<system_context>
All React components for the application. Split between Personal OS custom components, boilerplate chat UI components, and shared shadcn primitives. The `os/` subdirectory is where Personal OS feature work happens.
</system_context>

<file_map>
## FILE MAP

**Custom Personal OS:**
- `os/` - All Personal OS UI components. See [os/CLAUDE.md](os/CLAUDE.md). **This is where OS feature work goes.**

**Boilerplate (Chat SDK) — Root Level:**
- `chat.tsx` - Top-level chat component
- `messages.tsx` - Message list container
- `message.tsx` - Single message renderer
- `multimodal-input.tsx` - Text + file + audio input field
- `artifact.tsx`, `artifact-actions.tsx`, `artifact-messages.tsx` - Artifact panel
- `document.tsx`, `document-preview.tsx` - Document editor/preview
- `code-editor.tsx`, `text-editor.tsx`, `image-editor.tsx`, `sheet-editor.tsx` - Artifact editors
- `app-sidebar.tsx`, `sidebar-history.tsx`, `sidebar-user-nav.tsx` - Chat sidebar
- `data-stream-handler.tsx`, `data-stream-provider.tsx` - Stream processing
- `auth-form.tsx`, `sign-out-form.tsx` - Auth forms
- `greeting.tsx`, `suggested-actions.tsx` - Welcome / suggestions UI

**Boilerplate Subdirectories:**
- `ui/` - shadcn primitives. See [ui/CLAUDE.md](ui/CLAUDE.md). Do not modify.
- `elements/` - Basic chat element renderers (boilerplate).
- `ai-elements/` - Advanced AI visualization components (boilerplate).
</file_map>

<critical_notes>
## CRITICAL NOTES
- **New OS components go in `os/`** — Never add OS-specific UI at the root components level.
- **Root-level components are chat SDK boilerplate** — Modifying them risks breaking the chat app.
- **`ui/` is shadcn** — Add new primitives via `npx shadcn@latest add <component>`, never by hand.
</critical_notes>
