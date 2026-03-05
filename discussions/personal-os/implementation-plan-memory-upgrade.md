# Implementation Plan: Vector Memory + Temporal Narratives

> Upgrading the Personal OS from the current `pursuit_thoughts` / `context_summaries` memory model to the richer system proposed in `personal-os-architecture.jsx` — a vector store for atomic facts + living narrative documents per topic.
>
> All storage stays on the existing Vercel stack: Neon Postgres (+ pgvector), Upstash Redis, Vercel Blob, OpenAI API (already keyed).

---

## What Changes (Summary)

**New tables:** `memory_chunks` (vector store), `narratives` (living docs)
**Modified tables:** `projects` (add `narrativeId`), `tasks` (add `contextChunkIds`)
**New utilities:** embedding helper, vector search query, narrative append prompt
**Modified files:** `schema.ts`, `queries.ts`, `prompts.ts`, `create-os-tools.ts`, `home-chat/route.ts`, `chat/route.ts`

---

## Phase 1 — Database Foundation

**Goal:** Get the new tables and pgvector into Neon with no app changes yet.

### 1.1 Enable pgvector on Neon

Add a raw SQL migration file (Drizzle runs these in order before generated migrations):

**File: `lib/db/migrations/0000_enable_pgvector.sql`** *(or whatever the next migration number is)*
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Run manually once, or add to the migrate script. Neon supports pgvector natively — no extra setup needed.

### 1.2 Add new tables to `lib/db/schema.ts`

```ts
import { vector } from "drizzle-orm/pg-core"; // requires drizzle-orm >= 0.34 ✓

export const memoryChunk = pgTable("memory_chunks", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId").notNull().references(() => user.id),
  text: text("text").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }),
  tags: json("tags").$type<string[]>().notNull().default([]),
  entityType: varchar("entityType", {
    enum: ["business", "person", "challenge", "insight", "preference"],
  }),
  linkedPursuits: json("linkedPursuits").$type<string[]>().notNull().default([]),
  importance: real("importance").notNull().default(0.5),
  supersededBy: uuid("supersededBy"),  // self-FK — left untyped to avoid circular ref
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type MemoryChunk = InferSelectModel<typeof memoryChunk>;

export const narrative = pgTable("narratives", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId").notNull().references(() => user.id),
  topic: text("topic").notNull(),        // e.g. "daga-wallpapers", "marketing"
  topicType: varchar("topicType", {
    enum: ["business", "pursuit", "person", "domain"],
  }).notNull(),
  content: text("content").notNull().default(""),  // timestamped markdown
  summary: text("summary"),
  version: integer("version").notNull().default(1),
  lastUpdated: timestamp("lastUpdated").notNull().defaultNow(),
});

export type Narrative = InferSelectModel<typeof narrative>;
```

### 1.3 Add FK columns to existing tables

In `lib/db/schema.ts`, extend the existing `project` and `task` table definitions:

```ts
// Add to project table:
narrativeId: uuid("narrativeId"),  // optional FK → narratives.id

// Add to task table:
contextChunkIds: json("contextChunkIds").$type<string[]>().notNull().default([]),
```

### 1.4 Run migrations

```bash
pnpm db:generate
pnpm db:migrate
```

### 1.5 Create vector search Postgres function

After migration, run this SQL directly against Neon (add to a `lib/db/migrations/` SQL file or run via `db:studio`):

```sql
CREATE OR REPLACE FUNCTION vector_search(
  query_embedding vector(1536),
  match_count int,
  p_user_id uuid,
  filter_pursuits text[] DEFAULT NULL
)
RETURNS TABLE (id uuid, text text, tags text[], importance float, similarity float)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    mc.id,
    mc.text,
    mc.tags::text[],
    mc.importance::float,
    1 - (mc.embedding <=> query_embedding) AS similarity
  FROM memory_chunks mc
  WHERE
    mc.user_id = p_user_id
    AND mc.superseded_by IS NULL
    AND (filter_pursuits IS NULL OR mc.linked_pursuits::text[] && filter_pursuits)
  ORDER BY mc.embedding <=> query_embedding
  LIMIT match_count;
END; $$;

-- HNSW index for fast ANN search
CREATE INDEX IF NOT EXISTS memory_chunks_embedding_idx
ON memory_chunks USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Filtered search index
CREATE INDEX IF NOT EXISTS memory_chunks_filter_idx
ON memory_chunks (linked_pursuits, importance)
WHERE superseded_by IS NULL;
```

---

## Phase 2 — Core Utilities

**Goal:** Embedding helper + all Drizzle queries for the new tables. No route changes yet.

### 2.1 Create `lib/ai/embedding.ts`

```ts
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding("text-embedding-3-small"),
    value: text,
  });
  return embedding;
}
```

Uses the existing `OPENAI_API_KEY`. No new env vars.

### 2.2 Add queries to `lib/db/queries.ts`

New query functions to add:

