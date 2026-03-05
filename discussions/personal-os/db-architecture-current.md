# Personal OS — Infrastructure & Proposal Mapping

> This document maps your existing Vercel-native stack to the information organisation proposal in `personal-os-architecture.jsx`. Every Supabase reference in that proposal has a direct equivalent here — nothing needs to be replaced, only extended.

---

## Existing Infrastructure

| Layer | Technology | Env Var(s) | Current Role |
|---|---|---|---|
| **Primary DB** | Neon Postgres (serverless) | `POSTGRES_URL` | All OS data — pursuits, projects, tasks, memory |
| **ORM** | Drizzle ORM | — | Schema in `lib/db/schema.ts`, queries in `lib/db/queries.ts` |
| **Cache / KV** | Upstash Redis (Vercel KV) | `KV_REST_API_URL`, `KV_URL`, `REDIS_URL` → `noted-whale-41868.upstash.io` | Resumable chat streams (boilerplate only, not yet used by OS) |
| **File Storage** | Vercel Blob | `BLOB_READ_WRITE_TOKEN` | File/audio uploads |
| **LLM routing** | Vercel AI Gateway | `AI_GATEWAY_API_KEY` / OIDC | All model calls — Gemini, Claude, etc. |
| **Audio / Embeddings** | OpenAI | `OPENAI_API_KEY` | Whisper STT today — `text-embedding-3-small` available from same key |

---

## The Proposal (from `personal-os-architecture.jsx`)

The proposal adds two new storage layers on top of the existing pursuit/project/task graph:

### Layer 1 — Vector Store (`memory_chunks`)
Atomic facts and thoughts with embeddings. Each chunk stores a piece of information, its embedding, tags, which pursuits it relates to, and an importance score. Chunks can be versioned (`superseded_by` self-FK).

### Layer 2 — Temporal Narratives (`narratives`)
Living documents, one per major entity or pursuit topic. A narrative is a timestamped markdown log that an LLM appends to after each relevant exchange — with older facts marked `[SUPERSEDED]` when new info contradicts them.

### Pipeline
```
Input (voice/text)
  → [01] Whisper STT if audio
  → [02] LLM Router — classify intent: FACT | TASK | QUESTION | CONTEXT_UPDATE
  → [03] Dual Write (parallel):
      → memory_chunks: embed + insert
      → narratives: LLM appends timestamped entry
  → [04] Task Extraction (if TASK intent):
      → vector similarity match to find project (threshold 0.78)
      → create task, link to chunk_ids
  → [05] Retrieval (if QUESTION):
      → hybrid: vector search (top 8 chunks) + load narrative
      → assemble context → LLM response
```

---

## Supabase → Your Stack (Line by Line)

The proposal's code uses Supabase. Here is every replacement:

| Proposal uses | Your equivalent | Notes |
|---|---|---|
| `supabase.from('memory_chunks').insert(...)` | Drizzle `db.insert(memoryChunk).values(...)` | Same Neon DB, new table |
| `supabase.from('narratives').update(...)` | Drizzle `db.update(narrative).set(...).where(...)` | Same Neon DB, new table |
| `supabase.rpc('vector_search', {...})` | Raw SQL via Drizzle `sql\`\`` or a Postgres function on Neon | Neon supports `pgvector` natively — enable with `CREATE EXTENSION vector` |
| `supabase.rpc('match_projects', {...})` | Same — Postgres function on Neon | Or do similarity in app layer for MVP |
| Supabase pgvector | **Neon Postgres + pgvector extension** | Neon has supported pgvector since 2023. No separate service needed. |
| Supabase Auth | NextAuth v5 | Already implemented |
| Supabase Realtime (for live updates) | **Upstash Redis pub/sub + SSE** | Already provisioned — just needs wiring |

---

## New Tables Needed

Add these to `lib/db/schema.ts`. Both go in the same Neon database.

### `memory_chunks` — Vector Store

```ts
export const memoryChunk = pgTable("memory_chunks", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId").notNull().references(() => user.id),
  text: text("text").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }),  // requires pgvector extension
  tags: json("tags").$type<string[]>().notNull().default([]),
  entityType: varchar("entityType", {
    enum: ["business", "person", "challenge", "insight", "preference"],
  }),
  linkedPursuits: json("linkedPursuits").$type<string[]>().notNull().default([]),
  importance: real("importance").notNull().default(0.5),  // 0.0 – 1.0, LLM-scored
  supersededBy: uuid("supersededBy"),  // self-FK for versioning
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
```

