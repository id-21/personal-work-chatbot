"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MultimodalInput } from "@/components/multimodal-input";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import type { Pursuit } from "@/lib/db/schema";
import type { Attachment } from "@/lib/types";
import { generateUUID } from "@/lib/utils";
import { CreatePursuitDialog } from "./create-pursuit-dialog";
import { PursuitCard } from "./pursuit-card";

interface HomeChatViewProps {
  pursuits: Pursuit[];
  userName: string | null;
}

interface ProfileData {
  name?: string | null;
  values?: string[] | null;
  rawContext?: string | null;
}

// Routing confirmations are short one-liners — render as chips, not bubbles
const CHIP_PATTERN =
  /^(Added to|Updated your profile|Created project|Created pursuit)/i;

function isRoutingChip(text: string): boolean {
  return CHIP_PATTERN.test(text.trim()) && text.trim().length < 140;
}

export function HomeChatView({ pursuits, userName }: HomeChatViewProps) {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_CHAT_MODEL);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: "/api/os/home-chat",
    }),
    onFinish: () => {
      router.refresh();
      // Refresh profile data if sheet is open
      if (profileOpen) {
        setProfileData(null);
        loadProfile();
      }
    },
  });

  const isLoading = status === "streaming" || status === "submitted";
  const hasSentMessage = messages.length > 0;

  const loadProfile = async () => {
    setProfileLoading(true);
    try {
      const res = await fetch("/api/os/user-model");
      if (res.ok) {
        const data = await res.json();
        setProfileData(data);
      }
    } finally {
      setProfileLoading(false);
    }
  };

  const openProfile = () => {
    setProfileOpen(true);
    loadProfile();
  };

  useEffect(() => {
    if (hasSentMessage) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, hasSentMessage]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      {/* Profile button — always visible top-right */}
      <div className="absolute right-4 top-3 z-10">
        <Button
          className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={openProfile}
          size="sm"
          variant="ghost"
        >
          <User className="size-4" />
          <span className="text-xs">My Profile</span>
        </Button>
      </div>

      {/* Main area: either pursuit cards or chat messages */}
      <div className="flex-1 overflow-y-auto">
        {hasSentMessage ? (
          /* Chat messages view */
          <div className="p-4 pt-12 space-y-3">
            {messages.map((msg) => {
              const textContent = msg.parts
                .filter((p) => p.type === "text")
                .map((p) => (p.type === "text" ? p.text : ""))
                .join("");
              const toolCalls = msg.parts.filter(
                (p) => p.type === "tool-invocation"
              );

              if (!textContent && msg.role === "assistant") return null;

              const debugBadges = process.env.NODE_ENV === "development" &&
                toolCalls.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {toolCalls.map((p) => {
                      if (p.type !== "tool-invocation") return null;
                      const { toolName, state } = p.toolInvocation;
                      return (
                        <span
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                          key={p.toolInvocation.toolCallId}
                        >
                          ⚙ {toolName}
                          {state === "result" ? " ✓" : " …"}
                        </span>
                      );
                    })}
                  </div>
                );

              // Routing confirmations → chip style
              if (msg.role === "assistant" && isRoutingChip(textContent)) {
                return (
                  <div className="flex flex-col items-start" key={msg.id}>
                    <div className="inline-flex items-center gap-1.5 rounded-full border bg-muted/60 px-3 py-1 text-xs text-muted-foreground animate-in fade-in slide-in-from-bottom-1 duration-200">
                      <span className="text-green-500">✓</span>
                      <span>{textContent.replace(/\*\*/g, "")}</span>
                    </div>
                    {debugBadges}
                  </div>
                );
              }

              // Regular messages → bubble style
              return (
                <div
                  className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                  key={msg.id}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{textContent}</p>
                  </div>
                  {debugBadges}
                </div>
              );
            })}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-muted-foreground">
                  <span className="animate-pulse">···</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        ) : (
          /* Pursuit cards view */
          <div className="p-6">
            {pursuits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="mb-4 text-5xl">🗺️</div>
                <h2 className="mb-2 font-semibold text-xl">
                  Welcome to your Personal OS
                  {userName ? `, ${userName}` : ""}
                </h2>
                <p className="mb-6 max-w-md text-muted-foreground text-sm">
                  Tell me about yourself and what you work on — I'll help you
                  set up your first pursuits. Or create one manually below.
                </p>
                <CreatePursuitDialog />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pursuits.map((p) => (
                  <PursuitCard key={p.id} pursuit={p} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Always-visible input */}
      <div className="border-t p-3">
        <MultimodalInput
          attachments={attachments}
          chatId=""
          disableUrlPush={true}
          hideSuggestedActions={true}
          input={input}
          messages={messages}
          onModelChange={setSelectedModelId}
          selectedModelId={selectedModelId}
          selectedVisibilityType="private"
          sendMessage={sendMessage}
          setAttachments={setAttachments}
          setInput={setInput}
          setMessages={setMessages as never}
          status={status}
          stop={stop}
        />
      </div>

      {/* Profile Sheet */}
      <Sheet onOpenChange={setProfileOpen} open={profileOpen}>
        <SheetContent className="w-80 sm:w-96" side="right">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <User className="size-4" />
              My Profile
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6 text-sm">
            <p className="text-xs text-muted-foreground">
              This is what the AI remembers about you. Just talk to update it.
            </p>

            {profileLoading ? (
              <p className="text-muted-foreground animate-pulse">Loading…</p>
            ) : profileData ? (
              <>
                <div className="space-y-1">
                  <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">
                    Name
                  </p>
                  <p>
                    {profileData.name ?? (
                      <span className="text-muted-foreground italic">
                        Not set
                      </span>
                    )}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">
                    Values
                  </p>
                  {profileData.values && profileData.values.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {profileData.values.map((v) => (
                        <span
                          className="rounded-full border bg-muted px-2.5 py-0.5 text-xs"
                          key={v}
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic">Not set</p>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">
                    Background
                  </p>
                  <p className="leading-relaxed text-muted-foreground">
                    {profileData.rawContext ?? (
                      <span className="italic">Not set</span>
                    )}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground italic">
                Nothing stored yet.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
