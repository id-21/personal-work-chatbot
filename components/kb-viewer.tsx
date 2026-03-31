"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import type { Document } from "@/lib/db/schema";

function fetcher(url: string) {
  return fetch(url).then((r) => r.json());
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function KbViewer({ docId }: { docId: string }) {
  const { data: versions, isLoading } = useSWR<Document[]>(
    `/api/document?id=${docId}`,
    fetcher
  );

  const [currentIndex, setCurrentIndex] = useState<number | null>(null);

  if (isLoading) {
    return (
      <p className="text-muted-foreground text-sm animate-pulse">Loading…</p>
    );
  }

  if (!versions || versions.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No content yet. Check back after your next conversation.
      </p>
    );
  }

  const idx = currentIndex ?? versions.length - 1;
  const current = versions[idx];
  const total = versions.length;

  return (
    <div className="flex flex-col gap-4">
      {/* Version navigator */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground select-none">
        <Button
          aria-label="Older version"
          className="h-7 w-7"
          disabled={idx === 0}
          onClick={() => setCurrentIndex(idx - 1)}
          size="icon"
          variant="ghost"
        >
          <ChevronLeftIcon size={16} />
        </Button>

        <span className="flex-1 text-center tabular-nums">
          Version {idx + 1} of {total}
          {" — "}
          {formatDate(current.createdAt as unknown as string)}
        </span>

        <Button
          aria-label="Newer version"
          className="h-7 w-7"
          disabled={idx === total - 1}
          onClick={() => setCurrentIndex(idx + 1)}
          size="icon"
          variant="ghost"
        >
          <ChevronRightIcon size={16} />
        </Button>
      </div>

      <hr className="border-border" />

      {/* Content */}
      <article className="prose prose-sm dark:prose-invert max-w-none text-foreground">
        <ReactMarkdown
          components={{
            a: ({ href, children }) => (
              <a
                className="text-primary underline underline-offset-2 hover:opacity-80"
                href={href}
              >
                {children}
              </a>
            ),
          }}
          components={{
            a: ({ href, children }) => (
              <a
                className="text-primary underline underline-offset-2 hover:opacity-80"
                href={href}
              >
                {children}
              </a>
            ),
          }}
        >
          {current.content ?? ""}
        </ReactMarkdown>
      </article>
    </div>
  );
}
