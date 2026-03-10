<system_context>
Three-file module that powers the semantic memory pipeline: embedding user text, storing/retrieving vectorized memory chunks, and assembling relevant context for chat prompts. This is the most custom code in the project.
</system_context>

<file_map>
## FILE MAP
- `embedding.ts` — Text→vector via Google `text-embedding-004` (768-dim). `embedText(text)` single, `embedTexts(texts[])` batch.
- `queries.ts` — All DB ops for the memory tables. See function list below.
- `context-assembly.ts` — `assembleContext({ userId, userMessage })`: embeds query → vector search → load narrative → return formatted markdown injected into system prompt.
</file_map>

<patterns>
## PATTERNS

### queries.ts — full function inventory
**Memory chunks:**
- `createMemoryChunk({ userId, chatId, text, embedding, tags, importance, sourceMessageIds })`
- `supersedChunk({ oldId, newId })` — sets `supersededBy` on old chunk
- `vectorSearch({ userId, queryEmbedding, limit?, threshold? })` — cosine similarity via `<=>` operator; default limit 8, threshold 0.3; returns `VectorSearchResult[]`

**Narratives (per-topic living docs):**
- `getNarrativeByTopic({ userId, topic })` → `Narrative | undefined`
- `upsertNarrative({ userId, topic, content })` — increments `version` on update

**Reflections (pending user review):**
- `createReflection({ userId, chatId, proposedFacts, proposedPursuits, casualTopics })`
- `getReflectionById(id)`
- `getPendingReflectionsByUser({ userId })` — status = `"pending"` only
- `getPendingReflectionCount({ userId })` — for sidebar badge
- `updateReflectionStatus({ id, status })` — `"confirmed"` | `"dismissed"`
- `saveReflectionFeedback(items[])` — bulk insert into `ReflectionFeedback`

### assembleContext output format
```
## Relevant Memory
1. <chunk text>
2. <chunk text>
...

## <Topic> — Context
<narrative content>
```
This string is prepended to the system prompt in `app/(chat)/api/chat/route.ts`.
</patterns>

<critical_notes>
## CRITICAL NOTES
- **pgvector required** — `MemoryChunk.embedding` uses the custom `vectorColumn` type (768 dims). The Postgres database must have the `pgvector` extension enabled.
- **Feature flag** — All memory paths check `MEMORY_ENABLED` env var before running. Set it to `"true"` in `.env.local` to activate.
- **Superseding chunks** — When a fact is updated, call `supersedChunk()` to chain the old chunk to the new one. Do not delete old chunks.
- **Thresholds are configurable** — `vectorSearch` defaults to 0.3 similarity threshold; callers can override for stricter/looser retrieval.
- **Embeddings are server-only** — `embedding.ts` uses `"server-only"` guard; never import from client components.
- **Reflection → memory path** — Chunks are only created inside `app/(chat)/api/reflections/[id]/confirm/route.ts` after user accepts a proposed fact. The agents never write chunks directly.
</critical_notes>
