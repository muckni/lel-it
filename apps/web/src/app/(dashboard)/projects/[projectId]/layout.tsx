"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useParams } from "next/navigation";
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
import { LogoutButton } from "@/components/logout-button";
import { ProjectModuleSwitcher } from "@/components/project-module-switcher";
import {
  PROJECT_MODULES,
  inferProjectModuleFromPath,
  type ProjectModuleKey,
} from "@/lib/project-modules";
import { useTRPC } from "@/trpc/client";

function navHref(basePath: string, href: string) {
  if (href.startsWith("/lessons-portfolio")) return href;
  return `${basePath}${href}`;
}

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const projectId = params.projectId as string;
  const trpc = useTRPC();
  const basePath = `/projects/${projectId}`;
  const moduleMemoryKey = `owit.project.${projectId}.module`;

  const { data: project } = useQuery(
    trpc.project.getById.queryOptions({ id: projectId })
  );

  const activeModule =
    inferProjectModuleFromPath(pathname) ?? ("lessons" as ProjectModuleKey);
  const activeContract = PROJECT_MODULES[activeModule];

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(moduleMemoryKey, activeModule);
  }, [activeModule, moduleMemoryKey]);

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
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
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem className="hidden md:block">
                <Link
                  href={`/projects/${projectId}?select=1`}
                  className={cn(
                    "rounded px-2 py-0.5 text-xs font-medium transition-colors hover:opacity-85",
                    activeContract.badgeClass
                  )}
                >
                  {activeContract.shortLabel}
                </Link>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="ml-auto flex items-center gap-2 pr-2">
            <ProjectModuleSwitcher />
            <NotificationBell />
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className={cn("border-b px-4", activeContract.accentClass)}>
        <nav className="flex gap-4 -mb-px overflow-x-auto">
          {activeContract.nav.map((item) => {
            const href = navHref(basePath, item.href);
            const isActive =
              href === "/lessons-portfolio"
                ? pathname.startsWith("/lessons-portfolio")
                : pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={item.label}
                href={href}
                className={cn(
                  "border-b-2 px-1 py-3 text-sm font-medium transition-colors whitespace-nowrap",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex flex-1 flex-col">{children}</div>
    </>
  );
}
