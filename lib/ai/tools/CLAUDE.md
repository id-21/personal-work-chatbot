<system_context>
Vercel AI SDK `tool()` definitions that extend the LLM's capabilities in the main chat. All document tools stream progress to the client via `dataStream` and delegate persistence to handlers in `lib/artifacts/server.ts`.
</system_context>

<file_map>
## FILE MAP
- `create-document.ts` — Creates a new text/code/sheet artifact; streams `data-kind`, `data-id`, `data-title`, `data-clear`, `data-finish` events.
- `update-document.ts` — Updates an existing document by ID; delegates to the same kind-specific handler.
- `request-suggestions.ts` — Streams sentence-level suggestions from `getArtifactModel()` (Claude Haiku 4.5); saves to `Suggestion` table.
- `get-weather.ts` — Geocoding (Open-Meteo) + current forecast. Has `needsApproval: true`.
</file_map>

<patterns>
## PATTERNS

### Document tool signature
All document tools are factory functions:
```typescript
export const createDocument = ({ session, dataStream }: Props) => tool({ ... })
```
They are instantiated in `app/(chat)/api/chat/route.ts` when building the tools object.

### dataStream event sequence for document tools
```
data-kind   → artifact type ("text" | "code" | "sheet")
data-id     → new document UUID
data-title  → document title
data-clear  → signals client to clear current artifact content
[handler streams content chunks directly]
data-finish → signals completion
```

### Adding a new tool
1. Create file in `lib/ai/tools/`
2. Export factory function using `tool()` from `ai`
3. Register in `app/(chat)/api/chat/route.ts` tools object
4. If it creates/updates a document, add a handler in `lib/artifacts/server.ts` and register in `documentHandlersByArtifactKind`
</patterns>

<critical_notes>
## CRITICAL NOTES
- **Reasoning models skip tools** — In `app/(chat)/api/chat/route.ts`, models with IDs containing `"reasoning"` or `"thinking"` are passed an empty tools object. New tools must respect this gate.
- **`needsApproval: true`** — `get-weather.ts` uses this flag (Vercel AI SDK feature) to pause and ask user confirmation before executing. Apply to any tool with external side effects.
- **`request-suggestions` model** — Uses `getArtifactModel()` (Claude Haiku 4.5), not the user-selected chat model.
- **Document handler lookup** — Tools find handlers via `documentHandlersByArtifactKind.find(h => h.kind === kind)`. If no handler matches, the tool will throw.
</critical_notes>
