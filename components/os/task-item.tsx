"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Task } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<Task["status"], string> = {
  open: "Open",
  in_progress: "In Progress",
  done: "Done",
  dismissed: "Dismissed",
};

const STATUS_CLASSES: Record<Task["status"], string> = {
  open: "border-zinc-300 text-zinc-600 dark:border-zinc-600 dark:text-zinc-400",
  in_progress:
    "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  done: "border-green-300 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  dismissed:
    "border-red-200 bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
};

interface TaskItemProps {
  task: Task;
}

export function TaskItem({ task }: TaskItemProps) {
  const [status, setStatus] = useState<Task["status"]>(task.status);
  const [saving, setSaving] = useState(false);

  const handleStatusChange = async (next: string) => {
    const prev = status;
    setStatus(next as Task["status"]);
    setSaving(true);
    try {
      await fetch(`/api/os/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
    } catch {
      setStatus(prev);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md border p-3 transition-opacity",
        status === "dismissed" && "opacity-50",
        saving && "opacity-70"
      )}
    >
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm",
            status === "done" && "text-muted-foreground line-through"
          )}
        >
          {task.title}
        </p>
        {task.detail && (
          <p className="mt-0.5 text-muted-foreground text-xs">{task.detail}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {task.source === "ai_suggested" && (
          <Badge className="text-xs" variant="secondary">
            AI
          </Badge>
        )}
        <Select onValueChange={handleStatusChange} value={status}>
          <SelectTrigger
            className={cn("h-7 w-32 border text-xs", STATUS_CLASSES[status])}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS_LABELS) as Task["status"][]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
