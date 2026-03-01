# Phase 2 — Home Dashboard UI

**Status:** Complete
**Date:** 2026-03-02

---

## What Was Built

The Personal OS lives at `/os` alongside the existing chat app at `/`. No existing files were modified.

### New Route Group: `app/(os)/`

| File | Purpose |
|---|---|
| `app/(os)/layout.tsx` | Server component layout — checks auth (redirects to `/login` if unauthenticated), fetches pursuits for sidebar, wraps in `SidebarProvider` |
| `app/(os)/page.tsx` | Home dashboard page — loads pursuits server-side, shows grid or empty state |

### New Components: `components/os/`

| File | Purpose |
|---|---|
| `components/os/pursuit-card.tsx` | Clickable card for a single pursuit — shows name, vision (truncated), current state. Links to `/os/pursuits/[id]` |
| `components/os/create-pursuit-dialog.tsx` | Modal dialog with form for name (required), vision, current state. POSTs to `/api/os/pursuits`, calls `router.refresh()` on success |
| `components/os/os-sidebar.tsx` | Client sidebar — lists pursuits as nav links, highlights active route via `usePathname`, reuses `SidebarUserNav` from existing chat app for sign out / theme toggle |
| `components/os/home-input.tsx` | Always-visible input bar at the bottom of the dashboard — placeholder UI for Phase 4 AI routing |

---

## Key Decisions

- **Server-side data loading**: Pursuits are fetched directly from the DB in `layout.tsx` and `page.tsx` (server components), matching the pattern used in the existing `(chat)` layout. No client-side SWR needed for initial load.
- **Auth guard in layout**: `redirect("/login")` in the layout server component protects all `(os)` routes without touching middleware.
- **Sidebar reuse**: `OSSidebar` uses the exact same `Sidebar`, `SidebarContent`, `SidebarFooter`, `SidebarProvider`, `SidebarInset` primitives from `components/ui/sidebar.tsx` as the existing chat sidebar. `SidebarUserNav` is shared directly.
- **`router.refresh()`** after creating a pursuit re-runs the server component data fetch, so the new pursuit appears in the grid without a full page reload.
- **Home input is a placeholder** — it has the correct UI shape (always-visible bottom bar, input + submit button) but the submit handler just clears the field. AI routing will be added in Phase 4.

---

## How to Test (Phase 2)

1. Start the dev server: `pnpm run dev`
2. Navigate to [http://localhost:3000/os](http://localhost:3000/os) — should redirect to login if not authenticated
3. Log in, then navigate to `/os`
4. See the empty state with "Welcome to your Personal OS" message
5. Click **New Pursuit** → fill in name + optional fields → click **Create**
6. The pursuit card appears in the grid
7. The pursuit name also appears in the left sidebar
8. Click the card — navigates to `/os/pursuits/[id]` (404 until Phase 3)
9. Sidebar highlights the active pursuit route

---

## Files Created

```
app/(os)/
├── layout.tsx
└── page.tsx

components/os/
├── pursuit-card.tsx
├── create-pursuit-dialog.tsx
├── os-sidebar.tsx
└── home-input.tsx
```
