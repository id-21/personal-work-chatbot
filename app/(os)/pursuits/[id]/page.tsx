import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { CreateProjectDialog } from "@/components/os/create-project-dialog";
import { ProjectCard } from "@/components/os/project-card";
import { ScopedChat } from "@/components/os/scoped-chat";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getPursuitWithDetail } from "@/lib/db/queries";

interface PursuitDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PursuitDetailPage({
  params,
}: PursuitDetailPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const pursuit = await getPursuitWithDetail({ id });

  if (!pursuit || pursuit.userId !== session.user.id) notFound();

  return (
    <div className="flex h-dvh flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-6 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1" />
          <div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Link className="hover:text-foreground" href="/">
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-foreground">{pursuit.name}</span>
            </div>
            {pursuit.vision && (
              <p className="mt-0.5 text-muted-foreground text-xs">
                {pursuit.vision}
              </p>
            )}
          </div>
        </div>
        <CreateProjectDialog pursuitId={id} />
      </header>

      {/* Current state banner */}
      {pursuit.currentState && (
        <div className="border-b bg-muted/40 px-6 py-3 shrink-0">
          <p className="text-sm">
            <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Current state:{" "}
            </span>
            {pursuit.currentState}
          </p>
        </div>
      )}

      {/* Two-column layout: Projects (left) + Chat (right) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Projects panel */}
        <main className="flex-1 overflow-y-auto p-6">
          {pursuit.projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mb-4 text-4xl">📂</div>
              <h2 className="mb-2 font-semibold text-lg">No projects yet</h2>
              <p className="mb-6 max-w-sm text-muted-foreground text-sm">
                Break this pursuit into projects — mid-level initiatives you're
                actively working on.
              </p>
              <CreateProjectDialog pursuitId={id} />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {pursuit.projects.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  pursuitId={id}
                  tasks={p.tasks}
                />
              ))}
            </div>
          )}
        </main>

        {/* Chat panel */}
        <div className="w-80 xl:w-96 border-l flex flex-col shrink-0">
          <div className="px-4 py-3 border-b shrink-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              AI Assistant
            </p>
          </div>
          <div className="flex-1 overflow-hidden">
            <ScopedChat pursuitId={id} pursuitName={pursuit.name} />
          </div>
        </div>
      </div>
    </div>
  );
}
