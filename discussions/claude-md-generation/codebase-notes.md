# Codebase Exploration Notes

Findings from the initial codebase analysis (March 2026). Update this file when you discover new patterns or architecture changes.

---

## Project Identity

**Name:** Personal Work Chatbot / Personal OS
**Version:** 3.1.0
**Base:** Next.js AI Chatbot SDK (open-source boilerplate by Vercel)
**Custom layer:** Personal Operating System (pursuits → projects → tasks hierarchy)

---

## Custom vs. Boilerplate Breakdown

### Custom Code (Personal OS — where new features go)

| Path | What it is |
|---|---|
| `components/os/` | All Personal OS UI (pursuit cards, scoped chat, routing chips, dialogs) |
| `app/(os)/` | Personal OS pages (home dashboard, pursuit detail) |
| `app/(chat)/api/os/` | OS API routes (home-chat, chat, pursuits, user-model) |
| `lib/ai/tools/os/` | `createOSTools()` factory — all scoped AI tools |
| `lib/ai/prompts.ts` | 3-layer prompt system (onboarding, routing, scoped) — heavily modified |
| `lib/ai/models.ts` | Multi-provider model list — custom additions |
| `lib/ai/providers.ts` | `getOSModel()` returns Gemini 2.5 Flash Lite for all OS routes |
| `lib/ai/summary.ts` | Async context summarization |
| `lib/db/schema.ts` | DB schema including all OS tables |
| `lib/db/queries.ts` | All DB queries including OS operations |
| `hooks/use-audio-recorder.ts` | Audio recording for voice input |
| `hooks/use-chat-visibility.ts` | Chat visibility state |
| `discussions/` | All planning and design documents |

### Boilerplate (Next.js AI Chatbot SDK — don't modify unless necessary)

| Path | What it is |
|---|---|
| `components/ui/` | All shadcn/ui primitives (35+ components) |
| `components/elements/` | Basic chat element renderers |
| `components/ai-elements/` | Advanced AI visualization components |
| `lib/editor/` | ProseMirror rich editor setup |
| `lib/artifacts/` | Artifact server utilities |
| `artifacts/` | Artifact type handlers (code, text, image, sheet) |
| `app/(chat)/` | Chat app (mostly boilerplate, except api/os/ subdirectory) |
| `app/(auth)/` | Auth setup (NextAuth v5) |
| `hooks/use-mobile.ts` | Mobile detection hook |
| `hooks/use-scroll-to-bottom.tsx` | Auto-scroll hook |

### Mixed (boilerplate base + custom additions)

| Path | What it is |
|---|---|
| `components/*.tsx` | Root-level components — mostly boilerplate chat UI, some modified |
| `app/(chat)/api/` | Chat API — boilerplate, but `api/os/` subdirectory is all custom |
| `hooks/use-messages.tsx` | Messages hook — largely boilerplate |
| `hooks/use-artifact.ts` | Artifact hook — largely boilerplate |

---

## Key Architectural Patterns

### 1. Dual-Mode Prompting
The home chat (`/api/os/home-chat`) checks if the user has any pursuits. If none → onboarding prompt (`homeChatOnboardingPrompt`). If yes → routing prompt (`homeChatRoutingPrompt`). Different tool sets per mode.

Reference: `app/(chat)/api/os/home-chat/route.ts`, `lib/ai/prompts.ts`

### 2. Chip-Based Confirmations
Home mode AI responses that start with specific phrases are rendered as colored "chips" (not chat bubbles) in the UI. Detection via regex in `home-chat-view.tsx`:
```
/^(Added to|Updated your profile|Created project|Created pursuit)/i
```
Reference: `components/os/home-chat-view.tsx`

### 3. Tool Factory Pattern
`createOSTools({ userId, pursuitId })` returns a typed object of 7 tools scoped to a specific user and pursuit. All tools do ownership checks internally.
Reference: `lib/ai/tools/os/create-os-tools.ts`

### 4. Context Injection via Prompts
Full pursuit context (vision, state, constraints, projects, tasks, thought history) is serialized as JSON into the system prompt at request time — no mid-conversation fetches needed.
Reference: `lib/ai/prompts.ts` → `scopedPrompt()`

### 5. Async Memory Regeneration
After scoped conversations, Next.js `after()` asynchronously checks if the context summary needs regeneration. Keeps response latency low.
Reference: `app/(chat)/api/os/chat/route.ts`

### 6. Server Component Data Fetching
OS pages are React Server Components that fetch data server-side and pass to client components.
Reference: `app/(os)/page.tsx`, `app/(os)/pursuits/[id]/page.tsx`

---

## AI Model Choices

| Context | Model | Why |
|---|---|---|
| Personal OS (all routes) | `google/gemini-2.5-flash-lite` via `getOSModel()` | Fast, cheap, sufficient for routing |
| Chat app | User-selected via model selector | Varies |
| Default chat | `google/gemini-2.5-flash-lite` | Same as OS |

Model config: `lib/ai/models.ts`, `lib/ai/providers.ts`

---

## Database Tables (Personal OS)

| Table | Purpose |
|---|---|
| `user_model` | Global user profile (name, values, rawContext, resourceBudget) |
| `pursuits` | Top-level domains (vision, currentState, constraints, opportunities) |
| `projects` | Mid-level initiatives within pursuits |
| `tasks` | Leaf-level action items (status: open/in_progress/done/dismissed, source: user/ai_suggested) |
| `pursuit_thoughts` | Timestamped AI memory log per pursuit |
| `context_summaries` | Compressed rolling summaries of past conversations |

Boilerplate tables also present: `user`, `chat`, `message`, `vote`, `document`, `suggestion`, `stream`

Schema: `lib/db/schema.ts`
Queries: `lib/db/queries.ts`

---

## Tech Stack Summary

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| AI | Vercel AI SDK 6.x + Gemini 2.5 Flash Lite (OS) |
| Database | Neon Serverless Postgres + Drizzle ORM |
| Auth | NextAuth v5 (Auth.js) |
| UI | shadcn/ui + Tailwind CSS 4 |
| Code quality | Biome 2.x (formatter + linter) |
| Storage | Vercel Blob (file uploads) |
| Caching | Redis |
| Testing | Playwright (E2E) |
