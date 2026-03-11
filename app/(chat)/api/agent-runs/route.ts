import { auth } from "@/app/(auth)/auth";
import { ChatSDKError } from "@/lib/errors";
import { getRecentAgentRuns } from "@/lib/memory/adk/queries";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const runs = await getRecentAgentRuns({ userId: session.user.id });
  return Response.json(runs);
}
