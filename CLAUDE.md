# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start dev server with Turbo
pnpm build        # Runs DB migrations then Next.js build
pnpm lint         # Check code with Biome (via ultracite check)
pnpm format       # Auto-fix with Biome (via ultracite fix)
pnpm test         # Run Playwright e2e tests

pnpm db:generate  # Generate Drizzle migration files from schema changes
pnpm db:migrate   # Apply pending migrations to the database
pnpm db:studio    # Open Drizzle Studio to browse the DB
pnpm db:push      # Push schema directly to DB (dev only, no migration file)
```

## Architecture

### Route groups

- `app/(auth)/` — Login/register pages and NextAuth routes
- `app/(chat)/` — All chat UI pages and API routes. Also hosts auth middleware via layout.

Root URL `/` renders `app/(chat)/page.tsx` (new chat).

### Core AI chat flow

`POST /api/chat` ([app/(chat)/api/chat/route.ts](app/(chat)/api/chat/route.ts)) is the primary endpoint. It:
1. Assembles memory context via `assembleContext()` in `lib/memory/context-assembly.ts`
2. Streams a response using the user-selected model via `getLanguageModel()` in `lib/ai/providers.ts`
3. After streaming, triggers `updateKnowledgeBase()` (knowledge-agent) and `runReflectionAgent()` (reflection-agent) via `next/server`'s `after()`

### AI models

All models route through the **Vercel AI Gateway** (`@ai-sdk/gateway`):
- **Chat model**: user-selectable from `lib/ai/models.ts`. Default: `google/gemini-2.5-flash-lite`
- **Title model**: `google/gemini-2.5-flash-lite` (hardcoded via `getTitleModel()`)
- **Artifact model**: `anthropic/claude-haiku-4.5` (hardcoded via `getArtifactModel()`)
- **Embedding model**: `google/text-embedding-004` (768 dimensions, used in `lib/memory/embedding.ts`)

For non-Vercel environments, set `AI_GATEWAY_API_KEY` in `.env.local`.

### Artifacts system

Chat tools (defined in `lib/ai/tools/`) allow the AI to create/update rich artifacts rendered in a side panel:
- `createDocument` / `updateDocument` — text, code, sheet, image artifacts
- `requestSuggestions` — inline document suggestions
- `getWeather` — example tool

Reasoning/thinking models skip tools entirely (they cannot use tool calling).

### Memory system

Located in `lib/memory/` and `lib/ai/agents/`:

- **Embeddings**: `lib/memory/embedding.ts` — wraps AI Gateway text embedding
- **Vector search**: `lib/memory/queries.ts` — cosine similarity search over `MemoryChunk` table (pgvector)
- **Context assembly**: `lib/memory/context-assembly.ts` — retrieves relevant chunks + associated `Narrative` doc to prepend to system prompt
- **Knowledge agent** (`lib/ai/agents/knowledge-agent.ts`): Runs after each chat, maintains a single living markdown knowledge base document per user (stored as a `Document` record with a special title)
- **Reflection agent** (`lib/ai/agents/reflection-agent.ts`): Runs after each chat, extracts `ProposedFact[]` and `ProposedPursuit[]` → saved as a `Reflection` record with status `pending`
- **Narrative agent** (`lib/ai/agents/narrative-agent.ts`): Maintains per-topic narrative documents

Users review pending reflections at `/reflections`. Confirmed reflections feed into `MemoryChunk` rows that power future context assembly.

### Database schema

Drizzle ORM with Neon Postgres. Schema is in `lib/db/schema.ts`. Key tables:
- `User`, `Chat`, `Message_v2`, `Vote_v2`, `Document`, `Suggestion`, `Stream` — core chat SDK tables
- `MemoryChunk` — pgvector embeddings (768d) for semantic memory retrieval
- `Narrative` — per-topic narrative summaries merged from memory chunks
- `Reflection` / `ReflectionFeedback` — pending fact/pursuit proposals awaiting user review

> `Message` and `Vote` tables are **deprecated** (replaced by `Message_v2` and `Vote_v2`). Do not write new code against them.

When changing the schema: `pnpm db:generate` then `pnpm db:migrate`.

### Linting / formatting

Uses **Biome** via the `ultracite` wrapper. No ESLint. Key constraints from `.cursor/rules/ultracite.mdc`:
- No TypeScript enums — use `as const` objects instead
- No `any` type — use proper types or `unknown`
- Use `import type` for type-only imports
- No non-null assertions (`!`)
- No `console` calls in production code
- Use `for...of` instead of `.forEach()`
- Arrow functions over function expressions

### Auth

NextAuth v5 (`next-auth@5.0.0-beta.25`). Config split across `app/(auth)/auth.config.ts` (edge-safe) and `app/(auth)/auth.ts` (full, with DB adapter). Guest auth supported via `/api/auth/guest`.


## Setup / rebuild
`node_modules/` and `.next/` are disposable; `pnpm-lock.yaml` pins everything (pnpm 9.12.3).
```bash
pnpm install
pnpm db:migrate     # apply Drizzle migrations
pnpm dev            # next dev --turbo
```
Keep `.env.local` (copy from `.env.example` if lost; needs the DB URL and auth/AI keys). The `.venv/` holds only dev tooling (pytest, flake8) and is disposable: `python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt`.
