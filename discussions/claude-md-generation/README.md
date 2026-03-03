# CLAUDE.md Generation Registry

This directory tracks which CLAUDE.md files have been generated, what each covers, and how to update them when new directories are added.

---

## What This Is

CLAUDE.md files help any future Claude Code session instantly navigate this codebase without re-reading everything. They mark:
- **Custom Personal OS code** — where new features go
- **Boilerplate code** — from the Next.js AI Chatbot SDK, don't modify unless necessary
- **Patterns and gotchas** — things that would burn time to re-discover

See `codebase-notes.md` for the full exploration findings that informed these files.

---

## Registry: All CLAUDE.md Files

| File | Status | Priority | Notes |
|---|---|---|---|
| `discussions/claude-md-generation/README.md` | ✅ Done | — | This file |
| `discussions/claude-md-generation/codebase-notes.md` | ✅ Done | — | Exploration findings |
| `lib/ai/tools/os/CLAUDE.md` | ✅ Done | High | Core AI tool factory |
| `lib/db/CLAUDE.md` | ✅ Done | High | DB schema + queries |
| `components/os/CLAUDE.md` | ✅ Done | High | Personal OS UI components |
| `app/(os)/CLAUDE.md` | ✅ Done | High | OS pages |
| `app/(chat)/api/os/CLAUDE.md` | ✅ Done | High | OS API routes |
| `discussions/CLAUDE.md` | ✅ Done | High | Pointer to design docs |
| `hooks/CLAUDE.md` | ✅ Done | Medium | Custom React hooks |
| `lib/ai/CLAUDE.md` | ✅ Done | High | Prompts, models, providers |
| `components/ui/CLAUDE.md` | ✅ Done | Medium | Boilerplate shadcn primitives |
| `artifacts/CLAUDE.md` | ✅ Done | Low | Artifact type handlers |
| `app/(chat)/api/CLAUDE.md` | ✅ Done | Low | Chat API (mostly boilerplate) |
| `app/(auth)/CLAUDE.md` | ✅ Done | Low | Auth (boilerplate) |
| `app/(chat)/CLAUDE.md` | ✅ Done | Low | Chat route group |
| `app/CLAUDE.md` | ✅ Done | Medium | App Router overview |
| `components/CLAUDE.md` | ✅ Done | Medium | Component groups overview |
| `lib/CLAUDE.md` | ✅ Done | Medium | Library overview |
| `CLAUDE.md` (root) | ✅ Done | High | Master orientation file |

---

## How to Add a New Directory

When you create a new directory with non-trivial code:

1. Add a row to the registry table above with status `⬜ Pending`
2. Run `/generate-claude-md <directory-path>` (or ask Claude to generate it)
3. Mark it `✅ Done` once the CLAUDE.md is written
4. Update the parent directory's CLAUDE.md `<file_map>` to reference the new subdirectory

**Rule of thumb:** Any directory with 3+ custom files that a future developer would want to understand deserves a CLAUDE.md.

---

## Directories That Don't Need CLAUDE.md

These are boilerplate or low-touch areas:

| Directory | Reason |
|---|---|
| `components/elements/` | Boilerplate chat element renderers |
| `components/ai-elements/` | Boilerplate AI visualization components |
| `lib/editor/` | Boilerplate ProseMirror config |
| `lib/artifacts/` | Boilerplate artifact server logic |
| `tests/` | Standard Playwright tests |
| `public/` | Static assets |

---

## Authoritative Design Documents

Always refer to these before making architectural decisions:

- **Product intent:** `discussions/personal_os_context.md`
- **Technical architecture:** `discussions/personal_os_arch.md`
- **Implementation phases:** `discussions/implementation/`
