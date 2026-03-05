import type { NextRequest } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  createProject,
  getProjectsByPursuitId,
  getPursuitById,
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

  const { id: pursuitId } = await params;
  const pursuitData = await getPursuitById({ id: pursuitId });

  if (!pursuitData) {
    return new ChatSDKError(
      "not_found:database",
      "Pursuit not found"
    ).toResponse();
  }

  if (pursuitData.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const projects = await getProjectsByPursuitId({ pursuitId });
  return Response.json(projects);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const { id: pursuitId } = await params;
  const pursuitData = await getPursuitById({ id: pursuitId });

  if (!pursuitData) {
    return new ChatSDKError(
      "not_found:database",
      "Pursuit not found"
    ).toResponse();
  }

  if (pursuitData.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const body = await request.json();
  const { name, description, status } = body;

  if (!name || typeof name !== "string") {
    return new ChatSDKError("bad_request:api", "name is required").toResponse();
  }

  const created = await createProject({ pursuitId, name, description, status });
  return Response.json(created, { status: 201 });
}