**Indexes to create (raw SQL migration):**
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE INDEX ON memory_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX ON memory_chunks(linked_pursuits, importance)
WHERE superseded_by IS NULL;
```

### `narratives` — Living Documents

```ts
export const narrative = pgTable("narratives", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId").notNull().references(() => user.id),
  topic: text("topic").notNull(),           // e.g. "daga-wallpapers", "marketing"
  topicType: varchar("topicType", {
    enum: ["business", "pursuit", "person", "domain"],
  }).notNull(),
  content: text("content").notNull(),       // timestamped markdown
  summary: text("summary"),                 // LLM-generated TL;DR
  version: integer("version").notNull().default(1),
  lastUpdated: timestamp("lastUpdated").notNull().defaultNow(),
});
```

### Links to add to existing tables

The proposal links tasks back to the vector store and narratives. Add optional FK columns to `projects` and `tasks`:

```ts
// On projects table — add:
narrativeId: uuid("narrativeId"),     // FK → narratives.id

// On tasks table — add:
contextChunkIds: json("contextChunkIds").$type<string[]>().default([]),
```

---

## Vector Search (replacing `supabase.rpc`)

Create this as a Postgres function on Neon (in a migration file):

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
    mc.id, mc.text, mc.tags::text[], mc.importance::float,
    1 - (mc.embedding <=> query_embedding) AS similarity
  FROM memory_chunks mc
  WHERE
    mc.user_id = p_user_id
    AND mc.superseded_by IS NULL
    AND (filter_pursuits IS NULL OR mc.linked_pursuits::text[] && filter_pursuits)
  ORDER BY mc.embedding <=> query_embedding
  LIMIT match_count;
END; $$;
```

Call it from Drizzle using `sql` template tag:

```ts
import { sql } from "drizzle-orm";

const chunks = await db.execute(sql`
  SELECT * FROM vector_search(
    ${embedding}::vector,
    8,
    ${userId}::uuid,
    ${pursuitSlugs}::text[]
  )
`);
```

---

## Embedding (replacing OpenAI SDK calls)

The proposal uses `text-embedding-3-small`. You already have `OPENAI_API_KEY` configured. Use the Vercel AI SDK embed helper (consistent with your existing stack):

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

---

## LLM Router (replacing the classification call)

The proposal's router prompt classifies intent as `FACT | TASK | QUESTION | CONTEXT_UPDATE`. Wire this through `getOSModel()` (Gemini 2.5 Flash Lite) via the existing Vercel AI Gateway — no new API keys needed:

```ts
import { generateObject } from "ai";
import { getOSModel } from "@/lib/ai/providers";
import { z } from "zod";

const { object } = await generateObject({
  model: getOSModel(),
  schema: z.object({
    intents: z.array(z.enum(["FACT", "TASK", "QUESTION", "CONTEXT_UPDATE"])),
    entities: z.array(z.string()),
    pursuitsAffected: z.array(z.string()),
    importance: z.number().min(0).max(1),
  }),
  prompt: ROUTER_PROMPT(userMessage),
});
```

---

## What Exists vs What Needs Building

| Proposal element | Status | Action |
|---|---|---|
| `pursuits` / `projects` / `tasks` tables | ✅ Already built | No change |
| Whisper STT | ✅ Already wired (`OPENAI_API_KEY`, `hooks/use-audio-recorder.ts`) | No change |
| LLM routing / intent classification | ✅ Home-mode router exists | Extend with FACT/CONTEXT_UPDATE intents |
| Thought log (`pursuit_thoughts`) | ✅ Exists | Could feed into `memory_chunks` or replace it |
| Context summaries | ✅ Exists | Could evolve into `narratives` |
| `memory_chunks` vector table | ⚠️ Not yet | Add to schema, enable pgvector on Neon |
| `narratives` living doc table | ⚠️ Not yet | Add to schema |
| `context_chunk_ids` on tasks | ⚠️ Not yet | Add column to tasks table |
| `narrative_id` on projects | ⚠️ Not yet | Add column to projects table |
| Vector search Postgres function | ⚠️ Not yet | Write migration SQL |
| Embedding utility | ⚠️ Not yet | Small util using existing `OPENAI_API_KEY` |
| Narrative append LLM call | ⚠️ Not yet | New prompt + tool in OS layer |
| Real-time card updates | ⚠️ Not yet | Upstash Redis already provisioned — needs SSE route |

---

## Drizzle Note on pgvector

Drizzle ORM has native pgvector support via `drizzle-orm/pg-core`. Import `vector` from there. You'll also need to run `CREATE EXTENSION IF NOT EXISTS vector;` as a one-off migration before generating the schema.

---

## Adding the New Tables

1. Enable pgvector: add a raw SQL migration file before running `db:generate`
2. Add `memoryChunk` and `narrative` tables to `lib/db/schema.ts`
3. Add optional FK columns to `project` and `task` tables
4. `pnpm db:generate` → `pnpm db:migrate`
5. Create `vector_search` Postgres function via a separate SQL migration
