import "server-only";

import { and, count, desc, eq, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  type AdkConnection,
  type AgentLog,
  adkInsight,
  adkMemory,
  agentRun,
} from "@/lib/db/schema";

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export async function createAdkMemory({
  userId,
  chatId,
  source,
  summary,
  entities,
  topics,
  importance,
}: {
  userId: string;
  chatId: string | null;
  source: string;
  summary: string;
  entities: string[];
  topics: string[];
  importance: number;
}) {
  const [row] = await db
    .insert(adkMemory)
    .values({ userId, chatId, source, summary, entities, topics, importance })
    .returning({ id: adkMemory.id });
  return row;
}

export async function getUnconsolidatedAdkMemories({
  userId,
  limit = 30,
}: {
  userId: string;
  limit?: number;
}) {
  return db
    .select()
    .from(adkMemory)
    .where(and(eq(adkMemory.userId, userId), eq(adkMemory.consolidated, false)))
    .orderBy(desc(adkMemory.createdAt))
    .limit(limit);
}

export async function getAllAdkMemories({
  userId,
  limit = 50,
}: {
  userId: string;
  limit?: number;
}) {
  return db
    .select()
    .from(adkMemory)
    .where(eq(adkMemory.userId, userId))
    .orderBy(desc(adkMemory.createdAt))
    .limit(limit);
}

export async function countUnconsolidatedAdkMemories({
  userId,
}: {
  userId: string;
}): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(adkMemory)
    .where(
      and(eq(adkMemory.userId, userId), eq(adkMemory.consolidated, false))
    );
  return row?.value ?? 0;
}

export async function markMemoriesConsolidated({ ids }: { ids: string[] }) {
  if (ids.length === 0) return;
  await Promise.all(
    ids.map((id) =>
      db
        .update(adkMemory)
        .set({ consolidated: true })
        .where(eq(adkMemory.id, id))
    )
  );
}

export async function updateAdkMemoryConnections({
  id,
  connections,
}: {
  id: string;
  connections: AdkConnection[];
}) {
  await db.update(adkMemory).set({ connections }).where(eq(adkMemory.id, id));
}

export async function createAdkInsight({
  userId,
  summary,
  insight,
  memoryIds,
}: {
  userId: string;
  summary: string;
  insight: string;
  memoryIds: string[];
}) {
  const [row] = await db
    .insert(adkInsight)
    .values({ userId, summary, insight, memoryIds })
    .returning({ id: adkInsight.id });
  return row;
}

export async function getAllAdkInsights({ userId }: { userId: string }) {
  return db
    .select()
    .from(adkInsight)
    .where(eq(adkInsight.userId, userId))
    .orderBy(desc(adkInsight.createdAt));
}

// Agent run tracking

export async function createAgentRun({
  userId,
  chatId,
  agentName,
}: {
  userId: string;
  chatId: string | null;
  agentName: string;
}): Promise<{ id: string }> {
  const [row] = await db
    .insert(agentRun)
    .values({ userId, chatId, agentName, status: "running" })
    .returning({ id: agentRun.id });
  return row;
}

export async function updateAgentRun({
  id,
  status,
  logs,
  finishedAt,
}: {
  id: string;
  status: string;
  logs: AgentLog[];
  finishedAt: Date;
}) {
  await db
    .update(agentRun)
    .set({ status, logs, finishedAt })
    .where(eq(agentRun.id, id));
}

export async function getRecentAgentRuns({
  userId,
  sinceMs = 10 * 60 * 1000,
}: {
  userId: string;
  sinceMs?: number;
}) {
  const since = new Date(Date.now() - sinceMs);
  return db
    .select()
    .from(agentRun)
    .where(and(eq(agentRun.userId, userId), gte(agentRun.createdAt, since)))
    .orderBy(desc(agentRun.createdAt));
}
