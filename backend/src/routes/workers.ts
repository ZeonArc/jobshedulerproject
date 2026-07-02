import { Router } from 'express';
import { prisma } from '../db';

export const workersRouter = Router();

workersRouter.get('/', async (req, res) => {
  try {
    const workers = await prisma.worker.findMany({
      orderBy: { lastHeartbeatAt: 'desc' }
    });
    res.json(workers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
