import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
} from "ai";
import { auth } from "@/app/(auth)/auth";
import { type PursuitContext, scopedPrompt } from "@/lib/ai/prompts";
import { getOSModel } from "@/lib/ai/providers";
import { createOSTools } from "@/lib/ai/tools/os/create-os-tools";
import { getPursuitWithDetail } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { generateUUID } from "@/lib/utils";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const { messages, pursuitId } = await request.json();

    if (!pursuitId || !Array.isArray(messages)) {
      return new ChatSDKError("bad_request:api").toResponse();
    }

    const pursuitData = await getPursuitWithDetail({ id: pursuitId });
    if (!pursuitData || pursuitData.userId !== session.user.id) {
      return new ChatSDKError("forbidden:chat").toResponse();
    }

    const pursuitContext: PursuitContext = {
      name: pursuitData.name,
      vision: pursuitData.vision,
      currentState: pursuitData.currentState,
      constraints: pursuitData.constraints as string[] | null,
      opportunities: pursuitData.opportunities as string[] | null,
      contextSummary: pursuitData.contextSummary,
      projects: pursuitData.projects.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        openTaskCount: p.tasks.filter(
          (t) => t.status === "open" || t.status === "in_progress"
        ).length,
        tasks: p.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          source: t.source,
        })),
      })),
    };

    const tools = createOSTools({ userId: session.user.id, pursuitId });

    const modelMessages = await convertToModelMessages(messages);

    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        const result = streamText({
          model: getOSModel(),
          system: scopedPrompt(pursuitContext),
          messages: modelMessages,
          stopWhen: stepCountIs(10),
          experimental_activeTools: [
            "getPursuitDetail",
            "createTask",
            "updateTask",
            "createProject",
            "updatePursuit",
            "logThought",
            "getProjectTasks",
          ],
          tools,
          experimental_telemetry: { isEnabled: false },
        });

        dataStream.merge(result.toUIMessageStream());
      },
      generateId: generateUUID,
      onError: () => "Oops, something went wrong. Please try again.",
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    console.error("OS chat error:", error);
    return Response.json({ error: "Chat failed" }, { status: 500 });
  }
}
