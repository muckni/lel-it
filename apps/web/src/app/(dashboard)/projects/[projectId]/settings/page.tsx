"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { WorkPackageForm, type WorkPackageFormValues } from "@/components/forms/work-package-form";
import { PlusIcon, Trash2Icon, PackageIcon } from "lucide-react";

export default function SettingsPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: workPackages = [], isLoading } = useQuery(
    trpc.workPackage.list.queryOptions({ projectId })
  );

  const createMutation = useMutation(
    trpc.workPackage.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.workPackage.list.queryOptions({ projectId }));
        setOpen(false);
      },
    })
  );

  const deleteMutation = useMutation(
    trpc.workPackage.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.workPackage.list.queryOptions({ projectId }));
      },
    })
  );

  const seedMutation = useMutation(
    trpc.workPackage.seedDefaults.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.workPackage.list.queryOptions({ projectId }));
      },
    })
  );

  function handleCreate(values: WorkPackageFormValues) {
    createMutation.mutate({ projectId, ...values });
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Project Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure work packages and project details.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Work Packages</CardTitle>
              <CardDescription>
                Define the work packages that have interfaces in this project.
              </CardDescription>
            </div>
            <div className="flex gap-2">
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
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger render={<Button size="sm"><PlusIcon className="h-4 w-4 mr-1" />Add Package</Button>} />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New Work Package</DialogTitle>
                  </DialogHeader>
                  <WorkPackageForm
                    onSubmit={handleCreate}
                    isLoading={createMutation.isPending}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : workPackages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <PackageIcon className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">No work packages yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add packages manually or use the industry templates (WTG, Foundation, OSS, etc.)
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {workPackages.map((wp) => (
                <div
                  key={wp.id}
                  className="flex items-center gap-3 rounded-lg border px-4 py-3"
                >
                  <span
                    className="h-4 w-4 rounded-full shrink-0"
                    style={{ background: wp.color }}
                  />
                  <span className="font-mono text-sm font-semibold w-14">{wp.code}</span>
                  <span className="text-sm flex-1">{wp.name}</span>
                  {wp.responsibleOrg && (
                    <span className="text-xs text-muted-foreground">{wp.responsibleOrg}</span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteMutation.mutate({ id: wp.id })}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2Icon className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
