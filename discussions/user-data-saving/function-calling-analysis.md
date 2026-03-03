# Gemini Function Calling: Docs vs. Actual Code Analysis

Comparison of `function-calling-docs.md` against the actual implementation in:
- `app/(chat)/api/os/home-chat/route.ts`
- `app/(chat)/api/os/chat/route.ts`
- `lib/ai/tools/os/create-os-tools.ts`
- `lib/ai/providers.ts`

---

## The Critical Architectural Layer

**The code does NOT use the Google Gemini SDK (`@google/genai`) directly.** It uses the Vercel AI SDK (`import { streamText, tool } from "ai"`) routed through the Vercel AI Gateway (`@ai-sdk/gateway`).

```
Code (Zod schemas + tool())
  → Vercel AI SDK
    → Vercel AI Gateway
      → Gemini API
```

The Vercel AI SDK automatically handles:
- Converting Zod `inputSchema` to Gemini's OpenAPI-compatible JSON schema format
- The multi-turn tool call → execute → response → continue loop (via `stopWhen: stepCountIs(N)`)
- `finishReason: 'tool-calls'` detection to keep the agentic loop running
- Thought signatures for Gemini 2.5 series — docs confirm: *"If you're using the official libraries, you don't need to manage this process"* (line 474)

So the comparison is not "does our Zod match Gemini's raw JSON" — it's **"do the SDK abstractions correctly map what the code intends to what Gemini needs?"** They mostly do, but there are real gaps in the code's own design choices.

---

## Model Support: CONFIRMED COMPLIANT

From the docs support table (line 1647–1655):

| Model | Function Calling | Parallel | Compositional |
|---|---|---|---|
| **Gemini 2.5 Flash-Lite** | ✔️ | ✔️ | ✔️ |
| Gemini 2.0 Flash-Lite | ✖️ | ✖️ | ✖️ |

`getOSModel()` (`providers.ts:64`) returns `"google/gemini-2.5-flash-lite"` — **fully supports all function calling modes used by the code.** (Note: 2.0 Flash-Lite does not support it at all — this would have been a silent failure if that model had been chosen.)

---

## Tool Definitions: COMPLIANT

**What docs require (lines 448–456):**
- Unique names without spaces, periods, or dashes
- Clear `description` per tool
- Parameters as OpenAPI-subset schema with `type`, `properties`, `required`
- Use `enum` for fixed-value parameters

**What the code does:**

| Check | Code behavior | Status |
|---|---|---|
| Names | `updateUserModel`, `createPursuit`, `getUserProfile`, `createTask`, `createProject`, `getPursuitDetail`, `updateTask`, `updatePursuit`, `logThought`, `getProjectTasks` — all camelCase | ✅ |
| Descriptions | All tools have `description:` strings in `tool({...})` | ✅ |
| Schema format | `inputSchema: z.object({...})` — Vercel AI SDK converts Zod → OpenAPI | ✅ |
| Enums | `updateTask` uses `z.enum(["open", "in_progress", "done", "dismissed"])` (`create-os-tools.ts:105`) | ✅ |
| Empty schemas | `getUserProfile` and `getPursuitDetail` use `z.object({})` → translates to `{ type: "object", properties: {} }` which is valid for Gemini | ✅ |

---

## Tool Count: COMPLIANT (Within Best Practices)

Docs recommend: *"aim to provide only the relevant tools for the context, ideally keeping the active set to a maximum of 10–20"* (line 1662).

| Mode | Tools available | Count |
|---|---|---|
| Home chat — onboarding | `createPursuit`, `updateUserModel` | 2 ✅ |
| Home chat — routing | `getUserProfile`, `createTask`, `createProject`, `updateUserModel` | 4 ✅ |
| Scoped chat | `getPursuitDetail`, `createTask`, `updateTask`, `createProject`, `updatePursuit`, `logThought`, `getProjectTasks` | 7 ✅ |

---

## ISSUE 1 — No Tool Calling Mode Set (Most Significant)

**What docs say (lines 1045–1047):**
- `AUTO` (default): model decides whether to call a function or reply conversationally — "most flexible, recommended for most scenarios"
- `ANY`: model is **forced** to always predict a function call — *"use this when you require a function call response to every prompt"*
- `NONE`: function calling disabled

**What the code does:**
Neither `home-chat/route.ts` nor `chat/route.ts` sets any `toolChoice` or `functionCallingConfig` mode. Both default to `AUTO`.

**Why this is a real problem for home routing mode:**
In routing mode, the AI is supposed to *always* take an action — create a task, create a project, or update the user model. `AUTO` means the model is legally allowed to decide "I'll just reply conversationally" and skip all tool calls entirely. The current routing prompt instructs the AI behaviorally ("always call a tool"), but there is no API-level enforcement.

The docs' `ANY` mode — or the Vercel AI SDK's equivalent `toolChoice: 'required'` — would force Gemini to always call one of the available tools, which is the correct behavior for routing.

**Scoped mode:** `AUTO` is fine here — the AI should be able to answer a question without always calling a tool.

