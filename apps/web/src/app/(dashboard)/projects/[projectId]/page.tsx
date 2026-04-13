"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { BookOpenIcon, LayersIcon, ListIcon, MessageSquareIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTRPC } from "@/trpc/client";

export default function ProjectModuleSelectorPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const trpc = useTRPC();

  const { data: project, isLoading } = useQuery(
    trpc.project.getById.queryOptions({ id: projectId })
  );

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  if (!project) {
    return <div className="p-6 text-sm text-muted-foreground">Project not found.</div>;
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose a module to continue. Use <span className="font-mono">?select=1</span> in the URL to return here.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Interface Points</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{project.stats.totalPoints}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Open Queries</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{project.stats.openIqs}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Critical Items</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{project.stats.criticalPoints}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Members</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{project.memberCount}</CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <LayersIcon className="h-5 w-5" />
              <CardTitle>Interfaces Module</CardTitle>
            </div>
            <CardDescription>
              Manage interface cases, matrix, tracker, MOC, and interface execution workflows.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2"><ListIcon className="h-4 w-4" />Case lifecycle & SLA tracking</li>
              <li className="flex items-center gap-2"><MessageSquareIcon className="h-4 w-4" />Query and correspondence handling</li>
            </ul>
            <Link
              href={`/projects/${projectId}/modules/interfaces`}
              className={buttonVariants({ variant: "default" })}
            >
              Open Interfaces
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookOpenIcon className="h-5 w-5" />
              <CardTitle>Lessons Module</CardTitle>
            </div>
            <CardDescription>
              Capture, validate, and consolidate lessons with links back to interface points.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Project members can capture lessons quickly, while editors and admins handle governance.
            </p>
            <Link
              href={`/projects/${projectId}/modules/lessons`}
              className={buttonVariants({ variant: "outline" })}
            >
              Open Lessons
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
