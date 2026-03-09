import "server-only";

import { embedText } from "./embedding";
import { getNarrativeByTopic, vectorSearch } from "./queries";

export async function assembleContext({
  userId,
  userMessage,
}: {
  userId: string;
  userMessage: string;
}): Promise<string> {
  const queryEmbedding = await embedText(userMessage);
  const chunks = await vectorSearch({ userId, queryEmbedding, limit: 8 });
  if (!chunks.length) return "";

  // Use the most common topic among top results as the narrative to load
  const topicCounts = chunks.reduce<Record<string, number>>((acc, c) => {
    const topic = c.tags[0];
    if (topic) acc[topic] = (acc[topic] ?? 0) + 1;
    return acc;
  }, {});
  const topTopic = Object.entries(topicCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const narrativeDoc = topTopic
    ? await getNarrativeByTopic({ userId, topic: topTopic })
    : null;

  const chunkBlock = chunks
    .map((c, i) => `${i + 1}. ${c.text}`)
    .join("\n");

  const parts = [
    "## Relevant Memory\n",
    chunkBlock,
  ];

  if (narrativeDoc?.content) {
    parts.push(`\n## ${topTopic} — Context\n${narrativeDoc.content}`);
  }

  return parts.join("\n");
}
