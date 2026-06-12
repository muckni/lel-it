"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3Icon,
  BookOpenCheckIcon,
  FilterIcon,
  LibraryIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

const corporateNav = [
  { label: "Library", href: "/corporate/library", active: true, icon: LibraryIcon },
  { label: "Proposals", href: "/corporate/proposals", active: false, icon: BookOpenCheckIcon },
  { label: "Dashboard", href: "/corporate/dashboard", active: false, icon: BarChart3Icon },
] as const;

export default function CorporateLibraryPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const { data: entries = [], isLoading } = useQuery(
    trpc.lessonV2.listCorporateLibrary.queryOptions()
  );
  const { data: eligibleProjects = [] } = useQuery(
    trpc.lessonV2.listEligibleProjectsForCorporateAdd.queryOptions()
  );
  const addToProject = useMutation(
    trpc.lessonV2.addCorporateActionToProject.mutationOptions({
      onSuccess: async (_, variables) => {
        await queryClient.invalidateQueries(
          trpc.lessonV2.listCorporateLibrary.queryOptions()
        );
        await queryClient.invalidateQueries(
          trpc.lessonV2.listProjectActions.queryOptions({ projectId: variables.projectId })
        );
        setSelectedActionId(null);
        setAddError(null);
      },
      onError: (error) => {
        setAddError(error.message);
      },
    })
  );

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-teal-700">
            Corporate View
          </p>
          <h1 className="text-2xl font-semibold">Corporate Recommended Actions</h1>
        </div>
        <Button variant="outline">Export</Button>
      </div>

      <nav className="flex gap-2 overflow-x-auto border-b">
        {corporateNav.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-2 border-b-2 px-2 py-3 text-sm font-medium whitespace-nowrap",
                item.active
                  ? "border-teal-600 text-teal-700"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FilterIcon className="size-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {["Category", "Phase", "Workstream", "Reuse", "Status"].map((filter) => (
              <Button key={filter} variant="outline" className="w-full justify-between">
                {filter}
                <span className="text-muted-foreground">All</span>
              </Button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px] flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search title, guidance, category, or tag" />
            </div>
            <Button variant="outline">Most reused</Button>
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            {entries.map((entry) => (
              <Card key={entry.title}>
                <CardHeader className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700">
                      {entry.status.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      v{entry.version}
                    </span>
                  </div>
                  <CardTitle className="text-base leading-snug">{entry.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded border px-2 py-1">{entry.category.name}</span>
                    {entry.reusabilityLevel ? (
                      <span className="rounded border px-2 py-1">
                        {entry.reusabilityLevel.replace(/_/g, " ")}
                      </span>
                    ) : null}
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => {
                      setSelectedActionId(entry.id);
                      setAddError(null);
                    }}
                  >
                    <PlusIcon className="size-4" />
                    Add to project
                  </Button>
                </CardContent>
              </Card>
            ))}
            {!isLoading && entries.length === 0 ? (
              <Card className="xl:col-span-3">
                <CardContent className="py-6 text-sm text-muted-foreground">
                  No corporate recommended actions.
                </CardContent>
              </Card>
            ) : null}
          </div>
          <div className="flex justify-end">
            <Link
              href="/lessons-portfolio"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Portfolio cockpit
            </Link>
          </div>
        </div>
      </div>

      <Dialog open={selectedActionId !== null} onOpenChange={(open) => !open && setSelectedActionId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to project</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {eligibleProjects.map((project) => (
              <Button
                key={project.id}
                variant="outline"
                className="w-full justify-between"
                disabled={addToProject.isPending || !selectedActionId}
                onClick={() => {
                  if (!selectedActionId) return;
                  addToProject.mutate({
                    projectId: project.id,
                    corporateActionId: selectedActionId,
                  });
                }}
              >
                <span>{project.name}</span>
                <span className="text-xs text-muted-foreground">{project.role}</span>
              </Button>
            ))}
            {eligibleProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No eligible projects.</p>
            ) : null}
            {addError ? <p className="text-sm text-destructive">{addError}</p> : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
