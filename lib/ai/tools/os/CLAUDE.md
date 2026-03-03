<system_context>
This directory contains the AI tool factory for the Personal OS scoped conversations. A single factory function returns all 7 tools pre-scoped to a specific user and pursuit, with built-in ownership checks.
</system_context>

<file_map>
## FILE MAP
- `create-os-tools.ts` - The only file. Exports `createOSTools({ userId, pursuitId })` and the `OSTool` type.
</file_map>

<patterns>
## PATTERNS

**Factory pattern:** Call `createOSTools({ userId, pursuitId })` and pass the result as the `tools` object to `streamText`. The pursuit and user are bound at factory time — no need to pass them per-tool.

**Available tools (all 7):**
- `getPursuitDetail` — Refresh pursuit context mid-conversation
- `createTask(projectId, title, detail?)` — Creates task, source always `'ai_suggested'`
- `updateTask(taskId, status?, detail?)` — Status: `open | in_progress | done | dismissed`
- `createProject(name, description?)` — New project under bound pursuit
- `updatePursuit(currentState?, vision?, constraints?, opportunities?)` — Update pursuit model
- `logThought(content)` — Append to thought log (AI long-term memory). Call after every substantive exchange.
- `getProjectTasks(projectId)` — Check existing tasks before creating duplicates

**Ownership check pattern:** Each write tool verifies the target entity belongs to the bound `pursuitId` before executing. Returns `{ error: "..." }` on mismatch.

Example usage in `app/(chat)/api/os/chat/route.ts`, search: `createOSTools`
</patterns>

<critical_notes>
## CRITICAL NOTES
- **Never set task source to `'user'`** — AI-created tasks are always `'ai_suggested'`. Users create tasks manually via the UI.
- **`logThought` is the memory mechanism** — The AI must call it after every meaningful exchange. Without this, context is lost between sessions.
- **All tools use queries from `lib/db/queries.ts`** — Do not write raw SQL here; add new query functions to queries.ts.
- **Adding a new tool:** Add it inside the returned object in `createOSTools`, follow the `tool({ description, inputSchema, execute })` pattern from Vercel AI SDK.
</critical_notes>
