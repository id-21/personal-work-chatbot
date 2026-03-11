"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Reflection, ProposedFact, ProposedPursuit } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FeedbackItem = {
  itemId: string;
  itemType: "fact" | "pursuit";
  action: "accept" | "reject" | "edit";
  editedText?: string;
};

type ItemState = {
  action: "accept" | "reject" | "edit" | null;
  editedText: string;
};

function FactCard({
  fact,
  state,
  onChange,
}: {
  fact: ProposedFact;
  state: ItemState;
  onChange: (state: ItemState) => void;
}) {
  return (
    <div className={cn(
      "rounded-lg border p-4 space-y-3 transition-opacity",
      state.action === "reject" && "opacity-40"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1">
          {state.action === "edit" ? (
            <textarea
              className="w-full text-sm border rounded px-2 py-1.5 resize-none bg-background"
              rows={2}
              value={state.editedText}
              onChange={(e) => onChange({ ...state, editedText: e.target.value })}
            />
          ) : (
            <p className="text-sm">{fact.text}</p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {fact.topic}
            </span>
            <span className="text-xs text-muted-foreground">
              {Math.round(fact.confidence * 100)}% confidence
            </span>
          </div>
          {fact.sourceQuote && (
            <p className="text-xs text-muted-foreground italic line-clamp-2">
              &ldquo;{fact.sourceQuote}&rdquo;
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={state.action === "accept" ? "default" : "outline"}
          onClick={() => onChange({ ...state, action: "accept" })}
        >
          Accept
        </Button>
        <Button
          size="sm"
          variant={state.action === "edit" ? "default" : "outline"}
          onClick={() => onChange({ ...state, action: "edit", editedText: state.editedText || fact.text })}
        >
          Edit
        </Button>
        <Button
          size="sm"
          variant={state.action === "reject" ? "destructive" : "outline"}
          onClick={() => onChange({ ...state, action: "reject" })}
        >
          Reject
        </Button>
        {fact.sourceMessageIds.length > 0 && (
          <a
            href={`/chat/${fact.sourceMessageIds[0]}`}
            className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:underline self-center"
            target="_blank"
            rel="noreferrer"
          >
            View source
          </a>
        )}
      </div>
    </div>
  );
}

function PursuitCard({
  pursuit,
  state,
  onChange,
}: {
  pursuit: ProposedPursuit;
  state: ItemState;
  onChange: (state: ItemState) => void;
}) {
  const urgencyColor = {
    low: "bg-green-100 text-green-800",
    medium: "bg-yellow-100 text-yellow-800",
    high: "bg-red-100 text-red-800",
  }[pursuit.urgency];

  return (
    <div className={cn(
      "rounded-lg border p-4 space-y-3 transition-opacity",
      state.action === "reject" && "opacity-40"
    )}>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{pursuit.title}</p>
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", urgencyColor)}>
            {pursuit.urgency}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{pursuit.rationale}</p>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={state.action === "accept" ? "default" : "outline"}
          onClick={() => onChange({ ...state, action: "accept" })}
        >
          Accept
        </Button>
        <Button
          size="sm"
          variant={state.action === "reject" ? "destructive" : "outline"}
          onClick={() => onChange({ ...state, action: "reject" })}
        >
          Reject
        </Button>
      </div>
    </div>
  );
}

function ReflectionCard({ reflection }: { reflection: Reflection }) {
  const router = useRouter();
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>(() => {
    const initial: Record<string, ItemState> = {};
    for (const f of reflection.proposedFacts) {
      initial[f.id] = { action: "accept", editedText: f.text };
    }
    for (const p of reflection.proposedPursuits) {
      initial[p.id] = { action: "accept", editedText: p.title };
    }
    return initial;
  });
  const [submitting, setSubmitting] = useState(false);

  const chatDate = new Date(reflection.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  async function handleConfirm() {
    setSubmitting(true);
    const feedback: FeedbackItem[] = [
      ...reflection.proposedFacts.map((f: ProposedFact) => ({
        itemId: f.id,
        itemType: "fact" as const,
        action: itemStates[f.id]?.action ?? "reject",
        editedText: itemStates[f.id]?.editedText,
      })),
      ...reflection.proposedPursuits.map((p: ProposedPursuit) => ({
        itemId: p.id,
        itemType: "pursuit" as const,
        action: itemStates[p.id]?.action ?? "reject",
      })),
    ];

    try {
      const res = await fetch(`/api/reflections/${reflection.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      toast.success("Memory saved");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to save memory: ${message}`);
      setSubmitting(false);
    }
  }

  async function handleDismiss() {
    await fetch(`/api/reflections/${reflection.id}/confirm`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="border rounded-xl p-6 space-y-5 bg-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Session from {chatDate}</p>
          <a
            href={`/chat/${reflection.chatId}`}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            View conversation →
          </a>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Dismiss all
        </button>
      </div>

      {reflection.proposedFacts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Facts ({reflection.proposedFacts.length})
          </h3>
          {reflection.proposedFacts.map((fact: ProposedFact) => (
            <FactCard
              key={fact.id}
              fact={fact}
              state={itemStates[fact.id] ?? { action: "accept", editedText: fact.text }}
              onChange={(s) => setItemStates((prev) => ({ ...prev, [fact.id]: s }))}
            />
          ))}
        </div>
      )}

      {reflection.proposedPursuits.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Work Pursuits ({reflection.proposedPursuits.length})
          </h3>
          {reflection.proposedPursuits.map((pursuit: ProposedPursuit) => (
            <PursuitCard
              key={pursuit.id}
              pursuit={pursuit}
              state={itemStates[pursuit.id] ?? { action: "accept", editedText: pursuit.title }}
              onChange={(s) => setItemStates((prev) => ({ ...prev, [pursuit.id]: s }))}
            />
          ))}
        </div>
      )}

      {reflection.casualTopics.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground">
            Skipped (casual):{" "}
            {reflection.casualTopics.join(", ")}
          </p>
        </div>
      )}

      <Button
        className="w-full"
        onClick={handleConfirm}
        disabled={submitting}
      >
        {submitting ? "Saving..." : "Confirm & Save to Memory"}
      </Button>
    </div>
  );
}

export function ReflectionList({ reflections }: { reflections: Reflection[] }) {
  return (
    <div className="space-y-6">
      {reflections.map((r) => (
        <ReflectionCard key={r.id} reflection={r} />
      ))}
    </div>
  );
}
