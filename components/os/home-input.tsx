"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function HomeInput() {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    // AI routing will be wired up in Phase 4
    setValue("");
  };

  return (
    <div className="border-t bg-background p-4">
      <form className="flex gap-2" onSubmit={handleSubmit}>
        <Input
          className="flex-1"
          onChange={(e) => setValue(e.target.value)}
          placeholder="What's on your mind? (e.g. 'I need to call the logistics partner')"
          value={value}
        />
        <Button disabled={!value.trim()} type="submit">
          Add
        </Button>
      </form>
    </div>
  );
}
