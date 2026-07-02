import { Router } from 'express';
import { prisma } from '../db';
import { z } from 'zod';

export const jobsRouter = Router();

const jobSchema = z.object({
  queueId: z.string(),
  payload: z.any(),
  priority: z.number().int().default(0),
  scheduledAt: z.string().optional(),
  cronExpression: z.string().optional(),
  maxRetries: z.number().int().default(3),
  retryStrategy: z.enum(['fixed', 'exponential', 'linear']).default('exponential'),
  dependsOn: z.array(z.string()).optional()
});

jobsRouter.post('/', async (req, res) => {
  try {
    const p = jobSchema.parse(req.body);
    
    let initialStatus = 'queued';
    if (p.dependsOn && p.dependsOn.length > 0) {
      // Check if all dependencies are completed
      const dependencies = await prisma.job.findMany({
        where: { id: { in: p.dependsOn } },
        select: { id: true, status: true }
      });
      
      const allCompleted = dependencies.every(d => d.status === 'completed');
      if (!allCompleted) {
        initialStatus = 'waiting';
      }
    }

    const job = await prisma.job.create({
      data: {
        queueId: p.queueId,
        payload: p.payload,
        priority: p.priority,
        scheduledAt: p.scheduledAt ? new Date(p.scheduledAt) : new Date(),
        cronExpression: p.cronExpression,
        maxRetries: p.maxRetries,
        retryStrategy: p.retryStrategy,
        status: initialStatus,
        ...(p.dependsOn && p.dependsOn.length > 0 ? {
          dependencies: {
            connect: p.dependsOn.map(id => ({ id }))
          }
        } : {})
      }
    });
    res.json(job);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

jobsRouter.post('/batch', async (req, res) => {
  try {
    const parsedJobs = z.array(jobSchema).parse(req.body);
    const jobs = await prisma.job.createMany({
      data: parsedJobs.map(p => ({
        queueId: p.queueId,
        payload: p.payload,
        priority: p.priority,
        scheduledAt: p.scheduledAt ? new Date(p.scheduledAt) : new Date(),
        cronExpression: p.cronExpression,
        maxRetries: p.maxRetries,
        retryStrategy: p.retryStrategy,
        status: 'queued'
      }))
    });
    res.json({ count: jobs.count });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

jobsRouter.get('/', async (req, res) => {
  const { queueId, status, limit = 50, offset = 0 } = req.query;
  const filter: any = {};
  if (queueId) filter.queueId = String(queueId);
  if (status) filter.status = String(status);

  const jobs = await prisma.job.findMany({
    where: filter,
    orderBy: { createdAt: 'desc' },
    take: Number(limit),
    skip: Number(offset),
    include: {
      dependencies: { select: { id: true } }
    }
  });
  res.json(jobs);
});

jobsRouter.post('/:id/retry', async (req, res) => {
  try {
    const job = await prisma.job.update({
      where: { id: req.params.id },
      data: { status: 'queued', attempts: 0, scheduledAt: new Date(), workerId: null }
    });
    res.json(job);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

jobsRouter.post('/:id/analyze', async (req, res) => {
  try {
    const logs = await prisma.jobLog.findMany({
      where: { jobId: req.params.id },
      orderBy: { startedAt: 'desc' },
      take: 1
    });

    if (logs.length === 0 || !logs[0].errorMessage) {
      return res.json({ summary: "No explicit error message was found in the logs for this job." });
    }

    const err = logs[0].errorMessage.toLowerCase();
    let summary = "The job failed due to an unknown error.";

    if (err.includes('fetch') || err.includes('network') || err.includes('failed to parse')) {
      summary = "AI Analysis: The job failed because the target webhook URL was unreachable or returned an invalid response. Verify that the destination server is online and accepting connections.";
    } else if (err.includes('timeout')) {
      summary = "AI Analysis: The job execution timed out. The webhook server took too long to respond.";
    } else if (err.includes('status 4') || err.includes('status 5')) {
      summary = "AI Analysis: The destination webhook responded with an HTTP error code indicating the request was rejected or the server crashed.";
    } else if (err.includes('simulated')) {
      summary = "AI Analysis: This was a simulated random failure injected by the worker for testing retry mechanisms.";
    }

    // Simulate AI generation delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    res.json({ summary });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
