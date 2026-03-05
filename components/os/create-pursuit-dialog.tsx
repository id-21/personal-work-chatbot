"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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

export function CreatePursuitDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [vision, setVision] = useState("");
  const [currentState, setCurrentState] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/os/pursuits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          vision: vision.trim() || undefined,
          currentState: currentState.trim() || undefined,
        }),
      });

      if (!res.ok) throw new Error("Failed to create pursuit");

      setOpen(false);
      setName("");
      setVision("");
      setCurrentState("");
      router.refresh();
    } catch {
      // error handled silently; could add toast here
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button>New Pursuit</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create a new pursuit</DialogTitle>
            <DialogDescription>
              A pursuit is a top-level domain of your life or work — e.g.
              "Distribution", "Marketing", "Personal Growth".
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Distribution"
                required
                value={name}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vision">Vision</Label>
              <Textarea
                id="vision"
                onChange={(e) => setVision(e.target.value)}
                placeholder="What does success look like?"
                rows={2}
                value={vision}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="currentState">Current State</Label>
              <Textarea
                id="currentState"
                onChange={(e) => setCurrentState(e.target.value)}
                placeholder="Where are things right now?"
                rows={2}
                value={currentState}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
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
