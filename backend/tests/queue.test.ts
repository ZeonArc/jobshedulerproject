import request from 'supertest';
import app from '../src/index';
import { prisma } from '../src/db';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/env';

describe('JobScheduler API', () => {
  let projectId: string;
  let queueId: string;
  let token: string;

  beforeAll(async () => {
    // Setup test data
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: { email: 'test@example.com', password: 'hash' }
      });
    }
    
    token = jwt.sign({ id: user.id, email: user.email }, config.JWT_SECRET, { expiresIn: '1h' });

    const project = await prisma.project.create({
      data: { name: 'Test Project', userId: user.id }
    });
    projectId = project.id;

    const queue = await prisma.queue.create({
      data: { name: 'Test Queue', projectId, concurrencyLimit: 5 }
    });
    queueId = queue.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.jobLog.deleteMany({});
    await prisma.job.deleteMany({});
    await prisma.queue.deleteMany({});
    await prisma.project.deleteMany({});
  });

  it('should enqueue a new job successfully', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        queueId,
        payload: { task: 'hello' },
        priority: 1
      });

    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('queued');
  });

  it('should fetch jobs', async () => {
    const res = await request(app)
      .get('/api/jobs')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBeTruthy();
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('should pause and resume a queue', async () => {
    // Pause
    let res = await request(app)
      .post(`/api/queues/${queueId}/pause`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.isPaused).toBe(true);

    // Resume
    res = await request(app)
      .post(`/api/queues/${queueId}/resume`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.isPaused).toBe(false);
  });

  it('should accept a batch of jobs', async () => {
    const res = await request(app)
      .post('/api/jobs/batch')
      .set('Authorization', `Bearer ${token}`)
      .send([
        { queueId, payload: { n: 1 } },
        { queueId, payload: { n: 2 } }
      ]);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
  });

  it('should fetch queue stats', async () => {
    const res = await request(app)
      .get(`/api/queues/${queueId}/stats`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.queued).toBeGreaterThan(0);
  });
});
