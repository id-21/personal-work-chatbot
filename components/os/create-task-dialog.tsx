"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface CreateTaskDialogProps {
  projectId: string;
}

export function CreateTaskDialog({ projectId }: CreateTaskDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/os/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          detail: detail.trim() || undefined,
          source: "user",
        }),
      });

      if (!res.ok) throw new Error("Failed to create task");

      setOpen(false);
      setTitle("");
      setDetail("");
      router.refresh();
    } catch {
      // silently handled
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          New Task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add a task</DialogTitle>
            <DialogDescription>
              An atomic action item for this project.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="task-title">Title *</Label>
              <Input
                id="task-title"
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Set up QR scanner API"
                required
                value={title}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-detail">Detail</Label>
              <Textarea
                id="task-detail"
                onChange={(e) => setDetail(e.target.value)}
                placeholder="Any extra context?"
                rows={2}
                value={detail}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={loading || !title.trim()} type="submit">
              {loading ? "Adding..." : "Add Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
