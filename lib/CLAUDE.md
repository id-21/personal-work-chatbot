<system_context>
All shared server-side business logic: AI model setup, database access, rich text editing, semantic memory, and artifact handling. Nothing here is rendered directly — it's all consumed by API routes and server components.
</system_context>

<file_map>
## FILE MAP
- `ai/` — Model providers, prompts, entitlements, agents, tools. See `ai/CLAUDE.md`.
- `db/` — Drizzle schema, query functions, migrations. See `db/CLAUDE.md`.
- `editor/` — ProseMirror document editing utilities. See `editor/CLAUDE.md`.
- `memory/` — Vector embeddings, semantic search, reflection/narrative queries. See `memory/CLAUDE.md`.
- `artifacts/server.ts` — `createDocumentHandler()` factory + `documentHandlersByArtifactKind` registry (text, code, sheet). Handlers are defined in the root `artifacts/` directory.
- `constants.ts` — `isTestEnvironment`, `isProductionEnvironment` flags.
- `errors.ts` — `ChatSDKError` class with typed error codes and `toResponse()` helper.
- `types.ts` — `ChatMessage` and other shared TypeScript types used across routes and components.
- `utils.ts` — `generateUUID()`, `convertToUIMessages()`, `sanitizeText()`, `cn()` (clsx + tailwind-merge).
</file_map>

<critical_notes>
## CRITICAL NOTES
- **`server-only` guards** — Files in `ai/agents/` and `memory/` use `import "server-only"`. Never import them from client components or Edge runtime code.
- **Artifact handlers live outside `lib/`** — The per-type handlers (text, code, sheet) are in the root `artifacts/` directory, not in `lib/`. `lib/artifacts/server.ts` is just the factory and registry.
- **`ChatSDKError`** — All API routes should throw or return this for consistent error responses. Constructor takes an error code string like `"bad_request:api"`.
</critical_notes>
