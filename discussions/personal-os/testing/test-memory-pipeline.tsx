// scripts/test-memory-pipeline.ts
import { runMemoryPipeline } from "../lib/ai/memory-pipeline";
import { vectorSearch } from "../lib/db/queries";
import { embedText } from "../lib/ai/embedding";
import { db } from "../lib/db";

const TEST_USER_ID = "your-actual-user-id";

async function main() {
  console.log("--- Writing test memories ---");

  await runMemoryPipeline({
    userId: TEST_USER_ID,
    rawInput: "We import European wallpapers. Main store is in Kolkata.",
    intents: ["FACT"],
    entities: ["Daga Wallpapers", "Kolkata"],
    pursuitsAffected: [],
    importance: 0.9,
  });

  await runMemoryPipeline({
    userId: TEST_USER_ID,
    rawInput: "Biggest challenge right now is inventory visibility across distributors.",
    intents: ["FACT", "CONTEXT_UPDATE"],
    entities: ["inventory"],
    pursuitsAffected: ["operations"],
    importance: 0.95,
  });

  console.log("--- Testing retrieval ---");

  const embedding = await embedText("what are our main operational problems?");
  const results = await vectorSearch({
    queryEmbedding: embedding,
    userId: TEST_USER_ID,
    matchCount: 5,
  });

  console.log("Vector search results:");
  results.forEach(r => console.log(`  [${r.similarity.toFixed(3)}] ${r.text}`));

  // Check narratives
  const narratives = await db.select().from(narrativeTable)
    .where(eq(narrativeTable.userId, TEST_USER_ID));
  console.log("\nNarratives created:", narratives.map(n => n.topic));
  narratives.forEach(n => console.log(`\n--- ${n.topic} ---\n${n.content}`));
}

main().catch(console.error);