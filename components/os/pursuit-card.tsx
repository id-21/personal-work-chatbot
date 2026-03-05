"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Pursuit } from "@/lib/db/schema";

interface PursuitCardProps {
  pursuit: Pursuit;
}

export function PursuitCard({ pursuit }: PursuitCardProps) {
  return (
    <Link href={`/pursuits/${pursuit.id}`}>
      <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{pursuit.name}</CardTitle>
          {pursuit.vision && (
            <CardDescription className="line-clamp-2 text-xs">
              {pursuit.vision}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {pursuit.currentState ? (
            <p className="line-clamp-3 text-muted-foreground text-sm">
              {pursuit.currentState}
            </p>
          ) : (
            <p className="text-muted-foreground/50 text-sm italic">
              No current state set
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