```ts
// Insert a memory chunk (with pre-computed embedding)
createMemoryChunk({ userId, text, embedding, tags, entityType, linkedPursuits, importance })

// Vector search (calls the Postgres function)
vectorSearch({ queryEmbedding, userId, matchCount, filterPursuits? })
// Uses: db.execute(sql`SELECT * FROM vector_search(...)`)

// Mark a chunk as superseded
supersedechunk({ id, supersededById })

// Get or create narrative for a topic
getNarrativeByTopic({ userId, topic })
upsertNarrative({ userId, topic, topicType, content, summary })
```

### 2.3 Add narrative LLM prompts to `lib/ai/prompts.ts`

Two new prompt functions:

**Router prompt** — classifies intent:
```ts
export function intentRouterPrompt(pursuitsJson: string): string
// Returns: { intents: ["FACT"|"TASK"|"QUESTION"|"CONTEXT_UPDATE"], entities, pursuitsAffected, importance }
```

**Narrative append prompt** — updates a living doc:
```ts
export function narrativeAppendPrompt(topic: string, existing: string, newInfo: string): string
// Instructs LLM to append a timestamped entry, mark contradictions as [SUPERSEDED]
// Returns the full updated document (≤3000 words)
```

---

## Phase 3 — Input Pipeline (Dual Write)

**Goal:** When a user sends a message in home mode, write to `memory_chunks` AND update the relevant `narrative` in parallel. This is the core of the new system.

### 3.1 Create `lib/ai/memory-pipeline.ts`

A standalone function that handles the dual-write side-effect. Called after intent classification:

```ts
export async function runMemoryPipeline({
  userId,
  rawInput,
  intents,         // from router: ["FACT", "CONTEXT_UPDATE", ...]
  entities,        // extracted entity names
  pursuitsAffected,// pursuit slugs/names
  importance,      // 0.0 – 1.0
}: MemoryPipelineInput): Promise<void>
```

Internal steps:
1. Embed `rawInput` via `embedText()`
2. **Vector write** — `createMemoryChunk(...)` with embedding + metadata
3. **Narrative update** (async, non-blocking) — for each entity in `pursuitsAffected`:
   - Load narrative via `getNarrativeByTopic()`
   - Call LLM with `narrativeAppendPrompt()` using `getOSModel()`
   - `upsertNarrative()` with updated content + bumped version

The narrative update is `await`ed inside a `next/server` `after()` call so it doesn't block the response.

### 3.2 Modify `app/(chat)/api/os/home-chat/route.ts`

Currently the route calls the LLM router to classify and create entities. Extend it to:

1. After routing is done, call `runMemoryPipeline()` with the classification output
2. Wrap in `after()` so it's truly non-blocking

```ts
import { after } from "next/server";

// After existing routing logic:
after(async () => {
  await runMemoryPipeline({ userId, rawInput: message, ...routerOutput });
});
```

No change to the response shape — the chip confirmation still returns immediately.

---

## Phase 4 — Retrieval (Context Upgrade)

**Goal:** When the user asks a question (in home mode) or opens a pursuit card (scoped mode), enrich the AI's context with vector search results + the relevant narrative.

### 4.1 Create `lib/ai/context-assembly.ts`

```ts
export async function assembleContext({
  userId,
  query,
  activePursuits,  // string[] of pursuit slugs for filtering
  primaryTopic,    // e.g. "marketing" — for narrative load
}: ContextAssemblyInput): Promise<string>
```

Steps:
1. Embed `query`
2. `vectorSearch({ queryEmbedding, userId, matchCount: 8, filterPursuits: activePursuits })`
3. `getNarrativeByTopic({ userId, topic: primaryTopic })`
4. Return assembled context string:

```
### Recent Facts:
- <chunk.text> (importance: 0.8)
- ...

### <topic> — Current Narrative:
<narrative.summary>
<narrative.content (last 2000 chars)>
```

### 4.2 Modify `app/(chat)/api/os/chat/route.ts` (scoped mode)

Currently injects `getPursuitWithDetail()` output into `scopedPrompt()`. Extend to also inject assembled vector context:

```ts
const vectorContext = await assembleContext({
  userId,
  query: lastUserMessage,
  activePursuits: [pursuit.name],
  primaryTopic: pursuit.name,
});

// Pass to scopedPrompt (update signature to accept optional vectorContext)
```

Update `scopedPrompt()` in `lib/ai/prompts.ts` to accept and inject the `vectorContext` block after the existing `CONTEXT FROM PREVIOUS SESSIONS` section.

### 4.3 Modify home-mode TYPE A (QUESTION) handling in `app/(chat)/api/os/home-chat/route.ts`

When the router classifies a message as a question, inject assembled context before the LLM generates its answer. The current home-mode already has a TYPE A branch — add the retrieval step there.

---

## Phase 5 — AI Tool Integration

**Goal:** When the scoped AI calls `logThought`, also write a `memory_chunk`. This means every AI-logged thought automatically feeds the vector store without extra routing.

