"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
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

const tabs = [
  { name: "Overview", href: "" },
  { name: "Registers", href: "/registers" },
  { name: "Queries", href: "/queries" },
  { name: "3D View", href: "/3d-view" },
  { name: "Reports", href: "/reports" },
  { name: "Settings", href: "/settings" },
];

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const projectId = params.projectId as string;
  const basePath = `/projects/${projectId}`;

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
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
                <BreadcrumbPage>Project {projectId}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
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
