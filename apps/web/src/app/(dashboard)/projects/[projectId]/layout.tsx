"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notification-bell";
import { featureFlags } from "@/lib/feature-flags";
import { useTRPC } from "@/trpc/client";

const baseTabs = [
  { name: "Module Selector", href: "" },
  { name: "Interfaces", href: "/modules/interfaces" },
  { name: "Lessons", href: "/modules/lessons" },
  { name: "Registers", href: "/registers" },
  { name: "Queries", href: "/queries" },
  { name: "Calendar", href: "/calendar" },
  { name: "3D View", href: "/3d-view" },
  { name: "Reports", href: "/reports" },
  { name: "Activity", href: "/activity" },
  { name: "Settings", href: "/settings" },
];

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const trpc = useTRPC();
  const basePath = `/projects/${projectId}`;
  const moduleMemoryKey = `owit.project.${projectId}.module`;
  const { data: project } = useQuery(
    trpc.project.getById.queryOptions({ id: projectId })
  );
  const tabs = baseTabs.filter((tab) => {
    if (tab.name === "Interfaces" && !featureFlags.interfaceWorkspaceV2) return false;
    return true;
  });
  const isSelectingModule = searchParams.get("select") === "1";
  const activeModule = pathname.includes("/modules/lessons")
    ? "lessons"
    : pathname.includes("/modules/interfaces")
      ? "interfaces"
      : null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname === basePath && !isSelectingModule) {
      const rememberedModule = window.localStorage.getItem(moduleMemoryKey);
      if (rememberedModule === "interfaces" || rememberedModule === "lessons") {
        router.replace(`${basePath}/modules/${rememberedModule}`);
      }
    }
  }, [basePath, isSelectingModule, moduleMemoryKey, pathname, router]);

  useEffect(() => {
    if (typeof window === "undefined" || !activeModule) return;
    window.localStorage.setItem(moduleMemoryKey, activeModule);
  }, [activeModule, moduleMemoryKey]);

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4 flex-1">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-vertical:h-4 data-vertical:self-auto"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/">Portfolio</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{project?.name ?? "Project"}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="hidden md:flex items-center gap-2 rounded-md border bg-background p-1 ml-2">
            <Link
              href={`${basePath}/modules/interfaces`}
              className={cn(
                "px-2.5 py-1 text-xs rounded-sm transition-colors",
                activeModule === "interfaces"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Interfaces
            </Link>
            <Link
              href={`${basePath}/modules/lessons`}
              className={cn(
                "px-2.5 py-1 text-xs rounded-sm transition-colors",
                activeModule === "lessons"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Lessons
            </Link>
          </div>
          <div className="ml-auto pr-2">
            <NotificationBell />
          </div>
        </div>
      </header>
      <div className="border-b px-4">
        <nav className="flex gap-4 -mb-px">
          {tabs.map((tab) => {
            const tabPath = `${basePath}${tab.href}`;
            const isActive =
              tab.href === ""
                ? pathname === basePath
                : pathname.startsWith(tabPath);
            return (
              <Link
                key={tab.name}
                href={tabPath}
                className={cn(
                  "border-b-2 px-1 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
                )}
              >
                {tab.name}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </>
  );
}