**How to fix (Vercel AI SDK):**
```typescript
// home-chat/route.ts — in the streamText() call for routing mode only
const result = streamText({
  model: getOSModel(),
  system: systemPrompt,
  messages: modelMessages,
  stopWhen: stepCountIs(8),
  tools: activeTools,
  toolChoice: hasNoPursuits ? 'auto' : 'required',  // force tool call in routing mode
});
```

---

## ISSUE 2 — `experimental_activeTools`: Uncertain Gemini Translation

**What the code does (`chat/route.ts:72–80`):**
```typescript
experimental_activeTools: [
  "getPursuitDetail", "createTask", "updateTask",
  "createProject", "updatePursuit", "logThought", "getProjectTasks"
],
tools,
```

**What the Gemini API's equivalent is (docs line 1046):**
`allowedFunctionNames` inside `functionCallingConfig` — only relevant when mode is `ANY`, used to limit which tools the model can choose from.

**The concern:**
- `experimental_activeTools` is a Vercel AI SDK abstraction prefixed with `experimental_` — an unstable API that may change.
- It's unclear whether this translates to Gemini's `allowedFunctionNames` or simply filters the tools array client-side before sending. If it filters the array, it's functionally equivalent.
- In this specific case it's a no-op (all 7 listed tools match the full tools object), but matters if you ever want to provide a large tool registry and selectively expose a subset per request.

---

## ISSUE 3 — Temperature Not Set

**What docs say (lines 1668–1672):**
> *"Use a low temperature (e.g., 0) for more deterministic and reliable function calls."*
> Exception: *"When using Gemini 3 models, keep temperature at its default value of 1.0. Changing it may cause looping or degraded performance."*

**What the code does:**
No `temperature` parameter in either `streamText()` call — defaults to the model's built-in default.

**Assessment:**
The Gemini 3 caveat applies to Gemini 3 series only. For Gemini **2.5** Flash-Lite, setting a lower temperature (0.2–0.5) would likely improve routing reliability and reduce cases where the model picks the wrong tool or generates inconsistent structured data. Not a blocker, but a tuning opportunity — particularly if home-mode routing misclassifications are observed in production.

---

## ISSUE 4 — Ownership Check Inconsistency in Home Chat

**What docs say (lines 1681–1684):**
> *"Implement robust error handling in your functions to gracefully handle unexpected inputs."*

**What the code does:**

In `create-os-tools.ts` (scoped chat), the `createTask` tool does a full ownership check:
```typescript
const proj = await getProjectById({ id: projectId });
if (!proj || proj.pursuitId !== pursuitId) {
  return { error: "Project not found in this pursuit" };
}
```

In `home-chat/route.ts` (routing mode), the `createTask` tool only checks existence:
```typescript
const proj = await getProjectById({ id: projectId });
if (!proj) return { error: "Project not found" };
```

The `pursuitId` cross-check is missing in home-chat. The model could theoretically be tricked (via a crafted `projectId`) into creating a task under a project belonging to a different pursuit. Low risk in practice (the AI generates the IDs from the pursuits list it was given), but inconsistent with the scoped-chat pattern.

---

## What Works Correctly (Summary Table)

| Feature | Docs requirement | Code behavior | Status |
|---|---|---|---|
| Model support | Must use a supported model | Gemini 2.5 Flash-Lite (✔️ in table) | ✅ |
| Tool name format | No spaces/dots/dashes | camelCase throughout | ✅ |
| Tool descriptions | Clear and specific | All tools have description strings | ✅ |
| Parameter schemas | OpenAPI subset | Zod → converted by Vercel AI SDK | ✅ |
| Enum parameters | Use enum for fixed sets | `z.enum()` used for status fields | ✅ |
| Empty parameter schemas | Valid when no params needed | `z.object({})` → `{ type: "object", properties: {} }` | ✅ |
| Tool count | Max 10–20 active | 2 / 4 / 7 per mode | ✅ |
| Multi-turn tool loop | App must continue loop until no tool calls | `stopWhen: stepCountIs(N)` | ✅ (SDK handles) |
| Thought signatures | Must not break with official SDK | Using Vercel AI SDK (auto-handled) | ✅ |
| Parallel function calling | Model may call multiple tools per turn | Code's `execute` functions are async-safe | ✅ |
| Error responses | Return informative errors | `{ error: "..." }` objects returned | ✅ |

---

## Issues Summary

| Issue | Severity | File | Line(s) | Recommended Fix |
|---|---|---|---|---|
| No tool calling mode — routing mode can silently skip tool calls | **Medium** | `home-chat/route.ts` | 177–184 | Add `toolChoice: 'required'` in routing mode |
| `experimental_activeTools` is an unstable API | Low | `chat/route.ts` | 72–80 | Monitor Vercel AI SDK changelog |
| Temperature not set — may reduce routing reliability | Low | Both route files | `streamText()` calls | Consider `temperature: 0.3` for routing |
| Missing `pursuitId` ownership check in home-chat `createTask` | Low | `home-chat/route.ts` | ~150 | Add `proj.pursuitId` check to match scoped chat pattern |
