"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { BookOpenCheckIcon, BookOpenIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PROJECT_MODULES, type ProjectModuleKey } from "@/lib/project-modules";
import { useTRPC } from "@/trpc/client";

export default function ProjectModuleSelectorPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params.projectId as string;
  const trpc = useTRPC();
  const forceSelector = searchParams.get("select") === "1";

  const { data: project, isLoading } = useQuery(
    trpc.project.getById.queryOptions({ id: projectId })
  );

  useEffect(() => {
    if (!project || forceSelector || typeof window === "undefined") return;

    const key = `owit.project.${projectId}.module`;
    const remembered = window.localStorage.getItem(key) as ProjectModuleKey | null;
    if (remembered && remembered in PROJECT_MODULES) {
      router.replace(`/projects/${projectId}/modules/${remembered}`);
      return;
    }
    router.replace(`/projects/${projectId}/modules/lessons`);
  }, [forceSelector, project, projectId, router]);

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Captured Items</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{project.stats.totalLessons}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Validated</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{project.stats.validatedLessons}</CardContent>
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
              <BookOpenIcon className="h-5 w-5" />
              <CardTitle>Lessons Module</CardTitle>
            </div>
            <CardDescription>
              Capture, validate, and consolidate lessons into project actions and reusable guidance.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Project members can capture lessons quickly, while editors and admins handle governance.
            </p>
            <Link
              href={`/projects/${projectId}/modules/lessons`}
              className={buttonVariants({ variant: "default" })}
            >
              Open Lessons
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookOpenCheckIcon className="h-5 w-5" />
              <CardTitle>Corporate Library</CardTitle>
            </div>
            <CardDescription>
              Browse approved corporate recommended actions and bring them into project execution.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Available to users with corporate lessons access.
            </p>
            <Link href="/corporate/library" className={buttonVariants({ variant: "outline" })}>
              Open Library
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
