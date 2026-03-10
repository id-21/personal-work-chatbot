# Always-On Memory Agent (Google ADK port to TypeScript)

## Context

The Google ADK "Always-On Memory Agent" uses a completely different philosophy from our existing vector memory system — no embeddings, no human confirmation, no similarity search. Instead it uses a pure LLM pipeline: an IngestAgent extracts structured facts from conversations, a ConsolidateAgent periodically finds cross-cutting connections between all memories (like the brain during sleep), and a QueryAgent synthesizes an answer by reading all memories at once.

We're porting this to TypeScript so it runs inside the existing Next.js app — no Python process needed. It runs as a **parallel, independent** memory system. Both systems log their context outputs side-by-side (`[memory:vector]` vs `[memory:adk]`) for comparison. No UI change.

---

## Key Differences vs. Our Existing System

| Our System | ADK System |
|---|---|
| Embeddings → similarity search | LLM reads all memories directly |
| Human confirms before storing | Automatic, immediate ingest |
| Session-end trigger | Live ingest after every message |
| Passive storage | **Active consolidation** (finds cross-connections) |

---

## Architecture

```
After each AI response (onFinish):
  └─ after() → ingestExchange() → AdkMemory row created
                                → if ≥5 unconsolidated: runConsolidation() via after()

Before each LLM call:
  ├─ assembleContext() → vector search          → console.log '[memory:vector]'
  └─ queryAdkMemory()  → LLM reads all memories → console.log '[memory:adk]'
  Both results injected into system prompt
```

---

## Phase 1 — DB Schema

Add 2 tables to `lib/db/schema.ts`:

```typescript
export const adkMemory = pgTable("AdkMemory", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId").notNull().references(() => user.id),
  chatId: uuid("chatId").references(() => chat.id),
  source: text("source").notNull(),                      // e.g. "chat-exchange"
  summary: text("summary").notNull(),
  entities: json("entities").$type<string[]>().notNull().default([]),
  topics: json("topics").$type<string[]>().notNull().default([]),
  importance: real("importance").notNull().default(0.5),
  consolidated: boolean("consolidated").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const adkInsight = pgTable("AdkInsight", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId").notNull().references(() => user.id),
  insight: text("insight").notNull(),
  memoryIds: json("memoryIds").$type<string[]>().notNull().default([]),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
```

Run: `pnpm drizzle-kit generate && pnpm db:migrate`

---

## Phase 2 — `lib/memory/adk/queries.ts` (new)

Drizzle CRUD:
- `createAdkMemory({ userId, chatId, source, summary, entities, topics, importance })`
- `getUnconsolidatedAdkMemories({ userId, limit? })` — where `consolidated = false`, capped at 30
- `getAllAdkMemories({ userId, limit? })` — most recent N (default 50), ordered by `createdAt desc`
- `countUnconsolidatedAdkMemories({ userId })` — count
- `markMemoriesConsolidated({ ids })` — batch update
- `createAdkInsight({ userId, insight, memoryIds })`
- `getAllAdkInsights({ userId })` — all insights for user

---

## Phase 3 — IngestAgent (`lib/memory/adk/ingest-agent.ts`)

Called after every AI response. Single LLM call via `getOSModel()`.

**`buildExchangeText(finishedMessages)`** — helper that extracts the latest user + assistant turn as a plain string. Returns empty if nothing substantive.

**`ingestExchange({ userId, chatId, exchangeText })`**:
1. Call LLM with prompt asking for:
   ```json
   { "summary": "...", "entities": ["..."], "topics": ["..."], "importance": 0.7 }
   ```
2. Zod-validate. Silently skip on failure.
3. `createAdkMemory(...)` — save to DB
4. Check `countUnconsolidatedAdkMemories`. If ≥ 5, schedule `runConsolidation()` via `after()`.

---

## Phase 4 — ConsolidateAgent (`lib/memory/adk/consolidate-agent.ts`)

