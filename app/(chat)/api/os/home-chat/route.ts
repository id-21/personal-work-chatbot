import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  tool,
} from "ai";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  homeChatOnboardingPrompt,
  homeChatRoutingPrompt,
} from "@/lib/ai/prompts";
import { getOSModel } from "@/lib/ai/providers";
import {
  createProject,
  createPursuit,
  createTask,
  getProjectById,
  getPursuitsWithProjects,
  getUserModelByUserId,
  upsertUserModel,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { generateUUID } from "@/lib/utils";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const { messages } = await request.json();
    if (!Array.isArray(messages)) {
      return new ChatSDKError("bad_request:api").toResponse();
    }

    const userId = session.user.id;

    const [pursuits, userModel] = await Promise.all([
      getPursuitsWithProjects({ userId }),
      getUserModelByUserId({ userId }),
    ]);

    const hasNoPursuits = pursuits.length === 0;

    const systemPrompt = hasNoPursuits
      ? homeChatOnboardingPrompt(userModel?.name ?? null)
      : homeChatRoutingPrompt(
          userModel?.name ?? null,
          JSON.stringify(
            pursuits.map((p) => ({
              id: p.id,
              name: p.name,
              currentState: p.currentState,
              projects: p.projects.map((pr) => ({
                id: pr.id,
                name: pr.name,
                status: pr.status,
              })),
            })),
            null,
            2
          )
        );

    // Tools available in both modes
    const sharedTools = {
      updateUserModel: tool({
        description:
          "Update the user's profile with information they share about themselves — name, values, background, constraints, or time/energy budget.",
        inputSchema: z.object({
          name: z.string().optional().describe("User's name if mentioned"),
          values: z
            .array(z.string())
            .optional()
            .describe("Things the user cares about (e.g. family, quality, growth)"),
          rawContext: z
            .string()
            .optional()
            .describe("Free-form summary of who the user is, what they do, their background"),
        }),
        execute: async ({ name, values, rawContext }) => {
          await upsertUserModel({ userId, name, values, rawContext });
          return { updated: true };
        },
      }),
    };

    // Onboarding-only tools (create pursuits)
    const onboardingTools = {
      ...sharedTools,
      createPursuit: tool({
        description:
          "Create a new top-level pursuit (domain of life or work) for the user. Use when a clear domain is identified during onboarding.",
        inputSchema: z.object({
          name: z
            .string()
            .max(100)
            .describe("Short pursuit name, e.g. 'Distribution', 'Marketing', 'Personal Growth'"),
          vision: z
            .string()
            .optional()
            .describe("What success looks like for this pursuit"),
          currentState: z
            .string()
            .optional()
            .describe("Where things stand right now"),
        }),
        execute: async ({ name, vision, currentState }) => {
          const pursuit = await createPursuit({ userId, name, vision, currentState });
          return { id: pursuit.id, name: pursuit.name };
        },
      }),
    };

    // Routing-only tools (create tasks/projects)
    const routingTools = {
      ...sharedTools,
      createTask: tool({
        description:
          "Create a task under an existing project. Use when the user's message maps to an action item in one of the existing pursuits.",
        inputSchema: z.object({
          projectId: z.string().describe("The project ID to add the task to"),
          title: z
            .string()
            .max(200)
            .describe("Short, action-oriented task title"),
        }),
        execute: async ({ projectId, title }) => {
          // Verify project belongs to this user
          const proj = await getProjectById({ id: projectId });
          if (!proj) return { error: "Project not found" };
          const task = await createTask({ projectId, title, source: "ai_suggested" });
          return { id: task.id, title: task.title };
        },
      }),
      createProject: tool({
        description:
          "Create a new project under a pursuit. Use when the user's message describes an initiative that doesn't fit any existing project.",
        inputSchema: z.object({
          pursuitId: z.string().describe("The pursuit ID to create the project under"),
          name: z.string().max(200).describe("Short project name"),
          description: z.string().optional().describe("Brief description"),
        }),
        execute: async ({ pursuitId, name, description }) => {
          const project = await createProject({ pursuitId, name, description });
          return { id: project.id, name: project.name };
        },
      }),
    };

    const activeTools = hasNoPursuits ? onboardingTools : routingTools;

    const modelMessages = await convertToModelMessages(messages);

    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        const result = streamText({
          model: getOSModel(),
          system: systemPrompt,
          messages: modelMessages,
          stopWhen: stepCountIs(8),
          tools: activeTools,
          experimental_telemetry: { isEnabled: false },
        });

        dataStream.merge(result.toUIMessageStream());
      },
      generateId: generateUUID,
      onError: () => "Something went wrong. Please try again.",
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    console.error("Home chat error:", error);
    return Response.json({ error: "Chat failed" }, { status: 500 });
  }
}
