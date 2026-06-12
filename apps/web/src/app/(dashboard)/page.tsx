"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { LogoutButton } from "@/components/logout-button";
import { WindIcon, FolderIcon, PlusIcon } from "lucide-react";
import Link from "next/link";

const PHASE_LABELS: Record<string, string> = {
  maturation: "Maturation",
  feed: "FEED",
  detailed_design: "Detailed Design",
  procurement: "Procurement",
  fabrication: "Fabrication",
  installation: "Installation",
  commissioning: "Commissioning",
  operations: "Operations",
};

function DashboardContent() {
  const trpc = useTRPC();
  const searchParams = useSearchParams();
  const openedFromSearchParam = useRef(false);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const { data: portfolios = [], isLoading } = useQuery(trpc.portfolio.list.queryOptions());

  const projects = portfolios.flatMap((p) => p.projects ?? []);

  useEffect(() => {
    if (openedFromSearchParam.current) return;
    if (searchParams.get("new") === "1") {
      setOpenCreateDialog(true);
      openedFromSearchParam.current = true;
    }
  }, [searchParams]);

  return (
    <>
      <CreateProjectDialog open={openCreateDialog} onOpenChange={setOpenCreateDialog} />
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex w-full items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-vertical:h-4 data-vertical:self-auto"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>Portfolio Dashboard</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          {projects.length > 0 && (
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setOpenCreateDialog(true)}>
                <PlusIcon className="h-4 w-4 mr-1" />
                New Project
              </Button>
              <LogoutButton />
            </div>
          )}
          {projects.length === 0 && <LogoutButton />}
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">Portfolio</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </p>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : projects.length === 0 ? (
          <div className="min-h-[400px] flex-1 rounded-xl border border-dashed flex items-center justify-center">
            <div className="text-center text-muted-foreground max-w-sm">
              <WindIcon className="mx-auto h-12 w-12 mb-4" />
              <h3 className="text-lg font-semibold text-foreground">Welcome to lel-it</h3>
              <p className="mt-1 text-sm">
                No projects yet. Create your first project to get started.
              </p>
              <Button className="mt-4" onClick={() => setOpenCreateDialog(true)}>
                <PlusIcon className="h-4 w-4 mr-1" />
                New Project
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="hover:bg-muted/30 transition-colors cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FolderIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <CardTitle className="text-base">{project.name}</CardTitle>
                      </div>
                      {project.phase && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {PHASE_LABELS[project.phase] ?? project.phase}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {project.description ?? "No description"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2 capitalize">
                      {project.status?.replace(/_/g, " ") ?? "active"}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading…</p>}>
      <DashboardContent />
    </Suspense>
  );
}
