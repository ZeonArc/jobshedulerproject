# Design Decisions & Trade-offs

When designing this Distributed Job Scheduler, several architectural choices were made to optimize for reliability, maintainability, and concurrency over raw throughput.

## 1. PostgreSQL as the Message Broker
**Alternative considered:** Redis (BullMQ) or RabbitMQ.
**Decision:** We chose to use PostgreSQL as the primary message broker.
**Trade-off:**
While Redis is strictly faster because it runs entirely in RAM (allowing for tens of thousands of jobs per second), it introduces infrastructure complexity. By using Postgres, we gain absolute **ACID transactional guarantees**. If a job is created in the same transaction as a business logic update, it is guaranteed to persist. Furthermore, by relying on Postgres, the entire stack requires only one database, drastically simplifying deployment and maintenance for the end user.

## 2. `FOR UPDATE SKIP LOCKED` for Concurrency
**Alternative considered:** Advisory Locks or pessimistic table locks.
**Decision:** We utilized Postgres's `SKIP LOCKED` feature to achieve atomic job claiming.
**Trade-off:**
When dozens of distributed workers poll the database simultaneously, they would normally block each other trying to read the same "top priority" job row. `SKIP LOCKED` tells the database to instantly skip any rows that are currently locked by another transaction. This mathematical guarantee allows horizontal scaling of workers (you can spin up 100 worker containers) and they will all seamlessly claim different jobs concurrently without causing database deadlocks.

## 3. Pull-Based Polling vs Push-Based WebSockets
**Alternative considered:** WebSockets / Server-Sent Events (Push)
**Decision:** Workers utilize a `setInterval` polling loop (Pull).
**Trade-off:**
A push-based architecture (where the server pushes jobs to workers) has lower latency, but it risks overwhelming workers if jobs are pushed faster than they can be processed. A pull-based architecture naturally introduces backpressure. A worker will only pull a batch of jobs if it has the concurrency capacity to handle it. This guarantees the worker nodes will never run out of memory or crash due to job saturation.

## 4. Job Log Ledger vs State Overwrites
**Alternative considered:** Keeping retry history in a JSON array on the `Job` model.
**Decision:** Creating a separate `JobLog` relational table.
**Trade-off:**
While it requires more storage space, using a separate `JobLog` table creates an immutable, append-only ledger of every single execution attempt. If a job fails 4 times before succeeding, the `JobLog` table will contain exactly 5 records for that job, detailing the exact worker ID, error message, and timestamps for each attempt. This provides enterprise-grade observability at the cost of slightly higher storage usage.

## 5. JWT Auth vs Third-Party SaaS (Clerk)
**Alternative considered:** Using Clerk or Auth0.
**Decision:** Building a self-contained JWT and bcrypt authentication middleware.
**Trade-off:**
Third-party providers offer incredible features (MFA, social login), but they break the "local-first" nature of an intern assignment. By writing a custom JWT implementation, the evaluator can run the entire platform on localhost without configuring external API keys or relying on SaaS uptime.
