Here's the full arc of what we've designed:

---

## Personal OS — Architecture Recap

### The Goal
A voice/text AI interface that builds a deep, evolving understanding of you and your business — automatically categorizing tasks, retaining context, and helping you plan — without injecting noise or making autonomous decisions you didn't sanction.

---

### Memory Architecture: Two Parallel Layers

**Layer 1 — Vector Store** (`memory_chunks` table)
Atomic facts stored as embeddings. Fast fuzzy retrieval across all topics. Cross-linked to multiple pursuits simultaneously. Facts can supersede each other when they become stale.

**Layer 2 — Temporal Narratives** (`narratives` table)
One living markdown document per major topic (e.g. "daga-wallpapers", "marketing"). Timestamped, append-only, LLM-maintained. Richer than individual chunks — pre-synthesized context.

**Layer 3 — Task Graph** (`pursuits → projects → tasks`)
Your execution layer. Linked to relevant memory chunks and narratives so context travels with tasks.

---

### How Information Flows In

**Not** inline during the conversation. The main agent just responds — it doesn't touch memory.

Instead, at session end a **Reflection Agent** reads the full conversation and outputs structured candidates:
- Facts to potentially store
- Pursuit/project candidates with urgency
- Topics it deems casual/ignorable

This output is shown to you as a **Reflection Card** in the UI. Nothing gets written to the database until you review and confirm. You accept, reject, or refine each item. Only then does memory get updated.

This solves the core problem of autonomous agents injecting irrelevant context — casual conversations, random reading, fact-checking — none of it enters the system unless you promote it.

---

### How Information Flows Out (Retrieval)

When you ask a question, a hybrid retrieval assembles context:
1. Vector search → top 8 relevant chunks
2. Narrative for the primary topic → loaded in full
3. Open tasks for relevant pursuits → brief list
4. All three injected into the LLM's system prompt

---

### Key Design Decisions

| Decision | Rationale |
|---|---|
| Reflection Agent, not inline extraction | Prevents noise, gives you control |
| Human-in-the-loop confirmation | Casual thinking shouldn't pollute strategic context |
| Narratives separate from chunks | Chunks are fast recall; narratives are rich synthesis |
| Supersession on contradictions | Facts go stale — old chunks marked dead, not deleted |
| Upstash Queue for async jobs | Reflection agent runs after session, doesn't block responses |

---

### Stack
Neon Postgres + pgvector, Upstash Redis/Queue, Next.js API routes, OpenAI embeddings (`text-embedding-3-small`), Claude/GPT-4o for reasoning, Vercel for hosting.

---

### Implementation Phases
1. DB foundation (pgvector, new tables, HNSW index)
2. Core utilities (embedding helper, vector search RPC, narrative queries)
3. Reflection agent + session-end trigger + Reflection Card UI
4. Retrieval layer wired into chat routes
5. `logThought` tool writes to vector store automatically
6. Narrative surfacing in UI *(deferred)*
7. Real-time card updates via SSE *(deferred)*

____________________________________________

Given everything we've designed, here's the complete build sequence starting from a bare chat template.

---

## Assumptions about the starting template
- Next.js app with a working chat UI
- Postgres database (Neon) with basic auth + `messages` table
- OpenAI API key wired in
- Vercel deployment

---

## Phase 0 — Data Foundation

Everything else depends on this being correct first.

Add pgvector extension, create all new tables, run HNSW index. Nothing in the app changes yet — just DB schema.

