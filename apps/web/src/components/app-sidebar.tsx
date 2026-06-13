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
  BarChart3Icon,
  LibraryIcon,
  Rows3Icon,
  MessageSquareTextIcon,
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
                <span className="font-semibold">lel-it</span>
                <span className="text-xs text-muted-foreground">Lessons Learned</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<a href="/" />}
                isActive={pathname === "/" || pathname.startsWith("/projects")}
              >
                <Rows3Icon className="size-4" />
                <span>Lessons</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<a href="/corporate/library" />}
                isActive={pathname.startsWith("/corporate/library")}
              >
                <LibraryIcon className="size-4" />
                <span>Corporate Library</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<a href="/corporate/proposals" />}
                isActive={pathname.startsWith("/corporate/proposals")}
              >
                <MessageSquareTextIcon className="size-4" />
                <span>Corporate Proposals</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<a href="/corporate/dashboard" />}
                isActive={pathname.startsWith("/corporate/dashboard")}
              >
                <BarChart3Icon className="size-4" />
                <span>Corporate Dashboard</span>
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
