import "server-only";

import { generateText } from "ai";
import { getNarrativeByTopic, upsertNarrative } from "@/lib/memory/queries";
import { getOSModel } from "../providers";

export async function updateNarrativeWithFact({
  userId,
  topic,
  factText,
  date,
}: {
  userId: string;
  topic: string;
  factText: string;
  date?: Date;
}): Promise<void> {
  const existing = await getNarrativeByTopic({ userId, topic });
  const existingContent = existing?.content ?? "";
  const dateStr = (date ?? new Date()).toISOString().slice(0, 10);

  const { text: updatedContent } = await generateText({
    model: getOSModel(),
    prompt: `You are maintaining a living document about the topic "${topic}". Append the new fact as a single timestamped bullet point. Preserve all existing content unchanged.

EXISTING DOCUMENT:
${existingContent || "(empty)"}

NEW FACT (date: ${dateStr}):
${factText}

Rules:
- Add ONE new bullet at the end: "- [${dateStr}] <concise statement of the fact>"
- Never remove or reword existing bullets
- If the fact contradicts an existing bullet, add the new fact and append " [supersedes previous entry]"
- Output ONLY the complete updated document, no explanation`,
  });

  await upsertNarrative({ userId, topic, content: updatedContent.trim() });
}
