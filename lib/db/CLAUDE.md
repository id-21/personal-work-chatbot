<system_context>
Drizzle ORM definitions and query functions for Neon Postgres. Covers core chat tables, artifact/document tables, and the custom memory tables (MemoryChunk, Narrative, Reflection). Memory-specific queries live in `lib/memory/queries.ts`, not here.
</system_context>

<file_map>
## FILE MAP
- `schema.ts` — All table definitions and exported TypeScript types. Source of truth for DB structure.
- `queries.ts` — Query functions for core chat SDK tables (User, Chat, Message, Document, Suggestion, Vote, Stream).
- `utils.ts` — `generateHashedPassword(password)`, `generateDummyPassword()` — bcrypt-ts helpers for auth flows.
- `migrate.ts` — Migration runner called by `pnpm build` and `pnpm db:migrate`.
- `migrations/` — SQL migration files. Generate with `pnpm db:generate`; apply with `pnpm db:migrate`.
- `helpers/01-core-to-parts.ts` — One-time data migration helper (core → parts format).
</file_map>

<patterns>
## PATTERNS

### schema.ts — table inventory

**Core chat tables (boilerplate):**
- `user` (User) — id, email, password
- `chat` (Chat) — id, userId, title, visibility, createdAt
- `message` (Message_v2) — id, chatId, role, parts (json), attachments (json), createdAt
- `vote` (Vote_v2) — chatId + messageId composite PK, isUpvoted
- `document` (Document) — composite PK `(id, createdAt)`, kind enum, content, userId
- `suggestion` (Suggestion) — with foreign key to `(document.id, document.createdAt)`
- `stream` (Stream) — for resumable streams

**Deprecated tables (do not use):**
- `messageDeprecated` (Message) — superseded by Message_v2
- `voteDeprecated` (Vote) — superseded by Vote_v2

**Memory tables (custom):**
- `memoryChunk` (MemoryChunk) — text, embedding (vector 768), tags, importance, supersededBy, sourceMessageIds
- `narrative` (Narrative) — userId, topic, content, summary, version, updatedAt
- `reflection` (Reflection) — userId, chatId, status, proposedFacts, proposedPursuits, casualTopics
- `reflectionFeedback` (ReflectionFeedback) — reflectionId, itemId, itemType, action, editedText

**TypeScript interfaces (not tables):**
- `ProposedFact` — id, text, topic, confidence, sourceQuote, sourceMessageIds
- `ProposedPursuit` — id, title, rationale, urgency, sourceMessageIds
</patterns>

<critical_notes>
## CRITICAL NOTES
- **Never write new code against `Message` or `Vote`** — these are the deprecated tables. Use `message` (Message_v2) and `vote` (Vote_v2) exports.
- **`Document` composite PK** — Primary key is `(id, createdAt)`. When referencing a document by ID alone (e.g. foreign keys from Suggestion), both columns must be included.
- **pgvector extension required** — `MemoryChunk.embedding` uses a custom `vectorColumn` type with 768 dimensions. Neon Postgres must have the extension enabled before migrations run.
- **Schema changes workflow** — Edit `schema.ts` → `pnpm db:generate` → `pnpm db:migrate`. Never hand-edit migration SQL files.
- **Memory queries are separate** — `lib/db/queries.ts` does NOT contain memory functions. Those are all in `lib/memory/queries.ts`.
</critical_notes>
