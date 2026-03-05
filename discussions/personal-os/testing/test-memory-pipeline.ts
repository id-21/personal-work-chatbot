// Run from project root:
// pnpm tsx --require ./discussions/personal-os/testing/stub-server-only.cjs discussions/personal-os/testing/test-memory-pipeline.ts
// dotenv is loaded by stub-server-only.cjs preloader (--require flag)
import { runMemoryPipeline } from "../../../lib/ai/memory-pipeline";
import {
  getNarrativesByUserId,
  vectorSearch,
} from "../../../lib/db/queries";
import { embedText } from "../../../lib/ai/embedding";

// Replace with your actual user UUID (find it via pnpm db:studio → User table)
const TEST_USER_ID = "c2909aaf-8c28-4982-a578-da7b66acd6ca";

async function main() {
  console.log("--- Writing test memories ---\n");

  await runMemoryPipeline({
    userId: TEST_USER_ID,
    rawInput: "We import European wallpapers. Main store is in Kolkata.",
    pursuitNames: ["Marketing", "Fitness"],
  });
  console.log("✓ Pipeline run 1 complete");

  await runMemoryPipeline({
    userId: TEST_USER_ID,
    rawInput:
      "Biggest challenge right now is inventory visibility across distributors.",
    pursuitNames: ["Marketing", "Fitness"],
  });
  console.log("✓ Pipeline run 2 complete");

  console.log("\n--- Testing vector retrieval ---\n");

  const embedding = await embedText("what are our main operational problems?");
  const results = await vectorSearch({
    queryEmbedding: embedding,
    userId: TEST_USER_ID,
    matchCount: 5,
  });

  if (results.length === 0) {
    console.log("⚠ No vector search results — chunks may not have written");
  } else {
    console.log("Vector search results:");
    for (const r of results) {
      console.log(`  [${(r.similarity as number).toFixed(3)}] ${r.text}`);
    }
  }

  console.log("\n--- Narratives created ---\n");

  const narratives = await getNarrativesByUserId({ userId: TEST_USER_ID });
  if (narratives.length === 0) {
    console.log("⚠ No narratives found");
  } else {
    for (const n of narratives) {
      console.log(`\n=== ${n.topic} (v${n.version}) ===`);
      console.log(n.content);
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
