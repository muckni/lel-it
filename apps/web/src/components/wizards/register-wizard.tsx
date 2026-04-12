"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { DISCIPLINES } from "@owit/shared";

interface Props {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type WizardStep = "packages" | "register" | "agreement" | "done";

export function RegisterWizard({ projectId, open, onOpenChange }: Props) {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<WizardStep>("packages");
  const [packageAId, setPackageAId] = useState("");
  const [packageBId, setPackageBId] = useState("");
  const [name, setName] = useState("");
  const [createFirstAgreement, setCreateFirstAgreement] = useState(true);
  const [agreementTitle, setAgreementTitle] = useState("");
  const [agreementDiscipline, setAgreementDiscipline] = useState<"none" | (typeof DISCIPLINES)[number]>("none");
  const [createdRegisterId, setCreatedRegisterId] = useState<string | null>(null);
  const [createdAgreementId, setCreatedAgreementId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: workPackages = [] } = useQuery(
    trpc.workPackage.list.queryOptions({ projectId })
  );

  const { data: registers = [] } = useQuery(
    trpc.register.list.queryOptions({ projectId })
  );

  const packageA = workPackages.find((pkg) => pkg.id === packageAId) ?? null;
  const packageB = workPackages.find((pkg) => pkg.id === packageBId) ?? null;

  const inferredName = useMemo(() => {
    if (name.trim()) return name.trim();
    if (!packageA || !packageB) return "";
    return `${packageA.code}-${packageB.code} Interfaces`;
  }, [name, packageA, packageB]);

  const duplicatePair = useMemo(() => {
    if (!packageAId || !packageBId) return false;
    const candidate = [packageAId, packageBId].sort().join("::");
    return registers.some((register) => {
      const existing = [register.packageAId, register.packageBId].sort().join("::");
      return existing === candidate;
    });
  }, [registers, packageAId, packageBId]);

  const createRegister = useMutation(trpc.register.create.mutationOptions());
  const createAgreement = useMutation(trpc.agreement.create.mutationOptions());

  function handleClose(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (nextOpen) return;
    setStep("packages");
    setPackageAId("");
    setPackageBId("");
    setName("");
    setCreateFirstAgreement(true);
    setAgreementTitle("");
    setAgreementDiscipline("none");
    setCreatedRegisterId(null);
    setCreatedAgreementId(null);
    setError(null);
  }

  async function handleCreate() {
    if (!packageAId || !packageBId) {
      setError("Select both work packages.");
      return;
    }
    if (packageAId === packageBId) {
      setError("Package A and Package B must be different.");
      return;
    }
    if (duplicatePair) {
      setError("A register for this package pair already exists.");
      return;
    }

    setError(null);

    const register = await createRegister.mutateAsync({
      projectId,
      packageAId,
      packageBId,
      name: inferredName || "Interface Register",
    });

    let agreementId: string | null = null;

    if (createFirstAgreement) {
      const agreement = await createAgreement.mutateAsync({
        registerId: register.id,
        title: agreementTitle.trim() || `${register.code} Initial Agreement`,
        discipline: agreementDiscipline === "none" ? undefined : agreementDiscipline,
      });
      agreementId = agreement.id;
    }

    await queryClient.invalidateQueries(trpc.register.list.queryOptions({ projectId }));

    setCreatedRegisterId(register.id);
    setCreatedAgreementId(agreementId);
    setStep("done");
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Register Wizard</DialogTitle>
          <DialogDescription>
            Create a register between two work packages and optionally create the first agreement.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={step === "packages" ? "text-foreground" : ""}>1. Packages</span>
          <span>→</span>
          <span className={step === "register" ? "text-foreground" : ""}>2. Register</span>
          <span>→</span>
          <span className={step === "agreement" ? "text-foreground" : ""}>3. Agreement</span>
          <span>→</span>
          <span className={step === "done" ? "text-foreground" : ""}>4. Done</span>
        </div>

        {step === "packages" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Package A *</Label>
                <Select value={packageAId} onValueChange={(value) => setPackageAId(value ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select package" />
                  </SelectTrigger>
                  <SelectContent>
                    {workPackages
                      .filter((pkg) => pkg.id !== packageBId)
                      .map((pkg) => (
                        <SelectItem key={pkg.id} value={pkg.id}>
                          {pkg.code} — {pkg.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Package B *</Label>
                <Select value={packageBId} onValueChange={(value) => setPackageBId(value ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select package" />
                  </SelectTrigger>
                  <SelectContent>
                    {workPackages
                      .filter((pkg) => pkg.id !== packageAId)
                      .map((pkg) => (
                        <SelectItem key={pkg.id} value={pkg.id}>
                          {pkg.code} — {pkg.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {duplicatePair && (
              <p className="text-xs text-amber-700">
                A register for this package pair already exists.
              </p>
            )}

            <div className="flex justify-end">
              <Button onClick={() => setStep("register")} disabled={!packageAId || !packageBId || duplicatePair}>
                Next
              </Button>
            </div>
          </div>
        )}

        {step === "register" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Register Name</Label>
              <Input
                placeholder="WTG-FOU Interfaces"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">Default: {inferredName || "set after package selection"}</p>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="create-first-agreement"
                type="checkbox"
                checked={createFirstAgreement}
                onChange={(event) => setCreateFirstAgreement(event.target.checked)}
              />
              <Label htmlFor="create-first-agreement">Create first agreement now</Label>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep("packages")}>Back</Button>
              <Button onClick={() => setStep(createFirstAgreement ? "agreement" : "done")}>Next</Button>
            </div>
          </div>
        )}

        {step === "agreement" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Agreement Title</Label>
              <Input
                placeholder="Initial interface agreement"
                value={agreementTitle}
                onChange={(event) => setAgreementTitle(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Discipline</Label>
              <Select value={agreementDiscipline} onValueChange={(value) => setAgreementDiscipline(value as "none" | (typeof DISCIPLINES)[number])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {DISCIPLINES.map((discipline) => (
                    <SelectItem key={discipline} value={discipline}>
                      {discipline.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep("register")}>Back</Button>
              <Button onClick={() => setStep("done")}>Next</Button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4">
            <div className="rounded border p-3 text-sm">
              <p className="font-medium">{inferredName || "Interface Register"}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {packageA?.code ?? "-"} ↔ {packageB?.code ?? "-"}
              </p>
              {createFirstAgreement && (
                <p className="text-xs text-muted-foreground mt-1">
                  First agreement: {agreementTitle.trim() || "auto-generated"}
                </p>
              )}
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            {!createdRegisterId ? (
              <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => setStep(createFirstAgreement ? "agreement" : "register")}>Back</Button>
                <Button onClick={handleCreate} disabled={createRegister.isPending || createAgreement.isPending}>
                  {createRegister.isPending || createAgreement.isPending ? "Creating..." : "Create Register"}
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => handleClose(false)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    if (createdAgreementId) {
                      router.push(`/projects/${projectId}/registers/${createdRegisterId}/agreements/${createdAgreementId}`);
                    } else {
                      router.push(`/projects/${projectId}/registers/${createdRegisterId}`);
                    }
                    handleClose(false);
                  }}
                >
                  Open Created Record
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
