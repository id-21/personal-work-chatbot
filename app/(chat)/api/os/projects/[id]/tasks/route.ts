import type { NextRequest } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  createTask,
  getProjectById,
  getPursuitById,
  getTasksByProjectId,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

async function verifyProjectOwnership(projectId: string, userId: string) {
  const projectData = await getProjectById({ id: projectId });
  if (!projectData) return null;
  const pursuitData = await getPursuitById({ id: projectData.pursuitId });
  if (pursuitData?.userId !== userId) return null;
  return projectData;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const { id: projectId } = await params;
  const projectData = await verifyProjectOwnership(projectId, session.user.id);

  if (!projectData) {
    return new ChatSDKError("not_found:database", "Project not found").toResponse();
  }

  const tasks = await getTasksByProjectId({ projectId });
  return Response.json(tasks);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const { id: projectId } = await params;
  const projectData = await verifyProjectOwnership(projectId, session.user.id);

  if (!projectData) {
    return new ChatSDKError("not_found:database", "Project not found").toResponse();
  }

  const body = await request.json();
  const { title, detail, status, source } = body;

  if (!title || typeof title !== "string") {
    return new ChatSDKError("bad_request:api", "title is required").toResponse();
  }

  const created = await createTask({ projectId, title, detail, status, source });
  return Response.json(created, { status: 201 });
}
