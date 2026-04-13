"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";

export default function LessonsPortfolioCockpitPage() {
  const trpc = useTRPC();

  const { data: cockpit } = useQuery(trpc.lessonPortfolio.getCockpit.queryOptions());
  const { data: atRisk = [] } = useQuery(trpc.lessonPortfolio.listAtRiskProjects.queryOptions());

  return (
    <div className="flex flex-1 flex-col gap-5 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Portfolio Lessons PMO Cockpit</h1>
        <p className="text-sm text-muted-foreground">
          Cross-project workload, gate-readiness, overdue actions, and Track B escalation visibility.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Active Projects" value={cockpit?.kpis.activeProjects ?? 0} />
        <KpiCard label="Open Cycles" value={cockpit?.kpis.openCycles ?? 0} />
        <KpiCard label="Overdue Track A" value={cockpit?.kpis.overdueTrackAActions ?? 0} danger />
        <KpiCard label="Pending Track B" value={cockpit?.kpis.pendingTrackBSubmissions ?? 0} danger />
        <KpiCard label="Gate Ready" value={cockpit?.kpis.gateReadyProjects ?? 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">At-Risk Projects</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {atRisk.length === 0 ? (
            <p className="text-sm text-muted-foreground">No at-risk projects detected.</p>
          ) : (
            atRisk.map((project) => (
              <div key={project.projectId} className="rounded border p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{project.projectName}</p>
                  <p className="text-xs text-muted-foreground">
                    Overdue A: {project.overdueTrackAActions} · Pending B: {project.pendingTrackBSubmissions} · Unknowns: {project.unresolvedUnknowns}
                  </p>
                </div>
                <Link
                  href={`/projects/${project.projectId}/modules/lessons`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Open Project
                </Link>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Project Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(cockpit?.projects ?? []).map((project) => (
            <div key={project.projectId} className="rounded border p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{project.projectName}</p>
                <p className="text-xs text-muted-foreground">
                  Cycle: {project.cycle?.cycleLabel ?? "None"} · State: {project.cycle?.state ?? "none"}
                </p>
              </div>
              <div className="text-xs">
                <span className={`px-2 py-0.5 rounded ${project.gateReady ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {project.gateReady ? "Ready" : "Attention"}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{label}</CardTitle>
      </CardHeader>
      <CardContent className={`text-2xl font-semibold ${danger && value > 0 ? "text-red-700" : ""}`}>
        {value}
      </CardContent>
    </Card>
  );
}
