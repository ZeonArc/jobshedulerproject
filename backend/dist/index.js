"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const socket_1 = require("./socket");
const worker_1 = require("./worker");
const auth_1 = require("./auth");
const env_1 = require("./config/env");
const projects_1 = require("./routes/projects");
const queues_1 = require("./routes/queues");
const jobs_1 = require("./routes/jobs");
const workers_1 = require("./routes/workers");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
(0, socket_1.initSocket)(server);
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// --- ROUTES ---
app.use('/api/auth', auth_1.authRouter);
app.use('/api/projects', auth_1.authMiddleware, projects_1.projectsRouter);
app.use('/api/queues', auth_1.authMiddleware, queues_1.queuesRouter);
app.use('/api/jobs', auth_1.authMiddleware, jobs_1.jobsRouter);
app.use('/api/workers', auth_1.authMiddleware, workers_1.workersRouter);
// Start Server & Worker
if (require.main === module) {
    server.listen(env_1.config.PORT, () => {
        console.log(`🚀 API & WebSocket Server running on port ${env_1.config.PORT}`);
        (0, worker_1.startWorker)().catch(console.error);
    });
}
exports.default = app;
