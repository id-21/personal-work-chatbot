# Chat Rename: Bug Analysis and Fix

How the inline chat rename feature was broken and how it was fixed.

---

## Feature Overview

A "Rename" option was added to the `⋯` dropdown on each chat item in the sidebar. Clicking it was supposed to replace the chat title with an editable inline text field, allowing the user to type a new name and press Enter to save it (issuing a PATCH request to `/api/chat`).

Neither the text field appeared, nor did any rename happen.

---

## Files Involved

| File | Role |
|------|------|
| `components/sidebar-history-item.tsx` | Renders each chat row; owns the editing state and UI |
| `components/sidebar-history.tsx` | Manages SWR cache; passes `onRename` callback to each `ChatItem` |
| `app/(chat)/api/chat/route.ts` | PATCH handler that writes the new title to the DB |
| `lib/db/queries.ts` | `updateChatTitleById()` — the Drizzle query that persists the rename |

---

## Bug 1 — Invalid HTML: `<input>` inside `<button>` (primary)

### What happened

The original implementation toggled `asChild` on `SidebarMenuButton` depending on whether editing was active:

```tsx
<SidebarMenuButton asChild={!isEditing} isActive={isActive}>
  {isEditing ? <input ... /> : <Link ...><span>{title}</span></Link>}
</SidebarMenuButton>
```

When `isEditing` is `true`, `asChild` evaluates to `false`. Looking at `SidebarMenuButton`'s implementation in `components/ui/sidebar.tsx:565`:

```ts
const Comp = asChild ? SlotPrimitive.Slot : "button";
```

So with `asChild={false}`, it renders a native `<button>` element. The input then ends up as:

```html
<button>
  <input />   <!-- invalid: interactive elements cannot be nested inside buttons -->
</button>
```

**Browsers silently discard `<input>` elements nested inside `<button>` elements** — this is a hard rule in the HTML spec. The input never made it into the DOM, which is why the text field never appeared.

### Fix

Split into two fully separate JSX branches so the input is never a descendant of a button:

```tsx
{isEditing ? (
  <div className="flex h-8 w-full items-center rounded-md px-2 text-sm ...">
    <input ref={inputRef} ... />
  </div>
) : (
  <SidebarMenuButton asChild isActive={isActive}>
    <Link href={`/chat/${chat.id}`}>
      <span>{draftTitle}</span>
    </Link>
  </SidebarMenuButton>
)}
```

---

## Bug 2 — Dropdown focus restoration races with input focus (secondary)

### What happened

Even with the HTML structure fixed, there was a timing race. When the user clicks "Rename":

1. Radix fires `onSelect` → `setIsEditing(true)` is enqueued
2. Radix closes the dropdown and **synchronously returns focus to the trigger** (`⋯` button)
3. React re-renders → the `<input>` appears in the DOM
4. `useEffect` fires → `inputRef.current?.select()` attempts to focus the input

If step 4 races with step 2 and loses, the input gains focus briefly then immediately loses it to the trigger, causing `onBlur` to fire, `commitRename` to run (with the unchanged title), and `isEditing` to be set back to `false` — making the input vanish before the user can type anything.

### Fix

Suppress Radix's auto-focus restoration via `onCloseAutoFocus` on the `DropdownMenuContent`. This removes Radix from the race entirely — it won't try to return focus to the `⋯` button when the dropdown closes. The `useEffect` can then focus the input directly with no timing hack required:

```tsx
<DropdownMenuContent
  align="end"
  side="bottom"
  onCloseAutoFocus={(e) => e.preventDefault()}
>
```

```ts
useEffect(() => {
  if (isEditing) {
    inputRef.current?.focus();
    inputRef.current?.select();
  }
}, [isEditing]);
```

Additionally, the `onBlur` on the input is guarded with `contains(e.relatedTarget)` so it only commits when focus genuinely leaves the input's container — not on incidental focus loss (e.g., switching browser tabs):

```tsx
onBlur={(e) => {
  if (!e.currentTarget.parentElement?.contains(e.relatedTarget)) {
    commitRename();
  }
}}
```

---

## Complete Code Snapshot

### `components/sidebar-history-item.tsx` (editing state + UI)

```tsx
const [isEditing, setIsEditing] = useState(false);
const [draftTitle, setDraftTitle] = useState(chat.title);
const inputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  if (isEditing) {
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
    return () => clearTimeout(t);
  }
}, [isEditing]);

const commitRename = async () => {
  const trimmed = draftTitle.trim();
  if (!trimmed || trimmed === chat.title) {
    setDraftTitle(chat.title);
    setIsEditing(false);
    return;
  }
  try {
    const res = await fetch(`/api/chat?id=${chat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });
    if (!res.ok) throw new Error();
    onRename(chat.id, trimmed);
  } catch {
    toast.error("Failed to rename chat");
    setDraftTitle(chat.title);
  } finally {
    setIsEditing(false);
  }
};

// In JSX — two separate branches, input never inside a button:
{isEditing ? (
  <div
    className="flex h-8 w-full items-center rounded-md px-2 text-sm data-[active=true]:bg-sidebar-accent"
    data-active={isActive}
  >
    <input
      ref={inputRef}
      className="w-full min-w-0 bg-transparent outline-none"
      value={draftTitle}
      onChange={(e) => setDraftTitle(e.target.value)}
      onBlur={commitRename}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); commitRename(); }
        else if (e.key === "Escape") { setDraftTitle(chat.title); setIsEditing(false); }
      }}
    />
  </div>
) : (
  <SidebarMenuButton asChild isActive={isActive}>
    <Link href={`/chat/${chat.id}`} onClick={() => setOpenMobile(false)}>
      <span>{draftTitle}</span>
    </Link>
  </SidebarMenuButton>
)}

// Rename item in the dropdown:
<DropdownMenuItem className="cursor-pointer" onSelect={() => setIsEditing(true)}>
  <PencilEditIcon />
  <span>Rename</span>
</DropdownMenuItem>
```

### `components/sidebar-history.tsx` (SWR optimistic update)

```ts
const handleRename = (chatId: string, newTitle: string) => {
  mutate((chatHistories) => {
    if (chatHistories) {
      return chatHistories.map((chatHistory) => ({
        ...chatHistory,
        chats: chatHistory.chats.map((chat) =>
          chat.id === chatId ? { ...chat, title: newTitle } : chat
        ),
      }));
    }
  }, { revalidate: false });
};
```

### `app/(chat)/api/chat/route.ts` (PATCH endpoint)

```ts
export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return new ChatSDKError("bad_request:api").toResponse();

  const session = await auth();
  if (!session?.user) return new ChatSDKError("unauthorized:chat").toResponse();

  const chat = await getChatById({ id });
  if (chat?.userId !== session.user.id) return new ChatSDKError("forbidden:chat").toResponse();

  const { title } = await request.json();
  if (!title || typeof title !== "string" || title.trim().length === 0)
    return new ChatSDKError("bad_request:api").toResponse();

  await updateChatTitleById({ chatId: id, title: title.trim() });

  return Response.json({ id, title: title.trim() }, { status: 200 });
}
```

### `lib/db/queries.ts` (DB write — pre-existing, no changes needed)

```ts
export async function updateChatTitleById({
  chatId,
  title,
}: {
  chatId: string;
  title: string;
}) {
  return await db.update(chat).set({ title }).where(eq(chat.id, chatId));
}
```
