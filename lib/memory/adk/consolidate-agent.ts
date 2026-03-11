import { LlmAgent, FunctionTool, InMemoryRunner, getFunctionCalls, getFunctionResponses } from "@google/adk";
import { createUserContent, Type } from "@google/genai";
import {
  getUnconsolidatedAdkMemories,
  markMemoriesConsolidated,
  updateAdkMemoryConnections,
  createAdkInsight,
  createAgentRun,
  updateAgentRun,
} from "./queries";
import type { AgentLog } from "@/lib/db/schema";

export async function runConsolidation({ userId }: { userId: string }) {
  const readTool = new FunctionTool({
    name: "read_unconsolidated_memories",
    description: "Fetch memories that have not yet been consolidated (max 30).",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
    execute: async () => {
      const memories = await getUnconsolidatedAdkMemories({ userId, limit: 30 });
      return {
        memories: memories.map((m) => ({
          id: m.id,
          summary: m.summary,
          topics: m.topics,
          entities: m.entities,
        })),
      };
    },
  });

  const storeTool = new FunctionTool({
    name: "store_consolidation",
    description:
      "Store a cross-cutting insight and link the source memories together.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        sourceIds: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description:
            "IDs of the memories that share a meaningful connection or pattern",
        },
        summary: {
          type: Type.STRING,
          description: "One-line label describing the connection",
        },
        insight: {
          type: Type.STRING,
          description:
            "Explanation of the cross-cutting pattern found across these memories",
        },
      },
      required: ["sourceIds", "summary", "insight"],
    },
    execute: async (input: unknown) => {
      const { sourceIds, summary, insight } = input as {
        sourceIds: string[];
        summary: string;
        insight: string;
      };

      if (sourceIds.length < 2) {
        return {
          status: "skipped",
          reason: "need at least 2 memories to consolidate",
        };
      }

      await createAdkInsight({ userId, summary, insight, memoryIds: sourceIds });

      for (const id of sourceIds) {
        const linkedTo = sourceIds.filter((x) => x !== id);
        await updateAdkMemoryConnections({
          id,
          connections: linkedTo.map((l) => ({
            linkedTo: l,
            relationship: summary,
          })),
        });
      }

      await markMemoriesConsolidated({ ids: sourceIds });
      return { status: "success", insight_stored: summary };
    },
  });

  const agent = new LlmAgent({
    name: "consolidate_agent",
    model: "gemini-2.5-flash-lite-preview-06-17",
    description: "Finds cross-cutting patterns between stored memories.",
    instruction: `You are a Memory Consolidation Agent. Your job is to find meaningful
connections between stored memories.

Steps:
1. Call read_unconsolidated_memories to get the available memories.
2. Identify groups of 2 or more memories that share a theme, pattern, or insight.
3. For each meaningful grouping, call store_consolidation once.
4. Be selective — only consolidate when a genuine cross-cutting insight exists.
   Do not force connections between unrelated memories.
5. After processing all meaningful connections, you are done.`,
    tools: [readTool, storeTool],
  });

  const runner = new InMemoryRunner({ agent, appName: "memory_consolidate" });

  const { id: runId } = await createAgentRun({ userId, chatId: null, agentName: "consolidate_agent" });
  console.log("[adk:consolidate] start", { userId, runId });

  const logs: AgentLog[] = [];
  try {
    for await (const event of runner.runEphemeral({
      userId,
      newMessage: createUserContent("Consolidate memories now."),
    })) {
      for (const call of getFunctionCalls(event)) {
        console.log("[adk:consolidate] tool_call", call.name, call.args);
        logs.push({ type: "tool_call", name: call.name, data: call.args, timestamp: Date.now() });
      }
      for (const resp of getFunctionResponses(event)) {
        console.log("[adk:consolidate] tool_result", resp.name, resp.response);
        logs.push({ type: "tool_result", name: resp.name, data: resp.response, timestamp: Date.now() });
      }
    }
    await updateAgentRun({ id: runId, status: "done", logs, finishedAt: new Date() });
    console.log("[adk:consolidate] done", { runId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log("[adk:consolidate] error", { runId, message });
    logs.push({ type: "error", data: message, timestamp: Date.now() });
    await updateAgentRun({ id: runId, status: "error", logs, finishedAt: new Date() });
  }
}
