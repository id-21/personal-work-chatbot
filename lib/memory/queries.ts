import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  type MemoryChunk,
  type MemoryIngestionLog,
  memoryChunk,
  memoryIngestionLog,
  type Narrative,
  narrative,
  type ProposedFact,
  type ProposedPursuit,
  type Reflection,
  reflection,
  reflectionFeedback,
} from "@/lib/db/schema";

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

// ─── Memory Chunks ────────────────────────────────────────────────────────────

export async function createMemoryChunk({
  userId,
  chatId,
  sourceMessageIds,
  text,
  embedding,
  tags,
  importance,
}: {
  userId: string;
  chatId?: string;
  sourceMessageIds: string[];
  text: string;
  embedding: number[];
  tags: string[];
  importance?: number;
}): Promise<MemoryChunk> {
  const [chunk] = await db
    .insert(memoryChunk)
    .values({
      userId,
      chatId,
      sourceMessageIds,
      text,
      embedding,
      tags,
      importance: importance ?? 0.5,
    })
    .returning();
  return chunk;
}

export async function supersedChunk({
  id,
  supersededById,
}: {
  id: string;
  supersededById: string;
}): Promise<void> {
  await db
    .update(memoryChunk)
    .set({ supersededBy: supersededById })
    .where(eq(memoryChunk.id, id));
}

export interface VectorSearchResult {
  id: string;
  text: string;
  similarity: number;
  tags: string[];
  chatId: string | null;
  sourceMessageIds: string[];
}

export async function vectorSearch({
  userId,
  queryEmbedding,
  limit = 8,
  matchThreshold = 0.3,
}: {
  userId: string;
  queryEmbedding: number[];
  limit?: number;
  matchThreshold?: number;
}): Promise<VectorSearchResult[]> {
  const embeddingStr = `[${queryEmbedding.join(",")}]`;
  const results = await db.execute(sql`
    SELECT
      mc.id,
      mc.text,
      1 - (mc.embedding <=> ${embeddingStr}::vector) AS similarity,
      mc.tags,
      mc."chatId",
      mc."sourceMessageIds"
    FROM "MemoryChunk" mc
    WHERE mc."userId" = ${userId}::uuid
      AND mc."supersededBy" IS NULL
      AND 1 - (mc.embedding <=> ${embeddingStr}::vector) > ${matchThreshold}
    ORDER BY mc.embedding <=> ${embeddingStr}::vector
    LIMIT ${limit}
  `);

  return (results as unknown[]).map((row: unknown) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      text: r.text as string,
      similarity: Number(r.similarity),
      tags: (r.tags as string[]) ?? [],
      chatId: (r.chatId as string) ?? null,
      sourceMessageIds: (r.sourceMessageIds as string[]) ?? [],
    };
  });
}

// ─── Narratives ───────────────────────────────────────────────────────────────

export async function getNarrativeByTopic({
  userId,
  topic,
}: {
  userId: string;
  topic: string;
}): Promise<Narrative | undefined> {
  const [result] = await db
    .select()
    .from(narrative)
    .where(and(eq(narrative.userId, userId), eq(narrative.topic, topic)));
  return result;
}

export async function upsertNarrative({
  userId,
  topic,
  content,
}: {
  userId: string;
  topic: string;
  content: string;
}): Promise<void> {
  const existing = await getNarrativeByTopic({ userId, topic });
  if (existing) {
    await db
      .update(narrative)
      .set({ content, version: existing.version + 1, updatedAt: new Date() })
      .where(eq(narrative.id, existing.id));
  } else {
    await db.insert(narrative).values({ userId, topic, content });
  }
}

// ─── Reflections ──────────────────────────────────────────────────────────────

export async function createReflection({
  userId,
  chatId,
  proposedFacts,
  proposedPursuits,
  casualTopics,
}: {
  userId: string;
  chatId: string;
  proposedFacts: ProposedFact[];
  proposedPursuits: ProposedPursuit[];
  casualTopics: string[];
}): Promise<Reflection> {
  const [result] = await db
    .insert(reflection)
    .values({ userId, chatId, proposedFacts, proposedPursuits, casualTopics })
    .returning();
  return result;
}

export async function getReflectionById({
  id,
}: {
  id: string;
}): Promise<Reflection | undefined> {
  const [result] = await db
    .select()
    .from(reflection)
    .where(eq(reflection.id, id));
  return result;
}

export async function getPendingReflectionsByUser({
  userId,
}: {
  userId: string;
}): Promise<Reflection[]> {
  return db
    .select()
    .from(reflection)
    .where(and(eq(reflection.userId, userId), eq(reflection.status, "pending")))
    .orderBy(reflection.createdAt);
}

export async function getPendingReflectionCount({
  userId,
}: {
  userId: string;
}): Promise<number> {
  const results = await db
    .select({ id: reflection.id })
    .from(reflection)
    .where(
      and(eq(reflection.userId, userId), eq(reflection.status, "pending"))
    );
  return results.length;
}

export async function updateReflectionStatus({
  id,
  status,
}: {
  id: string;
  status: "pending" | "confirmed" | "dismissed";
}): Promise<void> {
  await db.update(reflection).set({ status }).where(eq(reflection.id, id));
}

export async function saveReflectionFeedback({
  reflectionId,
  items,
}: {
  reflectionId: string;
  items: Array<{
    itemId: string;
    itemType: "fact" | "pursuit";
    action: "accept" | "reject" | "edit";
    editedText?: string;
  }>;
}): Promise<void> {
  if (!items.length) return;
  await db.insert(reflectionFeedback).values(
    items.map((item) => ({
      reflectionId,
      itemId: item.itemId,
      itemType: item.itemType,
      action: item.action,
      editedText: item.editedText,
    }))
  );
}

// ─── Ingestion Log ─────────────────────────────────────────────────────────────

export async function createIngestionLog({
  chatId,
  userId,
  agentType,
  processedMessageIds,
}: {
  chatId: string;
  userId: string;
  agentType: "reflection" | "knowledge";
  processedMessageIds: string[];
}): Promise<void> {
  await db
    .insert(memoryIngestionLog)
    .values({ chatId, userId, agentType, processedMessageIds });
}

export async function getIngestionLog({
  chatId,
  agentType,
}: {
  chatId: string;
  agentType: "reflection" | "knowledge";
}): Promise<Pick<MemoryIngestionLog, "id" | "ingestedAt"> | undefined> {
  const [result] = await db
    .select({
      id: memoryIngestionLog.id,
      ingestedAt: memoryIngestionLog.ingestedAt,
    })
    .from(memoryIngestionLog)
    .where(
      and(
        eq(memoryIngestionLog.chatId, chatId),
        eq(memoryIngestionLog.agentType, agentType)
      )
    )
    .limit(1);
  return result;
}
