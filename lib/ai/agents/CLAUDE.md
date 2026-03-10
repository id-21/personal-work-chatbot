<system_context>
Three background LLM agents that run after each chat to build the user's long-term memory. All are `server-only` and use `getOSModel()` (Gemini 2.5 Flash Lite). They never block the chat response — they're scheduled via Next.js `after()`.
</system_context>

<file_map>
## FILE MAP
- `reflection-agent.ts` — Extracts structured facts and pursuits from a chat transcript into a pending `Reflection` record for user review.
- `knowledge-agent.ts` — Merges a conversation into a single living KB document (stored as a `Document` row with `title === "__kb__"`).
- `narrative-agent.ts` — Appends a timestamped bullet for a single confirmed fact to the per-topic `Narrative` doc.
</file_map>

<patterns>
## PATTERNS

### reflection-agent.ts — `runReflectionAgent(chatId, userId)`
1. Fetches messages via `getMessagesByChatId()`
2. Builds transcript with IDs: `[uuid] role: text` — IDs required so `sourceMessageIds` can be validated
3. **Skips** if transcript < 150 chars (too short to extract anything meaningful)
4. Calls `generateText()` with Zod output schema → `{ facts: ProposedFact[], pursuits: ProposedPursuit[], casual: string[] }`
5. Saves via `createReflection()` with `status: "pending"`

Extraction rules baked into the prompt:
- Facts: only durable preferences, decisions, commitments — not greetings or curiosity questions
- Pursuits: only if there's clear evidence of an active project
- `confidence` (0–1) and `urgency` ("low"|"medium"|"high") fields must be set

### knowledge-agent.ts — `updateKnowledgeBase(chatId, userId)`
1. Fetches messages + existing KB document (`getKnowledgeBaseDocument()`)
2. Builds plain transcript (no IDs): `role: text`
3. Calls `generateText()` → updated KB markdown
4. Saves via `saveDocument()` with `title: "__kb__"`

KB structure maintained by the prompt:
```
## Topics
- [topic] [citation]
## Key Facts
- [fact] [citation]
## Action Items
- [task] [citation]
```
Citation format: `[View conversation](/chat/{chatId})`

### narrative-agent.ts — `updateNarrative(fact: ProposedFact, userId)`
1. Loads existing narrative for `fact.topic`
2. Calls `generateText()` → appends `- [YYYY-MM-DD] <statement>` bullet
3. Contradicting facts get `[supersedes previous entry]` appended
4. Upserts via `upsertNarrative()` (increments `version`)
</patterns>

<critical_notes>
## CRITICAL NOTES
- **Trigger points** — Reflection agent fires from `POST /api/chat/[id]/reflect`. Knowledge agent fires from `POST /api/chat` post-stream. Both via `after()`.
- **Reflection flow** — `pending` → (user reviews at `/reflections`) → `confirmed` | `dismissed`. Confirmed facts trigger `narrative-agent` + `createMemoryChunk()` in `reflections/[id]/confirm/route.ts`.
- **KB document sentinel** — KB is identified by `title === "__kb__"` in the `Document` table. Never rename it or it becomes orphaned and a new blank one is created.
- **No direct chunk writes** — Agents do not write to `MemoryChunk`. Only the confirm route does that, after user approval.
- **All agents are `server-only`** — Never import from client components or edge runtime code.
</critical_notes>
