# Phase 3 — Pursuit Detail + Projects + Tasks

**Status:** Complete
**Date:** 2026-03-02

---

## What Was Built

Full static view of the Pursuits → Projects → Tasks hierarchy. Clicking a pursuit card from the dashboard now takes you into a detail view; clicking a project card opens the project with its task list.

### New Pages

| File | Route | Purpose |
|---|---|---|
| `app/(os)/pursuits/[id]/page.tsx` | `/os/pursuits/[id]` | Pursuit detail — header with vision/current state, grid of project cards |
| `app/(os)/pursuits/[id]/projects/[projectId]/page.tsx` | `/os/pursuits/[id]/projects/[projectId]` | Project detail — header with status, task list |

### New Components: `components/os/`

| File | Purpose |
|---|---|
| `task-item.tsx` | Single task row — title, optional detail, status Select (with optimistic update), AI badge if `source = ai_suggested` |
| `task-list.tsx` | Renders a list of `TaskItem` components, or an empty state |
| `project-card.tsx` | Clickable card — project name, status badge, open/total task count. Links to project detail page |
| `create-project-dialog.tsx` | Modal with name (required) + description. POSTs to `/api/os/pursuits/[id]/projects` |
| `create-task-dialog.tsx` | Modal with title (required) + detail. POSTs to `/api/os/projects/[id]/tasks` with `source: "user"` |

---

## Key Decisions

- **`getPursuitWithDetail`** (single DB call) powers the entire pursuit detail page — returns pursuit + all projects + all tasks per project + context summary + recent thoughts. No N+1 queries.
- **Project detail page** makes three parallel calls via `Promise.all`: `getProjectById`, `getPursuitById` (for breadcrumb), `getTasksByProjectId`.
- **Task status is updated optimistically**: `TaskItem` updates local state immediately on select change, calls `PUT /api/os/tasks/[id]`, and reverts if the request fails. No full page reload needed.
- **`router.refresh()`** is used in the create dialogs (project and task) to re-run the server component data fetch after creation — shows new items without a manual reload.
- **Breadcrumb navigation**: Dashboard → Pursuit → Project, each level is a clickable link.
- **Ownership check**: Both pages redirect to 404 if the pursuit's `userId` doesn't match the session user.

---

## How to Test (Phase 3)

1. `pnpm run dev`
2. Navigate to `/os` → create a pursuit if you haven't
3. Click a pursuit card → see the pursuit detail page at `/os/pursuits/[id]`
4. Click **New Project** → fill in name → confirm
5. Project card appears in the grid with "0 open · 0 total"
6. Click the project card → see project detail at `/os/pursuits/[id]/projects/[projectId]`
7. Click **New Task** → add a title → confirm
8. Task appears in the list with status "Open"
9. Change the status dropdown → status updates instantly without reload
10. Create a task that was AI-suggested: `POST /api/os/projects/[id]/tasks` with `"source": "ai_suggested"` → the task shows an **AI** badge

---

## Files Created

```
app/(os)/pursuits/[id]/
├── page.tsx
└── projects/[projectId]/
    └── page.tsx

components/os/
├── task-item.tsx
├── task-list.tsx
├── project-card.tsx
├── create-project-dialog.tsx
└── create-task-dialog.tsx
```
