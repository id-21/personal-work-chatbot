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

interface CreateProjectDialogProps {
  pursuitId: string;
}

export function CreateProjectDialog({ pursuitId }: CreateProjectDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/os/pursuits/${pursuitId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });

      if (!res.ok) throw new Error("Failed to create project");

      setOpen(false);
      setName("");
      setDescription("");
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
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create a new project</DialogTitle>
            <DialogDescription>
              A project is a mid-level initiative within this pursuit.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="proj-name">Name *</Label>
              <Input
                id="proj-name"
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. QR Code Tracking System"
                required
                value={name}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="proj-desc">Description</Label>
              <Textarea
                id="proj-desc"
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this project about?"
                rows={2}
                value={description}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={loading || !name.trim()} type="submit">
              {loading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
