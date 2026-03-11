import { LlmAgent, FunctionTool, InMemoryRunner } from "@google/adk";
import { createUserContent, Type } from "@google/genai";
import type { UIMessage } from "ai";
import { after } from "next/server";
import {
  createAdkMemory,
  countUnconsolidatedAdkMemories,
} from "./queries";

export function buildExchangeText(messages: UIMessage[]): string {
  const lastUserIdx = [...messages].reverse().findIndex((m) => m.role === "user");
  if (lastUserIdx === -1) return "";

  const fromIdx = messages.length - 1 - lastUserIdx;
  const exchange = messages.slice(fromIdx);

  const parts = exchange
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      const text = m.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join(" ")
        .trim();
      return text ? `${m.role}: ${text}` : null;
    })
    .filter(Boolean);

  return parts.join("\n\n");
}

export async function ingestExchange({
  userId,
  chatId,
  exchangeText,
}: {
  userId: string;
  chatId: string;
  exchangeText: string;
}) {
  const storeMemoryTool = new FunctionTool({
    name: "store_memory",
    description: "Store a processed memory from the conversation exchange.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        summary: {
          type: Type.STRING,
          description: "1-2 sentence summary of the key information",
        },
        entities: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "People, projects, tools, or concepts mentioned",
        },
        topics: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Topic categories (e.g. "work", "health", "learning")',
        },
        importance: {
          type: Type.NUMBER,
          description: "0.0 to 1.0 importance score",
        },
      },
      required: ["summary", "entities", "topics", "importance"],
    },
    execute: async (input: unknown) => {
      const { summary, entities, topics, importance } = input as {
        summary: string;
        entities: string[];
        topics: string[];
        importance: number;
      };
      const memory = await createAdkMemory({
        userId,
        chatId,
        source: "chat-exchange",
        summary,
        entities,
        topics,
        importance,
      });
      return { status: "success", memory_id: memory.id };
    },
  });

  const agent = new LlmAgent({
    name: "ingest_agent",
    model: "gemini-2.5-flash-lite-preview-06-17",
    description: "Extracts structured memory from raw conversation text.",
    instruction: `You are a Memory Ingest Agent. Extract the most important information
from the conversation exchange and call store_memory exactly once. Focus on facts,
decisions, preferences, and context that would be useful in future conversations.
Do not store small talk, greetings, or trivial exchanges — only information with
lasting value. If there is nothing worth storing, do not call store_memory.`,
    tools: [storeMemoryTool],
  });

  const runner = new InMemoryRunner({ agent, appName: "memory_ingest" });

  for await (const _event of runner.runEphemeral({
    userId,
    newMessage: createUserContent(
      `Process and store a memory from this conversation exchange:\n\n${exchangeText}`,
    ),
  })) {
    // Tool calls happen automatically
  }

  const unconsolidatedCount = await countUnconsolidatedAdkMemories({ userId });
  if (unconsolidatedCount >= 5) {
    after(async () => {
      const { runConsolidation } = await import("./consolidate-agent");
      await runConsolidation({ userId });
    });
  }
}
