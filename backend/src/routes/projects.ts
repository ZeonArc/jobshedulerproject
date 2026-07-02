import { Router } from 'express';
import { prisma } from '../db';
import { z } from 'zod';

export const projectsRouter = Router();

const projectSchema = z.object({
  name: z.string().min(1),
  userId: z.string().optional()
});

projectsRouter.post('/', async (req: any, res: any) => {
  try {
    const { name } = projectSchema.parse(req.body);
    const userId = req.user.id; // from authMiddleware
    const project = await prisma.project.create({ data: { name, userId } });
    res.json(project);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

projectsRouter.get('/', async (req: any, res: any) => {
  const userId = req.user.id;
  const projects = await prisma.project.findMany({ 
    where: { userId },
    include: { queues: true }
  });
  res.json(projects);
});
