"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { ProjectSetupWizard } from "@/components/wizards/project-setup-wizard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ListIcon,
  MessageSquareIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  UsersIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { DeadlineSummaryCard } from "@/components/deadlines/deadline-summary-card";

const PHASE_LABELS: Record<string, string> = {
  maturation: "Maturation",
  feed: "FEED",
  detailed_design: "Detailed Design",
  procurement: "Procurement",
  fabrication: "Fabrication",
  installation: "Installation",
  commissioning: "Commissioning",
  operations: "Operations",
};

const STATUS_COLOR: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  on_hold: "bg-amber-100 text-amber-800",
  completed: "bg-blue-100 text-blue-800",
  cancelled: "bg-red-100 text-red-800",
  planning: "bg-gray-100 text-gray-700",
};

export default function ProjectOverviewPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const trpc = useTRPC();
  const [showSetupWizard, setShowSetupWizard] = useState(false);

  const { data: project, isLoading } = useQuery(
    trpc.project.getById.queryOptions({ id: projectId })
  );

  const { data: recentActivity = [] } = useQuery(
    trpc.activity.list.queryOptions({ projectId, limit: 5 })
  );

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  if (!project) {
    return <div className="p-6 text-sm text-muted-foreground">Project not found.</div>;
  }

  const { stats, memberCount } = project;

  return (
    <div className="flex flex-1 flex-col gap-5 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {project.description && (
            <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {project.phase && (
            <Badge variant="secondary">
              {PHASE_LABELS[project.phase] ?? project.phase}
            </Badge>
          )}
          {project.status && (
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[project.status] ?? "bg-gray-100 text-gray-700"}`}
            >
              {project.status.replace(/_/g, " ")}
            </span>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Interface Points</CardTitle>
            <ListIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPoints}</div>
            <p className="text-xs text-muted-foreground">across all registers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Open Queries</CardTitle>
            <MessageSquareIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.openIqs > 0 ? "text-amber-600" : ""}`}>
              {stats.openIqs}
            </div>
            <p className="text-xs text-muted-foreground">awaiting response</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Critical Items</CardTitle>
            <AlertTriangleIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.criticalPoints > 0 ? "text-red-600" : ""}`}>
              {stats.criticalPoints}
            </div>
            <p className="text-xs text-muted-foreground">need attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle2Icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{stats.resolvedPoints}</div>
            <p className="text-xs text-muted-foreground">interface points</p>
          </CardContent>
        </Card>
      </div>

      <DeadlineSummaryCard projectId={projectId} />

      {/* Work Packages + Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Work Packages</CardTitle>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <UsersIcon className="h-3.5 w-3.5" />
                {memberCount} member{memberCount !== 1 ? "s" : ""}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {project.workPackages.length === 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  No work packages yet. Go to Settings → Work Packages.
                </p>
                <Button size="sm" onClick={() => setShowSetupWizard(true)}>
                  Run Setup Wizard
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {project.workPackages.map((wp) => (
                  <div key={wp.id} className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ background: wp.color }}
                    />
                    <span className="text-xs font-mono font-semibold w-12">{wp.code}</span>
                    <span className="text-sm">{wp.name}</span>
                    {wp.responsibleOrg && (
                      <span className="text-xs text-muted-foreground ml-auto">{wp.responsibleOrg}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((a: any) => (
                  <div key={a.id} className="flex items-start gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs">
                        <span className="font-medium">{a.actorName}</span>{" "}
                        <span className="text-muted-foreground">
                          {a.eventType.replace(/\./g, " ")}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{a.entityLabel}</p>
                    </div>
                    <time className="text-[10px] text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                    </time>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ProjectSetupWizard
        projectId={projectId}
        open={showSetupWizard}
        onOpenChange={setShowSetupWizard}
      />
    </div>
  );
}
