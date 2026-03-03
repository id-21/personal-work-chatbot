<system_context>
Authentication setup using NextAuth v5 (Auth.js). This is boilerplate from the Next.js Chat SDK. The Personal OS uses the same auth session — no custom auth logic needed.
</system_context>

<file_map>
## FILE MAP
- `auth.ts` - NextAuth configuration and session helpers. Exports `auth()` for getting the current session.
- `auth.config.ts` - NextAuth config (providers, callbacks, pages)
- `actions.ts` - Server actions: `login()`, `register()`, `logout()`
- `api/auth/[...nextauth]/route.ts` - NextAuth handler
- `login/page.tsx` - Login page (renders AuthForm)
- `register/page.tsx` - Registration page (renders AuthForm)
</file_map>

<critical_notes>
## CRITICAL NOTES
- **Getting the current user:** Import `auth` from `@/app/(auth)/auth` and call `const session = await auth()`. Then `session?.user?.id` is the `userId`.
- **Do not modify** unless you need to change auth providers or session shape.
- **Both (chat) and (os) route groups use the same session** — Auth is shared across the whole app.
</critical_notes>
