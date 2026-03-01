import type { NextRequest } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getUserModelByUserId, upsertUserModel } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const model = await getUserModelByUserId({ userId: session.user.id });
  return Response.json(model ?? {});
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const body = await request.json();
  const { name, values, resourceBudget, rawContext } = body;

  const model = await upsertUserModel({
    userId: session.user.id,
    name,
    values,
    resourceBudget,
    rawContext,
  });

  return Response.json(model);
}