**Tables to create:**
- `memory_chunks` (text, embedding vector, tags, importance, superseded_by)
- `narratives` (topic, content, summary, version)
- `pursuits`, `projects`, `tasks` (the task graph)
- `reflections` (stores reflection agent output per session)
- `reflection_feedback` (stores user's accept/reject per item)

**Also add** the `vector_search` Postgres function and indexes.

Verify by opening Drizzle Studio and confirming all tables exist with correct columns.

---

## Phase 1 — Core Utilities (no UI changes)

Build all the reusable building blocks every later phase will call.

- `embedText()` — wraps OpenAI embedding API
- `vectorSearch()` — calls the Postgres RPC
- `createMemoryChunk()`, `getNarrativeByTopic()`, `upsertNarrative()` — Drizzle query functions
- `supersededChunk()` — marks old facts dead
- Task graph CRUD — create/read/update for pursuits, projects, tasks

Test with a throwaway script (`scripts/test-memory.ts`) — manually insert chunks, run vector search, verify similarity scores come back sensibly.

---

## Phase 2 — The Main Chat Agent

Wire up the primary conversational agent. At this stage it has **no memory** — it just responds well.

- System prompt that describes its role (Personal OS for Daga Wallpapers)
- Scoped vs. home mode if you want that distinction
- Streaming responses
- Messages persisted to DB per session
- Session ID tracked in URL or state

**Do not add memory here yet.** Get the chat experience solid first. This is your baseline.

---

## Phase 3 — Session-End Trigger

Add the mechanism that fires when a conversation ends. The memory pipeline hangs off this.

- Detect session end (tab close, explicit "end session" button, or inactivity timeout)
- On trigger, push `{ userId, conversationId }` to Upstash Queue
- Add a worker route (`/api/workers/reflection`) that Upstash calls
- Worker fetches the full conversation from DB and passes to the reflection agent

At this stage the worker can just `console.log` the conversation — verify the queue trigger is actually firing reliably before building what happens next.

---

## Phase 4 — Reflection Agent

The reflection agent is the heart of the system. Build and tune this carefully.

- Prompt that reads the full conversation and outputs structured JSON:
  - Candidate facts (with confidence, entity type)
  - Pursuit/project candidates (with urgency, rationale)
  - Topics flagged as casual/ignorable
- Parse and validate the JSON output
- Store the reflection output in the `reflections` table
- **Do not write to memory yet** — just store what the agent proposed

Test by running real conversations and inspecting what the agent extracts. Tune the prompt until the distinction between casual and substantive feels right. This is the most important prompt in the whole system — worth spending real time on.

---

## Phase 5 — Reflection Card UI

Surface the agent's proposals to the user for confirmation.

- New page or drawer: shows pending reflections after a session
- Each item is expandable (shows the exact quote from the conversation that generated it)
- User can accept / reject / edit each item individually
- Batch confirm button
- `POST /api/os/reflections/{id}/confirm` processes the feedback

On confirm, **now** write to memory:
- Accepted facts → `memory_chunks` with embeddings
- Accepted pursuits/projects → task graph
- Narrative updates for affected topics

This is the first time data actually enters the memory system. Verify after confirming a reflection that chunks appear in the DB and narratives are created.

---

## Phase 6 — Retrieval Layer

Now that memory exists, wire it into the chat agent's context.

- `assembleContext()` function — embeds the query, runs vector search, loads relevant narrative, pulls open tasks
- Inject assembled context into the main agent's system prompt on every message
- Test by asking questions that should be answerable from stored memory

This is when the system starts feeling alive — the agent references things you said in previous sessions without you re-explaining them.

---

## Phase 7 — Narrative Maintenance

Add the living document update logic so narratives evolve as memory grows.

- `narrativeAppendPrompt()` — LLM appends a timestamped line to the right narrative when new facts are confirmed
- Contradiction detection — when a new fact contradicts an existing chunk, mark old chunk `superseded_by`, append `[SUPERSEDED]` note in narrative
- Background summarization job — when a narrative exceeds ~3000 words, compress old entries into a header summary, keep recent entries verbatim

---

## Phase 8 — Task Graph UI

Make pursuits, projects, and tasks visible and interactive.

- Pursuit cards on dashboard
- Project list per pursuit
- Task list per project with status (backlog / active / blocked / done)
- Tasks link back to the memory chunks that created them (so you can see "why does this task exist?")
- Ability to manually create/edit/reorder without going through the AI

---

## Phase 9 — `logThought` Tool (closing the loop)

Give the main chat agent the ability to proactively log things mid-conversation without waiting for session end.

- `logThought` tool available to the scoped agent
- When called, writes directly to `memory_chunks` with `importance: 0.6` default
- Also optionally updates the relevant narrative
- Useful for explicit commitments ("I'm going to do X") that shouldn't wait for reflection

---

## Phase 10 — Polish (deferred)

These improve the experience but aren't required for the system to work.

- Real-time dashboard updates via SSE when a reflection creates new tasks
- Narrative viewer on pursuit detail page (shows the living doc the AI maintains)
- Memory audit page (browse all chunks, see supersession chains)
- Reflection history (past confirmed reflections with what was accepted/rejected)

---

## The build order in one view

```
Phase 0  DB schema
Phase 1  Utilities
Phase 2  Chat agent (no memory)
Phase 3  Session-end trigger
Phase 4  Reflection agent (tune carefully)
Phase 5  Reflection card UI + memory writes
Phase 6  Retrieval wired into chat
Phase 7  Narrative maintenance
Phase 8  Task graph UI
Phase 9  logThought tool
Phase 10 Polish (deferred)
```

Phases 0–2 give you a working chat. Phases 3–5 give you controlled memory ingestion. Phase 6 is where it becomes noticeably smarter. Everything after is refinement.