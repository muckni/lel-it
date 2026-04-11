"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RegisterForm, type RegisterFormValues } from "@/components/forms/register-form";
import { RegisterStatusBadge } from "@/components/status-badge";
import { PlusIcon, ListIcon, ChevronRightIcon } from "lucide-react";

export default function RegistersPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: registers = [], isLoading } = useQuery(
    trpc.register.list.queryOptions({ projectId })
  );

  const { data: workPackages = [] } = useQuery(
    trpc.workPackage.list.queryOptions({ projectId })
  );

  const createMutation = useMutation(
    trpc.register.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.register.list.queryOptions({ projectId }));
        setOpen(false);
      },
    })
  );

  function handleCreate(values: RegisterFormValues) {
    createMutation.mutate({ projectId, ...values });
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Interface Registers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {registers.length} register{registers.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button><PlusIcon className="h-4 w-4 mr-1" />New Register</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Interface Register</DialogTitle>
            </DialogHeader>
            {workPackages.length < 2 ? (
              <p className="text-sm text-muted-foreground">
                You need at least 2 work packages to create a register. Go to Settings → Work Packages.
              </p>
            ) : (
              <RegisterForm
                workPackages={workPackages}
                onSubmit={handleCreate}
                isLoading={createMutation.isPending}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : registers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ListIcon className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm font-medium">No interface registers yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Create a register between two work packages to start tracking interface points.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {registers.map((reg) => {
            const totalPoints = reg.agreements.reduce(
              (sum, a) => sum + (a.points?.length ?? 0),
              0
            );
            return (
              <Card
                key={reg.id}
                className="cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() =>
                  router.push(`/projects/${projectId}/registers/${reg.id}`)
                }
              >
                <CardContent className="flex items-center gap-4 py-4">
                  <div
                    className="flex items-center gap-1 shrink-0"
                    title={`${reg.packageA.name} ↔ ${reg.packageB.name}`}
                  >
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: reg.packageA.color }}
                    />
                    <span className="font-mono text-xs font-semibold">{reg.packageA.code}</span>
                    <span className="text-muted-foreground mx-1">↔</span>
                    <span className="font-mono text-xs font-semibold">{reg.packageB.code}</span>
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: reg.packageB.color }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{reg.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {reg.code} · {reg.agreements.length} agreement{reg.agreements.length !== 1 ? "s" : ""} · {totalPoints} point{totalPoints !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <RegisterStatusBadge status={reg.status} />
                  <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
