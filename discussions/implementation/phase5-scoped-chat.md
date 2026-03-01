# Phase 5 — Scoped Conversation + AI Write Tools

**Status:** Complete
**Date:** 2026-03-02

---

## What Was Built

Clicking into a pursuit now reveals a split-pane view: the project grid on the left and an AI chat panel on the right. The AI has full context of the pursuit (vision, state, constraints, opportunities, all projects and tasks) and can create tasks, update tasks/pursuit state, and log thoughts to build long-term memory.

---

## New Files

| File | Purpose |
|---|---|
| `lib/ai/tools/os/create-os-tools.ts` | Factory returning all OS AI tools scoped to a user + pursuit |
| `app/(chat)/api/os/chat/route.ts` | POST streaming endpoint — injects pursuit context + enables OS tools |
| `components/os/scoped-chat.tsx` | Client chat component using `useChat` + `DefaultChatTransport` |

## Modified Files

| File | Change |
|---|---|
| `lib/ai/prompts.ts` | Added `PursuitContext` type + `scopedPrompt()` function (Layer 2b) |
| `lib/ai/providers.ts` | Added `getOSModel()` (used here and in Phase 4) |
| `app/(os)/pursuits/[id]/page.tsx` | Split into two-column layout; added `ScopedChat` in right panel |

---

## OS AI Tools (in `create-os-tools.ts`)

| Tool | Description |
|---|---|
| `getPursuitDetail` | Refresh full pursuit context mid-conversation |
| `createTask(projectId, title, detail?)` | Create a task (always `source: ai_suggested`) |
| `updateTask(taskId, status?, detail?)` | Update task status or detail |
| `createProject(name, description?)` | Create a new project under the pursuit |
| `updatePursuit(currentState?, vision?, constraints?, opportunities?)` | Update pursuit model |
| `logThought(content)` | Append a 1-3 sentence summary to `pursuit_thoughts` |
| `getProjectTasks(projectId)` | Get task list before creating duplicates |

All tools are ownership-verified (projectId must belong to the current pursuith, userId must own the pursuit).

---

## How the Scoped Chat Works

```
User opens pursuit page → system prompt built from DB (Layer 2b):
  - pursuit name, vision, currentState, constraints, opportunities
  - all projects with task lists
  - contextSummary (from Phase 6, empty initially)

User sends message → POST /api/os/chat
  body: { messages: UIMessage[], pursuitId }

Route:
  1. Auth check
  2. getPursuitWithDetail → build system prompt
  3. createOSTools({ userId, pursuitId })
  4. streamText({ model: Gemini, system, messages, tools })
  5. AI can call write tools as side effects
  6. logThought is called by AI at end of meaningful exchanges

UI (ScopedChat):
  - useChat + DefaultChatTransport (prepareSendMessagesRequest adds pursuitId)
  - onFinish → router.refresh() to reflect created tasks/projects in project grid
  - Enter to send, Shift+Enter for newline
```

---

## Key Decisions

- **Separate endpoint** (`/api/os/chat`) rather than extending `/api/chat` — keeps the scoped chat clean without adding `scope`/`pursuitId` branching to the already-complex main chat route.
- **No message persistence** — the scoped chat is session-based. Long-term memory is built via `logThought` tool writing to `pursuit_thoughts` table. Phase 6 converts those thoughts into a rolling context summary.
- **`useChat` + `DefaultChatTransport`** — uses the same underlying SDK as the main chat but with a custom transport that injects `pursuitId` into every request body.
- **`stopWhen: stepCountIs(10)`** — allows multi-step tool use (e.g. check tasks → create task → log thought) without unbounded loops.
- **`router.refresh()` on finish** — after the AI response, the server component re-runs, reflecting any tasks or projects the AI created in the project grid.
- **Two-column layout** — projects on the left (`flex-1`), chat panel on the right (`w-80 xl:w-96`). Responsive but keeps the chat always visible on desktop without a toggle.

---

## How to Test (Phase 5)

1. `pnpm run dev`
2. Navigate to `/os` → click a pursuit
3. See the two-column layout: projects left, AI chat panel right
4. Type in the chat panel: `"What are the biggest blockers for this pursuit?"`
5. AI responds with context-aware analysis
6. Type: `"Create a task to review the logistics contract under [project name]"`
7. AI calls `createTask` → task appears in project card (page refreshes)
8. Type: `"Update the current state — we just signed a new 3PL partner"`
9. AI calls `updatePursuit` → refresh the page to see updated current state banner
10. Check `pursuit_thoughts` table in DB — `logThought` should have run

---

## Files Summary

```
lib/ai/tools/os/
└── create-os-tools.ts      (new — 7 OS AI tools)

app/(chat)/api/os/chat/
└── route.ts                (new — scoped streaming endpoint)

components/os/
└── scoped-chat.tsx         (new — client chat panel)

lib/ai/
└── prompts.ts              (PursuitContext type + scopedPrompt added)

app/(os)/pursuits/[id]/
└── page.tsx                (two-column layout + ScopedChat added)
```
