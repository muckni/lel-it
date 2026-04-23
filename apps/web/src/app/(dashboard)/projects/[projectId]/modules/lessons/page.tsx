"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LESSON_DISCIPLINES, LESSON_OWNERSHIP_STATES } from "@owit/shared";
import {
  BarChart3Icon,
  BookCheckIcon,
  BotIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  ClipboardCheckIcon,
  ListChecksIcon,
  MenuIcon,
  SearchIcon,
  XCircleIcon,
} from "lucide-react";
import { CreateLessonDialog } from "@/components/lessons/create-ll-dialog";
import {
  LESSON_OWNERSHIP_OPTIONS,
  LESSON_STATUS_OPTIONS,
  LESSON_TYPE_OPTIONS,
  LLOwnershipBadge,
  LLStatusBadge,
  LLTypeBadge,
} from "@/components/lessons/ll-badge";
import { LessonDetailPanel, type DetailLesson } from "@/components/lessons/ll-detail-panel";
import { LessonCommentsThread } from "@/components/lessons/lesson-comments-thread";
import { useLessonsI18n } from "@/components/lessons/lessons-i18n";
import { LessonRow, type LessonRowItem } from "@/components/lessons/ll-row";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useProjectRole } from "@/hooks/use-project-role";
import { useTRPC } from "@/trpc/client";

type MainSection = "capture" | "review" | "actions" | "reports";

type ReviewFilter = "pending" | "approved" | "rejected";

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

const triageDecisionOptions = [
  { value: "retain", label: "Retain" },
  { value: "drop", label: "Drop" },
  { value: "defer", label: "Defer" },
  { value: "hold", label: "Hold" },
  { value: "duplicate", label: "Duplicate" },
  { value: "external_context", label: "External Context" },
] as const;

function actionProgress(status: string) {
  if (status === "done") return 100;
  if (status === "in_progress") return 65;
  if (status === "overdue") return 30;
  return 10;
}

function keywordThemes(
  lessons: Array<{ title: string; description: string }>
): Array<{ key: string; count: number; recommendation: string }> {
  const stopwords = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "that",
    "this",
    "were",
    "was",
    "have",
    "into",
    "onsite",
    "project",
    "interface",
    "lesson",
    "lessons",
  ]);

  const counts = new Map<string, number>();
  for (const lesson of lessons) {
    const tokens = `${lesson.title} ${lesson.description}`
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 3 && !stopwords.has(token));
    const unique = new Set(tokens);
    for (const token of unique) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([key, count]) => ({
      key,
      count,
      recommendation: `Create a standard mitigation checklist for "${key}" and assign owner coverage in Track A.`,
    }));
}

