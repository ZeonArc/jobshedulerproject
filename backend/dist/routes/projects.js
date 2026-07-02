"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectsRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
const zod_1 = require("zod");
exports.projectsRouter = (0, express_1.Router)();
const projectSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    userId: zod_1.z.string().optional()
});
exports.projectsRouter.post('/', async (req, res) => {
    try {
        const { name } = projectSchema.parse(req.body);
        const userId = req.user.id; // from authMiddleware
        const project = await db_1.prisma.project.create({ data: { name, userId } });
        res.json(project);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
exports.projectsRouter.get('/', async (req, res) => {
    const userId = req.user.id;
    const projects = await db_1.prisma.project.findMany({
        where: { userId },
        include: { queues: true }
    });
    res.json(projects);
});
