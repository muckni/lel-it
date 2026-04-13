"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LESSON_DISCIPLINES } from "@owit/shared";
import { CreateLessonDialog } from "@/components/lessons/create-ll-dialog";
import { LESSON_STATUS_OPTIONS, LESSON_TYPE_OPTIONS, LLStatusBadge, LLTypeBadge } from "@/components/lessons/ll-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const triageDecisionOptions = [
  { value: "retain", label: "Retain" },
  { value: "drop", label: "Drop" },
  { value: "defer", label: "Defer" },
  { value: "hold", label: "Hold" },
  { value: "duplicate", label: "Duplicate" },
  { value: "external_context", label: "External Context" },
] as const;

export default function ProjectLessonsModulePage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { canEdit } = useProjectRole(projectId);

  const [tab, setTab] = useState("intake");
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [disciplineFilter, setDisciplineFilter] = useState<string>("all");
  const [triageDecisionByLesson, setTriageDecisionByLesson] = useState<Record<string, string>>({});

  const { data: project } = useQuery(trpc.project.getById.queryOptions({ id: projectId }));
  const { data: workPackages = [] } = useQuery(trpc.workPackage.list.queryOptions({ projectId }));

  const { data: lessons = [] } = useQuery(
    trpc.lessonLearned.list.queryOptions({
      projectId,
      status: statusFilter === "all" ? undefined : (statusFilter as any),
      type: typeFilter === "all" ? undefined : (typeFilter as any),
      discipline: disciplineFilter === "all" ? undefined : (disciplineFilter as any),
    })
  );

  const { data: intakeLessons = [] } = useQuery(
    trpc.lessonOps.listIntake.queryOptions({ projectId })
  );
  const { data: workflowOverview } = useQuery(
    trpc.lessonOps.getWorkflowOverview.queryOptions({ projectId })
  );
  const { data: clusters = [] } = useQuery(trpc.lessonOps.listClusters.queryOptions({ projectId }));
  const { data: trackAActions = [] } = useQuery(trpc.lessonOps.listTrackA.queryOptions({ projectId }));
  const { data: trackB = [] } = useQuery(trpc.lessonOps.listTrackB.queryOptions({ projectId }));
  const { data: cycles = [] } = useQuery(trpc.lessonOps.listCycles.queryOptions({ projectId }));
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

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries(trpc.lessonLearned.list.queryOptions({ projectId })),
      queryClient.invalidateQueries(trpc.lessonOps.listIntake.queryOptions({ projectId })),
      queryClient.invalidateQueries(trpc.lessonOps.getWorkflowOverview.queryOptions({ projectId })),
      queryClient.invalidateQueries(trpc.lessonOps.listClusters.queryOptions({ projectId })),
      queryClient.invalidateQueries(trpc.lessonOps.listTrackA.queryOptions({ projectId })),
      queryClient.invalidateQueries(trpc.lessonOps.listTrackB.queryOptions({ projectId })),
      queryClient.invalidateQueries(trpc.lessonOps.listCycles.queryOptions({ projectId })),
      queryClient.invalidateQueries(
        trpc.lessonReport.listPacks.queryOptions({ projectId, cycleId: workflowOverview?.cycleId ?? undefined })
      ),
      queryClient.invalidateQueries(trpc.lessonLearned.listPendingReviews.queryOptions({ projectId })),
    ]);
  };

  const triageMutation = useMutation(
    trpc.lessonOps.triage.mutationOptions({ onSuccess: refreshAll })
  );
  const createClusterMutation = useMutation(
    trpc.lessonOps.createCluster.mutationOptions({ onSuccess: refreshAll })
  );
  const classifyTrackMutation = useMutation(
    trpc.lessonOps.classifyTrack.mutationOptions({ onSuccess: refreshAll })
  );
  const startCycleMutation = useMutation(
    trpc.lessonOps.startCycle.mutationOptions({ onSuccess: refreshAll })
  );
  const completeCycleMutation = useMutation(
    trpc.lessonOps.advanceCycle.mutationOptions({ onSuccess: refreshAll })
  );
  const createTrackAMutation = useMutation(
    trpc.lessonOps.createTrackA.mutationOptions({ onSuccess: refreshAll })
  );
  const createTrackBMutation = useMutation(
    trpc.lessonOps.createTrackB.mutationOptions({ onSuccess: refreshAll })
  );
  const submitTrackBMutation = useMutation(
    trpc.lessonOps.submitTrackB.mutationOptions({ onSuccess: refreshAll })
  );
  const reviewMutation = useMutation(
    trpc.lessonLearned.reviewProposedUpdate.mutationOptions({ onSuccess: refreshAll })
  );
  const generatePackMutation = useMutation(
    trpc.lessonReport.generatePack.mutationOptions({ onSuccess: refreshAll })
  );
  const downloadPackMutation = useMutation(trpc.lessonReport.downloadPack.mutationOptions());

  const isBusy =
    triageMutation.isPending ||
    createClusterMutation.isPending ||
    classifyTrackMutation.isPending ||
    startCycleMutation.isPending ||
    completeCycleMutation.isPending ||
    createTrackAMutation.isPending ||
    createTrackBMutation.isPending ||
    submitTrackBMutation.isPending ||
    reviewMutation.isPending ||
    generatePackMutation.isPending ||
    downloadPackMutation.isPending;

  const activeCycle = workflowOverview?.activeCycle;

  const canAdvanceToCluster = (workflowOverview?.blockers.untriaged ?? 0) === 0;
  const canAdvanceToTrack = (workflowOverview?.blockers.unclassified ?? 0) === 0;
  const canCloseCycle = Boolean(workflowOverview?.isGateReady && activeCycle);
  const triagedLessons = lessons.filter((lesson) => lesson.workflowState === "triaged");

  return (
    <div className="flex flex-1 flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Lessons Learned Operations</h1>
          <p className="text-sm text-muted-foreground">
            Handbook-compliant workflow for {project?.name ?? "this project"}: intake, triage, clustering, actioning, escalations, and report packs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!activeCycle && (
            <Button
              variant="outline"
              onClick={() =>
                startCycleMutation.mutate({
                  projectId,
                  cycleType: "monthly",
                  cycleLabel: `Monthly ${new Date().toISOString().slice(0, 7)}`,
                })
              }
              disabled={!canEdit || isBusy}
            >
              Start Monthly Cycle
            </Button>
          )}
          {activeCycle && (
            <Button
              variant="outline"
              onClick={() =>
                completeCycleMutation.mutate({ projectId, cycleId: activeCycle.id, state: "completed" })
              }
              disabled={!canEdit || isBusy || !canCloseCycle}
            >
              Complete Cycle
            </Button>
          )}
          <Button onClick={() => setCreateOpen(true)}>Capture Lesson</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Ingested</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{workflowOverview?.totals.ingested ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Triaged</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{workflowOverview?.totals.triaged ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Classified</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{workflowOverview?.totals.classified ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Track A</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{trackAActions.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Track B</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{trackB.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Gate Ready</CardTitle></CardHeader>
          <CardContent className={`text-2xl font-semibold ${workflowOverview?.isGateReady ? "text-emerald-700" : "text-amber-700"}`}>
            {workflowOverview?.isGateReady ? "Yes" : "No"}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lesson Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Search</Label>
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title or description" />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? "all")}>
              <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {LESSON_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value ?? "all")}>
              <SelectTrigger><SelectValue placeholder="All types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {LESSON_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Discipline</Label>
            <Select value={disciplineFilter} onValueChange={(value) => setDisciplineFilter(value ?? "all")}>
              <SelectTrigger><SelectValue placeholder="All disciplines" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All disciplines</SelectItem>
                {LESSON_DISCIPLINES.map((discipline) => (
                  <SelectItem key={discipline} value={discipline}>{DISCIPLINE_LABELS[discipline]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="intake">Intake</TabsTrigger>
          <TabsTrigger value="triage">Triage</TabsTrigger>
          <TabsTrigger value="clusters" disabled={!canAdvanceToCluster}>Clusters</TabsTrigger>
          <TabsTrigger value="trackA" disabled={!canAdvanceToTrack}>Track A Actions</TabsTrigger>
          <TabsTrigger value="trackB" disabled={!canAdvanceToTrack}>Track B</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="quality">Quality Checks</TabsTrigger>
        </TabsList>

        <TabsContent value="intake" className="space-y-3 mt-4">
          {filteredLessons.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No lessons match the current filters.</CardContent></Card>
          ) : (
            filteredLessons.map((lesson) => (
              <Card key={lesson.id}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <LLStatusBadge status={lesson.status} />
                    <LLTypeBadge type={lesson.type} />
                    <span className="text-xs text-muted-foreground">Workflow: {lesson.workflowState}</span>
                  </div>
                  <p className="text-sm font-medium">{lesson.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{lesson.description}</p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="triage" className="space-y-3 mt-4">
          {intakeLessons.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-sm text-muted-foreground">
                No intake items pending triage. Capture a new lesson or wait for the next cycle.
              </CardContent>
            </Card>
          ) : (
            intakeLessons.map((lesson) => {
              const selectedDecision = triageDecisionByLesson[lesson.id] ?? "retain";
              return (
                <Card key={lesson.id}>
                  <CardContent className="pt-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">{lesson.title}</p>
                        <p className="text-xs text-muted-foreground">{lesson.description}</p>
                        <p className="text-xs text-muted-foreground">Workflow: {lesson.workflowState}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={selectedDecision}
                          onValueChange={(value) =>
                            setTriageDecisionByLesson((prev) => ({ ...prev, [lesson.id]: value ?? "retain" }))
                          }
                        >
                          <SelectTrigger className="w-44"><SelectValue placeholder="Decision" /></SelectTrigger>
                          <SelectContent>
                            {triageDecisionOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          disabled={!canEdit || isBusy}
                          onClick={() => {
                            triageMutation.mutate({
                              projectId,
                              lessonId: lesson.id,
                              cycleId: activeCycle?.id,
                              decision: selectedDecision as any,
                              rationale: `Triage decision: ${selectedDecision}`,
                            });
                          }}
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="clusters" className="mt-4 space-y-3">
          {triagedLessons.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Classification Queue</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {triagedLessons.map((lesson) => (
                  <div key={lesson.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2">
                    <div>
                      <p className="text-sm font-medium">{lesson.title}</p>
                      <p className="text-xs text-muted-foreground">Workflow: {lesson.workflowState}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canEdit || isBusy}
                        onClick={async () => {
                          const cluster = await createClusterMutation.mutateAsync({
                            projectId,
                            cycleId: activeCycle?.id,
                            clusterName: `A: ${lesson.title.slice(0, 120)}`,
                            lessonIds: [lesson.id],
                          });
                          await classifyTrackMutation.mutateAsync({
                            projectId,
                            clusterId: cluster.id,
                            trackType: "A",
                            trackRationale: "Auto-classified from triage queue",
                          });
                        }}
                      >
                        Cluster as Track A
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canEdit || isBusy}
                        onClick={async () => {
                          const cluster = await createClusterMutation.mutateAsync({
                            projectId,
                            cycleId: activeCycle?.id,
                            clusterName: `B: ${lesson.title.slice(0, 120)}`,
                            lessonIds: [lesson.id],
                          });
                          await classifyTrackMutation.mutateAsync({
                            projectId,
                            clusterId: cluster.id,
                            trackType: "B",
                            trackRationale: "Auto-classified from triage queue",
                          });
                        }}
                      >
                        Cluster as Track B
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {clusters.length === 0 ? (
            <Card><CardContent className="py-8 text-sm text-muted-foreground">No clusters created yet.</CardContent></Card>
          ) : (
            clusters.map((cluster) => (
              <Card key={cluster.id}>
                <CardContent className="pt-4 space-y-1">
                  <p className="text-sm font-semibold">{cluster.clusterName}</p>
                  <p className="text-xs text-muted-foreground">
                    Track: {cluster.trackType ?? "Unclassified"} · Lessons: {cluster.clusterItems.length}
                  </p>
                  <p className="text-xs text-muted-foreground">{cluster.rootCause ?? "No root cause narrative yet."}</p>
                  {!cluster.trackType && (
                    <div className="pt-2 flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canEdit || isBusy}
                        onClick={() =>
                          classifyTrackMutation.mutate({
                            projectId,
                            clusterId: cluster.id,
                            trackType: "A",
                            trackRationale: "Manual classification from cluster view",
                          })
                        }
                      >
                        Classify A
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canEdit || isBusy}
                        onClick={() =>
                          classifyTrackMutation.mutate({
                            projectId,
                            clusterId: cluster.id,
                            trackType: "B",
                            trackRationale: "Manual classification from cluster view",
                          })
                        }
                      >
                        Classify B
                      </Button>
                    </div>
                  )}
                  {cluster.trackType === "A" && cluster.clusterItems.length > 0 && (
                    <div className="pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canEdit || isBusy}
                        onClick={() =>
                          createTrackAMutation.mutate({
                            projectId,
                            cycleId: activeCycle?.id,
                            lessonId: cluster.clusterItems[0].lessonId,
                            clusterId: cluster.id,
                            actionText: `Define Track A corrective action for ${cluster.clusterItems[0].lesson.title}`,
                          })
                        }
                      >
                        Seed Track A Action
                      </Button>
                    </div>
                  )}
                  {cluster.trackType === "B" && cluster.clusterItems.length > 0 && (
                    <div className="pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canEdit || isBusy}
                        onClick={() =>
                          createTrackBMutation.mutate({
                            projectId,
                            cycleId: activeCycle?.id,
                            lessonId: cluster.clusterItems[0].lessonId,
                            clusterId: cluster.id,
                            structuralIssue: cluster.clusterItems[0].lesson.title,
                            proposedCorporateAction: "Define structural corrective action",
                          })
                        }
                      >
                        Seed Track B Escalation
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="trackA" className="mt-4 space-y-3">
          {trackAActions.length === 0 ? (
            <Card><CardContent className="py-8 text-sm text-muted-foreground">No Track A actions yet.</CardContent></Card>
          ) : (
            trackAActions.map((action) => (
              <Card key={action.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">{action.actionText}</p>
                      <p className="text-xs text-muted-foreground">
                        {action.lesson?.title ?? "Lesson"} · Status: {action.status} · Owner: {action.ownerUserId ?? "Unassigned"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Due: {action.dueAt ? new Date(action.dueAt).toLocaleDateString() : "Not set"} · Approval: {action.approvalLevel ?? "-"}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${action.status === "overdue" ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground"}`}>
                      {action.status}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="trackB" className="mt-4 space-y-3">
          {canEdit && pendingReviews.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Pending Validated-Edit Reviews</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {pendingReviews.map((request) => (
                  <div key={request.id} className="rounded border p-2 flex items-center justify-between gap-2">
                    <p className="text-sm">{request.lesson.title}</p>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" disabled={isBusy} onClick={() => reviewMutation.mutate({ id: request.id, decision: "rejected" })}>Reject</Button>
                      <Button size="sm" disabled={isBusy} onClick={() => reviewMutation.mutate({ id: request.id, decision: "approved" })}>Approve</Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {trackB.length === 0 ? (
            <Card><CardContent className="py-8 text-sm text-muted-foreground">No Track B escalations yet.</CardContent></Card>
          ) : (
            trackB.map((item) => (
              <Card key={item.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">{item.structuralIssue}</p>
                      <p className="text-xs text-muted-foreground">{item.proposedCorporateAction}</p>
                      <p className="text-xs text-muted-foreground">Status: {item.status} · Due by: {item.dueBy ? new Date(item.dueBy).toLocaleDateString() : "-"}</p>
                    </div>
                    {item.status === "draft" && (
                      <Button size="sm" disabled={!canEdit || isBusy} onClick={() => submitTrackBMutation.mutate({ projectId, escalationId: item.id })}>
                        Submit
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="reports" className="mt-4 space-y-3">
          <Card>
            <CardContent className="pt-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Generate Gate Pack</p>
                <p className="text-xs text-muted-foreground">Creates HTML/PDF/XLSX artifacts for current cycle.</p>
              </div>
              <Button
                disabled={!canEdit || isBusy}
                onClick={() =>
                  generatePackMutation.mutate({
                    projectId,
                    cycleId: activeCycle?.id,
                  })
                }
              >
                Generate Pack
              </Button>
            </CardContent>
          </Card>

          {packs.length === 0 ? (
            <Card><CardContent className="py-8 text-sm text-muted-foreground">No report packs generated yet.</CardContent></Card>
          ) : (
            packs.map((pack) => (
              <Card key={pack.id}>
                <CardContent className="pt-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Pack {pack.version} · {pack.package ? `${pack.package.code} - ${pack.package.name}` : "All packages"}</p>
                    <p className="text-xs text-muted-foreground">Generated {new Date(pack.generatedAt).toLocaleString()}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isBusy}
                    onClick={async () => {
                      const urls = await downloadPackMutation.mutateAsync({ packId: pack.id });
                      window.open(urls.pdfUrl, "_blank");
                    }}
                  >
                    Open PDF
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="quality" className="mt-4 space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Quality Check Status</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Untriaged intake items: <span className="font-medium">{workflowOverview?.blockers.untriaged ?? 0}</span></p>
              <p>Unclassified lessons: <span className="font-medium">{workflowOverview?.blockers.unclassified ?? 0}</span></p>
              <p>Track A without owner: <span className="font-medium">{workflowOverview?.blockers.trackAWithoutOwner ?? 0}</span></p>
              <p>Track A done without evidence: <span className="font-medium">{workflowOverview?.blockers.trackADoneWithoutEvidence ?? 0}</span></p>
              <p>Pending Track B submissions: <span className="font-medium">{workflowOverview?.blockers.pendingTrackBSubmissions ?? 0}</span></p>
              <p className={`font-semibold ${workflowOverview?.isGateReady ? "text-emerald-700" : "text-amber-700"}`}>
                Gate readiness: {workflowOverview?.isGateReady ? "Ready" : "Not ready"}
              </p>
              <p className="text-xs text-muted-foreground">Cross-project oversight is available in the portfolio cockpit.</p>
              <Link href="/lessons-portfolio" className="text-xs text-primary underline">Open Portfolio Cockpit</Link>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateLessonDialog
        projectId={projectId}
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
