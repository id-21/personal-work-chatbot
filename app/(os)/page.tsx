import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { CreatePursuitDialog } from "@/components/os/create-pursuit-dialog";
import { HomeChatView } from "@/components/os/home-chat-view";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getPursuitsByUserId, getUserModelByUserId } from "@/lib/db/queries";

export default async function OSHomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [pursuits, userModel] = await Promise.all([
    getPursuitsByUserId({ userId: session.user.id }),
    getUserModelByUserId({ userId: session.user.id }),
  ]);

  return (
    <div className="flex h-dvh flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1" />
          <div>
            <h1 className="font-semibold text-xl">Dashboard</h1>
            <p className="text-muted-foreground text-sm">
              Your pursuits at a glance
            </p>
          </div>
        </div>
        <CreatePursuitDialog />
      </header>

      {/* Chat view handles both pursuit cards and chat messages */}
      <HomeChatView pursuits={pursuits} userName={userModel?.name ?? null} />
    </div>
  );
}
