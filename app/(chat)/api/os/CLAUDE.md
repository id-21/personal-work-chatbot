<system_context>
All Personal OS API routes. This is entirely custom code — nothing here is boilerplate. It includes both AI streaming endpoints (home-chat, chat) and REST CRUD endpoints for all OS entities. All routes are in the (chat) API group for auth middleware convenience but serve the (os) UI.
</system_context>

<file_map>
## FILE MAP

**AI Streaming Endpoints:**
- `home-chat/route.ts` - Home mode AI: onboarding OR routing, returns streaming text with chip confirmations
- `chat/route.ts` - Scoped mode AI: full pursuit-context conversation with 7 tools, async summary after
- `route/route.ts` - Standalone routing classification endpoint (classifies input without chat)

**REST CRUD Endpoints:**
- `user-model/route.ts` - GET (fetch profile) / PUT (upsert profile) user model
- `pursuits/route.ts` - GET all pursuits / POST create pursuit
- `pursuits/[id]/route.ts` - GET / PUT / DELETE single pursuit
- `pursuits/[id]/projects/route.ts` - GET projects under pursuit / POST create project
- `projects/[id]/route.ts` - GET / PUT / DELETE single project
- `projects/[id]/tasks/route.ts` - GET tasks under project / POST create task
- `tasks/[id]/route.ts` - GET / PUT / DELETE single task
- `summaries/route.ts` - GET / POST context summaries for a scope
</file_map>

<patterns>
## PATTERNS

**home-chat/route.ts mode switching:**
```
if (pursuits.length === 0) → onboarding prompt + onboarding tools (createPursuit, updateUserModel)
else                        → routing prompt + routing tools (getUserProfile, createTask, createProject, updateUserModel)
```
Max steps: 8. Model: `getOSModel()` (Gemini 2.5 Flash Lite).

**chat/route.ts scoped context injection:**
Full pursuit detail (vision, state, constraints, opportunities, all projects + tasks + thoughts) serialized into system prompt via `scopedPrompt(pursuit)`. Tools provided via `createOSTools({ userId, pursuitId })`. Max steps: 10. Async summary regeneration via Next.js `after()`.

**REST endpoints:** Standard Next.js route handlers. All read `auth()` from NextAuth to get `userId`. Return JSON. No streaming.
</patterns>

<critical_notes>
## CRITICAL NOTES
- **Both AI endpoints use `getOSModel()`** — NOT the user's model selection from the chat app. The OS always uses Gemini 2.5 Flash Lite.
- **home-chat handles two tool sets** — When adding a new home-mode capability, decide if it's onboarding-only, routing-only, or shared and add accordingly.
- **chat/route.ts uses `after()` for async summary** — Don't move the summary logic into the main handler; it would block the response.
- **REST endpoints serve the (os) UI create dialogs** — The `create-*-dialog.tsx` components POST directly to these, bypassing AI.
- **Scoped chat sends `pursuitId` in request body** — Not a URL param. See `scoped-chat.tsx` `prepareSendMessagesRequest`.
</critical_notes>