export default function ProjectLessonsModulePage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { canEdit, role } = useProjectRole(projectId);
  const t = useLessonsI18n();

  const [section, setSection] = useState<MainSection>("capture");
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [rightOpen, setRightOpen] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [disciplineFilter, setDisciplineFilter] = useState<string>("all");
  const [ownershipFilter, setOwnershipFilter] = useState<string>("all");

  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("pending");
  const [reviewCommentByLesson, setReviewCommentByLesson] = useState<Record<string, string>>({});
  const [triageDecisionByLesson, setTriageDecisionByLesson] = useState<Record<string, string>>({});

  const { data: project } = useQuery(trpc.project.getById.queryOptions({ id: projectId }));
  const { data: workPackages = [] } = useQuery(trpc.workPackage.list.queryOptions({ projectId }));

  const { data: lessons = [] } = useQuery(
    trpc.lessonLearned.list.queryOptions({
      projectId,
      status: statusFilter === "all" ? undefined : (statusFilter as any),
      type: typeFilter === "all" ? undefined : (typeFilter as any),
      discipline: disciplineFilter === "all" ? undefined : (disciplineFilter as any),
      ownershipState: ownershipFilter === "all" ? undefined : (ownershipFilter as any),
    })
  );
  const { data: intakeLessons = [] } = useQuery(trpc.lessonOps.listIntake.queryOptions({ projectId }));
  const { data: workflowOverview } = useQuery(trpc.lessonOps.getWorkflowOverview.queryOptions({ projectId }));
  const { data: clusters = [] } = useQuery(trpc.lessonOps.listClusters.queryOptions({ projectId }));
  const { data: trackAActions = [] } = useQuery(trpc.lessonOps.listTrackA.queryOptions({ projectId }));
  const { data: trackB = [] } = useQuery(trpc.lessonOps.listTrackB.queryOptions({ projectId }));
  const { data: packs = [] } = useQuery(
    trpc.lessonReport.listPacks.queryOptions({
      projectId,
      cycleId: workflowOverview?.cycleId ?? undefined,
    })
  );
  const { data: pendingReviews = [] } = useQuery({
    ...trpc.lessonLearned.listPendingReviews.queryOptions({ projectId }),
    enabled: canEdit,
  });

  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;

  const filteredLessons = useMemo(() => {
    const query = search.trim().toLowerCase();

    return lessons.filter((lesson) => {
      if (query) {
        const haystack = `${lesson.title}\n${lesson.description}\n${lesson.recommendation ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [lessons, search]);

  const reviewLessons = useMemo(() => {
    if (reviewFilter === "pending") return lessons.filter((lesson) => lesson.status === "draft");
    if (reviewFilter === "approved") {
      return lessons.filter((lesson) => ["validated", "consolidated", "closed"].includes(lesson.status));
    }
    return lessons.filter((lesson) => lesson.workflowState === "ingested" && lesson.status === "draft");
  }, [lessons, reviewFilter]);

  const actionStatusCounts = useMemo(() => {
    return trackAActions.reduce(
      (acc, row) => {
        if (row.status === "done") acc.done += 1;
        else if (row.status === "in_progress") acc.inProgress += 1;
        else if (row.status === "overdue") acc.overdue += 1;
        else acc.open += 1;
        return acc;
      },
      { open: 0, inProgress: 0, done: 0, overdue: 0 }
    );
  }, [trackAActions]);

  const reportByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const lesson of lessons) {
      map.set(lesson.type, (map.get(lesson.type) ?? 0) + 1);
    }
    const total = Math.max(lessons.length, 1);
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ key, count, pct: (count / total) * 100 }));
  }, [lessons]);

  const reportByPackage = useMemo(() => {
    const map = new Map<string, number>();
    for (const lesson of lessons) {
      const label = lesson.workPackage ? `${lesson.workPackage.code} - ${lesson.workPackage.name}` : "Unassigned";
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    const total = Math.max(lessons.length, 1);
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ key, count, pct: (count / total) * 100 }));
  }, [lessons]);

  const themes = useMemo(() => keywordThemes(lessons), [lessons]);

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries(trpc.lessonLearned.list.queryOptions({ projectId })),
      queryClient.invalidateQueries(trpc.lessonOps.listIntake.queryOptions({ projectId })),
      queryClient.invalidateQueries(trpc.lessonOps.getWorkflowOverview.queryOptions({ projectId })),
      queryClient.invalidateQueries(trpc.lessonOps.listClusters.queryOptions({ projectId })),
      queryClient.invalidateQueries(trpc.lessonOps.listTrackA.queryOptions({ projectId })),
      queryClient.invalidateQueries(trpc.lessonOps.listTrackB.queryOptions({ projectId })),
      queryClient.invalidateQueries(
        trpc.lessonReport.listPacks.queryOptions({ projectId, cycleId: workflowOverview?.cycleId ?? undefined })
      ),
      queryClient.invalidateQueries(trpc.lessonLearned.listPendingReviews.queryOptions({ projectId })),
    ]);
  };

  const validateMutation = useMutation(trpc.lessonLearned.validate.mutationOptions({ onSuccess: refreshAll }));
  const rejectMutation = useMutation(
    trpc.comment.create.mutationOptions({
      onSuccess: refreshAll,
    })
  );
  const triageMutation = useMutation(trpc.lessonOps.triage.mutationOptions({ onSuccess: refreshAll }));
  const createClusterMutation = useMutation(trpc.lessonOps.createCluster.mutationOptions({ onSuccess: refreshAll }));
  const classifyTrackMutation = useMutation(trpc.lessonOps.classifyTrack.mutationOptions({ onSuccess: refreshAll }));
  const createTrackAMutation = useMutation(trpc.lessonOps.createTrackA.mutationOptions({ onSuccess: refreshAll }));
  const createTrackBMutation = useMutation(trpc.lessonOps.createTrackB.mutationOptions({ onSuccess: refreshAll }));
  const submitTrackBMutation = useMutation(trpc.lessonOps.submitTrackB.mutationOptions({ onSuccess: refreshAll }));
  const reviewMutation = useMutation(trpc.lessonLearned.reviewProposedUpdate.mutationOptions({ onSuccess: refreshAll }));
  const setOwnershipStateMutation = useMutation(
    trpc.lessonLearned.setOwnershipState.mutationOptions({ onSuccess: refreshAll })
  );
  const generatePackMutation = useMutation(trpc.lessonReport.generatePack.mutationOptions({ onSuccess: refreshAll }));
  const downloadPackMutation = useMutation(trpc.lessonReport.downloadPack.mutationOptions());

  const busy =
    validateMutation.isPending ||
    rejectMutation.isPending ||
    triageMutation.isPending ||
    createClusterMutation.isPending ||
    classifyTrackMutation.isPending ||
    createTrackAMutation.isPending ||
    createTrackBMutation.isPending ||
    submitTrackBMutation.isPending ||
    reviewMutation.isPending ||
    setOwnershipStateMutation.isPending ||
    generatePackMutation.isPending ||
    downloadPackMutation.isPending;

  const navItems: Array<{ key: MainSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { key: "capture", label: t("capture"), icon: ClipboardCheckIcon },
    { key: "review", label: t("review"), icon: BookCheckIcon },
    { key: "actions", label: t("actions"), icon: ListChecksIcon },
    { key: "reports", label: t("reports"), icon: BarChart3Icon },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("moduleTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("moduleSubtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setRightOpen((prev) => !prev)}>
            {rightOpen ? "Hide Insights" : "Show Insights"}
          </Button>
          <Button onClick={() => setCreateOpen(true)}>Capture Lesson</Button>
        </div>
      </div>

      <div
        className="flex items-center gap-0 rounded-lg border border-[#E5E7EB] bg-white px-4 py-2"
        style={{ fontFamily: "var(--font-ibm-plex-sans)" }}
      >
        {(["capture", "review", "actions", "reports"] as const).map((key, index) => {
          const labels = ["Capture", "Review", "Actions", "Reports"] as const;
          const activeIndex = ["capture", "review", "actions", "reports"].indexOf(section);
          const isActive = section === key;
          const isPast = activeIndex > index;

          return (
            <div key={key} className="flex items-center gap-0">
              {index > 0 ? (
                <div
                  className="mx-1 h-px w-4 shrink-0"
                  style={{ background: isPast ? "#0F172A" : "#E5E7EB" }}
                />
              ) : null}

              <button
                type="button"
                onClick={() => setSection(key)}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
                style={{
                  background: isActive ? "#0F172A" : isPast ? "#F3F4F6" : "transparent",
                  color: isActive ? "#FFFFFF" : isPast ? "#374151" : "#9CA3AF",
                  border: "none",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  fontFamily: "inherit",
                }}
              >
                <span
                  className="flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                  style={{
                    background: isActive ? "rgba(255,255,255,0.2)" : isPast ? "#0F172A" : "#E5E7EB",
                    color: isActive || isPast ? "#FFFFFF" : "#9CA3AF",
                  }}
                >
                  {isPast ? "✓" : index + 1}
                </span>
                {labels[index]}
              </button>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)] xl:grid-cols-[auto_minmax(0,1fr)_340px]">
        <Card className="hidden lg:block lg:h-fit">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              {!navCollapsed && <CardTitle className="text-sm">Workflows</CardTitle>}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setNavCollapsed((prev) => !prev)}
                aria-label="Toggle lessons navigation"
              >
                <MenuIcon className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-1 pb-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = section === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                    active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                  onClick={() => setSection(item.key)}
                  aria-label={item.label}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!navCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="lg:hidden">
            <CardContent className="pt-4">
              <Select value={section} onValueChange={(value) => setSection(value as MainSection)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select workflow" />
                </SelectTrigger>
                <SelectContent>
                  {navItems.map((item) => (
                    <SelectItem key={item.key} value={item.key}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {section === "capture" && (
            <>
              <div
                className="flex flex-nowrap items-center gap-1.5 overflow-hidden rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5"
                style={{ fontFamily: "var(--font-ibm-plex-sans)" }}
              >
                <div className="relative min-w-[120px] flex-1">
                  <SearchIcon className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search lessons…"
                    className="w-full rounded-md border border-[#E5E7EB] bg-[#FAFAFA] py-1.5 pl-7 pr-2.5 text-[12px] text-[#111827] outline-none transition-colors focus:border-[#2563EB]"
                    style={{ fontFamily: "inherit" }}
                  />
                </div>

                {[
                  {
                    key: "type",
                    value: typeFilter,
                    setValue: setTypeFilter,
                    options: [
                      { value: "all", label: "Type" },
                      ...LESSON_TYPE_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
                    ],
                  },
                  {
                    key: "status",
                    value: statusFilter,
                    setValue: setStatusFilter,
                    options: [
                      { value: "all", label: "Status" },
                      ...LESSON_STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
                    ],
                  },
                  {
                    key: "discipline",
                    value: disciplineFilter,
                    setValue: setDisciplineFilter,
                    options: [
                      { value: "all", label: "Discipline" },
                      ...LESSON_DISCIPLINES.map((discipline) => ({
                        value: discipline,
                        label: DISCIPLINE_LABELS[discipline],
                      })),
                    ],
                  },
                  {
                    key: "ownership",
                    value: ownershipFilter,
                    setValue: setOwnershipFilter,
                    options: [
                      { value: "all", label: "Ownership" },
                      ...LESSON_OWNERSHIP_OPTIONS.map((option) => ({
                        value: option.value,
                        label: option.label,
                      })),
                    ],
                  },
                ].map((filter) => {
                  const active = filter.value !== "all";
                  return (
                    <div key={filter.key} className="relative">
                      <select
                        value={filter.value}
                        onChange={(event) => filter.setValue(event.target.value)}
                        className="appearance-none rounded-md py-1.5 pl-2.5 pr-6 text-[11px] font-medium outline-none transition-colors"
                        style={{
                          border: `1px solid ${active ? "#0F172A" : "#E5E7EB"}`,
                          background: active ? "#0F172A" : "#FFFFFF",
                          color: active ? "#FFFFFF" : "#374151",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        {filter.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <span
                        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-[#9CA3AF]"
                        aria-hidden
                      >
                        ▾
                      </span>
                    </div>
                  );
                })}

                {(search ||
                  typeFilter !== "all" ||
                  statusFilter !== "all" ||
                  disciplineFilter !== "all" ||
                  ownershipFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setTypeFilter("all");
                      setStatusFilter("all");
                      setDisciplineFilter("all");
                      setOwnershipFilter("all");
                    }}
                    className="flex items-center gap-1 px-1.5 py-1 text-[11px] text-[#6B7280] hover:text-[#111827]"
                    style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    ✕ Clear
                  </button>
                )}
              </div>

              <div className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
                {filteredLessons.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">{t("noResults")}</p>
                ) : (
                  filteredLessons.map((lesson) => (
                    <LessonRow
                      key={lesson.id}
                      lesson={lesson as LessonRowItem}
                      selected={selectedLessonId === lesson.id}
                      onClick={() =>
                        setSelectedLessonId(selectedLessonId === lesson.id ? null : lesson.id)
                      }
                    />
                  ))
                )}
              </div>
            </>
          )}

          {section === "review" && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Review / Approval Queue</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant={reviewFilter === "pending" ? "default" : "outline"} onClick={() => setReviewFilter("pending")}>
                      {t("pending")}
                    </Button>
                    <Button size="sm" variant={reviewFilter === "approved" ? "default" : "outline"} onClick={() => setReviewFilter("approved")}>
                      {t("approved")}
                    </Button>
                    <Button size="sm" variant={reviewFilter === "rejected" ? "default" : "outline"} onClick={() => setReviewFilter("rejected")}>
                      {t("rejected")}
                    </Button>
                  </div>

                  {reviewLessons.map((lesson) => (
                    <div key={lesson.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold">{lesson.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{lesson.description}</p>
                          <p className="text-xs text-muted-foreground">Status: {lesson.status}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!canEdit || busy || lesson.status !== "draft"}
                            onClick={() =>
                              validateMutation.mutate({ id: lesson.id })
                            }
                          >
                            {t("approve")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!canEdit || busy || lesson.status !== "draft"}
                            onClick={() =>
                              rejectMutation.mutate({
                                parentType: "lesson_learned",
                                parentId: lesson.id,
                                content: `Review rejected: ${reviewCommentByLesson[lesson.id]?.trim() || "Please revise and resubmit."}`,
                              })
                            }
                          >
                            {t("reject")}
                          </Button>
                        </div>
                      </div>
                      <Textarea
                        rows={2}
                        className="mt-2"
                        placeholder="Reviewer comment"
                        value={reviewCommentByLesson[lesson.id] ?? ""}
                        onChange={(event) =>
                          setReviewCommentByLesson((prev) => ({ ...prev, [lesson.id]: event.target.value }))
                        }
                        disabled={!canEdit}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Triage Queue</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {intakeLessons.length === 0 && <p className="text-sm text-muted-foreground">No intake items pending triage.</p>}
                  {intakeLessons.map((lesson) => {
                    const decision = triageDecisionByLesson[lesson.id] ?? "retain";
                    return (
                      <div key={lesson.id} className="rounded-lg border p-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{lesson.title}</p>
                            <p className="text-xs text-muted-foreground">Workflow: {lesson.workflowState}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Select
                              value={decision}
                              onValueChange={(value) =>
                                setTriageDecisionByLesson((prev) => ({ ...prev, [lesson.id]: value ?? "retain" }))
                              }
                            >
                              <SelectTrigger className="w-44">
                                <SelectValue placeholder="Decision" />
                              </SelectTrigger>
                              <SelectContent>
                                {triageDecisionOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              disabled={!canEdit || busy}
                              onClick={() =>
                                triageMutation.mutate({
                                  projectId,
                                  lessonId: lesson.id,
                                  cycleId: workflowOverview?.activeCycle?.id,
                                  decision: decision as any,
                                  rationale: `Queue decision: ${decision}`,
                                })
                              }
                            >
                              Apply
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {pendingReviews.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Validated Change Requests</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {pendingReviews.map((request) => (
                      <div key={request.id} className="rounded-lg border p-2.5 flex items-center justify-between gap-2">
                        <p className="text-sm">{request.lesson.title}</p>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => reviewMutation.mutate({ id: request.id, decision: "rejected" })}>
                            Reject
                          </Button>
                          <Button size="sm" disabled={busy} onClick={() => reviewMutation.mutate({ id: request.id, decision: "approved" })}>
                            Approve
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {section === "actions" && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Action Burndown</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Open</p>
                    <p className="text-xl font-semibold">{actionStatusCounts.open}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">In progress</p>
                    <p className="text-xl font-semibold">{actionStatusCounts.inProgress}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Done</p>
                    <p className="text-xl font-semibold text-emerald-700">{actionStatusCounts.done}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Overdue</p>
                    <p className="text-xl font-semibold text-red-700">{actionStatusCounts.overdue}</p>
                  </div>
                </CardContent>
              </Card>

              <Tabs defaultValue="trackA">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="trackA">Track A</TabsTrigger>
                  <TabsTrigger value="trackB">Track B</TabsTrigger>
                  <TabsTrigger value="clusters">Clusters</TabsTrigger>
                </TabsList>

                <TabsContent value="trackA" className="space-y-2 mt-3">
                  {trackAActions.length === 0 && <Card><CardContent className="py-8 text-sm text-muted-foreground">No Track A actions yet.</CardContent></Card>}
                  {trackAActions.map((action) => (
                    <Card key={action.id}>
                      <CardContent className="pt-4 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{action.actionText}</p>
                            <p className="text-xs text-muted-foreground">
                              {action.lesson?.title ?? "Lesson"} · Assignee: {action.ownerUserId ?? "Unassigned"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Due: {action.dueAt ? new Date(action.dueAt).toLocaleDateString() : "Not set"}
                            </p>
                          </div>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${action.status === "overdue" ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground"}`}>
                            {action.status}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="h-2 w-full rounded bg-muted">
                            <div
                              className={`h-2 rounded ${action.status === "done" ? "bg-emerald-600" : action.status === "overdue" ? "bg-red-600" : "bg-primary"}`}
                              style={{ width: `${actionProgress(action.status)}%` }}
                            />
                          </div>
                          <p className="text-[11px] text-muted-foreground">Progress: {actionProgress(action.status)}%</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>

                <TabsContent value="trackB" className="space-y-2 mt-3">
                  {trackB.length === 0 && <Card><CardContent className="py-8 text-sm text-muted-foreground">No Track B escalations yet.</CardContent></Card>}
                  {trackB.map((item) => (
                    <Card key={item.id}>
                      <CardContent className="pt-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{item.structuralIssue}</p>
                          <p className="text-xs text-muted-foreground">{item.proposedCorporateAction}</p>
                          <p className="text-xs text-muted-foreground">Status: {item.status} · Due by: {item.dueBy ? new Date(item.dueBy).toLocaleDateString() : "-"}</p>
                        </div>
                        {item.status === "draft" && (
                          <Button size="sm" disabled={!canEdit || busy} onClick={() => submitTrackBMutation.mutate({ projectId, escalationId: item.id })}>
                            Submit
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>

                <TabsContent value="clusters" className="space-y-2 mt-3">
                  {clusters.length === 0 && <Card><CardContent className="py-8 text-sm text-muted-foreground">No clusters created yet.</CardContent></Card>}
                  {clusters.map((cluster) => (
                    <Card key={cluster.id}>
                      <CardContent className="pt-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{cluster.clusterName}</p>
                            <p className="text-xs text-muted-foreground">Track: {cluster.trackType ?? "Unclassified"} · Lessons: {cluster.clusterItems.length}</p>
                            <p className="text-xs text-muted-foreground">{cluster.rootCause ?? "No root cause narrative yet."}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {!cluster.trackType && (
                              <>
                                <Button size="sm" variant="outline" disabled={!canEdit || busy} onClick={() => classifyTrackMutation.mutate({ projectId, clusterId: cluster.id, trackType: "A", trackRationale: "Manual classification" })}>
                                  Classify A
                                </Button>
                                <Button size="sm" variant="outline" disabled={!canEdit || busy} onClick={() => classifyTrackMutation.mutate({ projectId, clusterId: cluster.id, trackType: "B", trackRationale: "Manual classification" })}>
                                  Classify B
                                </Button>
                              </>
                            )}
                            {cluster.trackType === "A" && cluster.clusterItems[0] && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!canEdit || busy}
                                onClick={() =>
                                  createTrackAMutation.mutate({
                                    projectId,
                                    cycleId: workflowOverview?.activeCycle?.id,
                                    lessonId: cluster.clusterItems[0].lessonId,
                                    clusterId: cluster.id,
                                    actionText: `Define Track A corrective action for ${cluster.clusterItems[0].lesson.title}`,
                                  })
                                }
                              >
                                Seed Track A
                              </Button>
                            )}
                            {cluster.trackType === "B" && cluster.clusterItems[0] && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!canEdit || busy}
                                onClick={() =>
                                  createTrackBMutation.mutate({
                                    projectId,
                                    cycleId: workflowOverview?.activeCycle?.id,
                                    lessonId: cluster.clusterItems[0].lessonId,
                                    clusterId: cluster.id,
                                    structuralIssue: cluster.clusterItems[0].lesson.title,
                                    proposedCorporateAction: "Define structural corrective action",
                                  })
                                }
                              >
                                Seed Track B
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {intakeLessons.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-base">One-click Clustering</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        {intakeLessons.map((lesson) => (
                          <div key={lesson.id} className="rounded border p-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm">{lesson.title}</p>
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="outline" disabled={!canEdit || busy} onClick={async () => {
                                const cluster = await createClusterMutation.mutateAsync({
                                  projectId,
                                  cycleId: workflowOverview?.activeCycle?.id,
                                  clusterName: `A: ${lesson.title.slice(0, 120)}`,
                                  lessonIds: [lesson.id],
                                });
                                await classifyTrackMutation.mutateAsync({ projectId, clusterId: cluster.id, trackType: "A", trackRationale: "Auto classification" });
                              }}>
                                Cluster A
                              </Button>
                              <Button size="sm" variant="outline" disabled={!canEdit || busy} onClick={async () => {
                                const cluster = await createClusterMutation.mutateAsync({
                                  projectId,
                                  cycleId: workflowOverview?.activeCycle?.id,
                                  clusterName: `B: ${lesson.title.slice(0, 120)}`,
                                  lessonIds: [lesson.id],
                                });
                                await classifyTrackMutation.mutateAsync({ projectId, clusterId: cluster.id, trackType: "B", trackRationale: "Auto classification" });
                              }}>
                                Cluster B
                              </Button>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}

          {section === "reports" && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Lessons by Category</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {reportByType.map((row) => (
                      <div key={row.key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span>{row.key.replace(/_/g, " ")}</span>
                          <span>{row.count}</span>
                        </div>
                        <div className="h-2 rounded bg-muted">
                          <div className="h-2 rounded bg-primary" style={{ width: `${row.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Lessons by Project Scope</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {reportByPackage.map((row) => (
                      <div key={row.key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="truncate pr-2">{row.key}</span>
                          <span>{row.count}</span>
                        </div>
                        <div className="h-2 rounded bg-muted">
                          <div className="h-2 rounded bg-emerald-600" style={{ width: `${row.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2"><BotIcon className="h-4 w-4" /> Theme Clustering Suggestions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {themes.length === 0 && <p className="text-sm text-muted-foreground">Not enough data to suggest recurring themes yet.</p>}
                  {themes.map((theme) => (
                    <div key={theme.key} className="rounded border p-2.5">
                      <p className="text-sm font-medium">{theme.key} ({theme.count} lessons)</p>
                      <p className="text-xs text-muted-foreground">{theme.recommendation}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Reporting Packs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">Generate gate package reports (HTML/PDF/XLSX).</p>
                    <Button disabled={!canEdit || busy} onClick={() => generatePackMutation.mutate({ projectId, cycleId: workflowOverview?.activeCycle?.id })}>
                      Generate Pack
                    </Button>
                  </div>

                  {packs.length === 0 && <p className="text-sm text-muted-foreground">No report packs generated yet.</p>}
                  {packs.map((pack) => (
                    <div key={pack.id} className="rounded border p-2.5 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">Pack {pack.version} · {pack.package ? `${pack.package.code} - ${pack.package.name}` : "All packages"}</p>
                        <p className="text-xs text-muted-foreground">Generated {new Date(pack.generatedAt).toLocaleString()}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={async () => {
                          const urls = await downloadPackMutation.mutateAsync({ packId: pack.id });
                          window.open(urls.pdfUrl, "_blank", "noopener,noreferrer");
                        }}
                      >
                        Open PDF
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {rightOpen && (
          <div className="space-y-4 xl:block">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Context & Analytics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Ingested</span>
                  <span className="font-medium">{workflowOverview?.totals.ingested ?? 0}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Triaged</span>
                  <span className="font-medium">{workflowOverview?.totals.triaged ?? 0}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Classified</span>
                  <span className="font-medium">{workflowOverview?.totals.classified ?? 0}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Actions</span>
                  <span className="font-medium">{trackAActions.length}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Escalations</span>
                  <span className="font-medium">{trackB.length}</span>
                </div>

                <div className="space-y-1 rounded-md border p-2.5">
                  <p className="text-xs font-medium">Quality Gates</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><CircleAlertIcon className="h-3.5 w-3.5" /> Untriaged: {workflowOverview?.blockers.untriaged ?? 0}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><CircleAlertIcon className="h-3.5 w-3.5" /> Unclassified: {workflowOverview?.blockers.unclassified ?? 0}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><XCircleIcon className="h-3.5 w-3.5" /> Track A without owner: {workflowOverview?.blockers.trackAWithoutOwner ?? 0}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><CalendarClockIcon className="h-3.5 w-3.5" /> Pending Track B: {workflowOverview?.blockers.pendingTrackBSubmissions ?? 0}</p>
                </div>

                <p className={`text-xs font-medium ${workflowOverview?.isGateReady ? "text-emerald-700" : "text-amber-700"}`}>
                  {workflowOverview?.isGateReady ? "Gate readiness: Ready" : "Gate readiness: Not ready"}
                </p>
                <Link href="/lessons-portfolio" className="inline-flex items-center gap-1 text-xs text-primary underline">
                  <CheckCircle2Icon className="h-3.5 w-3.5" /> Open Portfolio Cockpit
                </Link>
              </CardContent>
            </Card>

            {selectedLesson ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{selectedLesson.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <LLStatusBadge status={selectedLesson.status} />
                    <LLTypeBadge type={selectedLesson.type} />
                    <LLOwnershipBadge ownershipState={selectedLesson.ownershipState} />
                    <span className="text-xs text-muted-foreground">{selectedLesson.workflowState}</span>
                  </div>

                  {canEdit && (
                    <div className="space-y-1.5">
                      <Label>Ownership State</Label>
                      <Select
                        value={selectedLesson.ownershipState}
                        onValueChange={(value) => {
                          if (
                            !value ||
                            value === selectedLesson.ownershipState ||
                            !LESSON_OWNERSHIP_STATES.includes(value as any)
                          ) {
                            return;
                          }
                          setOwnershipStateMutation.mutate({
                            id: selectedLesson.id,
                            ownershipState: value as (typeof LESSON_OWNERSHIP_STATES)[number],
                            rationale: `Updated in lessons module by ${role ?? "editor"}`,
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select ownership state" />
                        </SelectTrigger>
                        <SelectContent>
                          {LESSON_OWNERSHIP_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>Discipline: {selectedLesson.discipline.replace(/_/g, " ")}</p>
                    <p>Work package: {selectedLesson.workPackage ? `${selectedLesson.workPackage.code} - ${selectedLesson.workPackage.name}` : "Not set"}</p>
                    <p>Linked points: {selectedLesson.linkedPoints.length}</p>
                  </div>

                  <div>
                    <p className="text-xs font-medium">Problem</p>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{selectedLesson.description}</p>
                  </div>

                  {selectedLesson.recommendation && (
                    <div>
                      <p className="text-xs font-medium">Solution / References</p>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{selectedLesson.recommendation}</p>
                    </div>
                  )}

                  <LessonCommentsThread projectId={projectId} lessonId={selectedLesson.id} canComment={role !== null} />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Select a lesson</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Select any lesson from the central panel to view details, comments, and collaboration history.
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {selectedLessonId && selectedLesson ? (
        <LessonDetailPanel
          lesson={selectedLesson as DetailLesson}
          projectId={projectId}
          canEdit={canEdit}
          canComment={role !== null}
          isAdmin={role === "admin"}
          busy={busy}
          onClose={() => setSelectedLessonId(null)}
          onValidate={(id) => validateMutation.mutate({ id })}
          onConsolidate={(id) => validateMutation.mutate({ id })}
          onCloseLesson={(id) => validateMutation.mutate({ id })}
        />
      ) : null}

      <CreateLessonDialog
        projectId={projectId}
        projectName={project?.name}
        open={createOpen}
        onOpenChange={setCreateOpen}
        workPackages={workPackages.map((workPackage) => ({
          id: workPackage.id,
          code: workPackage.code,
          name: workPackage.name,
        }))}
      />
    </div>
  );
}
