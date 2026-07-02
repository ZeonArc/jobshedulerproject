# Architecture Diagram

This diagram illustrates the high-level architecture of the Distributed Job Scheduler.

```mermaid
graph TD
    subgraph Frontend
        A[Next.js Dashboard]
    end

    subgraph Backend API Node
        B[Express API Server]
        C[Zod Validation Layer]
        D[JWT Auth Middleware]
    end

    subgraph Distributed Workers
        E[Worker Node 1]
        F[Worker Node 2]
        G[Worker Node N]
    end
    
    subgraph Database Layer
        H[(PostgreSQL)]
    end

    subgraph External Systems
        I[External Webhook 1]
        J[External Webhook 2]
    end

    %% Connections
    A -->|REST API Calls| B
    B --> C
    B --> D
    D -->|Prisma Queries| H
    
    E -->|Polls Queue SKIP LOCKED| H
    F -->|Polls Queue SKIP LOCKED| H
    G -->|Polls Queue SKIP LOCKED| H

    E -->|Executes Job Payload| I
    F -->|Executes Job Payload| J
```

## Description
- **Frontend**: A React/Next.js dashboard that visualizes queues, jobs, and workers. It polls the REST API for live updates.
- **Backend API Node**: An Express.js application responsible for receiving jobs, pausing queues, and serving metrics. It strictly validates payloads and uses JWT for auth.
- **Database Layer**: PostgreSQL acts as both the primary datastore and the message broker.
- **Distributed Workers**: Horizontally scalable Node.js processes that constantly poll the database. They achieve atomic locks using `SKIP LOCKED` to prevent duplicate processing.
