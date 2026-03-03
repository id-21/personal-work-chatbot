<system_context>
All Personal OS UI components live here. These are entirely custom — none of these exist in the boilerplate. They implement the pursuits/projects/tasks dashboard, routing chips, scoped chat sidebar, and creation dialogs.
</system_context>

<file_map>
## FILE MAP
- `home-chat-view.tsx` - Home dashboard: pursuit card grid + home-mode chat (dual view)
- `scoped-chat.tsx` - Pursuit-scoped AI chat sidebar (renders inside pursuit detail page)
- `pursuit-card.tsx` - Card displaying one pursuit (name, vision, currentState)
- `project-card.tsx` - Card displaying one project under a pursuit
- `task-item.tsx` - Single task row with status indicator
- `task-list.tsx` - Container rendering a list of task-item components
- `routing-chip.tsx` - Small confirmation badge rendered after AI routing actions
- `os-sidebar.tsx` - Sidebar navigation for the OS route group
- `create-pursuit-dialog.tsx` - Modal form to manually create a pursuit
- `create-project-dialog.tsx` - Modal form to manually create a project
- `create-task-dialog.tsx` - Modal form to manually create a task
</file_map>

<patterns>
## PATTERNS

**Chip detection (home-chat-view.tsx):** AI routing responses that start with specific phrases are rendered as chips, not chat bubbles. Regex: `/^(Added to|Updated your profile|Created project|Created pursuit)/i`. Any new routing confirmation phrases the AI produces must match this regex or they'll appear as plain bubbles.

**Dual-view toggle (home-chat-view.tsx):** The component starts showing the pursuit card grid. After the first message is sent, it switches to chat bubble view. State is local (`hasStartedChat`).

**Chat transport:** `home-chat-view.tsx` → `/api/os/home-chat`. `scoped-chat.tsx` → `/api/os/chat`. Neither uses the boilerplate `/api/chat` endpoint.

**Data refresh:** Both chat components call `router.refresh()` in `onFinish` to re-fetch server-rendered pursuit cards after AI creates new entities.

Example: `home-chat-view.tsx` for full chip + dual-view implementation.
</patterns>

<critical_notes>
## CRITICAL NOTES
- **Do NOT point these components at `/api/chat`** — They use dedicated OS endpoints.
- **Routing chip phrases are hardcoded in regex** — If the AI prompt changes the confirmation text format, update the regex in `home-chat-view.tsx` to match.
- **No priority UI anywhere** — Tasks do not show a priority field. Per product spec, priority is always the user's mental model, never surfaced in the app.
- **Create dialogs POST to REST endpoints** (`/api/os/pursuits`, etc.) — They do not go through AI. Manual creation bypasses routing.
</critical_notes>
