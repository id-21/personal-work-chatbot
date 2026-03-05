import "server-only";

import { generateObject, generateText } from "ai";
import { z } from "zod";
import {
  createMemoryChunk,
  getNarrativeByTopic,
  upsertNarrative,
} from "@/lib/db/queries";
import { embedText } from "./embedding";
import { intentRouterPrompt, narrativeAppendPrompt } from "./prompts";
import { getOSModel } from "./providers";

const intentSchema = z.object({
  intents: z.array(z.enum(["FACT", "TASK", "QUESTION", "CONTEXT_UPDATE"])),
  entities: z.array(z.string()),
  pursuitsAffected: z.array(z.string()),
});

/**
 * Dual-write memory pipeline: classifies intent, embeds the raw input,
 * writes a memory chunk, and updates the relevant narrative documents.
 *
 * Designed to run inside an `after()` block — non-blocking, never throws.
 */
export async function runMemoryPipeline({
  userId,
  rawInput,
  pursuitNames,
}: {
  userId: string;
  rawInput: string;
  pursuitNames: string[];
}): Promise<void> {
  try {
    // Step 1: Classify intent + embed in parallel
    const [routerResult, embedding] = await Promise.all([
      generateObject({
        model: getOSModel(),
        schema: intentSchema,
        prompt: intentRouterPrompt(rawInput, pursuitNames),
      }),
      embedText(rawInput),
    ]);

    const { pursuitsAffected } = routerResult.object;

    // Step 2: Write vector chunk
    await createMemoryChunk({
      userId,
      text: rawInput,
      embedding,
      linkedPursuits: pursuitsAffected,
      importance: 0.5,
    });

    // Step 3: Update narratives for each affected pursuit in parallel
    if (pursuitsAffected.length > 0) {
      await Promise.all(
        pursuitsAffected.map(async (pursuitName) => {
          const existing = await getNarrativeByTopic({
            userId,
            topic: pursuitName,
          });

          const { text: updatedContent } = await generateText({
            model: getOSModel(),
            prompt: narrativeAppendPrompt(
              pursuitName,
              existing?.content ?? "",
              rawInput
            ),
          });

          await upsertNarrative({
            userId,
            topic: pursuitName,
            topicType: "pursuit",
            content: updatedContent,
          });
        })
      );
    }
  } catch (error) {
    // Non-critical path — log but never surface to the user
    console.error("[memory-pipeline] error:", error);
  }
}
