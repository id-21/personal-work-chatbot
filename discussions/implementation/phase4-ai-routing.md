# Phase 4 — AI Home Mode Routing

**Status:** Complete
**Date:** 2026-03-02

---

## What Was Built

The home input now routes typed messages to the correct pursuit and project using Gemini 2.5 Flash Lite via `generateObject`. After submission, a dismissable chip appears confirming what was created.

### New Files

| File | Purpose |
|---|---|
| `app/(chat)/api/os/route/route.ts` | POST endpoint — classifies message, creates task/project, logs decision |
| `components/os/routing-chip.tsx` | Dismissable confirmation chip displayed after routing |

### Modified Files

| File | Change |
|---|---|
| `lib/ai/prompts.ts` | Added `homePrompt` — routing-only system prompt for Gemini |
| `lib/ai/providers.ts` | Added `getOSModel()` returning `google/gemini-2.5-flash-lite` |
| `lib/db/queries.ts` | Added `getPursuitsWithProjects()` — pursuits + projects without tasks (for routing context) |
| `components/os/home-input.tsx` | Wired up to `/api/os/route`, shows routing chip on success |

---

## How It Works

```
User types → POST /api/os/route
  → fetch all pursuits + projects from DB
  → generateObject({ model: Gemini, system: homePrompt, prompt: message + context })
  → AI returns { action, pursuitId, projectId, newProjectName, title, chipText }
  → Route creates task or project in DB
  → Logs to routing_log (fire-and-forget)
  → Returns chip text to UI
```

### Routing Schema (AI output)

```typescript
{
  action: "create_task" | "create_project" | "unclassified",
  pursuitId: string | null,
  projectId: string | null,      // null when action = create_project
  newProjectName: string | null, // populated when action = create_project
  title: string,                 // task title or project name
  chipText: string               // e.g. "Added to Distribution → QR Tracking"
}
```

### Key Decisions

- **`generateObject`** (not `streamText` with tools) — routing is a one-shot classification, not a conversation. Structured outputs are more reliable and simpler to test.
- **`getOSModel()`** — centralised factory for all OS AI calls returning `google/gemini-2.5-flash-lite`.
- **`getPursuitsWithProjects`** — lightweight query (pursuits + projects, no tasks) injected as context JSON. Keeps the routing prompt small and accurate.
- **Fire-and-forget routing log** — the log write uses `.catch(() => {})` so a DB failure there never blocks the user-facing response.
- **`unclassified` guard** — if the user has no pursuits yet, the chip reads "Nothing to route — create a pursuit first" without a DB error.
- **DB action enum mapping** — AI returns `create_task`/`create_project` (present tense for readability in the prompt), which the route maps to `created_task`/`created_project` to match the DB schema.

---

## How to Test (Phase 4)

1. `pnpm run dev`
2. Navigate to `/os`
3. Create at least one pursuit and one project (from Phase 3)
4. Type in the home input: `"I need to call the logistics partner about pricing"`
5. Click **Add** → chip appears: `"Added to [Pursuit] → [Project]"`
6. Click X on the chip to dismiss
7. Navigate into the pursuit → project detail page → task should appear with the AI badge
8. Check the routing log in DB: `select * from routing_log;`

---

## Files Created / Modified

```
app/(chat)/api/os/route/
└── route.ts

components/os/
├── routing-chip.tsx     (new)
└── home-input.tsx       (updated)

lib/ai/
├── prompts.ts           (homePrompt added)
└── providers.ts         (getOSModel added)

lib/db/
└── queries.ts           (getPursuitsWithProjects added)
```
