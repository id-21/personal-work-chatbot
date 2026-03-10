<system_context>
All React UI components for the chat interface, artifact editing, and memory review features. Custom components live at the root of this directory. Sub-directories `ui/`, `elements/`, and `ai-elements/` are boilerplate — avoid modifying them.
</system_context>

<file_map>
## FILE MAP
**Chat core:**
- `chat.tsx` — Root chat component. Uses `useChat()` from `@ai-sdk/react`. Orchestrates message list, input, and artifact panel.
- `multimodal-input.tsx` — Message input bar with model selector, file attachment, and audio record (MicIcon). Persists model selection to `chat-model` cookie.
- `message.tsx` — Single message renderer; delegates text content to `elements/message.tsx` and tool results to `document.tsx`.
- `messages.tsx` — Scrollable message list with stick-to-bottom behavior.
- `chat-header.tsx` — Top bar with model selector and visibility toggle.
- `app-sidebar.tsx` — Sidebar with chat history, KB link, and reflections badge.

**Data streaming:**
- `data-stream-provider.tsx` — Context provider exposing the AI data stream.
- `data-stream-handler.tsx` — Consumes stream events (`data-kind`, `data-id`, `data-suggestion`, etc.) and updates local state.

**Memory UI (custom):**
- `kb-viewer.tsx` — Displays the KB document with pagination. Fetches document versions from `/api/document` via SWR.
- `reflection-list.tsx` — Accept/reject/edit UI for pending `Reflection` items. Submits feedback to `POST /api/reflections/[id]/confirm`.

**Artifact editors:**
- `artifact.tsx` / `create-artifact.tsx` — Artifact side panel shell and creation flow.
- `document.tsx` — Renders document tool results inline in messages.
- `text-editor.tsx` — ProseMirror-based rich text editor (uses `lib/editor/`).
- `code-editor.tsx` — CodeMirror-based code editor.
- `sheet-editor.tsx` — react-data-grid spreadsheet editor.
- `image-editor.tsx` — Image artifact display/edit.

**Boilerplate sub-directories (do not modify):**
- `ui/` — shadcn/ui primitive components.
- `elements/` — Vercel Chat SDK UI elements.
- `ai-elements/` — Vercel Chat SDK AI-specific elements.
</file_map>

<critical_notes>
## CRITICAL NOTES
- **`elements/` and `ai-elements/` are SDK-managed** — These come from the Vercel Chat SDK boilerplate. Modifying them risks merge conflicts on SDK upgrades. Add custom rendering logic in the root-level components instead.
- **`reflection-list.tsx` is the main memory UI** — All user accept/reject/edit actions for proposed facts and pursuits flow through this component. The feedback shape must match `POST /api/reflections/[id]/confirm` exactly.
- **Model selection persists in cookie** — `multimodal-input.tsx` writes the selected model ID to the `chat-model` cookie. `app/(chat)/page.tsx` reads it on load to restore the user's preference.
- **Artifact editors are lazy** — Artifact editors are only mounted when an artifact is open. Don't import editor libraries at the top level of non-artifact components.
</critical_notes>
