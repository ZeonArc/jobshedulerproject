# Entity Relationship (ER) Diagram

This diagram visualizes the relational schema designed in Prisma for the Distributed Job Scheduler.

```mermaid
erDiagram
    USER {
        string id PK
        string email UK
        string password
        datetime createdAt
    }
    
    PROJECT {
        string id PK
        string name
        string userId FK
        datetime createdAt
    }
    
    QUEUE {
        string id PK
        string name
        string projectId FK
        int concurrencyLimit
        boolean isPaused
        datetime createdAt
    }
    
    JOB {
        string id PK
        string queueId FK
        string status
        json payload
        int priority
        datetime scheduledAt
        string cronExpression
        int maxRetries
        int attempts
        string retryStrategy
        datetime createdAt
        datetime updatedAt
        string workerId FK "nullable"
    }
    
    JOB_LOG {
        string id PK
        string jobId FK
        string workerId
        string status
        datetime startedAt
        datetime completedAt
        string errorMessage
        json output
    }
    
    WORKER {
        string id PK
        string hostname
        string status
        datetime lastHeartbeatAt
    }

    %% Relationships
    USER ||--o{ PROJECT : "owns"
    PROJECT ||--o{ QUEUE : "contains"
    QUEUE ||--o{ JOB : "manages"
    JOB ||--o{ JOB_LOG : "generates"
    WORKER |o--o{ JOB : "claims (temporary)"
```

## Schema Normalization & Design Choices
- **Cascading Deletes**: `ON DELETE CASCADE` is implemented heavily. If a Project is deleted, its Queues, Jobs, and JobLogs are automatically scrubbed to prevent orphaned data.
- **Indexes**: A composite index exists on `Job (queueId, status, scheduledAt, priority Desc)`. This specifically optimizes the `SKIP LOCKED` polling query used by workers, making sure they can fetch top-priority, ready jobs in constant time `O(log N)` without scanning the entire table.
- **JobLog History**: Instead of creating a complex relational table just for retry history, the `JobLog` acts as an append-only ledger for every single execution attempt, making it extremely easy to build a timeline UI for a single job.
