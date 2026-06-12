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
import {
  WorkPackageForm,
  type WorkPackageFormValues,
} from "@/components/forms/work-package-form";
import {
  CheckCircle2Icon,
  PackageIcon,
  RocketIcon,
} from "lucide-react";

interface Props {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type StepKey = "packages" | "done";

const steps = [
  { key: "packages" as const, label: "1. Work Packages", icon: PackageIcon },
  { key: "done" as const, label: "2. Ready", icon: RocketIcon },
];

export function ProjectSetupWizard({ projectId, open, onOpenChange }: Props) {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<StepKey>("packages");
  const [showAddForm, setShowAddForm] = useState(false);

  // Reset to first step when dialog closes
  useEffect(() => {
    if (!open) {
      setStep("packages");
      setShowAddForm(false);
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

  function handleCreateWp(values: WorkPackageFormValues) {
    createWpMutation.mutate({ projectId, ...values });
  }

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
              <Button onClick={() => setStep("done")}>
                Next
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Done ── */}
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
            <Button
              onClick={() => {
                router.push(`/projects/${projectId}/modules/lessons`);
                onOpenChange(false);
              }}
            >
              Open Lessons
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
