"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  const queryClient = useQueryClient();
  const basePath = `/projects/${projectId}/lessons`;
  const [renderedAt] = useState(() => Date.now());
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureForm, setCaptureForm] = useState({
    title: "",
    description: "",
    type: "problem" as const,
    categoryId: "",
  });
  const { data: lessons = [] } = useQuery(
    trpc.lessonV2.listLessons.queryOptions({ projectId })
  );
  const { data: categories = [] } = useQuery(trpc.lessonV2.listCategories.queryOptions());
  const { data: clusters = [] } = useQuery(
    trpc.lessonV2.listClusters.queryOptions({ projectId })
  );
  const { data: recommendedActions = [] } = useQuery(
    trpc.lessonV2.listRecommendedActions.queryOptions({ projectId })
  );
  const { data: projectActions = [] } = useQuery(
    trpc.lessonV2.listProjectActions.queryOptions({ projectId })
  );
  const createLesson = useMutation(
    trpc.lessonV2.createLesson.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.lessonV2.listLessons.queryOptions({ projectId }));
        setCaptureOpen(false);
        setCaptureForm({
          title: "",
          description: "",
          type: "problem",
          categoryId: categories[0]?.id ?? "",
        });
      },
    })
  );
  const submitLesson = useMutation(
    trpc.lessonV2.submitLesson.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.lessonV2.listLessons.queryOptions({ projectId }));
      },
    })
  );
  const decideLesson = useMutation(
    trpc.lessonV2.decideLesson.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.lessonV2.listLessons.queryOptions({ projectId }));
      },
    })
  );

  function createCapturedLesson(submit: boolean) {
    const categoryId = captureForm.categoryId || categories[0]?.id;
    if (!categoryId) return;
    createLesson.mutate({
      projectId,
      title: captureForm.title,
      description: captureForm.description,
      type: captureForm.type,
      categoryId,
      submit,
    });
  }

  function submitCapture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createCapturedLesson(true);
  }

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
    {
      label: "Open actions",
      value: projectActions.filter((action) => !["closed", "cancelled"].includes(action.status)).length,
      note: "Assigned or in progress",
    },
    {
      label: "Overdue actions",
      value: projectActions.filter((action) => {
        if (!action.deadline || ["closed", "cancelled", "verified"].includes(action.status)) return false;
        return new Date(action.deadline).getTime() < renderedAt;
      }).length,
      note: "Past deadline",
    },
  ] as const;

  const workflowQueues = [
    { label: "Review queue", value: (lessonCounts.submitted ?? 0) + (lessonCounts.under_review ?? 0), href: "#review" },
    { label: "Draft clusters", value: clusters.filter((cluster) => cluster.status === "draft").length, href: "#clusters" },
    {
      label: "Corporate proposals",
      value: recommendedActions.filter((action) =>
        ["proposed_for_corporate", "corporate_review"].includes(action.status)
      ).length,
      href: "#recommended-actions",
    },
    {
      label: "Needs assignment",
      value: projectActions.filter((action) => action.status === "added_to_project").length,
      href: "#actions",
    },
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
          <Button onClick={() => setCaptureOpen(true)}>
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
              href="/corporate/library"
              className={buttonVariants({ variant: "outline", size: "sm", className: "w-full" })}
            >
              Corporate Library
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card id="lessons">
        <CardHeader>
          <CardTitle className="text-base">Lessons</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {lessons.slice(0, 10).map((lesson) => (
            <div
              key={lesson.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded border p-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/projects/${projectId}/lessons/${lesson.id}`}
                    className="truncate text-sm font-medium hover:underline"
                  >
                    {lesson.title}
                  </Link>
                  <span className="rounded bg-muted px-2 py-1 text-xs">
                    {lesson.status.replace(/_/g, " ")}
                  </span>
                  <span className="rounded border px-2 py-1 text-xs">
                    {lesson.category.name}
                  </span>
                </div>
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                  {lesson.description}
                </p>
              </div>
              <div className="flex gap-2">
                {lesson.status === "draft" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={submitLesson.isPending}
                    onClick={() =>
                      submitLesson.mutate({ projectId, lessonId: lesson.id })
                    }
                  >
                    Submit
                  </Button>
                ) : null}
                {lesson.status === "submitted" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={decideLesson.isPending}
                    onClick={() =>
                      decideLesson.mutate({
                        projectId,
                        lessonId: lesson.id,
                        decision: "start_review",
                      })
                    }
                  >
                    Start review
                  </Button>
                ) : null}
                {lesson.status === "under_review" ? (
                  <Button
                    size="sm"
                    disabled={decideLesson.isPending}
                    onClick={() =>
                      decideLesson.mutate({
                        projectId,
                        lessonId: lesson.id,
                        decision: "validate",
                      })
                    }
                  >
                    Validate
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          {lessons.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lessons.</p>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={captureOpen} onOpenChange={setCaptureOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={submitCapture} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Capture lesson</DialogTitle>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="lesson-v2-title">Title</Label>
              <Input
                id="lesson-v2-title"
                value={captureForm.title}
                onChange={(event) =>
                  setCaptureForm((current) => ({ ...current, title: event.target.value }))
                }
                maxLength={200}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lesson-v2-description">Description</Label>
              <Textarea
                id="lesson-v2-description"
                value={captureForm.description}
                onChange={(event) =>
                  setCaptureForm((current) => ({ ...current, description: event.target.value }))
                }
                required
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={captureForm.type}
                  onValueChange={(value) =>
                    setCaptureForm((current) => ({
                      ...current,
                      type: value as typeof captureForm.type,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["problem", "success", "risk", "improvement", "process_deviation"].map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={captureForm.categoryId || categories[0]?.id || ""}
                  onValueChange={(value) =>
                    setCaptureForm((current) => ({ ...current, categoryId: value ?? "" }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={createLesson.isPending || categories.length === 0}
                onClick={() => createCapturedLesson(false)}
              >
                Save draft
              </Button>
              <Button disabled={createLesson.isPending || categories.length === 0}>
                Submit
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
