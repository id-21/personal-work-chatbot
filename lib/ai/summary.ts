import "server-only";

import { generateText } from "ai";
import {
  getPursuitThoughtsByPursuitId,
  upsertContextSummary,
} from "@/lib/db/queries";
import { getOSModel } from "./providers";

const SUMMARY_THRESHOLD = 15; // regenerate when thought count exceeds this

/**
 * Check if a pursuit's thought log has grown past the threshold and, if so,
 * regenerate and persist a rolling context summary.
 *
 * Designed to run inside an `after()` block — non-blocking, no user-facing side effects.
 */
export async function maybRegenerateSummary({
  pursuitId,
  pursuitName,
}: {
  pursuitId: string;
  pursuitName: string;
}) {
  const thoughts = await getPursuitThoughtsByPursuitId({
    pursuitId,
    limit: 100,
  });

  if (thoughts.length < SUMMARY_THRESHOLD) return;

  await regeneratePursuitSummary({ pursuitId, pursuitName, thoughts });
}

/**
 * Unconditionally regenerate the context summary for a pursuit.
 * Can be called manually (e.g. from the summaries API) or from `maybRegenerateSummary`.
 */
export async function regeneratePursuitSummary({
  pursuitId,
  pursuitName,
  thoughts,
}: {
  pursuitId: string;
  pursuitName: string;
  thoughts?: Awaited<ReturnType<typeof getPursuitThoughtsByPursuitId>>;
}) {
  const allThoughts =
    thoughts ??
    (await getPursuitThoughtsByPursuitId({ pursuitId, limit: 100 }));

  if (allThoughts.length === 0) return null;

  // Present chronologically (oldest first) for coherent summarisation
  const thoughtLines = [...allThoughts]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map(
      (t) =>
        `[${t.createdAt.toISOString().split("T")[0]}] ${t.author === "ai" ? "AI" : "User"}: ${t.content}`
    )
    .join("\n");

  const { text: summary } = await generateText({
    model: getOSModel(),
    prompt: `You are summarizing the thought log from conversations about a pursuit called "${pursuitName}".

Below are logged thoughts from recent sessions (oldest first):
${thoughtLines}

Generate a 3-6 sentence rolling context summary that captures:
- Key decisions made or insights reached
- Current blockers or constraints discovered
- Active threads or topics being worked on
- Meaningful progress since sessions began

Write in present tense, concisely but specifically. Do not use bullet points — write flowing prose.`,
  });

  const coversUntil = allThoughts.reduce(
    (latest, t) => (t.createdAt > latest ? t.createdAt : latest),
    allThoughts[0].createdAt
  );

  await upsertContextSummary({
    scopeId: pursuitId,
    scope: "pursuit",
    summary,
    coversUntil,
  });

  return summary;
}
