import "server-only";

import { generateText } from "ai";
import { getKnowledgeBaseDocument, getMessagesByChatId, saveDocument } from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { generateUUID } from "@/lib/utils";
import { getOSModel } from "../providers";

function buildTranscript(messages: DBMessage[]): string {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      const parts = m.parts as Array<{ type: string; text?: string }>;
      const text = parts
        .filter((p) => p.type === "text" && typeof p.text === "string")
        .map((p) => p.text)
        .join(" ");
      return text ? `${m.role}: ${text}` : null;
    })
    .filter(Boolean)
    .join("\n\n");
}

function buildPrompt({
  existingContent,
  transcript,
  chatId,
}: {
  existingContent: string;
  transcript: string;
  chatId: string;
}): string {
  const citation = `[View conversation](/chat/${chatId})`;
  return `You are a silent knowledge extraction agent. Your job is to maintain a living knowledge base document by merging new conversation insights into the existing document.

EXISTING KNOWLEDGE BASE:
${existingContent || "(empty — this is the first conversation)"}

NEW CONVERSATION (citation: ${citation}):
${transcript}

Update the knowledge base by integrating insights from the new conversation. Rules:
- Preserve all existing entries unchanged (do not remove or reword them)
- Add only new, non-duplicate information from the new conversation
- Every new entry you add MUST end with the citation: ${citation}
- Existing entries keep their original citations — never change them
- Omit small talk, greetings, and filler — only include substantive information
- If the new conversation adds nothing new, return the existing document unchanged

Output the complete updated document using EXACTLY this structure (use ## headings, use - bullets):

## Topics
- [topic or theme discussed] ${citation}

## Key Facts
- [fact the user shared about themselves, their work, or their preferences] ${citation}

## Action Items
- [task or action item mentioned] ${citation}

Return ONLY the document content. No preamble, no explanation.`;
}

export async function updateKnowledgeBase({
  chatId,
  userId,
}: {
  chatId: string;
  userId: string;
}): Promise<void> {
  console.log("[knowledge-agent] starting for chat:", chatId);
  try {
    const [messages, existingDoc] = await Promise.all([
      getMessagesByChatId({ id: chatId }),
      getKnowledgeBaseDocument({ userId }),
    ]);

    const transcript = buildTranscript(messages);
    if (!transcript) {
      console.log("[knowledge-agent] no transcript — skipping");
      return;
    }

    const existingContent = existingDoc?.content ?? "";
    const docId = existingDoc?.id ?? generateUUID();

    const { text: updatedContent } = await generateText({
      model: getOSModel(),
      prompt: buildPrompt({ existingContent, transcript, chatId }),
    });

    console.log(
      "[knowledge-agent] updated KB —",
      updatedContent.length,
      "chars (doc id:",
      docId,
      ")"
    );

    await saveDocument({
      id: docId,
      title: "__kb__",
      content: updatedContent,
      kind: "text",
      userId,
    });

    console.log("[knowledge-agent] saved KB document");
  } catch (err) {
    console.error("[knowledge-agent] error:", err);
  }
}
