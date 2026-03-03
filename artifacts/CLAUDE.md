<system_context>
Artifact type handlers for the boilerplate chat app. Artifacts are rich content blocks (code, text documents, images, spreadsheets) that the AI can create and the user can edit. This is entirely boilerplate from the Next.js Chat SDK — the Personal OS does not use artifacts.
</system_context>

<file_map>
## FILE MAP
- `actions.ts` - Server actions for artifact persistence
- `code/client.tsx` - Code artifact UI (CodeMirror editor)
- `code/server.ts` - Code artifact server-side rendering
- `text/client.tsx` - Text/document artifact UI (ProseMirror)
- `text/server.ts` - Text artifact server logic
- `image/client.tsx` - Image artifact display
- `sheet/client.tsx` - Spreadsheet artifact UI (React Data Grid)
- `sheet/server.ts` - Spreadsheet artifact logic
</file_map>

<critical_notes>
## CRITICAL NOTES
- **Boilerplate only** — The Personal OS does not create or use artifacts. Only the `/chat` app uses these.
- **Do not modify** unless you need to change artifact behavior in the boilerplate chat app.
- **Adding a new artifact type:** Follow the `code/` pattern — create `client.tsx` + `server.ts`, register in `lib/artifacts/server.ts`.
</critical_notes>
