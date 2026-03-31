import type { NextRequest } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getChatById, getSubChatsByParentId } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const parentChat = await getChatById({ id });
  if (!parentChat) {
    return new ChatSDKError("not_found:chat").toResponse();
  }
  if (parentChat.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const subChats = await getSubChatsByParentId({
    parentId: id,
    userId: session.user.id,
  });

  return Response.json(subChats);
}
