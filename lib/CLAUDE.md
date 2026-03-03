<system_context>
Shared utilities, database layer, AI configuration, and business logic. The `ai/` and `db/` subdirectories contain the core of the Personal OS implementation; the rest is boilerplate.
</system_context>

<file_map>
## FILE MAP

**Custom Personal OS:**
- `ai/` - Prompts, models, providers, tools. See [ai/CLAUDE.md](ai/CLAUDE.md). Heavily modified.
- `db/` - Drizzle schema, queries, migrations. See [db/CLAUDE.md](db/CLAUDE.md). Contains all OS tables.

**Boilerplate:**
- `editor/` - ProseMirror rich text editor configuration. Do not modify.
- `artifacts/server.ts` - Artifact server utilities. Do not modify.
- `types.ts` - Shared TypeScript types (chat SDK types).
- `utils.ts` - `cn()` utility from shadcn + general helpers.
- `constants.ts` - App-wide constants.
- `errors.ts` - Error class definitions.
</file_map>

<critical_notes>
## CRITICAL NOTES
- **`ai/` and `db/` are where OS feature work happens** — See their individual CLAUDE.md files.
- **`utils.ts` has `cn()`** — Use `cn()` for conditional Tailwind class merging throughout the app.
- **Do not add OS-specific utilities to `utils.ts`** — Keep OS logic in `ai/` or `db/`.
</critical_notes>
