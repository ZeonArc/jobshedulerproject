"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workersRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
exports.workersRouter = (0, express_1.Router)();
exports.workersRouter.get('/', async (req, res) => {
    try {
        const workers = await db_1.prisma.worker.findMany({
            orderBy: { lastHeartbeatAt: 'desc' }
        });
        res.json(workers);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
