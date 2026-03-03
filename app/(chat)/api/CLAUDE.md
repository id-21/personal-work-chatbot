<system_context>
API routes for the chat application. Most routes are boilerplate from the Next.js Chat SDK. The `os/` subdirectory is entirely custom Personal OS routes and has its own CLAUDE.md.
</system_context>

<file_map>
## FILE MAP

**Boilerplate Chat Routes:**
- `chat/route.ts` - Main chat streaming endpoint (Vercel AI SDK streamText)
- `chat/schema.ts` - Request validation schema for chat endpoint
- `document/route.ts` - Document creation and retrieval
- `history/route.ts` - Chat history listing
- `suggestions/route.ts` - AI-generated response suggestions
- `transcribe/route.ts` - Audio transcription via OpenAI Whisper
- `vote/route.ts` - Message upvote/downvote

**Custom Personal OS Routes:**
- `os/` - All OS API routes. See [os/CLAUDE.md](os/CLAUDE.md) for details.
</file_map>

<critical_notes>
## CRITICAL NOTES
- **`chat/route.ts` is boilerplate** — It serves the `/chat` app, not the Personal OS. Do not add OS logic here.
- **`os/` is where all OS features go** — When adding a new OS API route, add it under `os/`, not at this level.
- **`transcribe/route.ts` uses OpenAI Whisper** — See `discussions/openai_whisper_docs.md` for API details.
</critical_notes>
