# Google Calendar Integration

## What was built

A `createCalendarEvent` tool that lets the AI create Google Calendar events when the user asks to schedule, remind, or book something in chat. Uses `needsApproval: true` — shows an Allow/Deny dialog before any write to Google Calendar.

## Files changed

| File | Change |
|------|--------|
| `lib/ai/tools/create-calendar-event.ts` | New tool — OAuth2 client, event creation via `googleapis` |
| `app/(chat)/api/chat/route.ts` | Added import + registered in `tools` and `experimental_activeTools` |
| `lib/types.ts` | Added `calendarEventTool` to `ChatTools` for type inference |
| `components/message.tsx` | Added `tool-createCalendarEvent` render handler |
| `lib/ai/prompts.ts` | Added tool guidance to `artifactsPrompt` |
| `.env.example` | Documented 4 new env vars |

## Env vars required

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALENDAR_REFRESH_TOKEN=
GOOGLE_CALENDAR_ID=   # optional, defaults to "primary"
```

Refresh token obtained via [OAuth Playground](https://developers.google.com/oauthplayground/) with scope `https://www.googleapis.com/auth/calendar.events`.

## Bugs encountered

### 1. Tool called but UI renders nothing (empty message)

**Symptom:** AI calls the tool, second assistant message appears with just the avatar + action buttons, no content.

**Cause:** `message.tsx` has explicit `if (type === "tool-X")` blocks for each tool. Unrecognised tool types fall through to `return null`. The tool was firing correctly; the UI was silently dropping it.

**Fix:** Added a `tool-createCalendarEvent` block in `message.tsx` with input display, Allow/Deny buttons, and output/error states — modelled on the existing `tool-getWeather` handler.

### 2. TypeScript build error after adding the message.tsx handler

**Error:**
```
Type error: This comparison appears to be unintentional because the types '...' and '"tool-createCalendarEvent"' have no overlap.
```

**Cause:** `lib/types.ts` defines `ChatTools` using `InferUITool` for each registered tool. This drives the union type for `part.type` across the whole app. `createCalendarEvent` was missing from `ChatTools`, so TypeScript didn't know `"tool-createCalendarEvent"` was a valid type.

**Fix:** Added to `lib/types.ts`:
```typescript
import type { createCalendarEvent } from "./ai/tools/create-calendar-event";
type calendarEventTool = InferUITool<typeof createCalendarEvent>;
// in ChatTools:
createCalendarEvent: calendarEventTool;
```

## Checklist for adding any new tool

Every new tool must be registered in **4 places**:

1. `lib/ai/tools/<tool-name>.ts` — the tool implementation
2. `app/(chat)/api/chat/route.ts` — import + add to `tools` object and `experimental_activeTools`
3. `lib/types.ts` — add `InferUITool` entry to `ChatTools`
4. `components/message.tsx` — add `if (type === "tool-<name>")` render handler

Missing step 3 → TypeScript build error.
Missing step 4 → silent empty message in UI (tool fires but nothing renders).
