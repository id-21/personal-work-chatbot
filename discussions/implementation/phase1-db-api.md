# Phase 1 — Database Foundation & REST API

**Status:** Complete
**Date:** 2026-03-02

---

## What Was Built

### Database Tables Added (`lib/db/schema.ts`)

7 new tables for the Personal OS data model:

| Table | Purpose |
|---|---|
| `user_model` | Global user context — name, values, resource budget, raw notes |
| `pursuits` | Top-level domains (e.g. "Distribution", "Marketing") |
| `projects` | Mid-level initiatives within a pursuit |
| `tasks` | Atomic action items within a project |
| `pursuit_thoughts` | Timestamped AI + user thought log per pursuit |
| `context_summaries` | AI-compressed rolling summaries per pursuit/project |
| `routing_log` | Record of every AI routing decision for transparency |

### Query Functions Added (`lib/db/queries.ts`)

~20 new typed functions following existing `ChatSDKError` / Drizzle ORM patterns:

- `getUserModelByUserId`, `upsertUserModel`
- `createPursuit`, `getPursuitsByUserId`, `getPursuitById`, `updatePursuitById`, `deletePursuitById`
- `createProject`, `getProjectsByPursuitId`, `getProjectById`, `updateProjectById`
- `createTask`, `getTasksByProjectId`, `getTaskById`, `updateTaskById`
- `createPursuitThought`, `getPursuitThoughtsByPursuitId`
- `upsertContextSummary`, `getContextSummaryByScopeId`
- `createRoutingLog`, `updateRoutingLogConfirmation`
- `getPursuitWithDetail` (rich read: pursuit + projects + tasks + summary + thoughts)

### Migration

Generated: `lib/db/migrations/0009_aspiring_toxin.sql`
Run: `pnpm run db:migrate` — applied successfully to Neon PostgreSQL

### REST API Routes

All routes under `/api/os/`, auth-protected via `auth()`:

| Route | Methods | Purpose |
|---|---|---|
| `/api/os/user-model` | GET, PUT | Read/update global user model |
| `/api/os/pursuits` | GET, POST | List all pursuits, create new |
| `/api/os/pursuits/[id]` | GET, PUT, DELETE | Get detail (with projects/tasks), update, delete |
| `/api/os/pursuits/[id]/projects` | GET, POST | List/create projects under a pursuit |
| `/api/os/projects/[id]` | GET, PUT | Get/update a project |
| `/api/os/projects/[id]/tasks` | GET, POST | List/create tasks under a project |
| `/api/os/tasks/[id]` | PUT | Update task status/detail |

All write operations verify ownership through the pursuit → user chain.

---

## Key Decisions

- **Reused existing patterns**: `ChatSDKError`, `auth()`, Drizzle ORM operators, typed params
- **Ownership verified via chain**: tasks → project → pursuit → userId for all mutations
- **`getPursuitWithDetail`** does a single rich load (pursuit + projects + tasks + summary + recent thoughts) — used by the GET `/api/os/pursuits/[id]` endpoint and later by AI tools
- **`integer` import added** to schema imports for `displayOrder` on pursuits

---

## How to Test (Phase 1)

Start the dev server: `pnpm run dev`

Use a REST client (e.g. Thunder Client / Postman / curl) while logged in:

```bash
# Create a pursuit
POST /api/os/pursuits
{ "name": "Distribution", "vision": "Nationwide logistics network", "currentState": "Testing in 3 cities" }

# List pursuits
GET /api/os/pursuits

# Create a project
POST /api/os/pursuits/{id}/projects
{ "name": "QR Code Tracking", "description": "Track deliveries via QR" }

# Add a task
POST /api/os/projects/{id}/tasks
{ "title": "Set up QR scanner API", "source": "user" }

# Update task status
PUT /api/os/tasks/{id}
{ "status": "in_progress" }
```
