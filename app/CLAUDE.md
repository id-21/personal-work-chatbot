<system_context>
Next.js App Router root. Three route groups co-exist here: (os) for the Personal OS, (chat) for the boilerplate chat app, and (auth) for authentication. The root URL `/` maps to the Personal OS home.
</system_context>

<file_map>
## FILE MAP
- `layout.tsx` - Root layout (ThemeProvider, fonts, global providers)
- `globals.css` - Global Tailwind CSS + CSS variables
- `favicon.ico` - App favicon
- `(os)/` - **Custom.** Personal OS pages. Root URL `/`. See [(os)/CLAUDE.md]((os)/CLAUDE.md).
- `(chat)/` - **Boilerplate.** Chat app at `/chat`. See [(chat)/CLAUDE.md]((chat)/CLAUDE.md).
- `(auth)/` - **Boilerplate.** Auth at `/login`, `/register`. See [(auth)/CLAUDE.md]((auth)/CLAUDE.md).
</file_map>

<critical_notes>
## CRITICAL NOTES
- **Route group collision:** `(os)` and `(chat)` can theoretically collide at root. They don't currently because `(chat)` has no root-level page — its entry is at `/chat`.
- **New OS pages go in `(os)/`** — New chat features go in `(chat)/`.
- **`globals.css` defines design tokens** — CSS custom properties for colors, spacing, etc. Modify here for global theme changes.
</critical_notes>
