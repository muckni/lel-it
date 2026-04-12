"use client";

import { useMemo, useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QUERY_PRIORITIES } from "@owit/shared";

interface Props {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registerId?: string;
  initialInterfacePointId?: string;
}

type WizardStep = "point" | "parties" | "details" | "review";

function plusDaysISO(days: number) {
  const next = new Date();
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

export function TquWizard({
  projectId,
  open,
  onOpenChange,
  registerId,
  initialInterfacePointId,
}: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<WizardStep>("point");
  const [interfacePointId, setInterfacePointId] = useState(initialInterfacePointId ?? "");
  const [raisedByPackageId, setRaisedByPackageId] = useState("");
  const [assignedToPackageId, setAssignedToPackageId] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<(typeof QUERY_PRIORITIES)[number]>("medium");
  const [dueDate, setDueDate] = useState(plusDaysISO(14));
  const [error, setError] = useState<string | null>(null);

  const { data: workPackages = [] } = useQuery(
    trpc.workPackage.list.queryOptions({ projectId })
  );

  const { data: registers = [] } = useQuery(
    trpc.register.list.queryOptions({ projectId })
  );

  const allPoints = useMemo(() => {
    return registers
      .filter((register) => (registerId ? register.id === registerId : true))
      .flatMap((register) =>
        register.agreements.flatMap((agreement) =>
          (agreement.points ?? []).map((point) => ({
            id: point.id,
            code: point.code,
            title: point.title,
            agreementCode: agreement.code,
            registerCode: register.code,
          }))
        )
      );
  }, [registers, registerId]);

  const selectedPoint = allPoints.find((point) => point.id === interfacePointId) ?? null;

  const createQuery = useMutation(
    trpc.interfaceQuery.create.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.interfaceQuery.listByProject.queryOptions({ projectId })
        );
        if (interfacePointId) {
          await queryClient.invalidateQueries(
            trpc.interfaceQuery.listByPoint.queryOptions({ interfacePointId })
          );
        }
        handleClose(false);
      },
      onError: (mutationError) => setError(mutationError.message),
    })
  );

  function handleClose(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (nextOpen) return;
    setStep("point");
    setInterfacePointId(initialInterfacePointId ?? "");
    setRaisedByPackageId("");
    setAssignedToPackageId("");
    setSubject("");
    setDescription("");
    setPriority("medium");
    setDueDate(plusDaysISO(14));
    setError(null);
  }

  async function handleSubmit() {
    if (!interfacePointId || !raisedByPackageId || !assignedToPackageId || !subject.trim()) {
      setError("Please complete all required fields.");
      return;
    }
    if (raisedByPackageId === assignedToPackageId) {
      setError("Requesting and Providing Party must be different work packages.");
      return;
    }

    setError(null);

    await createQuery.mutateAsync({
      interfacePointId,
      raisedByPackageId,
      assignedToPackageId,
      subject: subject.trim(),
      description: description.trim() || undefined,
      priority,
      dueDate: dueDate || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create TQU / DIR</DialogTitle>
          <DialogDescription>
            Create a Technical Query with Detailed Information Requirement and RP/PP assignment.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={step === "point" ? "text-foreground" : ""}>1. Interface Point</span>
          <span>→</span>
          <span className={step === "parties" ? "text-foreground" : ""}>2. Parties</span>
          <span>→</span>
          <span className={step === "details" ? "text-foreground" : ""}>3. DIR Details</span>
          <span>→</span>
          <span className={step === "review" ? "text-foreground" : ""}>4. Review</span>
        </div>

        {step === "point" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Interface Point *</Label>
              <Select value={interfacePointId} onValueChange={(value) => setInterfacePointId(value ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select interface point..." />
                </SelectTrigger>
                <SelectContent>
                  {allPoints.map((point) => (
                    <SelectItem key={point.id} value={point.id}>
                      {point.code} — {point.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPoint && (
                <p className="text-xs text-muted-foreground">
                  {selectedPoint.registerCode} / {selectedPoint.agreementCode}
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep("parties")} disabled={!interfacePointId}>
                Next
              </Button>
            </div>
          </div>
        )}

        {step === "parties" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Requesting Party (RP) *</Label>
                <Select value={raisedByPackageId} onValueChange={(value) => setRaisedByPackageId(value ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select package" />
                  </SelectTrigger>
                  <SelectContent>
                    {workPackages
                      .filter((wp) => wp.id !== assignedToPackageId)
                      .map((wp) => (
                        <SelectItem key={wp.id} value={wp.id}>
                          {wp.code} — {wp.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Providing Party (PP) *</Label>
                <Select value={assignedToPackageId} onValueChange={(value) => setAssignedToPackageId(value ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select package" />
                  </SelectTrigger>
                  <SelectContent>
                    {workPackages
                      .filter((wp) => wp.id !== raisedByPackageId)
                      .map((wp) => (
                        <SelectItem key={wp.id} value={wp.id}>
                          {wp.code} — {wp.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep("point")}>Back</Button>
              <Button onClick={() => setStep("details")} disabled={!raisedByPackageId || !assignedToPackageId}>
                Next
              </Button>
            </div>
          </div>
        )}

        {step === "details" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>DIR Subject *</Label>
              <Input
                placeholder="Clarification on flange bolt pattern"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(value) => setPriority(value as (typeof QUERY_PRIORITIES)[number])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUERY_PRIORITIES.map((value) => (
                      <SelectItem key={value} value={value} className="capitalize">
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due Date (Default +14 days)</Label>
                <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>DIR Description</Label>
              <Textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} />
            </div>

            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep("parties")}>Back</Button>
              <Button onClick={() => setStep("review")} disabled={!subject.trim()}>
                Next
              </Button>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <div className="rounded border p-3 text-sm">
              <p className="font-medium">{subject}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Point: {selectedPoint?.code ?? "-"} · Priority: {priority} · Due: {dueDate || "-"}
              </p>
              {description && <p className="text-xs text-muted-foreground mt-2">{description}</p>}
            </div>

            <div className="rounded border p-3 text-xs text-muted-foreground">
              <p>
                RP: {workPackages.find((wp) => wp.id === raisedByPackageId)?.code ?? "-"} → PP: {workPackages.find((wp) => wp.id === assignedToPackageId)?.code ?? "-"}
              </p>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep("details")}>Back</Button>
              <Button onClick={handleSubmit} disabled={createQuery.isPending}>
                {createQuery.isPending ? "Creating..." : "Create TQU / DIR"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
