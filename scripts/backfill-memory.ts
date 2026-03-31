/**
 * backfill-memory.ts
 *
 * One-time script to run the reflection agent over all historical chats
 * that have never been ingested into the memory pipeline.
 *
 * Usage:
 *   pnpm memory:backfill
 *
 * Safe to re-run — already-processed chats are skipped via MemoryIngestionLog.
 */

import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { runReflectionAgent } from "../lib/ai/agents/reflection-agent";
import { chat, message, user } from "../lib/db/schema";
import { createIngestionLog, getIngestionLog } from "../lib/memory/queries";

if (!process.env.POSTGRES_URL) {
  console.error("[backfill] POSTGRES_URL is not set. Aborting.");
  process.exit(1);
}

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

async function getAllUsers() {
  return db.select({ id: user.id, email: user.email }).from(user);
}

async function getAllChatsByUserId(userId: string) {
  return db
    .select()
    .from(chat)
    .where(eq(chat.userId, userId))
    .orderBy(asc(chat.createdAt));
}

async function getMessageCountForChat(chatId: string): Promise<number> {
  const rows = await db
    .select({ id: message.id })
    .from(message)
    .where(eq(message.chatId, chatId));
  return rows.length;
}

async function getMessageIdsForChat(chatId: string): Promise<string[]> {
  const rows = await db
    .select({ id: message.id })
    .from(message)
    .where(eq(message.chatId, chatId));
  return rows.map((r) => r.id);
}

async function main() {
  console.log("[backfill] Starting memory pipeline backfill...");

  const users = await getAllUsers();
  console.log(`[backfill] Found ${users.length} user(s)`);

  let totalChats = 0;
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const u of users) {
    const chats = await getAllChatsByUserId(u.id);
    console.log(`\n[backfill] User ${u.email} — ${chats.length} chat(s)`);
    totalChats += chats.length;

    for (let i = 0; i < chats.length; i++) {
      const c = chats[i];
      console.log(
        `[backfill]   [${i + 1}/${chats.length}] chat ${c.id} ("${c.title}")`
      );

      // Skip if already ingested
      const existing = await getIngestionLog({
        chatId: c.id,
        agentType: "reflection",
      });
      if (existing) {
        console.log(
          `[backfill]   → already ingested at ${existing.ingestedAt.toISOString()}, skipping`
        );
        skipped++;
        continue;
      }

      // Skip chats with no messages
      const msgCount = await getMessageCountForChat(c.id);
      if (msgCount === 0) {
        console.log("[backfill]   → no messages, skipping");
        skipped++;
        continue;
      }

      try {
        await runReflectionAgent({ chatId: c.id, userId: u.id });

        // Record ingestion
        const messageIds = await getMessageIdsForChat(c.id);
        await createIngestionLog({
          chatId: c.id,
          userId: u.id,
          agentType: "reflection",
          processedMessageIds: messageIds,
        });

        console.log("[backfill]   → done");
        processed++;
      } catch (err) {
        console.error(`[backfill]   → FAILED for chat ${c.id}:`, err);
        failed++;
      }
    }
  }

  console.log(`
[backfill] ─────────────────────────────
[backfill] Complete.
[backfill]   Total chats : ${totalChats}
[backfill]   Processed   : ${processed}
[backfill]   Skipped     : ${skipped}
[backfill]   Failed      : ${failed}
[backfill] ─────────────────────────────
`);

  await client.end();
}

main().catch((err) => {
  console.error("[backfill] Fatal error:", err);
  process.exit(1);
});
