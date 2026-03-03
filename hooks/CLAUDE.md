<system_context>
Custom React hooks for the application. Most hooks are boilerplate from the Next.js Chat SDK. The OS-specific addition is use-audio-recorder.ts. All hooks follow standard React conventions.
</system_context>

<file_map>
## FILE MAP

**Custom / OS-related:**
- `use-audio-recorder.ts` - Audio recording hook for voice input (used in OS home chat + chat app)

**Boilerplate (Chat SDK):**
- `use-messages.tsx` - Message state management and streaming handling
- `use-artifact.ts` - Artifact panel state (open/close, content)
- `use-auto-resume.ts` - Auto-resumes interrupted streaming conversations
- `use-chat-visibility.ts` - Toggles chat visibility (public/private)
- `use-scroll-to-bottom.tsx` - Auto-scrolls chat container to bottom on new messages
- `use-mobile.ts` - Detects mobile viewport width
</file_map>

<critical_notes>
## CRITICAL NOTES
- **`use-audio-recorder.ts` is the only OS-specific hook** — If adding new OS state logic, consider a hook here rather than embedding state in components.
- **Boilerplate hooks are wired to the chat SDK internals** — Modifying them may break the boilerplate chat app. Only modify if you understand the Vercel AI SDK data stream protocol.
</critical_notes>
