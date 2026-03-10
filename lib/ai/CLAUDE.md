<system_context>
All AI model configuration, provider setup, system prompts, entitlements, and the two sub-systems for agents and tools. Every LLM call in the project routes through this directory.
</system_context>

<file_map>
## FILE MAP
- `providers.ts` — Model getter functions (all via Vercel AI Gateway `@ai-sdk/gateway`).
- `models.ts` — `chatModels[]` curated list with provider grouping; `DEFAULT_CHAT_MODEL`.
- `prompts.ts` — All system/user prompt strings and constructors.
- `entitlements.ts` — Rate limits by user type (guest: 20 msg/day, regular: 50 msg/day).
- `models.mock.ts` / `models.test.ts` — Test-only stubs; production code ignores these.
- `agents/` → See `agents/CLAUDE.md`
- `tools/` → See `tools/CLAUDE.md`
</file_map>

<patterns>
## PATTERNS

### providers.ts — model getters
```typescript
getLanguageModel(modelId)  // user-selected chat model; wraps with reasoning middleware if needed
getTitleModel()            // always google/gemini-2.5-flash-lite
getArtifactModel()         // always anthropic/claude-haiku-4.5
getOSModel()               // always google/gemini-2.5-flash-lite (used by agents)
```
All model IDs use `provider/model-name` format (e.g. `"anthropic/claude-haiku-4.5"`).

### prompts.ts — key exports
- `systemPrompt({ selectedChatModel, requestHints })` — composites `regularPrompt` + geo hints + `artifactsPrompt` (omits artifacts for reasoning models)
- `artifactsPrompt` — instructions for `createDocument` / `updateDocument` / `requestSuggestions` tool use
- `titlePrompt` — few-shot prompt for chat title generation (2–5 words, no formatting)
- `codePrompt` / `sheetPrompt` — artifact-specific generation instructions
- `updateDocumentPrompt(currentContent, type)` — improvement prompt for existing artifacts

### Reasoning model detection
```typescript
modelId.includes("reasoning") || modelId.includes("thinking")
```
Used in both `providers.ts` (to apply `extractReasoningMiddleware`) and `app/(chat)/api/chat/route.ts` (to skip tool registration).
</patterns>

<critical_notes>
## CRITICAL NOTES
- **`getOSModel()` is hardcoded** — Never make the OS/agents model user-configurable. It must always be Gemini 2.5 Flash Lite.
- **AI Gateway required** — Non-Vercel deployments need `AI_GATEWAY_API_KEY` in `.env.local`. Without it, all LLM calls fail.
- **Adding a new user-selectable model** — Add an entry to `chatModels[]` in `models.ts`. The gateway handles routing; no other config needed.
- **Test environment** — `isTestEnvironment` switches `myProvider` to mock models from `models.mock.ts`. The real gateway is never called during tests.
</critical_notes>
