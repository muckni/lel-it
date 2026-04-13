"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PointStatusBadge, CriticalityBadge } from "@/components/status-badge";
import { PlusIcon, Trash2Icon, ExternalLinkIcon, CheckCircle2Icon, ClockIcon, MessageSquareIcon, ArrowRightIcon, BookOpenIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { DELIVERABLE_STATUSES, POINT_STATUSES, SCOPE_ALLOCATION_PHASES } from "@owit/shared";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useProjectRole } from "@/hooks/use-project-role";
import { EntityAttachments } from "@/components/attachments/entity-attachments";
import { DeadlineBadge, getDeadlineRowClassName } from "@/components/deadlines/deadline-badge";
import { TquWizard } from "@/components/wizards/tqu-wizard";
import { CreateLessonDialog } from "@/components/lessons/create-ll-dialog";
import { LessonCard, type LessonCardItem } from "@/components/lessons/ll-card";

const deliverableSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  responsiblePackageId: z.string().uuid().optional(),
  dueDate: z.string().optional(),
});

type DeliverableFormValues = z.infer<typeof deliverableSchema>;

const deliverableStatusColors: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-800",
  submitted: "bg-amber-100 text-amber-800",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const iqPriorityColors: Record<string, string> = {
  urgent: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-blue-100 text-blue-800",
  low: "bg-gray-100 text-gray-600",
};

const iqStatusColors: Record<string, string> = {
  open: "bg-amber-100 text-amber-800",
  responded: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  closed: "bg-gray-100 text-gray-600",
};

