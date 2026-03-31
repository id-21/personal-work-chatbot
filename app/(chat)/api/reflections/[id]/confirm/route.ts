import { auth } from "@/app/(auth)/auth";
import { updateNarrativeWithFact } from "@/lib/ai/agents/narrative-agent";
import type { ProposedFact } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import { embedText } from "@/lib/memory/embedding";
import {
  createMemoryChunk,
  getReflectionById,
  saveReflectionFeedback,
  updateReflectionStatus,
} from "@/lib/memory/queries";

interface FeedbackItem {
  itemId: string;
  itemType: "fact" | "pursuit";
  action: "accept" | "reject" | "edit";
  editedText?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const reflection = await getReflectionById({ id });
  if (!reflection || reflection.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  if (reflection.status !== "pending") {
    return Response.json({ error: "Already processed" }, { status: 400 });
  }

  const { feedback }: { feedback: FeedbackItem[] } = await request.json();

  // Persist raw feedback
  await saveReflectionFeedback({ reflectionId: id, items: feedback });

  // Process accepted facts
  const acceptedFacts = feedback
    .filter((f) => f.itemType === "fact" && f.action !== "reject")
    .map((f) => {
      const original = reflection.proposedFacts.find(
        (pf: ProposedFact) => pf.id === f.itemId
      );
      if (!original) return null;
      return {
        ...original,
        text:
          f.action === "edit" && f.editedText ? f.editedText : original.text,
      } as ProposedFact;
    })
    .filter((f): f is ProposedFact => f !== null);

  // Embed + store each accepted fact, then update narrative
  try {
    await Promise.all(
      acceptedFacts.map(async (fact) => {
        const embedding = await embedText(fact.text);
        await createMemoryChunk({
          userId: session.user.id,
          chatId: reflection.chatId,
          sourceMessageIds: fact.sourceMessageIds,
          text: fact.text,
          embedding,
          tags: [fact.topic],
          importance: fact.confidence,
        });
        await updateNarrativeWithFact({
          userId: session.user.id,
          topic: fact.topic,
          factText: fact.text,
        });
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      { error: `Failed to process facts: ${message}` },
      { status: 500 }
    );
  }

  await updateReflectionStatus({ id, status: "confirmed" });

  return Response.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const reflection = await getReflectionById({ id });
  if (!reflection || reflection.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  await updateReflectionStatus({ id, status: "dismissed" });
  return Response.json({ ok: true });
}
