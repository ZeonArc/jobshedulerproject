# Distributed Job Scheduler

A production-ready, distributed job scheduling platform capable of reliably executing asynchronous background jobs across multiple workers. Built for an internship assignment evaluating backend engineering, database design, concurrency, and API design.

## Features
- **Atomic Job Claiming**: Guaranteed unique job execution across distributed workers using PostgreSQL `SKIP LOCKED`.
- **Concurrency & Batching**: Workers process batches of jobs concurrently using `Promise.all` bounds.
- **Robust Retries**: Fixed, Linear, and Exponential backoff strategies with Dead Letter Queue support.
- **Zombie Recovery**: Background sweeper automatically recovers jobs abandoned by crashed workers.
- **Graceful Shutdown**: Intercepts `SIGINT`/`SIGTERM` to allow running jobs to finish safely.
- **Recurring Jobs**: Full cron expression parsing and automatic rescheduling.
- **Full Stack Dashboard**: A Next.js interactive dashboard with JWT Authentication, real-time polling, and interactive management modals.

## Setup Instructions

### Prerequisites
- Node.js (v18+)
- Docker & Docker Compose (for PostgreSQL)

### 1. Start the Database
The project uses a containerized PostgreSQL database.
```bash
docker-compose up -d
```

### 2. Setup the Backend
Open a new terminal window:
```bash
cd backend
npm install
npx prisma db push
npx prisma generate
```

Start the backend API and Worker process:
```bash
npm run dev
```

### 3. Setup the Frontend
Open a new terminal window:
```bash
cd frontend
npm install
npm run dev
```

### 4. Access the Platform
1. Open your browser and navigate to: `http://localhost:3000`
2. **Login Credentials:**
   - **Email:** `intern@example.com`
   - **Password:** `password123`
3. Click "Initialize Queue" to create your first queue, then "Enqueue Job" to dispatch webhooks!

## Deliverables
Please review the generated markdown documents in the root directory for architectural insights:
- [Architecture Diagram](./architecture.md)
- [Entity Relationship (ER) Diagram](./er-diagram.md)
- [API Documentation](./api-docs.md)
- [Design Decisions & Trade-offs](./design-decisions.md)

## Automated Tests
To run the integration tests on the queue logic:
```bash
cd backend
npm test
```
