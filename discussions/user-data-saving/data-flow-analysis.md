# Data Flow Analysis: How Chat Information Is Stored & Retrieved

Verified against actual source code (not architectural intent). Cross-referenced with CLAUDE.md files.
Last updated: March 2026.

---

## HOW READS WORK: What the AI Sees Before Responding

### Home Chat — `app/(chat)/api/os/home-chat/route.ts`

Fires on every user message. Two DB reads execute in parallel at **lines 44–47**:

**1. `getPursuitsWithProjects({ userId })`** — `lib/db/queries.ts:1181–1196`
- Tables: `pursuits` → `projects`
- Columns fetched: `pursuit.id, name, currentState, vision, displayOrder, createdAt` + `project.id, name, status, createdAt`
- What's injected into the AI prompt (lines 56–68): `{ id, name, currentState, projects: [{ id, name, status }] }`
- **NOT injected:** `vision`, `constraints`, `opportunities` — home-mode AI is strategically blind to pursuit strategy

**2. `getUserModelByUserId({ userId })`** — `lib/db/queries.ts:622–636`
- Table: `user_model`
- Columns fetched: all
- What's injected into the AI prompt: `name` only
- **NOT injected:** `values`, `resourceBudget`, `rawContext` — collected but never fed to any AI prompt

**Mode decision at lines 51–53:**
- `pursuits.length === 0` → `homeChatOnboardingPrompt()` (`lib/ai/prompts.ts:203–218`) + 2 tools
- `pursuits.length > 0` → `homeChatRoutingPrompt()` (`lib/ai/prompts.ts` routing section) + 4 tools

---

### Scoped Chat — `app/(chat)/api/os/chat/route.ts`

Fires on every user message in a pursuit view. One composite read at **line 33**:

**`getPursuitWithDetail({ id: pursuitId })`** — `lib/db/queries.ts:1198–1229`
- Tables joined: `pursuits` + `projects` + `tasks` (per project via `Promise.all` at lines 1204–1209) + `pursuit_thoughts` (last **20**, line 1214) + `context_summaries` (latest 1 by `updatedAt DESC`)
- Transformed into `PursuitContext` object at lines 38–59
- Serialized into system prompt via `scopedPrompt(pursuitContext)` at line 69 (`lib/ai/prompts.ts:56–95`)
- **NOT injected:** `task.detail`, `project.description`, `user.resourceBudget`

**After response — async summary regeneration at lines 92–101:**
- Runs via Next.js `after()` — non-blocking, fires after response streams
- Calls `maybRegenerateSummary({ pursuitId, pursuitName })` — `lib/ai/summary.ts:18–33`
- Fetches `getPursuitThoughtsByPursuitId(pursuitId, limit: 100)` — `lib/db/queries.ts:1033–1053`
- Threshold: only regenerates if `thoughts.length >= 15`
- Sends thought log to Gemini → stores result via `upsertContextSummary()` — `lib/ai/summary.ts:84–89`

---

## HOW WRITES WORK: Every Table, Every Trigger

### TABLE: `user_model`
**Query:** `upsertUserModel()` — `lib/db/queries.ts` (upsert pattern, 1:1 per user)

| Trigger | Location | Data written | Source |
|---|---|---|---|
| AI `updateUserModel` tool call | `home-chat/route.ts:73–91` | `name`, `values`, `rawContext` | AI extracts from conversation |
| `PUT /api/os/user-model` | `user-model/route.ts:16–34` | `name`, `values`, `resourceBudget`, `rawContext` | User form data |

---

### TABLE: `pursuits`
**Queries:** `createPursuit()`, `updatePursuitById()`

| Trigger | Location | Data written | Source |
|---|---|---|---|
| AI `createPursuit` tool call (onboarding) | `home-chat/route.ts:97–118` | `name`, `vision`, `currentState` | AI-extracted from conversation |
| `POST /api/os/pursuits` | `pursuits/route.ts:16–40` | `name`, `vision`, `currentState`, `constraints`, `opportunities`, `displayOrder` | User form data |
| AI `updatePursuit` tool call | `create-os-tools.ts:143–172` | `currentState`, `vision`, `constraints`, `opportunities` (any subset) | AI-extracted from conversation |
| `PUT /api/os/pursuits/[id]` | `pursuits/[id]/route.ts:33–53` | Any subset of all fields | User form data |

---

### TABLE: `projects`
**Queries:** `createProject()`, `updateProjectById()`

| Trigger | Location | Data written | Source |
|---|---|---|---|
| AI `createProject` tool call (routing) | `home-chat/route.ts:156–168` | `pursuitId`, `name`, `description` | AI-generated from conversation |
| AI classification | `route/route.ts:63–70` | `pursuitId`, `newProjectName` | AI-generated routing schema |
| `POST /api/os/pursuits/[id]/projects` | `pursuits/[id]/projects/route.ts:34–63` | `name`, `description`, `status` | User form data |
| `PUT /api/os/projects/[id]` | `projects/[id]/route.ts:34–60` | `name`, `description`, `status` (any subset) | User form data |

