import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { CreatePursuitDialog } from "@/components/os/create-pursuit-dialog";
import { HomeInput } from "@/components/os/home-input";
import { PursuitCard } from "@/components/os/pursuit-card";
import { getPursuitsByUserId } from "@/lib/db/queries";
import { SidebarTrigger } from "@/components/ui/sidebar";

export default async function OSHomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const pursuits = await getPursuitsByUserId({ userId: session.user.id });

  return (
    <div className="flex h-dvh flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1" />
          <div>
            <h1 className="font-semibold text-xl">Dashboard</h1>
            <p className="text-muted-foreground text-sm">Your pursuits at a glance</p>
          </div>
        </div>
        <CreatePursuitDialog />
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        {pursuits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 text-5xl">🗺️</div>
            <h2 className="mb-2 font-semibold text-xl">
              Welcome to your Personal OS
            </h2>
            <p className="mb-6 max-w-md text-muted-foreground text-sm">
              Start by creating your first pursuit — a top-level domain of your
              life or work like "Distribution", "Marketing", or "Personal
              Growth".
            </p>
            <CreatePursuitDialog />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pursuits.map((p) => (
              <PursuitCard key={p.id} pursuit={p} />
            ))}
          </div>
        )}
      </main>

      {/* Always-visible home input */}
      <HomeInput />
    </div>
  );
}
