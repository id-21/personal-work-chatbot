<system_context>
Database layer using Drizzle ORM with Neon Serverless Postgres. Contains the unified schema for both boilerplate chat tables and Personal OS tables, plus all query functions and migrations.
</system_context>

<file_map>
## FILE MAP
- `schema.ts` - All table definitions (Drizzle schema). Single source of truth for types.
- `queries.ts` - All database query functions (both boilerplate and OS queries)
- `utils.ts` - DB connection and Drizzle client setup
- `migrate.ts` - Migration runner script
- `migrations/` - SQL migration files (numbered 0000–0009)
- `migrations/meta/` - Drizzle migration metadata (auto-generated, don't edit)
- `helpers/01-core-to-parts.ts` - One-time migration helper for message format change
</file_map>

<patterns>
## PATTERNS

**Schema split (schema.ts):**
- **Lines 1–171** — Boilerplate tables: `User`, `Chat`, `Message_v2`, `Vote_v2`, `Document`, `Suggestion`, `Stream`. Also deprecated `Message` and `Vote` tables (kept for migration compatibility).
- **Lines 173–288** — Personal OS tables (comment-delimited): `user_model`, `pursuits`, `projects`, `tasks`, `pursuit_thoughts`, `context_summaries`, `routing_log`

**OS table enums:**
- `projects.status`: `'active' | 'paused' | 'completed' | 'idea'`
- `tasks.status`: `'open' | 'in_progress' | 'done' | 'dismissed'`
- `tasks.source`: `'user' | 'ai_suggested'`
- `pursuit_thoughts.author`: `'user' | 'ai'`
- `context_summaries.scope`: `'pursuit' | 'project'`
- `routing_log.action`: `'created_task' | 'updated_task' | 'created_project' | 'no_action'`

**Adding a query:** Add to `queries.ts`. Import Drizzle table from `schema.ts`. Use the Drizzle query builder (`db.select().from().where()`). Export as a named function.

**Adding a new table:** Add to `schema.ts` below the OS section, run `pnpm drizzle-kit generate` to create a migration, then `pnpm db:migrate` to apply.
</patterns>

<critical_notes>
## CRITICAL NOTES
- **`user_model` is 1:1 with `User`** — One row per user (unique constraint on `userId`). Use upsert when creating.
- **Do not edit `migrations/meta/`** — Drizzle auto-generates these. Running `drizzle-kit generate` updates them.
- **Deprecated tables stay** — `Message` and `Vote` are deprecated but must remain for migration compatibility. Use `Message_v2` and `Vote_v2` for new code.
- **`routingLog` has no FK on `classifiedPursuitId` or `classifiedProjectId`** — These can be null if routing produced no classification. Handle nulls in queries.
- **All exported types** are `InferSelectModel<typeof tableName>` — import these instead of defining your own interfaces.
</critical_notes>
