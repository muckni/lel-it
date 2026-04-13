"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  WindIcon,
  FolderIcon,
  PlusIcon,
  LayoutDashboardIcon,
  BookOpenIcon,
} from "lucide-react";
import { CreateProjectDialog } from "@/components/create-project-dialog";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const trpc = useTRPC();
  const pathname = usePathname();
  const [openCreateDialog, setOpenCreateDialog] = React.useState(false);

  const { data: portfolios = [] } = useQuery(trpc.portfolio.list.queryOptions());

  const projects = portfolios.flatMap((p) => p.projects ?? []);

  return (
    <Sidebar collapsible="icon" {...props}>
      <CreateProjectDialog open={openCreateDialog} onOpenChange={setOpenCreateDialog} />
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<a href="/" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <WindIcon className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">OWIT</span>
                <span className="text-xs text-muted-foreground">Offshore Wind</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Portfolio dashboard link */}
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<a href="/" />}
                isActive={pathname === "/"}
              >
                <LayoutDashboardIcon className="size-4" />
                <span>Dashboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<a href="/lessons-portfolio" />}
                isActive={pathname.startsWith("/lessons-portfolio")}
              >
                <BookOpenIcon className="size-4" />
                <span>Lessons Cockpit</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Projects list */}
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <SidebarMenu>
            {projects.map((project) => (
              <SidebarMenuItem key={project.id}>
                <SidebarMenuButton
                  render={<a href={`/projects/${project.id}`} />}
                  isActive={pathname.startsWith(`/projects/${project.id}`)}
                >
                  <FolderIcon className="size-4" />
                  <span className="truncate">{project.name}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            <SidebarMenuItem>
              <SidebarMenuButton
                className="text-muted-foreground"
                onClick={() => setOpenCreateDialog(true)}
              >
                <PlusIcon className="size-4" />
                <span>New Project</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
