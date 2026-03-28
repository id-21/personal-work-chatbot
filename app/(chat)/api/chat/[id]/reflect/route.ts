import { after } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getChatById } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.LEGACY_MEMORY_ENABLED) {
    return Response.json({ ok: true });
  }

  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });
  if (!chat || chat.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const userId = session.user.id;

  after(async () => {
    // Lazy import to keep the route bundle small
    const { runReflectionAgent } = await import(
      "@/lib/ai/agents/reflection-agent"
    );
    await runReflectionAgent({ chatId: id, userId });
  });

  return Response.json({ ok: true });
}
