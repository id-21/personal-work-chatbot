"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RoutingChip } from "./routing-chip";

interface RoutingResult {
  chipText: string;
  pursuitId: string | null;
  projectId: string | null;
  entityId: string | null;
  action: string;
}

export function HomeInput() {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RoutingResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || loading) return;

    const message = value.trim();
    setValue("");
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch("/api/os/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) throw new Error("Routing failed");

      const data: RoutingResult = await res.json();
      setResult(data);
    } catch {
      setResult({ chipText: "Something went wrong — try again", pursuitId: null, projectId: null, entityId: null, action: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-t bg-background p-4 space-y-2">
      {result && (
        <RoutingChip
          chipText={result.chipText}
          pursuitId={result.pursuitId}
          onDismiss={() => setResult(null)}
        />
      )}
      <form className="flex gap-2" onSubmit={handleSubmit}>
        <Input
          className="flex-1"
          disabled={loading}
          onChange={(e) => setValue(e.target.value)}
          placeholder="What's on your mind? (e.g. 'I need to call the logistics partner')"
          value={value}
        />
        <Button disabled={!value.trim() || loading} type="submit">
          {loading ? "Routing…" : "Add"}
        </Button>
      </form>
    </div>
  );
}
