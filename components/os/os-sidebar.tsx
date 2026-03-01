"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import type { User } from "next-auth";
import type { Pursuit } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { SidebarUserNav } from "@/components/sidebar-user-nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

interface OSSidebarProps {
  user: User | undefined;
  pursuits: Pursuit[];
}

export function OSSidebar({ user, pursuits }: OSSidebarProps) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar className="group-data-[side=left]:border-r-0">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <Link
                href="/"
                onClick={() => setOpenMobile(false)}
              >
                <span className="font-semibold text-base">Personal OS</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {pursuits.length === 0 ? (
            <div className="px-4 py-3 text-muted-foreground text-sm">
              No pursuits yet.
            </div>
          ) : (
            pursuits.map((p) => (
              <SidebarMenuItem key={p.id}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === `/pursuits/${p.id}`}
                >
                  <Link
                    href={`/pursuits/${p.id}`}
                    onClick={() => setOpenMobile(false)}
                  >
                    <span className="truncate">{p.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))
          )}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>{user && <SidebarUserNav user={user} />}</SidebarFooter>
    </Sidebar>
  );
}
