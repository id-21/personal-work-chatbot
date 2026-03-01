import type { NextRequest } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { createPursuit, getPursuitsByUserId } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const pursuits = await getPursuitsByUserId({ userId: session.user.id });
  return Response.json(pursuits);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const body = await request.json();
  const { name, vision, currentState, constraints, opportunities, displayOrder } = body;

  if (!name || typeof name !== "string") {
    return new ChatSDKError("bad_request:api", "name is required").toResponse();
  }

  const created = await createPursuit({
    userId: session.user.id,
    name,
    vision,
    currentState,
    constraints,
    opportunities,
    displayOrder,
  });

  return Response.json(created, { status: 201 });
}