---

### TABLE: `tasks`
**Queries:** `createTask()`, `updateTaskById()`

| Trigger | Location | `source` field | Data written | Data source |
|---|---|---|---|---|
| AI `createTask` tool (home routing) | `home-chat/route.ts:138–155` | always `'ai_suggested'` | `projectId`, `title` | AI-generated title from conversation |
| AI classification | `route/route.ts:71–79` | always `'ai_suggested'` | `projectId`, `title` | AI `routing.title` from schema |
| AI `createTask` tool (scoped chat) | `create-os-tools.ts:68–95` | always `'ai_suggested'` | `projectId`, `title`, `detail?` | AI-generated from conversation |
| AI `updateTask` tool (scoped chat) | `create-os-tools.ts:100–115` | — | `status?`, `detail?` | AI-decided from conversation |
| `POST /api/os/projects/[id]/tasks` | `projects/[id]/tasks/route.ts:39–64` | can be `'user'` | `title`, `detail`, `status`, `source` | User form data |
| `PUT /api/os/tasks/[id]` | `tasks/[id]/route.ts:11–43` | — | `title`, `detail`, `status` | User form data |

---

### TABLE: `pursuit_thoughts` — the AI memory mechanism
**Query:** `createPursuitThought()`

| Trigger | Location | Data written | Source |
|---|---|---|---|
| AI `logThought` tool call in scoped chat | `create-os-tools.ts:178–197` | `pursuitId`, `author='ai'`, `content` (max 2000 chars) | AI-written 1–3 sentence summary |

**Critical behavior:**
- `author` is hardcoded to `'ai'` in all current code paths — the `'user'` value in the schema is unused
- User messages themselves are **never stored** — only the AI's interpretation survives
- This tool call is **discretionary** — if the AI skips it (e.g., on short exchanges), the conversation leaves no trace
- Only called from scoped chat, never from home-chat

---

### TABLE: `context_summaries` — rolled-up long-term memory
**Query:** `upsertContextSummary()`

| Trigger | Location | Data written | Source |
|---|---|---|---|
| `after()` post-scoped-chat | `summary.ts:84–89` (called from `chat/route.ts:92–101`) | `scopeId`, `scope='pursuit'`, `summary`, `coversUntil` | Gemini-generated from 100 thoughts |
| `POST /api/os/summaries` | `summaries/route.ts` | Same | Same — manual trigger |

**Critical behavior:**
- Threshold: `thoughts.length >= 15` (`summary.ts:30`) — before this, `contextSummary` is empty in the scoped prompt
- `scope` is always `'pursuit'` — the `'project'` scope value in the schema is unused
- Runs after response via `after()` — never blocks the streaming response

---

### TABLE: `routing_log` — audit trail only
**Query:** `createRoutingLog()`

| Trigger | Location | Data written | Source |
|---|---|---|---|
| Every `/api/os/route` classification | `route/route.ts:82–89` | `userId`, `rawInput`, `classifiedPursuitId?`, `classifiedProjectId?`, `action`, `entityId?` | User's raw message + AI decision |

**Critical behavior:**
- **`rawInput` is the only place user message text is stored verbatim** in the OS
- Stored as fire-and-forget: `.catch(() => {})` at line 89 — failures are silently swallowed
- Never fed back into any AI prompt — analytics and transparency only
- `userConfirmed` field exists in schema but is never written by current code (no confirmation UI implemented)

---

## Key Findings: What the Code Actually Does

### 1. User messages are never stored (except `routing_log`)
The conversation is ephemeral. Only `routing_log.rawInput` stores verbatim user text, and only for home-mode. Scoped chat messages vanish unless the AI calls `logThought`.

### 2. The AI writes its own memory
`pursuit_thoughts` is populated entirely by the AI via the `logThought` tool. It decides what to remember and how to phrase it. If it skips the call (short exchanges, tool call budget exhausted), nothing is logged and the session leaves no lasting record.

### 3. OS routes don't persist conversation history
Unlike the boilerplate `/api/chat` (which saves full message arrays to `Message_v2`), the OS chat routes store nothing. End of session = conversation gone, unless `logThought` was called.

### 4. Home-mode AI is blind to pursuit strategy
At `home-chat/route.ts:56–68`, only `{ id, name, currentState, projects: [{ id, name, status }] }` is serialized into the prompt. `vision`, `constraints`, and `opportunities` are excluded — home-mode AI cannot see what success looks like or what the blockers are.

### 5. `resourceBudget` and `values` are dead fields
Written by `updateUserModel` (`home-chat/route.ts:73–91`), stored in `user_model`, but no prompt anywhere reads them. The AI never knows the user's time/energy constraints.

