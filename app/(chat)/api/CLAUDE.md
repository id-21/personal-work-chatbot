<system_context>
All REST API route handlers for the chat application. Every route in this directory is automatically auth-gated by the `(chat)` group layout middleware. Routes are Next.js App Router `route.ts` files.
</system_context>

<file_map>
## FILE MAP
**Core chat:**
- `chat/route.ts` — `POST /api/chat`: main streaming endpoint. Assembles memory context, streams AI response, runs knowledge-agent post-stream via `after()`.
- `chat/schema.ts` — Zod schema for the chat POST request body.
- `chat/[id]/stream/route.ts` — Resumable stream reconnection endpoint.
- `chat/[id]/reflect/route.ts` — `POST /api/chat/[id]/reflect`: triggers reflection-agent in background (checks `MEMORY_ENABLED` env var).

**Memory review:**
- `reflections/pending-count/route.ts` — `GET`: returns `{ count: number }` for sidebar badge.
- `reflections/[id]/confirm/route.ts` — `POST`: processes user feedback (accept/reject/edit). This is where confirmed facts become `MemoryChunk` rows and `narrative-agent` runs.

**Artifacts & documents:**
- `document/route.ts` — CRUD for `Document` records (artifact content persistence).
- `files/upload/route.ts` — Vercel Blob multipart upload for attachments.
- `transcribe/route.ts` — Audio→text transcription endpoint.

**Standard SDK routes:**
- `history/route.ts`, `suggestions/route.ts`, `vote/route.ts` — Boilerplate chat history, inline suggestions, and message voting.
</file_map>

<patterns>
## PATTERNS

### Memory agent trigger chain
```
POST /api/chat
  └─ after() → updateKnowledgeBase()        # knowledge-agent, always
POST /api/chat/[id]/reflect  (called by client after stream ends)
  └─ after() → runReflectionAgent()         # reflection-agent, if MEMORY_ENABLED
POST /api/reflections/[id]/confirm  (user submits feedback)
  └─ embed accepted facts → createMemoryChunk()
  └─ updateNarrative() per fact             # narrative-agent
```

### /reflections/[id]/confirm request body
```typescript
{
  feedback: Array<{
    itemId: string;         // ProposedFact.id or ProposedPursuit.id
    itemType: "fact" | "pursuit";
    action: "accept" | "reject" | "edit";
    editedText?: string;    // required when action === "edit"
  }>
}
```
</patterns>

<critical_notes>
## CRITICAL NOTES
- **`maxDuration = 60`** — The main `chat/route.ts` sets this for Vercel's function timeout. Background agents running via `after()` have their own separate timeout budget.
- **`MEMORY_ENABLED` gate** — `chat/[id]/reflect/route.ts` short-circuits with `{ ok: false }` if this env var is not `"true"`. Set in `.env.local` for local development.
- **`/reflections/[id]/confirm` is the only place chunks are written** — Agents do not write `MemoryChunk` directly. Memory only persists after explicit user approval here.
- **Resumable streams** — `chat/route.ts` uses `createResumableStreamContext()`. Reconnection flows through `chat/[id]/stream/route.ts` using the same `streamId`.
- **Auth pattern** — All handlers call `await auth()` and return a `ChatSDKError("unauthorized")` response if no session exists.
</critical_notes>
