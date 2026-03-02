"use client";

import type { UIMessage } from "ai";
import { useCallback, useState } from "react";
import { MultimodalInput } from "@/components/multimodal-input";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import type { Attachment } from "@/lib/types";
import { RoutingChip } from "./routing-chip";

interface RoutingResult {
  chipText: string;
  pursuitId: string | null;
  projectId: string | null;
  entityId: string | null;
  action: string;
}

export function HomeInput() {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"ready" | "submitted">("ready");
  const [result, setResult] = useState<RoutingResult | null>(null);
  const [messages] = useState<UIMessage[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_CHAT_MODEL);

  const handleSendMessage = useCallback(
    async (message: { role: string; parts: Array<{ type: string; text?: string }> }) => {
      const textPart = message.parts.find((p) => p.type === "text");
      const text = textPart?.text?.trim() ?? "";
      if (!text) return;

      setResult(null);
      setStatus("submitted");

      try {
        const res = await fetch("/api/os/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });

        if (!res.ok) throw new Error("Routing failed");

        const data: RoutingResult = await res.json();
        setResult(data);
      } catch {
        setResult({
          chipText: "Something went wrong — try again",
          pursuitId: null,
          projectId: null,
          entityId: null,
          action: "error",
        });
      } finally {
        setStatus("ready");
      }
    },
    []
  );

  return (
    <div className="border-t bg-background p-4 space-y-2">
      {result && (
        <RoutingChip
          chipText={result.chipText}
          pursuitId={result.pursuitId}
          onDismiss={() => setResult(null)}
        />
      )}
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sendMessage={handleSendMessage as any}
        setAttachments={setAttachments}
        setInput={setInput}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setMessages={(() => {}) as any}
        status={status}
        stop={() => {}}
      />
    </div>
  );
}
