<system_context>
The boilerplate chat application route group. Contains the standard AI chat UI (conversations, artifacts, model selection) from the Next.js Chat SDK. The Personal OS lives in the sibling (os) group — this group's only custom code is the `api/os/` subdirectory.
</system_context>

<file_map>
## FILE MAP
- `layout.tsx` - Chat app layout (sidebar + main)
- `actions.ts` - Chat server actions (save message, delete chat, etc.)
- `chat/page.tsx` - New chat page
- `chat/[id]/page.tsx` - Existing chat conversation page
- `api/` - API routes. See [api/CLAUDE.md](api/CLAUDE.md). OS-specific routes in [api/os/CLAUDE.md](api/os/CLAUDE.md).
- `opengraph-image.png` / `twitter-image.png` - Social sharing images
</file_map>

<critical_notes>
## CRITICAL NOTES
- **Boilerplate group** — Don't add Personal OS features here. The OS lives in `app/(os)/`.
- **`api/os/` is the exception** — OS API routes are placed here to inherit the chat group's auth middleware, but they serve the OS UI.
- **Chat URL is `/chat` or `/chat/[id]`** — The OS home is at `/` (root).
</critical_notes>