Runs async via `after()`. Single LLM call via `getOSModel()`.

**`runConsolidation({ userId })`**:
1. Load up to 30 unconsolidated memories
2. Call LLM with summaries + topics, asking for:
   ```json
   { "connections": [{ "memoryIds": ["...", "..."], "insight": "..." }] }
   ```
3. Save each connection as `AdkInsight`
4. Mark all input memories as `consolidated = true`

Cap at 30 memories per run to keep prompt bounded.

---

## Phase 5 — QueryAgent (`lib/memory/adk/query-agent.ts`)

Called before streaming in the chat route.

**`queryAdkMemory({ userId, userMessage })`**:
1. Load last 50 `AdkMemory` rows (summary + topics) + all `AdkInsight` rows
2. If no memories → return `""`
3. Call LLM: "Given these memories and insights, what is relevant to: [userMessage]?"
4. Return plain string — same shape as `assembleContext()` output

---

## Phase 6 — Wire into Chat Route

Two changes to `app/(chat)/api/chat/route.ts`:

### 6a. Context assembly (replace existing block, lines ~141–159)

```typescript
let memoryContext = "";
let adkContext = "";

if (process.env.MEMORY_ENABLED && message?.role === "user") {
  const latestText = /* existing extraction */;
  if (latestText) {
    [memoryContext, adkContext] = await Promise.all([
      assembleContext({ userId: session.user.id, userMessage: latestText }).catch(() => ""),
      queryAdkMemory({ userId: session.user.id, userMessage: latestText }).catch(() => ""),
    ]);
    console.log("[memory:vector]", memoryContext || "(none)");
    console.log("[memory:adk]", adkContext || "(none)");
  }
}

const contextBlock = [memoryContext, adkContext].filter(Boolean).join("\n\n---\n\n");
```

Then in `execute`:
```typescript
const fullSystemPrompt = contextBlock
  ? `${baseSystemPrompt}\n\n---\n\n${contextBlock}`
  : baseSystemPrompt;
```

### 6b. onFinish — live ingest (add after existing KB agent trigger)

```typescript
after(async () => {
  const { buildExchangeText, ingestExchange } = await import("@/lib/memory/adk/ingest-agent");
  const exchangeText = buildExchangeText(finishedMessages);
  if (exchangeText) {
    await ingestExchange({ userId: session.user.id, chatId: id, exchangeText });
  }
});
```

---

## Files Summary

### New files
| File | Purpose |
|---|---|
| `lib/memory/adk/queries.ts` | Drizzle CRUD for AdkMemory + AdkInsight |
| `lib/memory/adk/ingest-agent.ts` | Extract facts from exchange, trigger consolidation |
| `lib/memory/adk/consolidate-agent.ts` | Find cross-connections between memories |
| `lib/memory/adk/query-agent.ts` | Synthesize memory context for current question |

### Modified files
| File | Change |
|---|---|
| `lib/db/schema.ts` | Add `adkMemory` + `adkInsight` tables (~25 lines) |
| `app/(chat)/api/chat/route.ts` | Parallel context query + logging; live ingest in onFinish |

---

## Verification

1. **After migration**: Confirm `AdkMemory` + `AdkInsight` tables exist in Drizzle Studio
2. **After a chat message**: Check DB for a new `AdkMemory` row with non-empty `summary`
3. **After 5 messages**: Check DB for `AdkInsight` rows; all input memories show `consolidated = true`
4. **On next message**: Check server logs for `[memory:vector]` and `[memory:adk]` side-by-side
5. **Cold start** (no memories yet): Both log `(none)`, chat works normally

---

## Notes

- Both systems gated by `MEMORY_ENABLED` — zero impact on template if unset
- ADK system is fully automatic — no human confirmation — treat as passive comparison baseline
- `buildExchangeText()` passes only the **latest** user+assistant turn (not full history) — keeps each memory atomic
- QueryAgent reads last 50 memories + all insights. If memory grows large, filter by `importance` descending
