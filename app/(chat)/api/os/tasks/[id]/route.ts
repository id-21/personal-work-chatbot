import type { NextRequest } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  getProjectById,
  getPursuitById,
  getTaskById,
  updateTaskById,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const { id } = await params;
  const taskData = await getTaskById({ id });

  if (!taskData) {
    return new ChatSDKError(
      "not_found:database",
      "Task not found"
    ).toResponse();
  }

  // Verify ownership via project → pursuit → user
  const projectData = await getProjectById({ id: taskData.projectId });
  if (!projectData) {
    return new ChatSDKError(
      "not_found:database",
      "Project not found"
    ).toResponse();
  }

  const pursuitData = await getPursuitById({ id: projectData.pursuitId });
  if (pursuitData?.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const body = await request.json();
  const { title, detail, status } = body;

  const updated = await updateTaskById({
    id,
    updates: { title, detail, status },
  });
  return Response.json(updated);
}
