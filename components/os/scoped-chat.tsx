"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MultimodalInput } from "@/components/multimodal-input";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import type { Attachment } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

interface ScopedChatProps {
  pursuitId: string;
  pursuitName: string;
}

export function ScopedChat({ pursuitId, pursuitName }: ScopedChatProps) {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_CHAT_MODEL);

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: "/api/os/chat",
      prepareSendMessagesRequest({ messages: allMessages }) {
        return {
          body: { messages: allMessages, pursuitId },
        };
      },
    }),
    onFinish: () => {
      router.refresh();
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">
            <p className="font-medium mb-1">Scoped to: {pursuitName}</p>
            <p>Ask anything about this pursuit — the AI has full context.</p>
          </div>
        )}
        {messages.map((msg) => {
          const textContent = msg.parts
            .filter((p) => p.type === "text")
            .map((p) => (p.type === "text" ? p.text : ""))
            .join("");
          const toolCalls = msg.parts.filter((p) => p.type === "tool-invocation");

          if (!textContent && msg.role === "assistant") return null;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
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
              {process.env.NODE_ENV === "development" && toolCalls.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {toolCalls.map((p) => {
                    if (p.type !== "tool-invocation") return null;
                    const { toolName, state } = p.toolInvocation;
                    return (
                      <span
                        key={p.toolInvocation.toolCallId}
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                      >
                        ⚙ {toolName}{state === "result" ? " ✓" : " …"}
                      </span>
                    );
                  })}
                </div>
              )}
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

      {/* Input */}
      <div className="border-t p-3">
        <MultimodalInput
          attachments={attachments}
          chatId={pursuitId}
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
          setMessages={setMessages as any}
          status={status}
          stop={stop}
        />
      </div>
    </div>
  );
}
