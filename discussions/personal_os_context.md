# Personal OS — System Context & Product Brief

> This document is intended to give a building AI model or developer full context about what this application is, why it exists, and how it should behave. Read this before writing any code or making any architectural decisions.

---

## What This App Is

This is a **Personal Operating System** — not a task manager, not a notes app, not a chat assistant. It is a structured memory and reasoning system that holds a living model of one person's pursuits, projects, constraints, and evolving thoughts — and acts as an unbiased observer that helps them stay oriented across everything they are working on.

The central metaphor is a **mentor who knows everything about you** — your goals, your limitations, your opportunities, what you've been neglecting, what has momentum — and surfaces the right things at the right time without telling you what to prioritize (that is always the user's decision).

---

## The Problem It Solves

Knowledge workers and entrepreneurs juggle many domains simultaneously — business operations, product development, marketing, finance, personal growth. Context about each domain lives scattered across notes, chats, memory, and email. Every time they sit down to work, they have to reconstruct what's going on across all these fronts before they can make good decisions.

This app eliminates that reconstruction cost. It maintains a structured, persistent, evolving model of the user's world — and every conversation picks up exactly where the last one left off, with full awareness of the broader context.

---

## Core Concepts

### 1. Pursuits
The top-level domains of a user's life and work. Examples: "Distribution", "Marketing", "Product Development", "Finance", "Personal Growth". Each pursuit has:
- A **vision** (what success looks like)
- A **current state** (where things actually are right now)
- **Constraints** (what's limiting progress)
- **Opportunities** (what's open or emerging)
- A **thought log** (timestamped record of discussions and reflections)
- A **context summary** (AI-generated rolling compression of past discussions)

### 2. Projects
Mid-level initiatives within a pursuit. A pursuit may have multiple active projects. Example: under "Distribution", projects might be "QR Code Tracking System", "Pan-India Logistics", "Retailer Onboarding".

### 3. Tasks
Atomic action items within a project. Tasks have a status (open, in_progress, done, dismissed) and a source (user-created or ai_suggested). The AI creates tasks but never assigns or recommends priorities — that is always the user's domain.

### 4. User Model
A global layer that sits above all pursuits. Contains:
- The user's name and basic identity
- Their values and what matters to them
- Their resource budget (time, energy, money constraints)
- Company/organisation context if applicable
- Any cross-pursuit facts that inform reasoning

---

## The Two Modes of the App

### Home Mode (Unscoped)
The default view when no card is selected. Shows all pursuit cards on a dashboard. Also contains a free-form input field always visible at the bottom.

When the user types anything in home mode, the AI:
1. Reads the full pursuit/project model
2. Classifies where the input belongs (which pursuit, which project)
3. Determines if it maps to an existing entity or needs a new one created
4. Creates or updates the appropriate task/project silently
5. Returns a small confirmation chip: "Added to Distribution → QR Tracking"

The user can tap the chip to reassign if the classification was wrong. No modals, no questions asked.

**The AI does not have a full conversation in home mode. It routes, creates, and confirms.**

### Scoped Mode (Card Open)
When the user clicks into a pursuit card, they enter a focused conversation space. The AI is now injected with:
- Full detail of that pursuit (vision, state, constraints, opportunities)
- All projects and open tasks under it
- Compressed context summary of past discussions
- The global user model

In this mode the AI can have a rich, contextual conversation. It recommends, reasons, asks questions, and creates tasks — all grounded in the full context of that domain and how it fits into the user's broader picture.

---

## What the AI Must Never Do

- **Never set, suggest, or imply priorities.** The user decides what is most important. The AI's job is to surface, organise, and inform — not to rank.
- **Never lose context.** Every session must pick up from where the last one left off via the thought log and context summaries.
- **Never create noise.** Task creation should be quiet and confirmable, not interruptive.
- **Never flatten the hierarchy.** A thought belongs to a pursuit → project → task. The AI must maintain and respect this structure.

---

## Data Hierarchy (Summary)

```
User Model (global, always present)
└── Pursuits (domains of life/work)
    ├── vision, current_state, constraints, opportunities
    ├── thought_log (timestamped discussion history)
    ├── context_summary (AI-compressed rolling memory)
    └── Projects (initiatives within the pursuit)
        ├── description, status
        └── Tasks (atomic action items)
            ├── title, detail, status
            └── source: user | ai_suggested
```

---

## AI System Prompt Architecture (Three Layers)

The AI model receives context in three layers depending on mode:

### Layer 1 — Always Present
- User's name, values, resource budget
- Company/organisation context
- One-line summary of each pursuit and its current state
- Core behavioural rules (no priorities, confirm routing, log thoughts)

### Layer 2a — Home Mode
- Instruction: classify input, route to correct entity, create/update, confirm with chip
- Full list of pursuits + projects (enough to classify accurately)
- Do not engage conversationally

### Layer 2b — Scoped Mode
- Full detail of the active pursuit
- All projects and tasks under it
- Context summary of past discussions in this domain
- Instruction: reason as an informed mentor, create tasks as needed, log thoughts after session

---

## AI Tools Required

The AI model must have access to the following tools:

### Read Tools
| Tool | Purpose |
|---|---|
| `get_user_model()` | Fetch global user context |
| `get_all_pursuits()` | Fetch all pursuits with one-line summaries |
| `get_pursuit_detail(pursuit_id)` | Full pursuit + projects + tasks + summary |
| `get_project_detail(project_id)` | Project + tasks + recent thoughts |

### Write Tools
| Tool | Purpose |
|---|---|
| `create_task(project_id, title, detail)` | Create a new task (source = ai_suggested) |
| `update_task(task_id, changes)` | Update task status or detail |
| `create_project(pursuit_id, name, description)` | Create new project |
| `update_pursuit(pursuit_id, changes)` | Update vision, state, constraints, opportunities |
| `log_thought(pursuit_id, content)` | Append a summary to the pursuit thought log |

### Routing Tool (Home Mode Only)
| Tool | Purpose |
|---|---|
| `classify_and_route(raw_message)` | Classify input → identify pursuit/project → create entity → return chip text |

---

## UI Behaviour Notes

- **Dashboard**: Cards for each pursuit, showing project/task count. Cards update in real-time as tasks are created.
- **Card**: Shows pursuit name, active projects, open tasks. Clickable to enter scoped conversation.
- **Home input**: Always visible, always ready. Single line, expands if needed.
- **Routing chip**: Small, dismissable, appears below input after classification. Shows "Added to [Pursuit] → [Project]". Tappable to reassign.
- **No priority fields anywhere in the UI.** The user organises their own order.

---

## Technology Notes

- **Database**: PostgreSQL. Tables: `user_model`, `pursuits`, `projects`, `tasks`, `pursuit_thoughts`, `conversations`, `context_summaries`, `routing_log`.
- **Real-time**: Card badge counts and task lists update live when AI creates entities (Supabase Realtime or equivalent).
- **AI**: Claude (Anthropic) with native tool use. Model: claude-sonnet-4 or later.
- **Context management**: Rolling summaries stored in `context_summaries` table. Raw thought logs in `pursuit_thoughts`. Full conversation history in `conversations`. Summaries are regenerated when raw log exceeds a token threshold.
- **No vector search required initially.** Add pgvector when task count exceeds ~200 or when semantic search ("find everything related to logistics") becomes needed.

---

## The One-Sentence Summary

> This app holds a structured, living model of the user's world and acts as an always-informed, unbiased observer — classifying their thoughts, maintaining their context, and helping them stay oriented — while leaving all prioritisation decisions entirely to them.