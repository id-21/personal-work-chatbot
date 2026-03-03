<system_context>
Project planning and design documentation. These are not code files — they are the authoritative references for product intent and technical architecture. Read these before implementing any significant Personal OS feature.
</system_context>

<file_map>
## FILE MAP

**Core Design Docs (read these first):**
- `personal_os_context.md` - **Product spec.** What the app is, the two modes (home/scoped), the data hierarchy, what the AI must never do.
- `personal_os_arch.md` - **Technical architecture.** DB schema (reference), API design, AI tool specs, system prompt layers, data flow diagrams.
- `data-flow-analysis.md` - **Verified code audit.** Exactly what data is read/written, which functions, which line numbers, and what the AI actually sees. More accurate than personal_os_arch.md where they diverge.

**Feature Specs:**
- `audio_input_feat.md` - Audio/voice input feature spec
- `upload_docs.md` - Document upload feature spec
- `memory_app_rec.md` - Memory and context management recommendations
- `openai_whisper_docs.md` - OpenAI Whisper API documentation reference
- `plan_for_implementation.md` - High-level phased implementation roadmap

**Implementation Phase Docs (`implementation/`):**
- `phase1-db-api.md` - Database + REST API setup
- `phase2-dashboard.md` - Home dashboard UI
- `phase3-pursuit-detail.md` - Pursuit detail page + projects/tasks
- `phase4-ai-routing.md` - AI home mode routing
- `phase5-scoped-chat.md` - Context-scoped AI conversations
- `phase6-memory.md` - Summary and long-term memory system

**CLAUDE.md Generation (`claude-md-generation/`):**
- `README.md` - Registry of all CLAUDE.md files + instructions for adding new ones
- `codebase-notes.md` - Exploration findings: custom vs boilerplate breakdown, patterns, model choices
</file_map>

<critical_notes>
## CRITICAL NOTES
- **`personal_os_context.md` is the product source of truth** — When unsure about product behavior, check here first.
- **`personal_os_arch.md` is the technical source of truth** — DB schema, API shape, AI tool spec, prompt architecture.
- **Phase docs may be partially outdated** — Implementation deviated from the plan in some places. Always verify against actual code.
- **These files are documentation only** — Do not import from this directory. No code lives here.
</critical_notes>
