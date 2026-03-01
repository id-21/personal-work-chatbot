"use client";

import { X } from "lucide-react";

interface RoutingChipProps {
  chipText: string;
  pursuitId?: string | null;
  onDismiss: () => void;
}

export function RoutingChip({ chipText, onDismiss }: RoutingChipProps) {
  return (
    <div className="flex items-center gap-2 rounded-full border bg-muted px-3 py-1.5 text-sm w-fit animate-in fade-in slide-in-from-bottom-2 duration-200">
      <span className="text-muted-foreground">{chipText}</span>
      <button
        aria-label="Dismiss"
        className="text-muted-foreground hover:text-foreground transition-colors"
        onClick={onDismiss}
        type="button"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
