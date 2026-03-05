import type { NextRequest } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  deletePursuitById,
  getPursuitWithDetail,
  updatePursuitById,
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
  const detail = await getPursuitWithDetail({ id });

  if (!detail) {
    return new ChatSDKError(
      "not_found:database",
      "Pursuit not found"
    ).toResponse();
  }

  if (detail.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  return Response.json(detail);
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
  const body = await request.json();
  const {
    name,
    vision,
    currentState,
    constraints,
    opportunities,
    displayOrder,
  } = body;

  const updated = await updatePursuitById({
    id,
    userId: session.user.id,
    updates: {
      name,
      vision,
      currentState,
      constraints,
      opportunities,
      displayOrder,
    },
  });

  return Response.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const { id } = await params;
  const deleted = await deletePursuitById({ id, userId: session.user.id });

  if (!deleted) {
    return new ChatSDKError(
      "not_found:database",
      "Pursuit not found"
    ).toResponse();
  }

  return Response.json({ deleted: true });
}
