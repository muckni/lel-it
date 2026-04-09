"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { NavMain } from "@/components/nav-main";
import { NavProjects } from "@/components/nav-projects";
import { NavUser } from "@/components/nav-user";
import { TeamSwitcher } from "@/components/team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  WindIcon,
  LayoutDashboardIcon,
  ListIcon,
  MessageSquareIcon,
  BoxIcon,
  BarChart3Icon,
  Settings2Icon,
  FolderIcon,
  PlusIcon,
} from "lucide-react";

// Placeholder data — will be replaced with real data from Supabase
const data = {
  user: {
    name: "Interface Engineer",
    email: "engineer@example.com",
    avatar: "",
  },
  portfolios: [
    {
      name: "My Portfolio",
      logo: <WindIcon />,
      plan: "Active",
    },
  ],
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: <LayoutDashboardIcon />,
      isActive: true,
      items: [],
    },
    {
      title: "Interface Registers",
      url: "/registers",
      icon: <ListIcon />,
      items: [
        {
          title: "All Registers",
          url: "/registers",
        },
        {
          title: "Agreements",
          url: "/agreements",
        },
        {
          title: "Interface Points",
          url: "/points",
        },
      ],
    },
    {
      title: "Interface Queries",
      url: "/queries",
      icon: <MessageSquareIcon />,
      items: [
        {
          title: "All Queries",
          url: "/queries",
        },
        {
          title: "My Queries",
          url: "/queries/mine",
        },
        {
          title: "Assigned to Me",
          url: "/queries/assigned",
        },
      ],
    },
    {
      title: "3D View",
      url: "/3d-view",
      icon: <BoxIcon />,
      items: [],
    },
    {
      title: "Reports",
      url: "/reports",
      icon: <BarChart3Icon />,
      items: [
        {
          title: "Status Overview",
          url: "/reports/status",
        },
        {
          title: "Work Packages",
          url: "/reports/packages",
        },
      ],
    },
    {
      title: "Settings",
      url: "/settings",
      icon: <Settings2Icon />,
      items: [
        {
          title: "Work Packages",
          url: "/settings/packages",
        },
        {
          title: "Team Members",
          url: "/settings/team",
        },
        {
          title: "Project Details",
          url: "/settings/project",
        },
      ],
    },
  ],
  projects: [
    {
      name: "North Sea Alpha",
      url: "/projects/1",
      icon: <FolderIcon />,
    },
    {
      name: "Baltic Wind II",
      url: "/projects/2",
      icon: <FolderIcon />,
    },
    {
      name: "Create New Project",
      url: "/projects/new",
      icon: <PlusIcon />,
    },
  ],
};

export function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.portfolios} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
