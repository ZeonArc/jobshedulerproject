"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWorker = startWorker;
const db_1 = require("./db");
const client_1 = require("@prisma/client");
const parser = require('cron-parser');
const socket_1 = require("./socket");
const WORKER_ID = `worker-${Math.random().toString(36).substring(7)}`;
let isShuttingDown = false;
// Simple wait helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
async function processJob(job) {
    console.log(`[Worker ${WORKER_ID}] Processing job ${job.id} (Queue: ${job.queueId})`);
    if (job.payload && job.payload.url) {
        // Simulate progress for visual flair
        for (let p = 25; p <= 100; p += 25) {
            await db_1.prisma.job.update({ where: { id: job.id }, data: { progress: p } });
            try {
                (0, socket_1.getIO)().emit('jobProgress', { id: job.id, progress: p });
            }
            catch (e) { }
            if (p < 100)
                await sleep(500); // 1.5 seconds total delay for animation
        }
        // Real HTTP webhook execution
        const method = job.payload.method || 'POST';
        const body = job.payload.body ? JSON.stringify(job.payload.body) : undefined;
        const res = await fetch(job.payload.url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body
        });
        if (!res.ok) {
            throw new Error(`Webhook failed with status ${res.status}`);
        }
        const text = await res.text();
        return { success: true, response: text.substring(0, 500) };
    }
    else {
        // Fallback simulated work
        await sleep(500);
        if (Math.random() < 0.1)
            throw new Error('Simulated random failure');
        return { success: true, executedAt: new Date() };
    }
}
async function sweepZombieJobs() {
    // Find jobs stuck in 'running' by a worker that hasn't sent a heartbeat in > 60 seconds
    const staleThreshold = new Date(Date.now() - 60000);
    const zombieJobs = await db_1.prisma.$queryRaw `
    UPDATE "Job"
    SET status = 'queued', "updatedAt" = NOW()
    WHERE status = 'running' 
      AND "workerId" IN (
        SELECT id FROM "Worker" WHERE "lastHeartbeatAt" < ${staleThreshold}
      )
    RETURNING id;
  `;
    if (zombieJobs.length > 0) {
        console.log(`[Sweeper] Recovered ${zombieJobs.length} zombie jobs.`);
    }
    // Log Auto-Pruning: Delete JobLogs older than 7 days to maintain DB performance
    const retentionThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    try {
        const deletedLogs = await db_1.prisma.jobLog.deleteMany({
            where: { startedAt: { lt: retentionThreshold } }
        });
        if (deletedLogs.count > 0) {
            console.log(`[Sweeper] Pruned ${deletedLogs.count} stale JobLogs.`);
        }
    }
    catch (err) {
        console.error('[Sweeper] Failed to prune logs:', err);
    }
}
async function startWorker() {
    console.log(`[Worker] Started worker ${WORKER_ID}`);
    // Heartbeat loop
    const heartbeatInterval = setInterval(async () => {
        await db_1.prisma.worker.upsert({
            where: { id: WORKER_ID },
            update: { lastHeartbeatAt: new Date(), status: 'active' },
            create: { id: WORKER_ID, hostname: process.env.HOSTNAME || 'localhost' }
        });
    }, 10000);
    // Sweeper loop
    const sweeperInterval = setInterval(sweepZombieJobs, 30000);
    // Graceful Shutdown Hooks
    const shutdown = async () => {
        console.log(`\n[Worker ${WORKER_ID}] Received shutdown signal. Stopping polling...`);
        isShuttingDown = true;
        clearInterval(heartbeatInterval);
        clearInterval(sweeperInterval);
        await db_1.prisma.worker.update({
            where: { id: WORKER_ID },
            data: { status: 'offline' }
        });
        console.log(`[Worker ${WORKER_ID}] Offline. Exiting gracefully.`);
        process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    let consecutiveEmptyPolls = 0;
    const BASE_POLL_DELAY = 2000;
    const MAX_POLL_DELAY = 15000;
    // Polling loop
    while (!isShuttingDown) {
        try {
            // 0. Identify rate-limited queues to exclude
            const oneMinuteAgo = new Date(Date.now() - 60000);
            const queueCounts = await db_1.prisma.job.groupBy({
                by: ['queueId'],
                where: {
                    status: { in: ['completed', 'failed', 'dead_letter'] },
                    updatedAt: { gte: oneMinuteAgo }
                },
                _count: { id: true }
            });
            const rateLimitedQueueIds = [];
            const queuesWithLimits = await db_1.prisma.queue.findMany({
                where: { rateLimit: { not: null } }
            });
            for (const q of queuesWithLimits) {
                const countData = queueCounts.find(qc => qc.queueId === q.id);
                if (countData && countData._count.id >= q.rateLimit) {
                    rateLimitedQueueIds.push(q.id);
                }
            }
            const excludeSql = rateLimitedQueueIds.length > 0
                ? client_1.Prisma.sql `AND j."queueId" NOT IN (${client_1.Prisma.join(rateLimitedQueueIds)})`
                : client_1.Prisma.sql ``;
            // 1. Atomically claim a batch of jobs (up to 5 for concurrent processing)
            // We skip jobs from paused queues and rate-limited queues
            const claimedJobs = await db_1.prisma.$queryRaw `
        UPDATE "Job"
        SET status = 'claimed', "updatedAt" = NOW(), "workerId" = ${WORKER_ID}
        WHERE id IN (
          SELECT j.id FROM "Job" j
          JOIN "Queue" q ON j."queueId" = q.id
          WHERE j.status = 'queued' 
            AND j."scheduledAt" <= NOW()
            AND q."isPaused" = false
            ${excludeSql}
          ORDER BY j.priority DESC, j."createdAt" ASC
          LIMIT 5
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *;
      `;
            if (claimedJobs.length === 0) {
                // Adaptive Polling Backoff
                consecutiveEmptyPolls++;
                const backoffDelay = Math.min(BASE_POLL_DELAY * (1.5 ** consecutiveEmptyPolls), MAX_POLL_DELAY);
                await sleep(backoffDelay);
                continue;
            }
            // Reset backoff if we found jobs
            consecutiveEmptyPolls = 0;
            // Process batch concurrently
            await Promise.all(claimedJobs.map(async (job) => {
                // Update job to running and link worker
                await db_1.prisma.job.update({
                    where: { id: job.id },
                    data: { status: 'running', workerId: WORKER_ID }
                });
                try {
                    (0, socket_1.getIO)().emit('jobUpdated', { id: job.id, status: 'running' });
                }
                catch (e) { }
                // We also need to record workerId in JobLog later, so we link it temporarily if schema supported it
                // Since we don't have workerId in Job directly, we'll rely on the sweep threshold.
                let output;
                let errorMessage = null;
                let finalStatus = 'completed';
                try {
                    output = await processJob(job);
                }
                catch (err) {
                    console.error(`[Worker ${WORKER_ID}] Job ${job.id} failed:`, err.message);
                    errorMessage = err.message;
                    finalStatus = 'failed';
                }
                // Handle Retries and Dead Letter Queue
                if (finalStatus === 'failed') {
                    const attempts = job.attempts + 1;
                    if (attempts >= job.maxRetries) {
                        finalStatus = 'dead_letter';
                    }
                    else {
                        finalStatus = 'queued';
                        let nextRun = new Date();
                        if (job.retryStrategy === 'exponential') {
                            nextRun.setSeconds(nextRun.getSeconds() + Math.pow(2, attempts) * 5);
                        }
                        else if (job.retryStrategy === 'linear') {
                            nextRun.setSeconds(nextRun.getSeconds() + (attempts * 10)); // 10s, 20s, 30s
                        }
                        else {
                            nextRun.setSeconds(nextRun.getSeconds() + 10);
                        }
                        await db_1.prisma.job.update({
                            where: { id: job.id },
                            data: {
                                status: finalStatus,
                                attempts: attempts,
                                scheduledAt: nextRun,
                                workerId: null // Clear worker ID when re-queued
                            }
                        });
                    }
                }
                if (finalStatus === 'completed' && job.cronExpression) {
                    try {
                        const interval = parser.parseExpression(job.cronExpression);
                        const nextRun = interval.next().toDate();
                        await db_1.prisma.job.update({
                            where: { id: job.id },
                            data: {
                                status: 'queued',
                                scheduledAt: nextRun,
                                attempts: 0,
                                workerId: null
                            }
                        });
                        // Set finalStatus to something else so it skips the block below
                        finalStatus = 'rescheduled_cron';
                    }
                    catch (err) {
                        console.error(`[Worker] Invalid cron ${job.cronExpression} for job ${job.id}`);
                    }
                }
                if (finalStatus === 'completed' || finalStatus === 'dead_letter') {
                    await db_1.prisma.job.update({
                        where: { id: job.id },
                        data: {
                            status: finalStatus,
                            attempts: job.attempts + (finalStatus === 'dead_letter' ? 1 : 0)
                        }
                    });
                    // Workflow Dependencies Logic (DAGs)
                    if (finalStatus === 'completed') {
                        const dependents = await db_1.prisma.job.findMany({
                            where: { status: 'waiting', dependencies: { some: { id: job.id } } },
                            include: { dependencies: { select: { id: true, status: true } } }
                        });
                        for (const dep of dependents) {
                            const allCompleted = dep.dependencies.every(d => d.status === 'completed');
                            if (allCompleted) {
                                await db_1.prisma.job.update({ where: { id: dep.id }, data: { status: 'queued' } });
                                try {
                                    (0, socket_1.getIO)().emit('jobUpdated', { id: dep.id, status: 'queued' });
                                }
                                catch (e) { }
                            }
                        }
                    }
                    else if (finalStatus === 'dead_letter') {
                        // Cascade failure to downstream dependents recursively
                        const cascadeFail = async (parentJobId) => {
                            const dependents = await db_1.prisma.job.findMany({
                                where: { status: 'waiting', dependencies: { some: { id: parentJobId } } }
                            });
                            for (const dep of dependents) {
                                await db_1.prisma.job.update({ where: { id: dep.id }, data: { status: 'dead_letter' } });
                                await db_1.prisma.jobLog.create({
                                    data: {
                                        jobId: dep.id, workerId: WORKER_ID, status: 'dead_letter', startedAt: new Date(), completedAt: new Date(),
                                        errorMessage: 'Upstream dependency failed. Cascaded dead_letter status.'
                                    }
                                });
                                try {
                                    (0, socket_1.getIO)().emit('jobUpdated', { id: dep.id, status: 'dead_letter' });
                                }
                                catch (e) { }
                                await cascadeFail(dep.id); // Recursively fail downstream
                            }
                        };
                        await cascadeFail(job.id);
                    }
                }
                try {
                    (0, socket_1.getIO)().emit('jobUpdated', { id: job.id, status: finalStatus === 'queued' ? 'failed_retrying' : finalStatus });
                }
                catch (e) { }
                // Record Execution Log
                await db_1.prisma.jobLog.create({
                    data: {
                        jobId: job.id,
                        workerId: WORKER_ID,
                        status: finalStatus === 'queued' ? 'failed_retrying' : finalStatus,
                        startedAt: new Date(),
                        completedAt: new Date(),
                        errorMessage,
                        output: output || {}
                    }
                });
            }));
        }
        catch (err) {
            console.error('[Worker] Fatal error during polling:', err);
            await sleep(5000);
        }
    }
}
