# Plan: Personal OS — Full Implementation

## Context
Add a **Personal OS** at `/os` alongside the existing chat app (which stays at `/`). The OS is a structured memory and reasoning system with a 3-level hierarchy (Pursuits → Projects → Tasks), two modes (Home/routing and Scoped/conversation), and an AI that classifies, routes, and reasons — all backed by **Gemini 2.5 Flash Lite** for every AI call (routing, conversations, summary generation).

**User decisions:**
- OS lives at `/os` — existing chat at `/` is untouched
- Gemini for all AI calls (use `google/gemini-2.5-flash-lite` everywhere, including background summary generation)

Existing infrastructure to reuse: Auth (NextAuth), Chat/Message tables (extended for OS conversations), Drizzle ORM patterns, Vercel AI SDK streaming, sidebar layout shell.

---

## Phased Approach (Each phase = testable vertical slice)

### Phase 1 — Database Foundation + REST API skeleton
**What you can test:** CRUD operations via REST (create a pursuit, list projects, add tasks)

**DB: New tables in `lib/db/schema.ts`**
Extend existing `Chat` table: add `scope` (varchar enum `home|pursuit|project`, default `home`) and `scopeId` (uuid nullable) — so existing chat infra handles all conversations.

New tables:
- `user_model` — `{ id, userId → User.id (unique), name, values (JSON array), resourceBudget (JSON), rawContext (JSON), updatedAt }`
- `pursuits` — `{ id, userId → User.id, name, vision, currentState, constraints (JSON[]), opportunities (JSON[]), displayOrder (int), createdAt, updatedAt }`
- `projects` — `{ id, pursuitId → pursuits.id, name, description, status (active|paused|completed|idea), createdAt, updatedAt }`
- `tasks` — `{ id, projectId → projects.id, title, detail, status (open|in_progress|done|dismissed), source (user|ai_suggested), createdAt, updatedAt }`
- `pursuit_thoughts` — `{ id, pursuitId → pursuits.id, author (user|ai), content, createdAt }`
- `context_summaries` — `{ id, scopeId (uuid), scope (pursuit|project), summary, coversUntil (timestamp), updatedAt }`
- `routing_log` — `{ id, userId, rawInput, classifiedPursuitId, classifiedProjectId, action, entityId, userConfirmed (bool), createdAt }`

**Files to modify:**
- `lib/db/schema.ts` — add all tables above
- `lib/db/queries.ts` — add query functions for all new entities

**Run:** `npx drizzle-kit generate && npx drizzle-kit migrate`

**New API routes:**
- `app/(chat)/api/os/user-model/route.ts` — GET/PUT user model
- `app/(chat)/api/os/pursuits/route.ts` — GET all, POST create
- `app/(chat)/api/os/pursuits/[id]/route.ts` — GET detail, PUT update
- `app/(chat)/api/os/pursuits/[id]/projects/route.ts` — GET list, POST create
- `app/(chat)/api/os/projects/[id]/route.ts` — GET detail, PUT update
- `app/(chat)/api/os/projects/[id]/tasks/route.ts` — GET list, POST create
- `app/(chat)/api/os/tasks/[id]/route.ts` — PUT update (status, detail)

**Documentation:** Create `discussions/implementation/phase1-db-api.md`

---

### Phase 2 — Home Dashboard UI
**What you can test:** See the OS dashboard, create pursuits, view them as cards

**New route group:** `app/(os)/` with its own layout (existing chat at `/` is untouched)
- `app/(os)/layout.tsx` — layout with OS sidebar (pursuit list) using existing `SidebarProvider`/`Sidebar` components
- `app/(os)/page.tsx` — OS Home dashboard at `/os`

**New components:**
- `components/os/pursuit-card.tsx` — Card showing pursuit name, current state, project/task counts. Uses existing `Card` from `components/ui/card.tsx`
- `components/os/pursuit-grid.tsx` — Responsive grid of pursuit cards
- `components/os/create-pursuit-dialog.tsx` — Modal form to create pursuit. Uses existing `Dialog` from `components/ui/`
- `components/os/os-sidebar.tsx` — Sidebar with pursuit list + user model entry point. Replaces `AppSidebar` in OS layout
- `components/os/home-input.tsx` — Always-visible input at the bottom of the dashboard (placeholder for Phase 4 routing)

**Files to modify:**
- `app/(os)/layout.tsx` — add auth guard (no changes to existing chat pages)

**Documentation:** Create `discussions/implementation/phase2-dashboard.md`

---

### Phase 3 — Pursuit Detail + Projects + Tasks (Scoped Static View)
**What you can test:** Click into a pursuit, see projects and tasks, create/update them

**New pages:**
- `app/(os)/pursuits/[id]/page.tsx` — Pursuit detail page with:
  - Pursuit header (name, vision, current state)
  - Projects list with task counts
  - "New Project" button
  - Placeholder for scoped conversation (Phase 5)
- `app/(os)/pursuits/[id]/projects/[projectId]/page.tsx` — Project detail with task list

**New components:**
- `components/os/project-card.tsx` — Compact project card with task count badge
- `components/os/task-list.tsx` — List of tasks with status toggles
- `components/os/task-item.tsx` — Single task row (title, status chip, source badge)
- `components/os/create-project-dialog.tsx` — Form to add a project under a pursuit
- `components/os/create-task-dialog.tsx` — Form to add a task under a project

**Documentation:** Create `discussions/implementation/phase3-pursuit-detail.md`

---

### Phase 4 — AI Home Mode (Routing)
**What you can test:** Type "I need to review the marketing budget" in home input → see routing chip → task created under correct pursuit/project

