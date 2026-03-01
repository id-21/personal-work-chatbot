import Link from "next/link";
import type { Project, Task } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STATUS_VARIANTS: Record<
  Project["status"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  active: "default",
  paused: "secondary",
  completed: "outline",
  idea: "secondary",
};

const STATUS_LABELS: Record<Project["status"], string> = {
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  idea: "Idea",
};

interface ProjectCardProps {
  project: Project;
  tasks: Task[];
  pursuitId: string;
}

export function ProjectCard({ project, tasks, pursuitId }: ProjectCardProps) {
  const openCount = tasks.filter((t) => t.status === "open" || t.status === "in_progress").length;

  return (
    <Link href={`/pursuits/${pursuitId}/projects/${project.id}`}>
      <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{project.name}</CardTitle>
            <Badge variant={STATUS_VARIANTS[project.status]}>
              {STATUS_LABELS[project.status]}
            </Badge>
          </div>
          {project.description && (
            <CardDescription className="line-clamp-2 text-xs">
              {project.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-xs">
            {tasks.length === 0
              ? "No tasks"
              : `${openCount} open · ${tasks.length} total`}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
