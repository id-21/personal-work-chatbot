"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MultimodalInput } from "@/components/multimodal-input";
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

export function HomeChatView({ pursuits, userName }: HomeChatViewProps) {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_CHAT_MODEL);

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: "/api/os/home-chat",
    }),
    onFinish: () => {
      router.refresh();
    },
  });

  const isLoading = status === "streaming" || status === "submitted";
  const hasSentMessage = messages.length > 0;

  useEffect(() => {
    if (hasSentMessage) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, hasSentMessage]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Main area: either pursuit cards or chat messages */}
      <div className="flex-1 overflow-y-auto">
        {!hasSentMessage ? (
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
        ) : (
          /* Chat messages view */
          <div className="p-4 space-y-4">
            {messages.map((msg) => {
              const textContent = msg.parts
                .filter((p) => p.type === "text")
                .map((p) => (p.type === "text" ? p.text : ""))
                .join("");

              if (!textContent && msg.role === "assistant") return null;

              return (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{textContent}</p>
                  </div>
                </div>
              );
            })}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
                  Thinking…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
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
    </div>
  );
}
