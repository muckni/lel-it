"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LESSON_DISCIPLINES } from "@owit/shared";
import { CreateLessonDialog } from "@/components/lessons/create-ll-dialog";
import { LessonCard, type LessonCardItem } from "@/components/lessons/ll-card";
import {
  LESSON_STATUS_OPTIONS,
  LESSON_TYPE_OPTIONS,
  LLStatusBadge,
  LLTypeBadge,
} from "@/components/lessons/ll-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useProjectRole } from "@/hooks/use-project-role";
import { useTRPC } from "@/trpc/client";

const DISCIPLINE_LABELS: Record<(typeof LESSON_DISCIPLINES)[number], string> = {
  engineering: "Engineering",
  procurement: "Procurement",
  construction: "Construction",
  installation: "Installation",
  commissioning: "Commissioning",
  project_management: "Project Management",
  hse: "HSE",
  commercial: "Commercial",
  other: "Other",
};

export default function ProjectLessonsModulePage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { canEdit, isAdmin } = useProjectRole(projectId);

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [disciplineFilter, setDisciplineFilter] = useState<string>("all");

  const { data: project } = useQuery(
    trpc.project.getById.queryOptions({ id: projectId })
  );

  const { data: workPackages = [] } = useQuery(
    trpc.workPackage.list.queryOptions({ projectId })
  );

  const { data: lessons = [] } = useQuery(
    trpc.lessonLearned.list.queryOptions({
      projectId,
      status: statusFilter === "all" ? undefined : (statusFilter as any),
      type: typeFilter === "all" ? undefined : (typeFilter as any),
      discipline: disciplineFilter === "all" ? undefined : (disciplineFilter as any),
    })
  );

  const { data: pendingReviews = [] } = useQuery({
    ...trpc.lessonLearned.listPendingReviews.queryOptions({ projectId }),
    enabled: canEdit,
  });

  const { data: selectedLesson } = useQuery({
    ...trpc.lessonLearned.getById.queryOptions({ id: selectedLessonId ?? "" }),
    enabled: Boolean(selectedLessonId),
  });

  const filteredLessons = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return lessons;
    return lessons.filter((lesson) => {
      return (
        lesson.title.toLowerCase().includes(normalized) ||
        lesson.description.toLowerCase().includes(normalized)
      );
    });
  }, [lessons, search]);

  const summary = useMemo(() => {
    return {
      total: lessons.length,
      draft: lessons.filter((item) => item.status === "draft").length,
      validated: lessons.filter((item) => item.status === "validated").length,
      consolidated: lessons.filter((item) => item.status === "consolidated").length,
      pending: pendingReviews.length,
    };
  }, [lessons, pendingReviews.length]);

  const refreshQueries = async () => {
    await queryClient.invalidateQueries(
      trpc.lessonLearned.list.queryOptions({ projectId })
    );
    await queryClient.invalidateQueries(
      trpc.lessonLearned.listPendingReviews.queryOptions({ projectId })
    );
    if (selectedLessonId) {
      await queryClient.invalidateQueries(
        trpc.lessonLearned.getById.queryOptions({ id: selectedLessonId })
      );
    }
  };

  const validateMutation = useMutation(
    trpc.lessonLearned.validate.mutationOptions({
      onSuccess: refreshQueries,
    })
  );
  const consolidateMutation = useMutation(
    trpc.lessonLearned.consolidate.mutationOptions({
      onSuccess: refreshQueries,
    })
  );
  const closeMutation = useMutation(
    trpc.lessonLearned.close.mutationOptions({
      onSuccess: refreshQueries,
    })
  );
  const reviewMutation = useMutation(
    trpc.lessonLearned.reviewProposedUpdate.mutationOptions({
      onSuccess: refreshQueries,
    })
  );

  const isBusy =
    validateMutation.isPending ||
    consolidateMutation.isPending ||
    closeMutation.isPending ||
    reviewMutation.isPending;

  return (
    <div className="flex flex-1 flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Lessons Learned</h1>
          <p className="text-sm text-muted-foreground">
            Capture observations continuously and connect them to interface execution in{" "}
            <span className="font-medium text-foreground">{project?.name ?? "this project"}</span>.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Capture Lesson</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary.total}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Draft</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary.draft}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Validated</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary.validated}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Consolidated</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary.consolidated}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pending Reviews</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary.pending}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter Lessons</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Search</Label>
            <Input
              placeholder="Search title or description"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value ?? "all")}
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {LESSON_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select
              value={typeFilter}
              onValueChange={(value) => setTypeFilter(value ?? "all")}
            >
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {LESSON_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Discipline</Label>
            <Select
              value={disciplineFilter}
              onValueChange={(value) => setDisciplineFilter(value ?? "all")}
            >
              <SelectTrigger>
                <SelectValue placeholder="All disciplines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All disciplines</SelectItem>
                {LESSON_DISCIPLINES.map((discipline) => (
                  <SelectItem key={discipline} value={discipline}>
                    {DISCIPLINE_LABELS[discipline]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {canEdit && pendingReviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending Review Queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingReviews.map((request) => (
              <div key={request.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{request.lesson.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Proposed update to validated lesson
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() =>
                        reviewMutation.mutate({
                          id: request.id,
                          decision: "rejected",
                        })
                      }
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      disabled={isBusy}
                      onClick={() =>
                        reviewMutation.mutate({
                          id: request.id,
                          decision: "approved",
                        })
                      }
                    >
                      Approve
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {filteredLessons.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No lessons match the current filters.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredLessons.map((lesson) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson as LessonCardItem}
              canEdit={canEdit}
              isAdmin={isAdmin}
              busy={isBusy}
              onOpen={setSelectedLessonId}
              onValidate={(id) => validateMutation.mutate({ id })}
              onConsolidate={(id) => consolidateMutation.mutate({ id })}
              onClose={(id) => closeMutation.mutate({ id })}
            />
          ))}
        </div>
      )}

      <Sheet open={Boolean(selectedLessonId)} onOpenChange={(open) => !open && setSelectedLessonId(null)}>
        <SheetContent side="right" className="sm:max-w-xl">
          {!selectedLesson ? (
            <div className="p-4 text-sm text-muted-foreground">Loading lesson details…</div>
          ) : (
            <>
              <SheetHeader>
                <SheetTitle>{selectedLesson.title}</SheetTitle>
                <SheetDescription>Lesson detail and linked interface points</SheetDescription>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-4 pb-4">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <LLStatusBadge status={selectedLesson.status} />
                    <LLTypeBadge type={selectedLesson.type} />
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Description</p>
                    <p className="mt-1 text-sm">{selectedLesson.description}</p>
                  </div>

                  {selectedLesson.recommendation && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Recommendation</p>
                      <p className="mt-1 text-sm">{selectedLesson.recommendation}</p>
                    </div>
                  )}

                  <div className="rounded-md border p-3 text-sm">
                    <p>
                      Discipline: {DISCIPLINE_LABELS[selectedLesson.discipline as (typeof LESSON_DISCIPLINES)[number]] ?? selectedLesson.discipline}
                    </p>
                    <p>
                      Work package: {selectedLesson.workPackage ? `${selectedLesson.workPackage.code} - ${selectedLesson.workPackage.name}` : "Not set"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Linked Interface Points</p>
                    {selectedLesson.linkedPoints.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No linked points yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedLesson.linkedPoints.map((link) => {
                          const point = link.interfacePoint;
                          const registerId = point.agreement?.register?.id;
                          const agreementId = point.agreement?.id;
                          const href =
                            registerId && agreementId
                              ? `/projects/${projectId}/registers/${registerId}/agreements/${agreementId}/points/${point.id}`
                              : `/projects/${projectId}/modules/interfaces`;
                          return (
                            <Link
                              key={point.id}
                              href={href}
                              className="block rounded border p-2 text-sm hover:bg-muted/40"
                            >
                              <p className="font-mono text-xs text-muted-foreground">{point.code}</p>
                              <p className="font-medium">{point.title}</p>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <CreateLessonDialog
        projectId={projectId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        workPackages={workPackages.map((workPackage) => ({
          id: workPackage.id,
          code: workPackage.code,
          name: workPackage.name,
        }))}
        onCreated={setSelectedLessonId}
      />
    </div>
  );
}
