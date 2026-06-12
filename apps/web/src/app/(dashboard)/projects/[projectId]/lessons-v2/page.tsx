"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3Icon,
  ClipboardCheckIcon,
  FileTextIcon,
  Layers3Icon,
  ListChecksIcon,
  MessageSquareTextIcon,
  PlusIcon,
  Rows3Icon,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

const projectNav = [
  { label: "Dashboard", href: "", icon: BarChart3Icon, active: true },
  { label: "Lessons", href: "#lessons", icon: Rows3Icon, active: false },
  { label: "Review queue", href: "#review", icon: ClipboardCheckIcon, active: false },
  { label: "Clusters", href: "#clusters", icon: Layers3Icon, active: false },
  { label: "Recommended actions", href: "#recommended-actions", icon: MessageSquareTextIcon, active: false },
  { label: "Actions", href: "#actions", icon: ListChecksIcon, active: false },
  { label: "Reports", href: "#reports", icon: FileTextIcon, active: false },
] as const;

export default function ProjectLessonsV2Page() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const trpc = useTRPC();
  const basePath = `/projects/${projectId}/lessons-v2`;
  const { data: lessons = [] } = useQuery(
    trpc.lessonV2.listLessons.queryOptions({ projectId })
  );
  const { data: categories = [] } = useQuery(trpc.lessonV2.listCategories.queryOptions());

  const lessonCounts = useMemo(() => {
    return lessons.reduce(
      (acc, lesson) => {
        acc[lesson.status] = (acc[lesson.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }, [lessons]);

  const statusCards = [
    { label: "Submitted lessons", value: lessonCounts.submitted ?? 0, note: "Waiting for review" },
    { label: "Validated lessons", value: lessonCounts.validated ?? 0, note: "Ready for clustering" },
    { label: "Open actions", value: 0, note: "Assigned or in progress" },
    { label: "Overdue actions", value: 0, note: "Past deadline" },
  ] as const;

  const workflowQueues = [
    { label: "Review queue", value: (lessonCounts.submitted ?? 0) + (lessonCounts.under_review ?? 0), href: "#review" },
    { label: "Draft clusters", value: 0, href: "#clusters" },
    { label: "Corporate proposals", value: 0, href: "#recommended-actions" },
    { label: "Needs assignment", value: 0, href: "#actions" },
  ] as const;

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
            Project View
          </p>
          <h1 className="text-2xl font-semibold">Lessons Learned v2</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/corporate/library"
            className={buttonVariants({ variant: "outline" })}
          >
            Corporate Library
          </Link>
          <Button>
            <PlusIcon className="size-4" />
            Capture lesson
          </Button>
        </div>
      </div>

      <nav className="flex gap-2 overflow-x-auto border-b">
        {projectNav.map((item) => {
          const Icon = item.icon;
          const href = item.href ? `${basePath}${item.href}` : basePath;

          return (
            <Link
              key={item.label}
              href={href}
              className={cn(
                "flex items-center gap-2 border-b-2 px-2 py-3 text-sm font-medium whitespace-nowrap",
                item.active
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statusCards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{card.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Queues</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            {workflowQueues.map((item) => (
              <Link
                key={item.label}
                href={`${basePath}${item.href}`}
                className="rounded border p-3 hover:bg-muted/50"
              >
                <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold">{item.value}</p>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              {categories.slice(0, 8).map((category) => (
                <span key={category.id} className="rounded border px-2 py-1 text-xs">
                  {category.name}
                </span>
              ))}
              {categories.length === 0 ? (
                <span className="text-muted-foreground">No categories.</span>
              ) : null}
            </div>
            <Link
              href={`/projects/${projectId}/modules/lessons`}
              className={buttonVariants({ variant: "outline", size: "sm", className: "w-full" })}
            >
              Lessons cockpit
            </Link>
            <Link
              href="/corporate/library"
              className={buttonVariants({ variant: "outline", size: "sm", className: "w-full" })}
            >
              Corporate Library
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
