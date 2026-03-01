import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { OSSidebar } from "@/components/os/os-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getPursuitsByUserId } from "@/lib/db/queries";

export default function OSLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex h-dvh" />}>
      <OSSidebarWrapper>{children}</OSSidebarWrapper>
    </Suspense>
  );
}

async function OSSidebarWrapper({ children }: { children: React.ReactNode }) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);

  if (!session?.user) {
    redirect("/login");
  }

  const isCollapsed = cookieStore.get("sidebar_state")?.value !== "true";
  const pursuits = await getPursuitsByUserId({ userId: session.user.id });

  return (
    <SidebarProvider defaultOpen={!isCollapsed}>
      <OSSidebar pursuits={pursuits} user={session.user} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
