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
import { CRITICALITIES, PROJECT_PHASES, SCOPE_ALLOCATION_PHASES } from "@owit/shared";

interface Props {
  agreementId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

type WizardStep = "basics" | "scope" | "review";

type ScopeValue = string | "n.r." | "multiple";

type ScopeState = Record<(typeof SCOPE_ALLOCATION_PHASES)[number]["key"], ScopeValue>;

const defaultScopeState = SCOPE_ALLOCATION_PHASES.reduce((acc, phase) => {
  acc[phase.key] = "n.r.";
  return acc;
}, {} as ScopeState);

const phaseLabels: Record<(typeof PROJECT_PHASES)[number], string> = {
  maturation: "Maturation",
  feed: "FEED",
  detailed_design: "Detailed Design",
  procurement: "Procurement",
  fabrication: "Fabrication",
  installation: "Installation",
  commissioning: "Commissioning",
  operations: "Operations",
};

export function InterfacePointWizard({ agreementId, open, onOpenChange, onCreated }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<WizardStep>("basics");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [criticality, setCriticality] = useState<(typeof CRITICALITIES)[number]>("minor");
  const [phase, setPhase] = useState<(typeof PROJECT_PHASES)[number] | "">("");
  const [dueDate, setDueDate] = useState("");
  const [scope, setScope] = useState<ScopeState>(defaultScopeState);
  const [error, setError] = useState<string | null>(null);

  const { data: agreement } = useQuery({
    ...trpc.agreement.getById.queryOptions({ id: agreementId }),
    enabled: open,
  });

  const packageOptions = useMemo(() => {
    if (!agreement) return [] as { id: string; code: string; name: string }[];
    return [
      {
        id: agreement.register.packageA.id,
        code: agreement.register.packageA.code,
        name: agreement.register.packageA.name,
      },
      {
        id: agreement.register.packageB.id,
        code: agreement.register.packageB.code,
        name: agreement.register.packageB.name,
      },
    ];
  }, [agreement]);

  const createPoint = useMutation(
    trpc.interfacePoint.create.mutationOptions({
      onSuccess: async (created) => {
        await queryClient.invalidateQueries(
          trpc.interfacePoint.list.queryOptions({ agreementId })
        );
        onCreated?.(created.id);
        handleClose(false);
      },
      onError: (mutationError) => setError(mutationError.message),
    })
  );

  function handleScopeChange(
    key: (typeof SCOPE_ALLOCATION_PHASES)[number]["key"],
    value: ScopeValue
  ) {
    setScope((previous) => ({ ...previous, [key]: value }));
  }

  function handleClose(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (nextOpen) return;
    setStep("basics");
    setTitle("");
    setDescription("");
    setCriticality("minor");
    setPhase("");
    setDueDate("");
    setScope(defaultScopeState);
    setError(null);
  }

  async function handleSubmit() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    setError(null);

    await createPoint.mutateAsync({
      agreementId,
      title: title.trim(),
      description: description.trim() || undefined,
      criticality,
      phase: phase || undefined,
      dueDate: dueDate || undefined,
      scopeSpec: scope.scopeSpec,
      scopeDes: scope.scopeDes,
      scopeSup: scope.scopeSup,
      scopeOnA: scope.scopeOnA,
      scopeOnT: scope.scopeOnT,
      scopeOnC: scope.scopeOnC,
      scopeOffT: scope.scopeOffT,
      scopeOffI: scope.scopeOffI,
      scopeOffC: scope.scopeOffC,
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Interface Point</DialogTitle>
          <DialogDescription>
            Define basic details, set scope allocation, and review before creating.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={step === "basics" ? "text-foreground" : ""}>1. Basics</span>
          <span>→</span>
          <span className={step === "scope" ? "text-foreground" : ""}>2. Scope</span>
          <span>→</span>
          <span className={step === "review" ? "text-foreground" : ""}>3. Review</span>
        </div>

        {step === "basics" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                placeholder="Tower base flange connection"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Criticality</Label>
                <Select
                  value={criticality}
                  onValueChange={(value) => setCriticality(value as (typeof CRITICALITIES)[number])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CRITICALITIES.map((value) => (
                      <SelectItem key={value} value={value} className="capitalize">
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Phase</Label>
                <Select value={phase || "none"} onValueChange={(value) => setPhase(value === "none" ? "" : (value as (typeof PROJECT_PHASES)[number]))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Any</SelectItem>
                    {PROJECT_PHASES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {phaseLabels[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep("scope")} disabled={!title.trim()}>
                Next
              </Button>
            </div>
          </div>
        )}

        {step === "scope" && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Assign responsibility per EPCI phase using one of the two register packages, or set phase as not relevant/multiple.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {SCOPE_ALLOCATION_PHASES.map((phaseItem) => (
                <div key={phaseItem.key} className="space-y-1.5 rounded border p-2.5">
                  <div>
                    <p className="text-xs font-medium">{phaseItem.label}</p>
                    <p className="text-[11px] text-muted-foreground">{phaseItem.description}</p>
                  </div>
                  <Select
                    value={scope[phaseItem.key]}
                    onValueChange={(value) => handleScopeChange(phaseItem.key, value as ScopeValue)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {packageOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.code} — {option.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="n.r.">n.r. (not relevant)</SelectItem>
                      <SelectItem value="multiple">multiple</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep("basics")}>Back</Button>
              <Button onClick={() => setStep("review")}>Next</Button>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <div className="rounded border p-3 text-sm">
              <p className="font-medium">{title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {criticality} · {phase ? phaseLabels[phase] : "Any phase"} · {dueDate || "No due date"}
              </p>
              {description && <p className="mt-2 text-xs text-muted-foreground">{description}</p>}
            </div>

            <div className="rounded border p-3">
              <p className="text-xs font-medium mb-2">Scope allocation</p>
              <div className="grid gap-1.5 md:grid-cols-2">
                {SCOPE_ALLOCATION_PHASES.map((phaseItem) => {
                  const value = scope[phaseItem.key];
                  const packageValue = packageOptions.find((option) => option.id === value);
                  return (
                    <p key={phaseItem.key} className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{phaseItem.label}:</span>{" "}
                      {packageValue ? `${packageValue.code} — ${packageValue.name}` : value}
                    </p>
                  );
                })}
              </div>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep("scope")}>Back</Button>
              <Button onClick={handleSubmit} disabled={createPoint.isPending}>
                {createPoint.isPending ? "Creating..." : "Create Interface Point"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
