<div align="center">

# ⚡ JobSheduler

**A distributed, real-time, database-backed job scheduling system.**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue?logo=postgresql)](https://www.postgresql.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-Realtime-black?logo=socket.io)](https://socket.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?logo=typescript)](https://www.typescriptlang.org/)

[View Live Demo](https://jobshedulerproject.vercel.app/) • [API Documentation](#-api-documentation) • [Architecture](#-system-architecture)

</div>

---

## 📸 Screenshots

*(Replace the image paths below with actual screenshots of your application)*

| Dashboard Overview | Workflow Graph (DAGs) |
| :---: | :---: |
| <img src="https://via.placeholder.com/600x350/111827/FFFFFF?text=Dashboard+Overview" width="100%" /> | <img src="https://via.placeholder.com/600x350/111827/FFFFFF?text=React+Flow+DAG+Graph" width="100%" /> |
| **Real-time Queue Management & Live Progress Bars** | **Interactive DAG Visualization for Job Dependencies** |

---

## ✨ Features

JobSheduler is a highly resilient background task processor designed to scale without needing Redis. It uses PostgreSQL's native locking mechanisms to distribute workloads safely across multiple workers.

### 🎯 Core Capabilities
- **Distributed Workers:** Scale infinitely. Workers use `FOR UPDATE SKIP LOCKED` to safely claim jobs without race conditions.
- **Real-Time UI:** Built with **Socket.IO**; the dashboard reflects job statuses, worker heartbeats, and queue metrics instantly.
- **Project Isolation:** Multi-tenant design where Queues and Jobs are sandboxed per project.

### 🚀 Advanced Features
- **Workflow Dependencies (DAGs):** Jobs can wait for parent jobs to complete before executing. Beautifully visualized via **React Flow**.
- **Queue Rate Limiting:** Enforce strict execution limits (e.g., *60 jobs per minute*). Workers dynamically exclude rate-limited queues from their polling cycle.
- **Dead Letter Queue (DLQ):** Failed jobs exhaust their retries and move to a DLQ for manual inspection and requeuing.
- **Smart Retries:** Exponential and linear backoff algorithms for transient failure recovery.
- **Mock AI Failure Analysis:** Generates deterministic root-cause summaries for failed jobs directly in the UI.

---

## 🏗️ System Architecture

### 1. High-Level Flow
We utilize an **Adaptive Long-Polling** architecture. The Node.js Web API also houses the worker loop, allowing for a simplified, mono-service deployment.

```mermaid
graph TD
    Client[Next.js Dashboard] -->|HTTP REST| API(Node.js / Express API)
    Client <-->|Socket.io Live Events| API
    
    API -->|Prisma ORM| DB[(PostgreSQL)]
    
    Worker1[Worker Instance 1] <-->|SKIP LOCKED Polling| DB
    Worker2[Worker Instance 2] <-->|SKIP LOCKED Polling| DB
    
    Worker1 -->|Execute HTTP Webhooks| ExternalAPI(External Services)
    Worker2 -->|Execute HTTP Webhooks| ExternalAPI
```

### 2. Database Concurrency (`SKIP LOCKED`)
Instead of Redis, JobSheduler relies entirely on Postgres for state management. When a worker polls for jobs, it executes:
```sql
SELECT * FROM "Job" WHERE status = 'queued' 
ORDER BY priority DESC LIMIT 5 
FOR UPDATE SKIP LOCKED;
```
This guarantees **zero double-executions** even if 100 workers poll the exact same millisecond.

### 3. Entity Relationship (ER) Diagram
```mermaid
erDiagram
    Project ||--o{ Queue : contains
    Queue ||--o{ Job : schedules
    Worker ||--o{ Job : processes
    Job ||--o{ Job : depends_on

    Queue {
        String id PK
        Int concurrencyLimit
        Int rateLimit
        Boolean isPaused
    }
    Job {
        String id PK
        String status "queued, running, completed, dead_letter"
        Json payload
        Int priority
        Int attempts
    }
```

---

## 🛠️ Tech Stack

- **Frontend:** Next.js (App Router), React, TailwindCSS, Lucide Icons, React Flow (DAGs).
- **Backend:** Node.js, Express, Socket.IO, Prisma ORM, Zod (Validation), Jest (Testing).
- **Database:** PostgreSQL (Neon).
- **Hosting:** Vercel (Frontend), Render (Backend).

---

## 💻 Local Development Setup

### Prerequisites
- Node.js (v18+)
- PostgreSQL installed and running locally

### 1. Database Setup
Create a local Postgres database (e.g., `jobscheduler`).

### 2. Backend Setup
```bash
cd backend
npm install

# Configure Environment Variables
echo "DATABASE_URL=postgresql://user:pass@localhost:5432/jobscheduler" > .env
echo "PORT=4000" >> .env
echo "JWT_SECRET=supersecret123" >> .env

# Push schema and generate client
npx prisma db push
npx prisma generate

# Run the server (and worker)
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend
npm install

# Configure Environment Variables
echo "NEXT_PUBLIC_API_URL=http://localhost:4000/api" > .env
echo "NEXT_PUBLIC_SOCKET_URL=http://localhost:4000" >> .env

# Start the dashboard
npm run dev
```

---

## 🚀 Deployment Guide

### Backend (Render / Railway)
1. Set the root directory to `backend`.
2. **Build Command:** `npm install && npx prisma generate && npm run build`
3. **Start Command:** `npm start`
4. Add `DATABASE_URL` (e.g. Neon connection string) and `JWT_SECRET` in the host dashboard.

### Frontend (Vercel)
1. Set the root directory to `frontend`.
2. Add `NEXT_PUBLIC_API_URL` (e.g., `https://your-backend.onrender.com/api`) and `NEXT_PUBLIC_SOCKET_URL` (e.g., `https://your-backend.onrender.com`) to Vercel environment variables.
3. Deploy!

*(Note: Ensure your backend `index.ts` CORS array includes your Vercel URL!)*

---

## 📖 API Documentation

All routes (except `/auth`) require a JWT Bearer token in the `Authorization` header.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Login and receive JWT |
| `POST` | `/api/projects` | Create a new isolated project namespace |
| `POST` | `/api/queues` | Provision a queue (pass `rateLimit`, `concurrencyLimit`) |
| `POST` | `/api/queues/:id/pause`| Halt processing on a specific queue |
| `POST` | `/api/jobs` | Enqueue a job. Pass `dependsOn: [id]` for DAGs |
| `GET` | `/api/jobs?projectId=x`| Fetch jobs, statuses, and dependency links |
| `POST` | `/api/jobs/:id/retry` | Manually requeue a `dead_letter` job |
| `GET` | `/api/workers` | Fetch active cluster nodes and heartbeats |

---

<div align="center">
  <i>Engineered for scale, concurrency, and reliability.</i>
</div>
