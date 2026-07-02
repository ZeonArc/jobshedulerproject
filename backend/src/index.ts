import express from 'express';
import cors from 'cors';
import http from 'http';
import { initSocket } from './socket';
import { startWorker } from './worker';
import { authRouter, authMiddleware } from './auth';
import { config } from './config/env';

import { projectsRouter } from './routes/projects';
import { queuesRouter } from './routes/queues';
import { jobsRouter } from './routes/jobs';
import { workersRouter } from './routes/workers';

const app = express();
const server = http.createServer(app);
initSocket(server);

app.use(cors());
app.use(express.json());

// --- ROUTES ---
app.use('/api/auth', authRouter);
app.use('/api/projects', authMiddleware, projectsRouter);
app.use('/api/queues', authMiddleware, queuesRouter);
app.use('/api/jobs', authMiddleware, jobsRouter);
app.use('/api/workers', authMiddleware, workersRouter);

// Start Server & Worker
if (require.main === module) {
  server.listen(config.PORT, () => {
    console.log(`🚀 API & WebSocket Server running on port ${config.PORT}`);
    startWorker().catch(console.error);
  });
}

export default app;