### 5.1 Modify `logThought` tool in `lib/ai/tools/os/create-os-tools.ts`

In the `logThought` tool's `execute` function, after the existing `createPursuitThought()` call, add:

```ts
// Also write to vector store
const embedding = await embedText(content);
await createMemoryChunk({
  userId,
  text: content,
  embedding,
  tags: [],
  linkedPursuits: [pursuitId],
  importance: 0.6,  // AI thoughts default importance
});
```

This keeps the thought log and vector store in sync with zero extra LLM calls.

### 5.2 (Optional) Add `recallFacts` tool to scoped tools

A new tool the scoped AI can call mid-conversation to pull fresh vector results:

```ts
recallFacts: tool({
  description: "Search your memory for relevant facts. Use when you need specific past context not in your current prompt.",
  inputSchema: z.object({
    query: z.string().describe("What to search for"),
  }),
  execute: async ({ query }) => {
    const embedding = await embedText(query);
    return vectorSearch({ queryEmbedding: embedding, userId, matchCount: 6, filterPursuits: [pursuitId] });
  },
})
```

---

## Phase 6 — Narrative Surfacing in UI (Optional, deferred)

**Goal:** Show the narrative for a pursuit on the pursuit detail page, so the user can see the living doc the AI maintains.

### What this needs

- New API route: `GET /api/os/pursuits/[id]/narrative` — fetches narrative for the pursuit's topic
- New OS component: `<NarrativePanel>` in `components/os/` — displays the markdown content with version history
- Wire into the pursuit detail page in `app/(os)/`

This can be deferred until Phases 1–5 are working. The narrative exists in the DB already — surfacing it is a UI-only change.

---

## Phase 7 — Real-time Card Updates (Optional, deferred)

**Goal:** When the AI creates a task or project via the home-mode pipeline, the pursuit card on the dashboard should update live without a page refresh.

### Approach using existing Upstash Redis

1. After a write in `home-chat/route.ts`, publish to a Redis channel: `PUBLISH os:user:{userId} {"event":"entity_created","type":"task","pursuitId":"..."}`
2. Add a new SSE route: `GET /api/os/events` — subscribes to the user's Redis channel and streams events
3. On the client, `useEffect` in the dashboard subscribes to this SSE route and invalidates the SWR cache for the affected pursuit card

No new infrastructure — Upstash is already provisioned.

---

## File Change Summary

| File | Change |
|---|---|
| `lib/db/schema.ts` | Add `memoryChunk`, `narrative` tables; add `narrativeId` to `project`, `contextChunkIds` to `task` |
| `lib/db/queries.ts` | Add `createMemoryChunk`, `vectorSearch`, `supersedechunk`, `getNarrativeByTopic`, `upsertNarrative` |
| `lib/ai/embedding.ts` | **New file** — `embedText()` using `text-embedding-3-small` |
| `lib/ai/memory-pipeline.ts` | **New file** — dual-write orchestrator (vector chunk + narrative update) |
| `lib/ai/context-assembly.ts` | **New file** — hybrid retrieval (vector search + narrative load → context string) |
| `lib/ai/prompts.ts` | Add `intentRouterPrompt()`, `narrativeAppendPrompt()`, extend `scopedPrompt()` signature |
| `lib/ai/tools/os/create-os-tools.ts` | Extend `logThought` to also write `memory_chunk`; optionally add `recallFacts` tool |
| `app/(chat)/api/os/home-chat/route.ts` | Call `runMemoryPipeline()` via `after()` after routing |
| `app/(chat)/api/os/chat/route.ts` | Call `assembleContext()` and inject into scoped prompt |
| `lib/db/migrations/` | SQL file for pgvector extension, `vector_search` function, HNSW index |

---

## Implementation Order

```
Phase 1 (DB)      → Phase 2 (Utilities)  → Phase 3 (Input pipeline)
     ↓
Phase 4 (Retrieval) → Phase 5 (Tool integration)
     ↓
Phase 6 (UI, deferred)
Phase 7 (Real-time, deferred)
```

Phases 1–3 can be done without any visible UI change. Phase 4 is when the AI starts giving noticeably better answers. Phase 5 closes the loop so every conversation automatically feeds memory.

---

## Decisions Not Made Yet

- **Importance scoring**: The proposal has the LLM score importance (0.0–1.0) as part of the router output. Simple to add — the router already returns JSON. Alternatively, default all chunks to 0.5 and only score if needed later.
- **Superseding old chunks**: When should old facts be marked superseded? The narrative prompt handles this for narratives (marks contradictions as `[SUPERSEDED]`). For vector chunks, a simple approach is: when the LLM router identifies a `CONTEXT_UPDATE` intent, look up recent chunks with high similarity and call `supersedechunk()` on them.
- **Whether to keep `pursuit_thoughts` and `context_summaries`**: They overlap with the new system. Easiest path is to keep both running in parallel initially, then deprecate once the new system is proven. The `logThought` tool change in Phase 5 keeps them in sync automatically.