**New AI tools (in `lib/ai/tools/`):**
- `get-all-pursuits.ts` — reads all user pursuits + projects (used by routing)
- `classify-and-route.ts` — factory tool (needs session): calls `getTasksByUserId`, reasons over pursuit list, creates task/project, logs to routing_log, returns `{ chipText, pursuitsId, projectId, entityId }`

**New API route:**
- `app/(chat)/api/os/route/route.ts` — POST: receives raw message, runs AI classify_and_route, returns routing result

**Modify `lib/ai/prompts.ts`:** Add `homePrompt` — home mode instructions (classify, route, confirm with chip, no full conversation)

**New components:**
- `components/os/routing-chip.tsx` — Small dismissable chip: "Added to Distribution → QR Tracking". Tappable to reassign.
- Update `components/os/home-input.tsx` — wire up to `/api/os/route`, show routing chip after submit

**Files to modify:**
- `lib/types.ts` — add `InferUITool` types for new tools
- `app/(chat)/api/chat/route.ts` — do NOT touch; routing uses its own endpoint

**Documentation:** Create `discussions/implementation/phase4-ai-routing.md`

---

### Phase 5 — Scoped Conversation + AI Write Tools
**What you can test:** Open a pursuit, have a conversation, watch the AI create tasks, update pursuit state, and log thoughts automatically

**New AI tools:**
- `get-pursuit-detail.ts` — fetches full pursuit + projects + tasks + context summary
- `get-project-detail.ts` — fetches project + tasks + recent thoughts
- `create-task.ts` (OS version) — creates task under a project, source = `ai_suggested`
- `update-task.ts` (OS version) — updates task status or detail
- `create-project.ts` — creates project under a pursuit
- `update-pursuit.ts` — updates vision/current_state/constraints/opportunities
- `log-thought.ts` — appends to `pursuit_thoughts` table after meaningful exchange

**3-layer system prompt architecture** in `lib/ai/prompts.ts`:
- Layer 1 (always): user model + pursuit summaries + behavioural rules (never set priorities)
- Layer 2a (home): classify and route instructions
- Layer 2b (scoped): full active pursuit detail + context summary

**Scoped chat integration:**
- Extend `app/(chat)/api/chat/route.ts` to accept optional `scopeId` and `scope` params
- On scoped requests: inject Layer 2b context into system prompt + enable OS write tools
- Chat is saved with `scope = 'pursuit'` and `scopeId = pursuitId` in Chat table
- After AI response: auto-call `log_thought` tool as a background `after()` task

**Modify pages:**
- `app/(os)/pursuits/[id]/page.tsx` — add chat panel (right side) using existing `Chat` component, passing `scopeId`

**Documentation:** Create `discussions/implementation/phase5-scoped-chat.md`

---

### Phase 6 — Memory & Context Summaries
**What you can test:** After 10+ messages in a pursuit, new conversations still have full context; old messages are compressed not truncated

**New API route:**
- `app/(chat)/api/os/summaries/route.ts` — POST: triggers summary regeneration for a scope

**Logic:**
- After each scoped conversation ends (or when `pursuit_thoughts` count > threshold): call `getArtifactModel()` (Haiku) to generate a rolling summary, save to `context_summaries`
- Next conversation load: inject summary instead of raw thought log if raw log is large
- Threshold: regenerate summary when raw thoughts exceed ~3000 tokens

**Files to modify:**
- `app/(chat)/api/chat/route.ts` — after() block: check thought count, trigger summary if needed
- `lib/ai/prompts.ts` — Layer 2b pulls from `context_summaries` if available, else raw thoughts

**Documentation:** Create `discussions/implementation/phase6-memory.md`

---

## Key Files Summary

| File | Role |
|------|------|
| `lib/db/schema.ts` | Add 7 new tables |
| `lib/db/queries.ts` | Add ~20 new query functions |
| `lib/ai/prompts.ts` | Add home/scoped prompt layers |
| `lib/ai/tools/` | Add 9 new AI tools |
| `lib/types.ts` | Add tool types to ChatTools |
| `app/(chat)/api/chat/route.ts` | Add scope-aware context injection |
| `app/(os)/` | All new OS pages and layout |
| `components/os/` | All new OS UI components |

## Existing Infrastructure to Reuse

- `components/ui/` — Card, Dialog, Button, Input, Badge, Sidebar (all reused as-is)
- `auth.ts` / `auth.config.ts` — no changes needed
- `lib/db/queries.ts` patterns — `ChatSDKError`, Drizzle operators, cursor pagination
- Chat/Message streaming — reused for scoped conversations
- `app/(chat)/api/chat/route.ts` — extended, not replaced
- Add `getOSModel()` in `lib/ai/providers.ts` returning `google/gemini-2.5-flash-lite` for all OS AI calls (routing, summaries, scoped chat defaults to this too)

## Discussion Notes Convention
Create `discussions/implementation/` subfolder. After completing each phase, write a markdown note:
- What was built
- Key decisions made
- How to test it
- Any deviations from this plan

## Verification (End-to-End)
1. Register/log in
2. Home dashboard shows empty state with "Create your first pursuit" prompt
3. Create pursuit "Distribution" with vision + current state
4. Type "I need to call our logistics partner about pricing" in home input → see routing chip → task created
5. Click into "Distribution" → see the task under correct project
6. Have a scoped conversation → watch AI create more tasks, update pursuit state
7. Check DB: `select * from pursuits; select * from tasks; select * from pursuit_thoughts;`
