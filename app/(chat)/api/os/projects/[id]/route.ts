import type { NextRequest } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  getProjectById,
  getPursuitById,
  updateProjectById,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const { id } = await params;
  const projectData = await getProjectById({ id });

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

  return Response.json(projectData);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const { id } = await params;
  const projectData = await getProjectById({ id });

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
  const { name, description, status } = body;

  const updated = await updateProjectById({
    id,
    updates: { name, description, status },
  });
  return Response.json(updated);
}
