import { Router } from 'express';
import { prisma } from '../db';
import { z } from 'zod';

export const queuesRouter = Router();

const queueSchema = z.object({
  name: z.string().min(1),
  projectId: z.string(),
  concurrencyLimit: z.number().int().min(1).default(10),
  rateLimit: z.number().int().min(1).optional()
});

queuesRouter.post('/', async (req, res) => {
  try {
    const { name, projectId, concurrencyLimit, rateLimit } = queueSchema.parse(req.body);
    const queue = await prisma.queue.create({ data: { name, projectId, concurrencyLimit, rateLimit } });
    res.json(queue);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

queuesRouter.post('/:id/pause', async (req, res) => {
  try {
    const queue = await prisma.queue.update({ where: { id: req.params.id }, data: { isPaused: true } });
    res.json(queue);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

queuesRouter.post('/:id/resume', async (req, res) => {
  try {
    const queue = await prisma.queue.update({ where: { id: req.params.id }, data: { isPaused: false } });
    res.json(queue);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

queuesRouter.get('/:id/stats', async (req, res) => {
  try {
    const stats = await prisma.job.groupBy({
      by: ['status'],
      where: { queueId: req.params.id },
      _count: { status: true }
    });
    const formattedStats = stats.reduce((acc, curr) => {
      acc[curr.status] = curr._count.status;
      return acc;
    }, {} as Record<string, number>);
    res.json(formattedStats);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
