"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { generateUUID } from "@/lib/utils";

interface ScopedChatProps {
  pursuitId: string;
  pursuitName: string;
}

export function ScopedChat({ pursuitId, pursuitName }: ScopedChatProps) {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  const { messages, sendMessage, status } = useChat({
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

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    sendMessage({
      role: "user",
      parts: [{ type: "text", text }],
    });
  };

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

      {/* Input */}
      <div className="border-t p-3 flex gap-2 items-end">
        <Textarea
          className="flex-1 resize-none min-h-[36px] max-h-[120px]"
          disabled={isLoading}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={`Ask about ${pursuitName}…`}
          rows={1}
          value={input}
        />
        <Button
          className="shrink-0"
          disabled={!input.trim() || isLoading}
          onClick={handleSend}
          size="sm"
          type="button"
        >
          Send
        </Button>
      </div>
    </div>
  );
}