export default function PointDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const registerId = params.registerId as string;
  const agreementId = params.agreementId as string;
  const pointId = params.pointId as string;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [delOpen, setDelOpen] = useState(false);
  const [iqOpen, setIqOpen] = useState(false);
  const [createLessonOpen, setCreateLessonOpen] = useState(false);
  const { canEdit } = useProjectRole(projectId);

  const { data: point, isLoading } = useQuery(
    trpc.interfacePoint.getById.queryOptions({ id: pointId })
  );

  const { data: workPackages = [] } = useQuery(
    trpc.workPackage.list.queryOptions({ projectId })
  );

  const updatePoint = useMutation(
    trpc.interfacePoint.update.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries(trpc.interfacePoint.getById.queryOptions({ id: pointId })),
    })
  );

  const createDeliverable = useMutation(
    trpc.deliverable.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.interfacePoint.getById.queryOptions({ id: pointId }));
        setDelOpen(false);
      },
    })
  );

  const updateDeliverable = useMutation(
    trpc.deliverable.update.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries(trpc.interfacePoint.getById.queryOptions({ id: pointId })),
    })
  );

  const deleteDeliverable = useMutation(
    trpc.deliverable.delete.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries(trpc.interfacePoint.getById.queryOptions({ id: pointId })),
    })
  );

  const { data: iqs = [] } = useQuery(
    trpc.interfaceQuery.listByPoint.queryOptions({ interfacePointId: pointId })
  );

  const { data: linkedLessons = [] } = useQuery(
    trpc.lessonLearned.list.queryOptions({ projectId, interfacePointId: pointId })
  );

  const form = useForm<DeliverableFormValues>({ resolver: zodResolver(deliverableSchema) });

  function handleCreateDeliverable(values: DeliverableFormValues) {
    createDeliverable.mutate({
      interfacePointId: pointId,
      ...values,
      responsiblePackageId: values.responsiblePackageId || undefined,
    });
    form.reset();
  }

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!point) return <div className="p-6 text-sm text-destructive">Interface point not found.</div>;

  const deliverables = point.deliverables ?? [];
  const packageById = new Map([
    [point.agreement.register.packageA.id, `${point.agreement.register.packageA.code} — ${point.agreement.register.packageA.name}`],
    [point.agreement.register.packageB.id, `${point.agreement.register.packageB.code} — ${point.agreement.register.packageB.name}`],
  ]);

  const scopeRows = [
    {
      key: "scopeSpec",
      packageId: point.scopeSpecPackageId,
      mode: point.scopeSpecMode,
    },
    {
      key: "scopeDes",
      packageId: point.scopeDesPackageId,
      mode: point.scopeDesMode,
    },
    {
      key: "scopeSup",
      packageId: point.scopeSupPackageId,
      mode: point.scopeSupMode,
    },
    {
      key: "scopeOnA",
      packageId: point.scopeOnAPackageId,
      mode: point.scopeOnAMode,
    },
    {
      key: "scopeOnT",
      packageId: point.scopeOnTPackageId,
      mode: point.scopeOnTMode,
    },
    {
      key: "scopeOnC",
      packageId: point.scopeOnCPackageId,
      mode: point.scopeOnCMode,
    },
    {
      key: "scopeOffT",
      packageId: point.scopeOffTPackageId,
      mode: point.scopeOffTMode,
    },
    {
      key: "scopeOffI",
      packageId: point.scopeOffIPackageId,
      mode: point.scopeOffIMode,
    },
    {
      key: "scopeOffC",
      packageId: point.scopeOffCPackageId,
      mode: point.scopeOffCMode,
    },
  ] as const;

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href={`/projects/${projectId}/registers`}>Registers</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href={`/projects/${projectId}/registers/${registerId}`}>
                  {point.agreement.register.code}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href={`/projects/${projectId}/registers/${registerId}/agreements/${agreementId}`}>
                  {point.agreement.code}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{point.code}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-muted-foreground">{point.code}</span>
              <CriticalityBadge criticality={point.criticality as any} />
            </div>
            <h1 className="text-2xl font-bold">{point.title}</h1>
            {point.description && (
              <p className="text-sm text-muted-foreground mt-2">{point.description}</p>
            )}
          </div>
          <div className="shrink-0">
            <Select
              defaultValue={point.status}
              onValueChange={(v) => updatePoint.mutate({ id: pointId, status: v as any })}
            >
              <SelectTrigger className="w-36 h-8 text-xs">
                <PointStatusBadge status={point.status as any} />
              </SelectTrigger>
              <SelectContent>
                {POINT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    <PointStatusBadge status={s} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Package A</p>
            <p className="font-medium flex items-center gap-1 mt-0.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: point.agreement.register.packageA.color }} />
              {point.agreement.register.packageA.code} — {point.agreement.register.packageA.name}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Package B</p>
            <p className="font-medium flex items-center gap-1 mt-0.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: point.agreement.register.packageB.color }} />
              {point.agreement.register.packageB.code} — {point.agreement.register.packageB.name}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Phase</p>
            <p className="font-medium mt-0.5 capitalize">
              {point.phase?.replace(/_/g, " ") ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Due Date</p>
            <p className="font-medium mt-0.5 flex items-center gap-2">
              {point.dueDate ? format(new Date(point.dueDate), "dd MMM yyyy") : "—"}
              <DeadlineBadge
                dueDate={point.dueDate}
                entityType="interface_point"
                status={point.status}
              />
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Attachments</CardTitle>
          </CardHeader>
          <CardContent>
            <EntityAttachments
              entityType="interface_point"
              entityId={pointId}
              canManage={canEdit}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Scope Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {SCOPE_ALLOCATION_PHASES.map((phase) => {
                const row = scopeRows.find((item) => item.key === phase.key);
                const value = row?.mode === "multiple"
                  ? "multiple"
                  : row?.mode === "not_relevant"
                    ? "n.r."
                    : row?.packageId
                      ? packageById.get(row.packageId) ?? "Unknown package"
                      : "n.r.";
                return (
                  <div key={phase.key} className="rounded border px-3 py-2">
                    <p className="text-xs font-medium">{phase.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{value}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Deliverables */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Deliverables
                {deliverables.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({deliverables.filter((d: any) => d.status === "accepted").length}/{deliverables.length} accepted)
                  </span>
                )}
              </CardTitle>
              <Dialog open={delOpen} onOpenChange={setDelOpen}>
                <DialogTrigger render={<Button size="sm" variant="outline"><PlusIcon className="h-3.5 w-3.5 mr-1" />Add Deliverable</Button>} />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New Deliverable</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={form.handleSubmit(handleCreateDeliverable)} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Title *</Label>
                      <Input placeholder="Foundation design drawing" {...form.register("title")} />
                      {form.formState.errors.title && (
                        <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Responsible Package</Label>
                        <Select onValueChange={(v) => form.setValue("responsiblePackageId", v as string | undefined)}>
                          <SelectTrigger className="text-xs">
                            <SelectValue placeholder="Any" />
                          </SelectTrigger>
                          <SelectContent>
                            {workPackages.map((wp) => (
                              <SelectItem key={wp.id} value={wp.id}>
                                {wp.code} – {wp.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Due Date</Label>
                        <Input type="date" {...form.register("dueDate")} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea rows={2} {...form.register("description")} />
                    </div>
                    <Button type="submit" disabled={createDeliverable.isPending}>
                      {createDeliverable.isPending ? "Saving…" : "Add Deliverable"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {deliverables.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No deliverables yet. Add actions that need to be completed for this interface point.
              </p>
            ) : (
              <div className="space-y-2">
                {deliverables.map((d: any) => (
                  <div
                    id={`deliverable-${d.id}`}
                    key={d.id}
                    className={`rounded-lg border px-4 py-3 space-y-3 ${getDeadlineRowClassName(
                      d.dueDate,
                      "deliverable",
                      d.status
                    )}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{d.title}</p>
                        {d.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{d.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          {d.responsiblePackage && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <span className="h-2 w-2 rounded-full" style={{ background: d.responsiblePackage.color }} />
                              {d.responsiblePackage.code} — {d.responsiblePackage.name}
                            </span>
                          )}
                          {d.dueDate && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <ClockIcon className="h-3 w-3" />
                              {format(new Date(d.dueDate), "dd MMM yyyy")}
                            </span>
                          )}
                          <DeadlineBadge
                            dueDate={d.dueDate}
                            entityType="deliverable"
                            status={d.status}
                          />
                          {d.documentRef && (
                            <a
                              href={d.documentRef}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <ExternalLinkIcon className="h-3 w-3" /> Legacy Document Link
                            </a>
                          )}
                        </div>
                      </div>
                      <Select
                        defaultValue={d.status}
                        onValueChange={(v) => updateDeliverable.mutate({ id: d.id, status: v as any })}
                      >
                        <SelectTrigger className="w-28 h-7 text-xs border-0 p-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${deliverableStatusColors[d.status]}`}>
                            {d.status.replace(/_/g, " ")}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {DELIVERABLE_STATUSES.map((s) => (
                            <SelectItem key={s} value={s} className="text-xs">
                              {s.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => deleteDeliverable.mutate({ id: d.id })}
                      >
                        <Trash2Icon className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Attachments</p>
                      <EntityAttachments
                        entityType="deliverable"
                        entityId={d.id}
                        canManage={canEdit}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Interface Queries */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquareIcon className="h-4 w-4" />
                Interface Queries
                {iqs.length > 0 && (
                  <span className="text-sm font-normal text-muted-foreground">
                    ({iqs.filter((q: any) => q.status === "open" || q.status === "responded").length} open)
                  </span>
                )}
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setIqOpen(true)}>
                <PlusIcon className="h-3.5 w-3.5 mr-1" /> Create TQU / DIR
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {iqs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No interface queries raised on this point.
              </p>
            ) : (
              <div className="space-y-2">
                {iqs.map((q: any) => (
                  <div
                    key={q.id}
                    className="flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => router.push(`/projects/${projectId}/queries/${q.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{q.subject}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium capitalize ${iqPriorityColors[q.priority]}`}>
                          {q.priority}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full" style={{ background: q.raisedByPackage.color }} />
                          {q.raisedByPackage.code} — {q.raisedByPackage.name}
                          <ArrowRightIcon className="h-3 w-3 mx-0.5" />
                          <span className="h-2 w-2 rounded-full" style={{ background: q.assignedToPackage.color }} />
                          {q.assignedToPackage.code} — {q.assignedToPackage.name}
                        </span>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${iqStatusColors[q.status]}`}>
                      {q.status.replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Linked Lessons */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpenIcon className="h-4 w-4" />
                Linked Lessons
                {linkedLessons.length > 0 && (
                  <span className="text-sm font-normal text-muted-foreground">
                    ({linkedLessons.length})
                  </span>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <a
                  href={`/projects/${projectId}/modules/lessons`}
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  View all <ExternalLinkIcon className="h-3.5 w-3.5" />
                </a>
                <Button size="sm" variant="outline" onClick={() => setCreateLessonOpen(true)}>
                  <PlusIcon className="h-3.5 w-3.5 mr-1" /> Capture Lesson
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {linkedLessons.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No lessons linked to this interface point.
              </p>
            ) : (
              <div className="space-y-3">
                {linkedLessons.map((lesson) => (
                  <LessonCard
                    key={lesson.id}
                    lesson={lesson as LessonCardItem}
                    canEdit={canEdit}
                    isAdmin={false}
                    busy={false}
                    onOpen={() => router.push(`/projects/${projectId}/modules/lessons`)}
                    onValidate={() => {}}
                    onConsolidate={() => {}}
                    onClose={() => {}}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <CreateLessonDialog
          projectId={projectId}
          open={createLessonOpen}
          onOpenChange={setCreateLessonOpen}
          workPackages={workPackages}
          defaultInterfacePointId={pointId}
          onCreated={() => queryClient.invalidateQueries(trpc.lessonLearned.list.queryOptions({ projectId, interfacePointId: pointId }))}
        />

        <TquWizard
          projectId={projectId}
          open={iqOpen}
          onOpenChange={setIqOpen}
          registerId={registerId}
          initialInterfacePointId={pointId}
        />
      </div>
    </>
  );
}
