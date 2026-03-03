<system_context>
The Personal OS route group. Contains the home dashboard and pursuit detail pages. These are entirely custom — no boilerplate from the Next.js Chat SDK exists here. This route group uses a separate layout from the (chat) group.
</system_context>

<file_map>
## FILE MAP
- `layout.tsx` - OS layout wrapper (sidebar + main content area)
- `page.tsx` - Home dashboard: server-fetches pursuits + user model, renders HomeChatView
- `pursuits/[id]/page.tsx` - Pursuit detail page: two-column layout with projects grid + scoped chat sidebar
</file_map>

<patterns>
## PATTERNS

**Server component data fetching:** Both pages are React Server Components. They fetch data directly (no client-side fetch on mount) and pass it to client components as props.

```
page.tsx → fetch pursuits + userModel → <HomeChatView pursuits={...} userModel={...} />
pursuits/[id]/page.tsx → fetch pursuit detail + projects + tasks → renders grid + <ScopedChat pursuitId={...} />
```

**Layout separation:** The OS group has its own layout (`app/(os)/layout.tsx`) with `<OSSidebar>`. It does NOT share the chat layout.

**Route group path:** The OS home page resolves to `/` (root URL). Pursuit detail resolves to `/pursuits/[id]`.
</patterns>

<critical_notes>
## CRITICAL NOTES
- **Root URL is the OS home** — The `(os)` route group's `page.tsx` is at the root path `/`, not `/os/`. Don't add an `os/` segment in the path.
- **Data is fetched server-side** — If you add new data to a page, fetch it in the Server Component and pass it as props. Don't fetch in `useEffect`.
- **`ScopedChat` receives only `pursuitId`** — It fetches its own messages client-side. Don't try to pre-populate it with server data.
- **Auth:** Both pages require an authenticated session. See `app/(auth)/auth.ts` for session helpers.
</critical_notes>
