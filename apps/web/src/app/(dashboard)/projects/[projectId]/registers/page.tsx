"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RegisterStatusBadge } from "@/components/status-badge";
import { RegisterWizard } from "@/components/wizards/register-wizard";
import { PlusIcon, ListIcon, ChevronRightIcon } from "lucide-react";

export default function RegistersPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const trpc = useTRPC();
  const [wizardOpen, setWizardOpen] = useState(false);

  const { data: registers = [], isLoading } = useQuery(
    trpc.register.list.queryOptions({ projectId })
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Interface Registers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {registers.length} register{registers.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)}>
          <PlusIcon className="mr-1 h-4 w-4" />
          New Register
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : registers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ListIcon className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-sm font-medium">No interface registers yet</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Create a register between two work packages to start tracking interface points.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {registers.map((register) => {
            const totalPoints = register.agreements.reduce(
              (sum, agreement) => sum + (agreement.points?.length ?? 0),
              0
            );
            return (
              <Card
                key={register.id}
                className="cursor-pointer transition-colors hover:bg-muted/30"
                onClick={() =>
                  router.push(`/projects/${projectId}/registers/${register.id}`)
                }
              >
                <CardContent className="flex items-center gap-4 py-4">
                  <div
                    className="flex shrink-0 items-center gap-1"
                    title={`${register.packageA.name} ↔ ${register.packageB.name}`}
                  >
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: register.packageA.color }}
                    />
                    <span className="font-mono text-xs font-semibold">{register.packageA.code}</span>
                    <span className="mx-1 text-muted-foreground">↔</span>
                    <span className="font-mono text-xs font-semibold">{register.packageB.code}</span>
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: register.packageB.color }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{register.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {register.code} · {register.agreements.length} agreement
                      {register.agreements.length !== 1 ? "s" : ""} · {totalPoints} point
                      {totalPoints !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <RegisterStatusBadge status={register.status} />
                  <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <RegisterWizard
        projectId={projectId}
        open={wizardOpen}
        onOpenChange={setWizardOpen}
      />
    </div>
  );
}
