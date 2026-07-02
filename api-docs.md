# REST API Documentation

Base URL: `http://localhost:4000/api`

## Authentication

All endpoints (except auth) require a JWT token in the `Authorization` header.
`Authorization: Bearer <token>`

### `POST /auth/register`
Creates a new user.
**Body:** `{ "email": "a@b.com", "password": "123" }`
**Response:** `200 OK` `{ "token": "jwt...", "user": {...} }`

### `POST /auth/login`
Authenticates a user.
**Body:** `{ "email": "a@b.com", "password": "123" }`
**Response:** `200 OK` `{ "token": "jwt...", "user": {...} }`

---

## Queues

### `POST /queues`
Creates a new queue.
**Body:** `{ "name": "Email Queue", "projectId": "uuid", "concurrencyLimit": 10 }`

### `POST /queues/:id/pause`
Pauses a queue, preventing workers from claiming jobs from it.

### `POST /queues/:id/resume`
Resumes a paused queue.

### `GET /queues/:id/stats`
Retrieves aggregated statistics for the queue.
**Response:** `{ "completed": 45, "failed": 2, "queued": 10 }`

---

## Jobs

### `POST /jobs`
Enqueues a new job.
**Body:**
```json
{
  "queueId": "uuid",
  "payload": { "url": "https://api.example.com", "method": "POST" },
  "priority": 10,
  "scheduledAt": "2024-01-01T12:00:00Z",
  "cronExpression": "0 * * * *", 
  "retryStrategy": "exponential" 
}
```
*(Note: `scheduledAt` and `cronExpression` are optional).*

### `POST /jobs/batch`
Enqueues multiple jobs in a single database transaction for high throughput.
**Body:** `[ { job1 }, { job2 } ]`

### `GET /jobs`
Fetches a paginated list of jobs.
**Query Parameters:**
- `queueId` (optional)
- `status` (optional)
- `limit` (default: 50)
- `offset` (default: 0)

### `POST /jobs/:id/retry`
Manually forces a failed or dead_letter job back into the `queued` state for immediate processing.

---

## Workers

### `GET /workers`
Lists all worker nodes and their last heartbeat timestamp. Useful for cluster monitoring.
