# Google Calendar Integration — Common Pitfalls

A reference doc covering every gotcha encountered while building the `createCalendarEvent` tool. Check this before debugging a new tool integration.

---

## 1. AI never calls the tool — soft prompt guidance

**Symptom:** You ask to "schedule a meeting" and the AI replies in plain text instead of calling the tool.

**Cause:** Guidance phrased as "Use when the user asks to schedule..." is treated as optional by the LLM.

**Fix:** Use imperative language in the system prompt (`lib/ai/prompts.ts`):
```
ALWAYS call this tool when the user asks to schedule, remind, book, or add anything to their calendar — never just describe what you would do in text.
```

---

## 2. Tool fires but the UI shows an empty message

**Symptom:** The assistant message appears with just the avatar and action buttons — no content, no error.

**Cause:** `components/message.tsx` has explicit `if (type === "tool-X")` blocks for every known tool. Unrecognised tool types fall through to `return null`, so the message silently disappears even though the tool ran correctly.

**Fix:** Add a `if (type === "tool-yourToolName")` render block in `message.tsx` (see the `tool-getWeather` block as a template).

---

## 3. TypeScript build error — "types have no overlap"

**Error:**
```
Type error: This comparison appears to be unintentional because the types '...' and '"tool-createCalendarEvent"' have no overlap.
```

**Cause:** `lib/types.ts` defines `ChatTools` using `InferUITool` for each registered tool. This drives the `part.type` union across the whole app. A missing entry means TypeScript doesn't recognise the string literal.

**Fix:** Add the tool to `ChatTools` in `lib/types.ts`:
```typescript
import type { createCalendarEvent } from "./ai/tools/create-calendar-event";
type calendarEventTool = InferUITool<typeof createCalendarEvent>;
export type ChatTools = {
  // ...existing tools...
  createCalendarEvent: calendarEventTool;
};
```

---

## 4. TypeScript build error — ReactNode type mismatch

**Error:** Type error at the `output` prop of `<ToolOutput>` when passing a plain object.

**Cause:** `ToolOutput`'s `output` prop expects `ReactNode`, not an arbitrary object.

**Fix:** Serialize before passing:
```typescript
output={JSON.stringify(output, null, 2)}
```

---

## 5. `invalid_grant` — refresh token expires after 7 days

**Error:** `Token has been expired or revoked`

**Cause:** When the OAuth consent screen is in **Testing mode**, Google caps refresh token lifetime at **7 days**. Generating a new token also immediately revokes the previous one.

**Fix (long-term):** Publish the OAuth consent screen to **Production** in Google Cloud Console → OAuth consent screen → Publishing status. For sensitive scopes like `calendar.events` this requires Google verification, or you can set the app type to **Internal** (G Suite / Workspace only).

---

## 6. `unauthorized_client` — token bound to wrong OAuth client

**Error:** `unauthorized_client: Unauthorized`

**Cause:** [OAuth Playground](https://developers.google.com/oauthplayground/) issues tokens bound to **Google's own client credentials** by default. A token generated this way will fail when your app uses a different `GOOGLE_CLIENT_ID`.

**Fix:** Before running the OAuth flow in the Playground:
1. Click the gear icon (top-right)
2. Check **"Use your own OAuth credentials"**
3. Enter your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
4. Then run the auth flow and copy the refresh token

---

## 7. `404 Not Found` — double slash in Calendar API URL

**Error:** Request to `/calendars//events` → 404

**Cause:** `GOOGLE_CALENDAR_ID=` in `.env.local` is an **empty string** `""`, not `undefined`. The nullish coalescing operator `??` does not catch empty strings.

```typescript
// BAD — empty string passes through
const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";

// GOOD — empty string falls back to "primary"
const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";
```

---

## 8. Test script — `@next/env` not available outside Next.js

**Error:** Module not found when trying to import `loadEnvConfig` from `@next/env` in `scripts/`.

**Cause:** `@next/env` is designed to run inside the Next.js build pipeline, not standalone scripts.

**Fix:** Use Node's built-in env file loader (Node 20.12+):
```typescript
try {
  process.loadEnvFile(".env.local");
} catch {
  // env vars already set in environment
}
```

---

## Checklist for every new tool

Every tool must be registered in **4 places** — missing any one causes a silent or build failure:

| Step | File | What to add |
|------|------|-------------|
| 1 | `lib/ai/tools/<name>.ts` | Tool implementation |
| 2 | `app/(chat)/api/chat/route.ts` | Import + add to `tools` and `experimental_activeTools` |
| 3 | `lib/types.ts` | `InferUITool` entry in `ChatTools` |
| 4 | `components/message.tsx` | `if (type === "tool-<name>")` render handler |

Missing step 3 → TypeScript build error (pitfall #3 above).
Missing step 4 → silent empty message in UI (pitfall #2 above).
