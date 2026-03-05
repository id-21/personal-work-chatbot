import { auth } from "@/app/(auth)/auth";
import { regeneratePursuitSummary } from "@/lib/ai/summary";
import { getPursuitById } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

/**
 * POST /api/os/summaries
 * Manually trigger context summary regeneration for a pursuit.
 * Body: { pursuitId: string }
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const { pursuitId } = await request.json();
    if (!pursuitId || typeof pursuitId !== "string") {
      return new ChatSDKError("bad_request:api").toResponse();
    }

    const pursuitData = await getPursuitById({ id: pursuitId });
    if (!pursuitData || pursuitData.userId !== session.user.id) {
      return new ChatSDKError("forbidden:chat").toResponse();
    }

    const summary = await regeneratePursuitSummary({
      pursuitId,
      pursuitName: pursuitData.name,
    });

    if (summary === null) {
      return Response.json({
        summary: null,
        message: "No thoughts to summarise yet",
      });
    }

    return Response.json({ summary });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    console.error("Summary generation error:", error);
    return Response.json(
      { error: "Summary generation failed" },
      { status: 500 }
    );
  }
}
