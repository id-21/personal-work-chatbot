import { LlmAgent, FunctionTool, InMemoryRunner, isFinalResponse } from "@google/adk";
import { createUserContent, Type } from "@google/genai";
import { getAllAdkMemories, getAllAdkInsights } from "./queries";

export async function queryAdkMemory({
  userId,
  userMessage,
}: {
  userId: string;
  userMessage: string;
}): Promise<string> {
  const memories = await getAllAdkMemories({ userId, limit: 50 });
  const insights = await getAllAdkInsights({ userId });

  if (memories.length === 0) return "";

  const readMemoriesTool = new FunctionTool({
    name: "read_all_memories",
    description: "Get all stored memories for this user.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
    execute: async () => ({
      memories: memories.map((m) => ({
        id: m.id,
        summary: m.summary,
        topics: m.topics,
        entities: m.entities,
        importance: m.importance,
        createdAt: m.createdAt,
      })),
    }),
  });

  const readInsightsTool = new FunctionTool({
    name: "read_consolidation_history",
    description: "Get cross-cutting insights from memory consolidation.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
    execute: async () => ({
      insights: insights.map((i) => ({
        summary: i.summary,
        insight: i.insight,
        memoryCount: i.memoryIds.length,
      })),
    }),
  });

  const agent = new LlmAgent({
    name: "query_agent",
    model: "gemini-2.5-flash-lite",
    description: "Synthesizes relevant context from stored memories.",
    instruction: `You are a Memory Query Agent. Your job is to provide relevant
context from stored memories to help answer the user's current question.

Steps:
1. Call read_all_memories to get stored memories.
2. Call read_consolidation_history to get cross-cutting insights.
3. Identify what is most relevant to the user's question.
4. Return a concise summary of the relevant context as plain text.
   Focus only on what is genuinely relevant. If nothing is relevant, say so briefly.
   Do not include preamble like "Based on your memories..." — just the context content.`,
    tools: [readMemoriesTool, readInsightsTool],
  });

  const runner = new InMemoryRunner({ agent, appName: "memory_query" });

  let result = "";
  for await (const event of runner.runEphemeral({
    userId,
    newMessage: createUserContent(
      `What context from my memories is relevant to: ${userMessage}`,
    ),
  })) {
    if (isFinalResponse(event) && event.content?.parts?.length) {
      result = event.content.parts
        .map((p: { text?: string }) => p.text ?? "")
        .join("");
    }
  }

  return result;
}
