"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  WorkPackageForm,
  type WorkPackageFormValues,
} from "@/components/forms/work-package-form";
import {
  CheckCircle2Icon,
  PackageIcon,
  FileTextIcon,
  RocketIcon,
} from "lucide-react";

interface Props {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type StepKey = "packages" | "register" | "done";

const steps = [
  { key: "packages" as const, label: "1. Work Packages", icon: PackageIcon },
  { key: "register" as const, label: "2. First Register", icon: FileTextIcon },
  { key: "done" as const, label: "3. Ready", icon: RocketIcon },
];

export function ProjectSetupWizard({ projectId, open, onOpenChange }: Props) {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<StepKey>("packages");
  const [showAddForm, setShowAddForm] = useState(false);

  // Register step state
  const [registerName, setRegisterName] = useState("");
  const [packageAId, setPackageAId] = useState("");
  const [packageBId, setPackageBId] = useState("");
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [createdRegisterId, setCreatedRegisterId] = useState<string | null>(null);

  // Reset to first step when dialog closes
  useEffect(() => {
    if (!open) {
      setStep("packages");
      setShowAddForm(false);
      setRegisterName("");
      setPackageAId("");
      setPackageBId("");
      setRegisterError(null);
      setCreatedRegisterId(null);
    }
  }, [open]);

  const wpQueryOptions = trpc.workPackage.list.queryOptions({ projectId });

  const { data: workPackages = [] } = useQuery(wpQueryOptions);

  async function invalidateWp() {
    await queryClient.invalidateQueries(wpQueryOptions);
  }

  const seedMutation = useMutation(
    trpc.workPackage.seedDefaults.mutationOptions({
      onSuccess: async () => {
        await invalidateWp();
      },
    })
  );

  const createWpMutation = useMutation(
    trpc.workPackage.create.mutationOptions({
      onSuccess: () => {
        void invalidateWp();
        setShowAddForm(false);
      },
    })
  );

  const createRegisterMutation = useMutation(
    trpc.register.create.mutationOptions({
      onSuccess: async (created) => {
        setCreatedRegisterId(created.id);
        await queryClient.invalidateQueries(
          trpc.register.list.queryOptions({ projectId })
        );
        setStep("done");
      },
      onError: (err) => {
        setRegisterError(err.message);
      },
    })
  );

  function handleCreateWp(values: WorkPackageFormValues) {
    createWpMutation.mutate({ projectId, ...values });
  }

  function handleCreateRegister() {
    if (!packageAId || !packageBId) {
      setRegisterError("Please select both Package A and Package B.");
      return;
    }
    if (packageAId === packageBId) {
      setRegisterError("Package A and Package B must be different.");
      return;
    }
    setRegisterError(null);

    // Auto-generate name from package codes if left empty
    const pkgA = workPackages.find((wp) => wp.id === packageAId);
    const pkgB = workPackages.find((wp) => wp.id === packageBId);
    const name =
      registerName.trim() ||
      (pkgA && pkgB ? `${pkgA.code} / ${pkgB.code}` : "Interface Register");

    createRegisterMutation.mutate({ projectId, name, packageAId, packageBId });
  }

  const canProceedFromPackages = workPackages.length >= 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Project Setup Wizard</DialogTitle>
          <DialogDescription>
            Configure your project in a few quick steps.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex gap-4 border-b pb-3">
          {steps.map(({ key, label, icon: Icon }) => (
            <div
              key={key}
              className={`flex items-center gap-1.5 text-xs font-medium ${
                step === key ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </div>
          ))}
        </div>

        {/* ── Step 1: Work Packages ── */}
        {step === "packages" && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">Set up Work Packages</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Work packages represent the main deliverable groups in your
                project (e.g. WTG, Foundation, OSS).
              </p>
            </div>

            {/* Existing packages list */}
            {workPackages.length > 0 && (
              <div className="space-y-1.5">
                {workPackages.map((wp) => (
                  <div
                    key={wp.id}
                    className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ background: wp.color }}
                    />
                    <span className="font-mono font-semibold w-12 text-xs">
                      {wp.code}
                    </span>
                    <span>{wp.name}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Helper text */}
            {!canProceedFromPackages && (
              <p className="text-xs text-amber-600">
                You need at least 2 work packages to proceed.{" "}
                {workPackages.length === 1 && "Add one more."}
              </p>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap">
              {workPackages.length === 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => seedMutation.mutate({ projectId })}
                  disabled={seedMutation.isPending}
                >
                  {seedMutation.isPending ? "Loading…" : "Use Industry Templates"}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddForm((v) => !v)}
              >
                {showAddForm ? "Cancel" : "Add Custom"}
              </Button>
            </div>

            {showAddForm && (
              <div className="rounded-lg border p-4">
                <WorkPackageForm
                  onSubmit={handleCreateWp}
                  isLoading={createWpMutation.isPending}
                />
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                onClick={() => setStep("register")}
                disabled={!canProceedFromPackages}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: First Register ── */}
        {step === "register" && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">Create your first Interface Register</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                An interface register tracks all interfaces between two work
                packages.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="register-name">Register Name (optional)</Label>
                <Input
                  id="register-name"
                  placeholder="Auto-generated from package codes if left empty"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Package A</Label>
                  <Select
                    value={packageAId}
                    onValueChange={(v) => {
                      setPackageAId(v ?? "");
                      setRegisterError(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {workPackages
                        .filter((wp) => wp.id !== packageBId)
                        .map((wp) => (
                          <SelectItem key={wp.id} value={wp.id}>
                            {wp.code} — {wp.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Package B</Label>
                  <Select
                    value={packageBId}
                    onValueChange={(v) => {
                      setPackageBId(v ?? "");
                      setRegisterError(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {workPackages
                        .filter((wp) => wp.id !== packageAId)
                        .map((wp) => (
                          <SelectItem key={wp.id} value={wp.id}>
                            {wp.code} — {wp.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {registerError && (
                <p className="text-xs text-destructive">{registerError}</p>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep("packages")}>
                Back
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep("done")}
                >
                  Skip
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateRegister}
                  disabled={
                    createRegisterMutation.isPending || !packageAId || !packageBId
                  }
                >
                  {createRegisterMutation.isPending
                    ? "Creating…"
                    : "Create Register"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Done ── */}
        {step === "done" && (
          <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
            <CheckCircle2Icon className="h-12 w-12 text-green-500" />
            <div>
              <p className="text-lg font-semibold">Setup Complete</p>
              <p className="text-sm text-muted-foreground mt-1">
                {workPackages.length} work package
                {workPackages.length !== 1 ? "s" : ""} created.
              </p>
            </div>
            <Button onClick={() => onOpenChange(false)}>Go to Project</Button>
            {createdRegisterId && (
              <Button
                variant="outline"
                onClick={() => {
                  router.push(`/projects/${projectId}/registers/${createdRegisterId}`);
                  onOpenChange(false);
                }}
              >
                Open First Register
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
