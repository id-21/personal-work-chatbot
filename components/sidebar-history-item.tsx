import Link from "next/link";
import { memo, useState } from "react";
import { toast } from "sonner";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import type { Chat } from "@/lib/db/schema";
import {
  CheckCircleFillIcon,
  GlobeIcon,
  LoaderIcon,
  LockIcon,
  MoreHorizontalIcon,
  PencilEditIcon,
  ShareIcon,
  TrashIcon,
} from "./icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/sidebar";

const PureChatItem = ({
  chat,
  isActive,
  onDelete,
  onRename,
  setOpenMobile,
}: {
  chat: Chat;
  isActive: boolean;
  onDelete: (chatId: string) => void;
  onRename: (chatId: string, newTitle: string) => void;
  setOpenMobile: (open: boolean) => void;
}) => {
  const { visibilityType, setVisibilityType } = useChatVisibility({
    chatId: chat.id,
    initialVisibilityType: chat.visibility,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draftTitle, setDraftTitle] = useState(chat.title);

  const commitRename = async () => {
    const trimmed = draftTitle.trim();
    if (!trimmed || trimmed === chat.title) {
      setDraftTitle(chat.title);
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
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
      setIsSaving(false);
      setIsEditing(false);
    }
  };

  return (
    <SidebarMenuItem>
      {isEditing ? (
        isSaving ? (
          <div className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm text-muted-foreground">
            <span className="flex-1 truncate">{draftTitle}</span>
            <LoaderIcon className="animate-spin shrink-0" size={12} />
          </div>
        ) : (
          <div className="flex h-8 w-full items-center rounded-md px-2 text-sm ring-1 ring-ring">
            <input
              autoFocus
              className="w-full min-w-0 bg-transparent outline-none"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              onBlur={(e) => {
                if (!e.currentTarget.parentElement?.contains(e.relatedTarget)) {
                  commitRename();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitRename();
                } else if (e.key === "Escape") {
                  setDraftTitle(chat.title);
                  setIsEditing(false);
                }
              }}
            />
          </div>
        )
      ) : (
        <SidebarMenuButton asChild isActive={isActive}>
          <Link href={`/chat/${chat.id}`} onClick={() => setOpenMobile(false)}>
            <span>{draftTitle}</span>
          </Link>
        </SidebarMenuButton>
      )}

      <DropdownMenu modal={true}>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            className="mr-0.5 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            showOnHover={!isActive}
          >
            <MoreHorizontalIcon />
            <span className="sr-only">More</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          side="bottom"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => setIsEditing(true)}
          >
            <PencilEditIcon />
            <span>Rename</span>
          </DropdownMenuItem>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer">
              <ShareIcon />
              <span>Share</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuItem
                  className="cursor-pointer flex-row justify-between"
                  onClick={() => {
                    setVisibilityType("private");
                  }}
                >
                  <div className="flex flex-row items-center gap-2">
                    <LockIcon size={12} />
                    <span>Private</span>
                  </div>
                  {visibilityType === "private" ? (
                    <CheckCircleFillIcon />
                  ) : null}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer flex-row justify-between"
                  onClick={() => {
                    setVisibilityType("public");
                  }}
                >
                  <div className="flex flex-row items-center gap-2">
                    <GlobeIcon />
                    <span>Public</span>
                  </div>
                  {visibilityType === "public" ? <CheckCircleFillIcon /> : null}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          <DropdownMenuItem
            className="cursor-pointer text-destructive focus:bg-destructive/15 focus:text-destructive dark:text-red-500"
            onSelect={() => onDelete(chat.id)}
          >
            <TrashIcon />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
};

export const ChatItem = memo(PureChatItem, (prevProps, nextProps) => {
  if (prevProps.isActive !== nextProps.isActive) return false;
  if (prevProps.chat.title !== nextProps.chat.title) return false;
  return true;
});
