# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<system_context>
This is a Personal Operating System (Personal OS) built on top of the Next.js AI Chatbot SDK (open-source boilerplate by Vercel). The OS layer is a structured memory and reasoning system that holds a living model of the user's pursuits, projects, and tasks — and acts as an always-informed, context-aware assistant. The boilerplate layer provides a standard AI chat app, auth, artifact editors, and AI SDK plumbing.

**Before implementing any Personal OS feature, read:**
- Product intent: `discussions/personal-os/personal_os_context.md`
- Technical architecture: `discussions/personal-os/personal_os_arch.md`
</system_context>

## Commands

```bash
pnpm dev          # Start dev server (Next.js with Turbo)
pnpm build        # Run DB migrations then build for production
pnpm lint         # Lint with ultracite (wraps Biome)
pnpm format       # Format with ultracite (wraps Biome)
pnpm test         # Run Playwright e2e tests

# Database
pnpm db:generate  # Generate Drizzle migration files from schema changes
pnpm db:migrate   # Apply pending migrations to the DB
pnpm db:studio    # Open Drizzle Studio for DB inspection
```

**DB workflow for schema changes:** edit `lib/db/schema.ts` → `pnpm db:generate` → `pnpm db:migrate`.

<file_map>
## FILE MAP

**Personal OS (custom code — where new features go):**
- `app/(os)/` - OS pages (home dashboard, pursuit detail). See [app/(os)/CLAUDE.md](app/(os)/CLAUDE.md).
- `app/(chat)/api/os/` - OS API routes (AI streaming + REST CRUD). See [app/(chat)/api/os/CLAUDE.md](app/(chat)/api/os/CLAUDE.md).
- `components/os/` - OS UI components. See [components/os/CLAUDE.md](components/os/CLAUDE.md).
- `lib/ai/` - Prompts, models, providers. See [lib/ai/CLAUDE.md](lib/ai/CLAUDE.md).
- `lib/ai/tools/os/` - AI tool factory. See [lib/ai/tools/os/CLAUDE.md](lib/ai/tools/os/CLAUDE.md).
- `lib/db/` - DB schema + queries. See [lib/db/CLAUDE.md](lib/db/CLAUDE.md).
- `hooks/use-audio-recorder.ts` - Audio input hook.

**Boilerplate (Next.js AI Chatbot SDK — do not modify unless necessary):**
- `app/(chat)/` - Standard AI chat app at `/chat`. See [app/(chat)/CLAUDE.md](app/(chat)/CLAUDE.md).
- `app/(auth)/` - Auth (NextAuth v5). See [app/(auth)/CLAUDE.md](app/(auth)/CLAUDE.md).
- `components/ui/` - shadcn/ui primitives. See [components/ui/CLAUDE.md](components/ui/CLAUDE.md).
- `artifacts/` - Artifact type handlers. See [artifacts/CLAUDE.md](artifacts/CLAUDE.md).
- `lib/editor/` - ProseMirror editor setup.

**Documentation:**
- `discussions/` - All planning docs. See [discussions/CLAUDE.md](discussions/CLAUDE.md).
- `discussions/claude-md-generation/` - Registry of all CLAUDE.md files + codebase notes.
</file_map>

<patterns>
## PATTERNS

**OS data hierarchy:** User → Pursuits → Projects → Tasks. Thoughts + summaries are memory per pursuit.

**Two AI modes:**
- Home mode (`/api/os/home-chat`): Routes/classifies input, creates entities, returns chip confirmations. No long conversation.
- Scoped mode (`/api/os/chat`): Full pursuit context injected, 7 tools available, rich conversation.

**Model:** OS always uses Gemini 2.5 Flash Lite via `getOSModel()`. Never user-configurable.

**Auth:** `import { auth } from "@/app/(auth)/auth"` → `const session = await auth()` → `session?.user?.id`.
</patterns>

<critical_notes>
## CRITICAL NOTES
- **Never set or suggest priorities** — Per product spec, the user always decides priority. No priority fields anywhere.
- **OS routes are in (chat)/api/os/** — They live there for auth middleware, but serve the (os) UI.
- **Root URL `/` is the OS home** — Not `/os`. The `(os)` route group maps directly to root.
- **Biome is the linter/formatter** — Run `pnpm lint` and `pnpm format` (via ultracite). No ESLint.
- **Package manager is pnpm** — Use `pnpm`, not `npm` or `yarn`.
- **DB migrations:** `pnpm db:generate` then `pnpm db:migrate`.
- **See `discussions/claude-md-generation/README.md`** for how to update CLAUDE.md files when new directories are added.
</critical_notes>
