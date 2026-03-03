<system_context>
AI configuration, prompts, model definitions, and provider setup for the entire application. The prompts and OS model choice here are custom; everything else is largely boilerplate adapted from the Chat SDK.
</system_context>

<file_map>
## FILE MAP
- `prompts.ts` - **Custom.** All system prompts: onboarding, routing, scoped, plus boilerplate chat prompts.
- `models.ts` - **Custom additions.** Multi-provider model list with entitlements. OS uses Gemini 2.5 Flash Lite.
- `providers.ts` - **Custom.** AI provider factory. `getOSModel()` always returns Gemini 2.5 Flash Lite.
- `summary.ts` - **Custom.** Async context summary regeneration logic for scoped conversations.
- `entitlements.ts` - Model access rules per user type (boilerplate).
- `models.test.ts` - Model list tests (boilerplate).
- `models.mock.ts` - Mock models for testing (boilerplate).
- `tools/` - AI tool implementations. See `tools/os/` for OS-specific tools.
</file_map>

<patterns>
## PATTERNS

**Three-layer prompt system (prompts.ts):**
1. `homeChatOnboardingPrompt(userName)` — Used when user has 0 pursuits. Instructs AI to collect info and create first pursuits.
2. `homeChatRoutingPrompt(userName, pursuitsJson)` — Used after setup. Classifies input as question (TYPE A), action (TYPE B), or self-description (TYPE C).
3. `scopedPrompt(pursuit: PursuitContext)` — Full pursuit context injected as system prompt for scoped conversations. Includes vision, state, all projects + tasks + thoughts.

**Model selection:**
- OS routes always call `getOSModel()` — returns `google/gemini-2.5-flash-lite` via Vercel AI Gateway
- Chat app uses user-selected model from model selector (`models.ts` list)
- Never let users change the OS model — it's hardcoded for cost/speed

**Adding a new prompt:** Add a named export to `prompts.ts`. Keep under 50 lines. Follow the pattern of injecting structured data as JSON strings in the prompt body.

Example: `prompts.ts`, search: `homeChatRoutingPrompt`
</patterns>

<critical_notes>
## CRITICAL NOTES
- **`tools/os/` has its own CLAUDE.md** — See [tools/os/CLAUDE.md](tools/os/CLAUDE.md) for AI tool details.
- **Never expose the OS model selection to users** — `getOSModel()` is always Gemini 2.5 Flash Lite. If the model changes, update only `providers.ts`.
- **`scopedPrompt` serializes pursuit context as JSON inline** — If the pursuit data structure changes in `schema.ts`, update `scopedPrompt` to match.
- **`summary.ts` is called via `after()` in `chat/route.ts`** — It runs asynchronously after the response streams. Don't block the response on it.
</critical_notes>
