"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queuesRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
const zod_1 = require("zod");
exports.queuesRouter = (0, express_1.Router)();
const queueSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    projectId: zod_1.z.string(),
    concurrencyLimit: zod_1.z.number().int().min(1).default(10),
    rateLimit: zod_1.z.number().int().min(1).optional()
});
exports.queuesRouter.post('/', async (req, res) => {
    try {
        const { name, projectId, concurrencyLimit, rateLimit } = queueSchema.parse(req.body);
        const queue = await db_1.prisma.queue.create({ data: { name, projectId, concurrencyLimit, rateLimit } });
        res.json(queue);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
exports.queuesRouter.post('/:id/pause', async (req, res) => {
    try {
        const queue = await db_1.prisma.queue.update({ where: { id: req.params.id }, data: { isPaused: true } });
        res.json(queue);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
exports.queuesRouter.post('/:id/resume', async (req, res) => {
    try {
        const queue = await db_1.prisma.queue.update({ where: { id: req.params.id }, data: { isPaused: false } });
        res.json(queue);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
exports.queuesRouter.get('/:id/stats', async (req, res) => {
    try {
        const stats = await db_1.prisma.job.groupBy({
            by: ['status'],
            where: { queueId: req.params.id },
            _count: { status: true }
        });
        const formattedStats = stats.reduce((acc, curr) => {
            acc[curr.status] = curr._count.status;
            return acc;
        }, {});
        res.json(formattedStats);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
