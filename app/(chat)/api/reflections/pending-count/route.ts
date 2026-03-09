import { auth } from "@/app/(auth)/auth";
import { ChatSDKError } from "@/lib/errors";
import { getPendingReflectionCount } from "@/lib/memory/queries";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }
  const count = await getPendingReflectionCount({ userId: session.user.id });
  return Response.json({ count });
}
