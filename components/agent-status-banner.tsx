"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AgentRun, AgentLog } from "@/lib/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const AGENT_LABELS: Record<string, string> = {
  ingest_agent: "Memory Ingest",
  consolidate_agent: "Memory Consolidation",
};

type BannerEntry = {
  run: AgentRun;
  dismissed: boolean;
};

export function AgentStatusBanner() {
  if (!process.env.NEXT_PUBLIC_MEMORY_ENABLED) return null;

  return <AgentStatusBannerInner />;
}

function AgentStatusBannerInner() {
  const { data: runs } = useSWR<AgentRun[]>("/api/agent-runs", fetcher, {
    refreshInterval: 3000,
  });

  const [banners, setBanners] = useState<Record<string, BannerEntry>>({});
  const [logsRun, setLogsRun] = useState<AgentRun | null>(null);
  const dismissTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!runs) return;

    setBanners((prev) => {
      const next = { ...prev };
      for (const run of runs) {
        const existing = next[run.id];
        if (existing?.dismissed) continue;

        next[run.id] = { run, dismissed: false };

        // Schedule auto-dismiss for done runs
        if (run.status === "done" && !dismissTimers.current[run.id]) {
          dismissTimers.current[run.id] = setTimeout(() => {
            setBanners((b) => ({
              ...b,
              [run.id]: { ...b[run.id], dismissed: true },
            }));
          }, 5000);
        }
      }
      return next;
    });
  }, [runs]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of Object.values(dismissTimers.current)) {
        clearTimeout(timer);
      }
    };
  }, []);

  const visible = Object.values(banners).filter((b) => !b.dismissed);

  if (visible.length === 0 && !logsRun) return null;

  return (
    <>
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-72">
        {visible.map(({ run }) => (
          <Banner
            key={run.id}
            run={run}
            onDismiss={() =>
              setBanners((b) => ({
                ...b,
                [run.id]: { ...b[run.id], dismissed: true },
              }))
            }
            onViewLogs={() => setLogsRun(run)}
          />
        ))}
      </div>

      <LogsDialog
        run={logsRun}
        onClose={() => setLogsRun(null)}
      />
    </>
  );
}

function Banner({
  run,
  onDismiss,
  onViewLogs,
}: {
  run: AgentRun;
  onDismiss: () => void;
  onViewLogs: () => void;
}) {
  const label = AGENT_LABELS[run.agentName] ?? run.agentName;

  const bg =
    run.status === "running"
      ? "bg-blue-50 border-blue-200 text-blue-900"
      : run.status === "done"
        ? "bg-green-50 border-green-200 text-green-900"
        : "bg-red-50 border-red-200 text-red-900";

  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs shadow-sm ${bg}`}>
      <StatusIcon status={run.status} />
      <span className="flex-1 font-medium truncate">{label}</span>
      {run.status !== "running" && (
        <button
          type="button"
          onClick={onViewLogs}
          className="underline underline-offset-2 shrink-0 opacity-70 hover:opacity-100"
        >
          Logs
        </button>
      )}
      {run.status !== "running" && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 opacity-50 hover:opacity-100"
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "running") {
    return (
      <svg
        className="size-3 animate-spin shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    );
  }
  if (status === "done") return <span className="shrink-0">✓</span>;
  return <span className="shrink-0">✗</span>;
}

function LogsDialog({ run, onClose }: { run: AgentRun | null; onClose: () => void }) {
  if (!run) return null;

  const label = AGENT_LABELS[run.agentName] ?? run.agentName;
  const duration =
    run.finishedAt
      ? `${((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000).toFixed(1)}s`
      : "—";

  return (
    <Dialog open={!!run} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {label} — {run.status} ({duration})
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-auto flex-1 mt-2">
          <pre className="text-xs bg-muted rounded p-3 whitespace-pre-wrap break-all">
            {formatLogs(run.logs as AgentLog[])}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatLogs(logs: AgentLog[]): string {
  if (!logs || logs.length === 0) return "(no tool calls recorded)";
  return logs
    .map((log) => {
      const ts = new Date(log.timestamp).toISOString().substring(11, 23);
      const tag = log.type.toUpperCase().padEnd(11);
      const name = log.name ? `[${log.name}] ` : "";
      const data = JSON.stringify(log.data, null, 2);
      return `${ts} ${tag} ${name}\n${data}`;
    })
    .join("\n\n---\n\n");
}
