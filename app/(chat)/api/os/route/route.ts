import { generateObject } from "ai";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { homePrompt } from "@/lib/ai/prompts";
import { getOSModel } from "@/lib/ai/providers";
import {
  createProject,
  createRoutingLog,
  createTask,
  getPursuitsWithProjects,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

const routingSchema = z.object({
  action: z.enum(["create_task", "create_project", "unclassified"]),
  pursuitId: z.string().nullable(),
  projectId: z.string().nullable(),
  newProjectName: z.string().nullable(),
  title: z.string(),
  chipText: z.string(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const { message } = await request.json();
    if (!message || typeof message !== "string") {
      return new ChatSDKError("bad_request:api").toResponse();
    }

    const pursuits = await getPursuitsWithProjects({ userId: session.user.id });

    const contextJson = JSON.stringify(
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
    );

    const { object: routing } = await generateObject({
      model: getOSModel(),
      system: homePrompt,
      prompt: `User message: "${message}"\n\nAvailable pursuits and projects:\n${contextJson}`,
      schema: routingSchema,
    });

    if (routing.action === "unclassified") {
      return Response.json({
        chipText: "Nothing to route — create a pursuit first",
        entityId: null,
      });
    }

    let entityId: string | null = null;
    let finalProjectId = routing.projectId;
    let dbAction: "created_task" | "created_project" | "no_action" =
      "no_action";

    if (
      routing.action === "create_project" &&
      routing.pursuitId &&
      routing.newProjectName
    ) {
      const newProject = await createProject({
        pursuitId: routing.pursuitId,
        name: routing.newProjectName,
      });
      finalProjectId = newProject.id;
      entityId = newProject.id;
      dbAction = "created_project";
    } else if (routing.action === "create_task" && finalProjectId) {
      const newTask = await createTask({
        projectId: finalProjectId,
        title: routing.title,
        source: "ai_suggested",
      });
      entityId = newTask.id;
      dbAction = "created_task";
    }

    // Log the routing decision (fire-and-forget)
    createRoutingLog({
      userId: session.user.id,
      rawInput: message,
      classifiedPursuitId: routing.pursuitId ?? undefined,
      classifiedProjectId: finalProjectId ?? undefined,
      action: dbAction,
      entityId: entityId ?? undefined,
    }).catch(() => {});

    return Response.json({
      chipText: routing.chipText,
      pursuitId: routing.pursuitId,
      projectId: finalProjectId,
      entityId,
      action: dbAction,
    });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    console.error("Routing error:", error);
    return Response.json({ error: "Routing failed" }, { status: 500 });
  }
}
