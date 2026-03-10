import "server-only";

import { generateText } from "ai";
import { z } from "zod";
import { getMessagesByChatId } from "@/lib/db/queries";
import type { DBMessage, ProposedFact, ProposedPursuit } from "@/lib/db/schema";
import { createReflection } from "@/lib/memory/queries";
import { getOSModel } from "../providers";

function buildTranscriptWithIds(messages: DBMessage[]): string {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      const parts = m.parts as Array<{ type: string; text?: string }>;
      const text = parts
        .filter((p) => p.type === "text" && typeof p.text === "string")
        .map((p) => p.text)
        .join(" ");
      return text ? `[${m.id}] ${m.role}: ${text}` : null;
    })
    .filter(Boolean)
    .join("\n\n");
}

const ReflectionOutputSchema = z.object({
  facts: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      topic: z.string(),
      confidence: z.number().min(0).max(1),
      sourceQuote: z.string(),
      sourceMessageIds: z.array(z.string()),
    })
  ),
  pursuits: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      rationale: z.string(),
      urgency: z.enum(["low", "medium", "high"]),
      sourceMessageIds: z.array(z.string()),
    })
  ),
  casual: z.array(z.string()),
});

function buildReflectionPrompt(transcript: string): string {
  return `You are a memory extraction agent. Read the following conversation and extract structured information for long-term memory.

The transcript uses the format: [message-uuid] role: message text

CONVERSATION:
${transcript}

Your task: identify information worth remembering long-term vs. casual chat. Be conservative — only extract things that are durable facts, commitments, or significant work context.

Output ONLY a valid JSON object in this exact schema:
{
  "facts": [
    {
      "id": "unique-string",
      "text": "A clear, standalone fact statement",
      "topic": "short topic tag (e.g. 'daga-wallpapers', 'marketing', 'personal')",
      "confidence": 0.9,
      "sourceQuote": "exact quote from the conversation",
      "sourceMessageIds": ["message-uuid-that-contained-this-info"]
    }
  ],
  "pursuits": [
    {
      "id": "unique-string",
      "title": "Short pursuit or project title",
      "rationale": "Why this seems like an active area of work",
      "urgency": "low|medium|high",
      "sourceMessageIds": ["message-uuid"]
    }
  ],
  "casual": ["list of topic strings that are just small talk or not worth remembering"]
}

Rules:
- Facts: only concrete, durable information (preferences, decisions, commitments, key facts about the user's work or life)
- Do NOT include: greetings, questions the user asked out of curiosity, weather, jokes, or anything the user would not want stored permanently
- Pursuits: only if there is clear evidence of an active project or ongoing work effort
- sourceMessageIds: must be valid UUIDs from the transcript — use only IDs that appear in [brackets]
- If there is nothing worth storing, return empty arrays
- Output ONLY the JSON, no preamble or explanation`;
}

function generateItemId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export async function runReflectionAgent({
  chatId,
  userId,
}: {
  chatId: string;
  userId: string;
}): Promise<void> {
  console.log("[reflection-agent] starting for chat:", chatId);
  try {
    const messages = await getMessagesByChatId({ id: chatId });
    const transcript = buildTranscriptWithIds(messages);

    // Skip trivially short chats
    if (!transcript || transcript.length < 150) {
      console.log("[reflection-agent] transcript too short — skipping (length:", transcript.length, ")");
      return;
    }

    console.log("[reflection-agent] transcript length:", transcript.length, "chars,", messages.length, "messages");

    const { text } = await generateText({
      model: getOSModel(),
      prompt: buildReflectionPrompt(transcript),
    });

    // Strip markdown code fences if present
    const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

    let parsed: z.infer<typeof ReflectionOutputSchema>;
    try {
      parsed = ReflectionOutputSchema.parse(JSON.parse(cleaned));
    } catch (err) {
      console.error("[reflection-agent] Failed to parse output:", err, "\nRaw:", text);
      return;
    }

    console.log(
      "[reflection-agent] extracted — facts:",
      parsed.facts.length,
      "pursuits:",
      parsed.pursuits.length,
      "casual:",
      parsed.casual.length
    );

    // Ensure all items have IDs
    const proposedFacts: ProposedFact[] = parsed.facts.map((f) => ({
      ...f,
      id: f.id || generateItemId(),
    }));
    const proposedPursuits: ProposedPursuit[] = parsed.pursuits.map((p) => ({
      ...p,
      id: p.id || generateItemId(),
    }));

    if (!proposedFacts.length && !proposedPursuits.length) {
      console.log("[reflection-agent] nothing worth storing — skipping");
      return;
    }

    const result = await createReflection({
      userId,
      chatId,
      proposedFacts,
      proposedPursuits,
      casualTopics: parsed.casual,
    });

    console.log("[reflection-agent] created reflection id:", result.id);
  } catch (err) {
    console.error("[reflection-agent] Unexpected error:", err);
  }
}
