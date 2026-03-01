import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/app/(auth)/auth";
import { CreateTaskDialog } from "@/components/os/create-task-dialog";
import { TaskList } from "@/components/os/task-list";
import {
  getProjectById,
  getPursuitById,
  getTasksByProjectId,
} from "@/lib/db/queries";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  idea: "Idea",
};

interface ProjectDetailPageProps {
  params: Promise<{ id: string; projectId: string }>;
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id: pursuitId, projectId } = await params;

  const [project, pursuit, tasks] = await Promise.all([
    getProjectById({ id: projectId }),
    getPursuitById({ id: pursuitId }),
    getTasksByProjectId({ projectId }),
  ]);

  if (!project || !pursuit || pursuit.userId !== session.user.id) notFound();

  const openCount = tasks.filter(
    (t) => t.status === "open" || t.status === "in_progress"
  ).length;

  return (
    <div className="flex h-dvh flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1" />
          <div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Link className="hover:text-foreground" href="/">
                Dashboard
              </Link>
              <span>/</span>
              <Link
                className="hover:text-foreground"
                href={`/pursuits/${pursuitId}`}
              >
                {pursuit.name}
              </Link>
              <span>/</span>
              <span className="text-foreground">{project.name}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <Badge variant="outline">{STATUS_LABELS[project.status]}</Badge>
              <span className="text-muted-foreground text-xs">
                {openCount} open · {tasks.length} total
              </span>
            </div>
          </div>
        </div>
        <CreateTaskDialog projectId={projectId} />
      </header>

      {/* Project description */}
      {project.description && (
        <div className="border-b bg-muted/40 px-6 py-3">
          <p className="text-sm">{project.description}</p>
        </div>
      )}

      {/* Tasks */}
      <main className="flex-1 overflow-y-auto p-6">
        <h2 className="mb-4 font-medium text-sm text-muted-foreground uppercase tracking-wide">
          Tasks
        </h2>
        <TaskList tasks={tasks} />
      </main>
    </div>
  );
}
