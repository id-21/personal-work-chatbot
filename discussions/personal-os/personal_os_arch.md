# Personal OS — Database, API & AI Tools Architecture

---

## 1. Database Schema (PostgreSQL)

### Core Hierarchy Tables

```sql
-- The user's global model (one row per user)
CREATE TABLE user_model (
  id UUID PRIMARY KEY,
  name TEXT,
  raw_context JSONB,         -- free-form facts about the user
  resource_budget JSONB,     -- { time_per_week: 40, energy: "high mornings" }
  values TEXT[],             -- ["family", "financial independence", "craft"]
  updated_at TIMESTAMPTZ
);

-- Top-level domains / pursuits
CREATE TABLE pursuits (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES user_model(id),
  name TEXT,                 -- "Distribution", "Marketing", "Product Dev"
  vision TEXT,               -- What success looks like
  current_state TEXT,        -- Where things actually are
  constraints TEXT[],        -- ["limited budget", "no logistics partner"]
  opportunities TEXT[],      -- ["3PL market opening", "interior designer network"]
  display_order INT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- Mid-level: projects within a pursuit
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  pursuit_id UUID REFERENCES pursuits(id),
  name TEXT,
  description TEXT,
  status TEXT CHECK (status IN ('active', 'paused', 'completed', 'idea')),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- Leaf-level: tasks within a project
CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  title TEXT,
  detail TEXT,
  status TEXT CHECK (status IN ('open', 'in_progress', 'done', 'dismissed')),
  source TEXT CHECK (source IN ('user', 'ai_suggested')),  -- where it came from
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### Memory & Conversation Tables

```sql
-- Timestamped thought log per pursuit (the AI's memory)
CREATE TABLE pursuit_thoughts (
  id UUID PRIMARY KEY,
  pursuit_id UUID REFERENCES pursuits(id),
  author TEXT CHECK (author IN ('user', 'ai')),
  content TEXT,
  created_at TIMESTAMPTZ
);

-- Conversation threads (one per card session or home session)
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES user_model(id),
  scope TEXT CHECK (scope IN ('home', 'pursuit', 'project')),
  scope_id UUID,             -- NULL for home, pursuit_id or project_id otherwise
  messages JSONB[],          -- { role, content, timestamp }[]
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- Compressed summaries of past conversations (to avoid context bloat)
CREATE TABLE context_summaries (
  id UUID PRIMARY KEY,
  scope TEXT,
  scope_id UUID,
  summary TEXT,              -- AI-generated rolling summary
  covers_until TIMESTAMPTZ,  -- messages before this are summarised
  updated_at TIMESTAMPTZ
);
```

### Routing & Classification Tables

```sql
-- Log of AI routing decisions (for transparency + correction)
CREATE TABLE routing_log (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES user_model(id),
  raw_input TEXT,
  classified_pursuit_id UUID,
  classified_project_id UUID,
  action TEXT,               -- "created_task", "updated_task", "created_project"
  entity_id UUID,            -- what was created/updated
  user_confirmed BOOLEAN,    -- did user accept or override?
  override_to UUID,          -- if overridden, where did they move it?
  created_at TIMESTAMPTZ
);
```

---

## 2. API Design (REST + WebSocket)

### Context & Model Endpoints

```
GET  /api/user/model                    → full user model + pursuits summary
PUT  /api/user/model                    → update global context

GET  /api/pursuits                      → all pursuits with project/task counts
POST /api/pursuits                      → create new pursuit
PUT  /api/pursuits/:id                  → update pursuit (vision, state, constraints)

GET  /api/pursuits/:id/projects         → projects under a pursuit
POST /api/pursuits/:id/projects         → create project
PUT  /api/projects/:id                  → update project

GET  /api/projects/:id/tasks            → tasks under a project
POST /api/projects/:id/tasks            → create task
PUT  /api/tasks/:id                     → update task status/detail

GET  /api/pursuits/:id/thoughts         → thought log for a pursuit
GET  /api/pursuits/:id/summary          → compressed context summary
```

### Conversation Endpoints

```
POST /api/conversations                 → start new conversation (home or scoped)
GET  /api/conversations/:id             → get conversation history
POST /api/conversations/:id/messages    → send message → AI response + side effects

WS   /ws/conversations/:id             → real-time streaming responses
```

### Routing Endpoint (home mode)

```
POST /api/route
  Body: { message: "I think we should explore white-label partnerships..." }
  Response: {
    classified_pursuit: { id, name },
    classified_project: { id, name } | null,
    action: "created_task" | "updated_task" | "created_project",
    entity: { id, title },
    confidence: 0.92
  }
```

---

## 3. AI Model Tools (Claude Tool Use)

These are the tools Claude has access to. They map 1:1 to your API.

### Context Read Tools

```json
get_user_model()
→ Returns: { name, values, resource_budget, raw_context }
  Used: Always injected at conversation start.

get_all_pursuits()
→ Returns: [{ id, name, vision, current_state, constraints, opportunities }]
  Used: Home mode routing, cross-domain reasoning.

get_pursuit_detail(pursuit_id)
→ Returns: pursuit + its projects + open tasks + context_summary
  Used: When user opens a card (scoped mode).

get_project_detail(project_id)
→ Returns: project + tasks + recent thoughts
  Used: Deep-dive within a scoped conversation.
```

### Context Write Tools

```json
create_task(project_id, title, detail, source="ai_suggested")
→ Creates task, returns id.
  Used: When AI identifies an actionable item.

update_task(task_id, { status?, detail? })
→ Updates task.
  Used: When user says "that's done" or updates details.

create_project(pursuit_id, name, description)
→ Creates project under a pursuit.
  Used: When input doesn't match any existing project.

update_pursuit(pursuit_id, { current_state?, constraints?, opportunities? })
→ Updates pursuit model.
  Used: When user reveals new constraints or opportunities.

log_thought(pursuit_id, content, author="ai")
→ Appends to thought log.
  Used: After every meaningful exchange, AI logs a summary of what was said.
```

### Routing Tools (Home Mode Only)

```json
classify_input(raw_message)
→ Claude reasons over get_all_pursuits() output and returns:
  {
    pursuit_id: UUID,
    project_id: UUID | null,
    is_new_project: boolean,
    suggested_title: string,
    confidence: float
  }

route_and_create(classification, raw_message)
→ Executes the classification: creates task/project, logs routing decision.
  Used: The final step after classify_input confirms placement.
```

---

## 4. System Prompt Architecture

Three-layer injection depending on mode:

### Layer 1 — Always Present (Global)
```
You are a personal operating system for [Name].

USER MODEL:
- Values: [...]
- Resource budget: [...]
- Company: [Company context]

PURSUITS OVERVIEW:
[List of all pursuit names + one-line current state]

RULES:
- Never set or suggest priorities. The user decides those.
- When creating tasks, mark source as "ai_suggested".
- Always log a thought after substantive exchanges.
- Confirm routing with a chip, never a question.
```

### Layer 2 — Scoped Mode (injected when card is opened)
```
ACTIVE DOMAIN: Distribution
Vision: [...]
Current State: [...]
Constraints: [...]
Opportunities: [...]
Context Summary (last 30 days): [compressed summary]
Open Projects: [list with tasks]
```

### Layer 3 — Home Mode (injected instead of Layer 2)
```
MODE: Home / Unscoped
Your job is to:
1. Classify the user's input to the right pursuit and project.
2. Create or update the appropriate entity.
3. Confirm placement with a short chip message.
4. Do not have a full conversation. Route and confirm.
```

---

## 5. Technology Stack Recommendation

| Layer | Choice | Why |
|---|---|---|
| Database | PostgreSQL + pgvector | Relational for structure, vector for future semantic search |
| Backend | Next.js API routes or FastAPI | Fits your existing stack |
| AI | Claude (tool use) | Native tool calling, long context |
| Real-time | Supabase Realtime or Pusher | Card updates when tasks created |
| Auth | Supabase Auth | Simple, integrates with DB |
| Context storage | DB (not vector yet) | Start simple; add embeddings when tasks > 200 |

---

## 6. Data Flow Summary

```
User types in Home Mode
    → POST /api/route
    → AI calls get_all_pursuits()
    → AI calls classify_input()
    → AI calls create_task() or create_project()
    → AI calls log_thought()
    → Response: routing chip shown on UI
    → Card badge count updates via Realtime

User opens a card
    → GET /api/pursuits/:id (full detail injected as Layer 2)
    → POST /api/conversations (scoped conversation starts)
    → User talks → AI reasons with full domain context
    → AI calls create_task / update_pursuit as needed
    → Thought logged after session
```