### 6. `task.detail` is effectively write-only from the system prompt
`scopedPrompt()` at `prompts.ts:56–95` only injects `{ id, title, status, source }` per task. The `detail` field is not shown. The AI can write detail when creating/updating tasks, but can only read it mid-conversation by calling `getProjectTasks` (`create-os-tools.ts:202–221`).

### 7. Summary threshold creates a cold-start gap
For the first 14 thought entries, `contextSummary` is empty. The scoped prompt falls back to raw thought log only (last 20 entries). After crossing 15, the async summary kicks in and condenses 100 thoughts for future sessions.

### 8. `userConfirmed` on routing decisions is never set
`routing_log` has a `userConfirmed` boolean column in the schema (`schema.ts:284`) but no code path writes to it. The confirmation chip UI exists in `components/os/routing-chip.tsx` but the feedback loop back to the DB is not implemented.

---

## Data Flow Diagram

```
USER TYPES → HOME CHAT (/api/os/home-chat)
  │
  ├─ DB READ (parallel):
  │    getPursuitsWithProjects()   → pursuits + projects table
  │    getUserModelByUserId()      → user_model table
  │
  ├─ MODE DECISION:
  │    pursuits.length === 0  → onboarding prompt (prompts.ts:203–218)
  │    pursuits.length > 0    → routing prompt
  │
  ├─ AI (Gemini 2.5 Flash Lite) with max 8 steps
  │
  └─ AI TOOL CALLS → DB WRITES:
       updateUserModel  → user_model (AI-extracted profile)
       createPursuit    → pursuits   (AI-extracted domain)
       createProject    → projects   (AI-extracted initiative)
       createTask       → tasks      (AI-extracted action, source='ai_suggested')
       [fire-and-forget] createRoutingLog → routing_log (raw message + decision)


USER TYPES → SCOPED CHAT (/api/os/chat)
  │
  ├─ DB READ (single composite):
  │    getPursuitWithDetail() →
  │      pursuits         (all fields)
  │      projects         (id, name, status)
  │      tasks per proj   (id, title, status, source — NOT detail)
  │      pursuit_thoughts (last 20)
  │      context_summaries (latest 1)
  │
  ├─ scopedPrompt() injects ALL of above as system prompt
  │
  ├─ AI (Gemini 2.5 Flash Lite) with max 10 steps + 7 tools
  │
  ├─ AI TOOL CALLS → DB WRITES:
  │    createTask      → tasks
  │    updateTask      → tasks
  │    createProject   → projects
  │    updatePursuit   → pursuits
  │    logThought      → pursuit_thoughts  ← only persistent memory
  │    [read tools]:
  │      getPursuitDetail  → re-reads pursuits+projects+tasks+thoughts+summary
  │      getProjectTasks   → reads tasks for one project
  │
  └─ AFTER RESPONSE (async, non-blocking via after()):
       getPursuitThoughts(limit=100) → pursuit_thoughts
       if thoughts >= 15:
         Gemini generates 3-6 sentence summary
         upsertContextSummary() → context_summaries
```

---

## Source File Reference

| File | Relevant Lines | Role |
|---|---|---|
| `app/(chat)/api/os/home-chat/route.ts` | 44–47 (reads), 51–69 (prompt), 73–91 (updateUserModel tool), 97–118 (createPursuit tool), 138–155 (createTask tool), 156–168 (createProject tool) | Home mode AI endpoint |
| `app/(chat)/api/os/chat/route.ts` | 33 (read), 38–59 (context build), 69 (prompt), 92–101 (after block) | Scoped mode AI endpoint |
| `app/(chat)/api/os/route/route.ts` | 63–70 (createProject), 71–79 (createTask), 82–89 (createRoutingLog) | Standalone routing classifier |
| `lib/ai/tools/os/create-os-tools.ts` | 68–95 (createTask), 100–115 (updateTask), 120–138 (createProject), 143–172 (updatePursuit), 178–197 (logThought), 202–221 (getProjectTasks) | Scoped AI tool factory |
| `lib/ai/prompts.ts` | 203–218 (onboarding), routing section (home routing), 56–95 (scoped) | System prompts |
| `lib/ai/summary.ts` | 18–33 (maybRegenerateSummary), 84–89 (upsertContextSummary call) | Context summary regeneration |
| `lib/db/queries.ts` | 622–636 (getUserModelByUserId), 1033–1053 (getPursuitThoughtsByPursuitId), 1181–1196 (getPursuitsWithProjects), 1198–1229 (getPursuitWithDetail) | All DB query functions |
| `lib/db/schema.ts` | 175–191 (user_model), 193–208 (pursuits), 210–226 (projects), 228–247 (tasks), 249–259 (pursuit_thoughts), 261–270 (context_summaries), 272–288 (routing_log) | Table definitions |
