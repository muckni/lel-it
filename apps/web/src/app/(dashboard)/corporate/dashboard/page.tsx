"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3Icon,
  BookOpenCheckIcon,
  LibraryIcon,
  Repeat2Icon,
  ShieldCheckIcon,
  TrendingUpIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

const corporateNav = [
  { label: "Library", href: "/corporate/library", active: false, icon: LibraryIcon },
  { label: "Proposals", href: "/corporate/proposals", active: false, icon: BookOpenCheckIcon },
  { label: "Dashboard", href: "/corporate/dashboard", active: true, icon: BarChart3Icon },
] as const;

export default function CorporateDashboardPage() {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(trpc.lessonV2.corporateDashboard.queryOptions());

  const summary = data?.summary ?? {
    activeLibrary: 0,
    pendingProposals: 0,
    reusedActionCount: 0,
    implementationCount: 0,
    retired: 0,
  };
  const maxCategory = Math.max(1, ...(data?.byCategory.map((item) => item.count) ?? [1]));

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-teal-700">
            Corporate View
          </p>
          <h1 className="text-2xl font-semibold">Corporate Lessons Dashboard</h1>
        </div>
        <Button variant="outline" disabled={isLoading}>Export snapshot</Button>
      </div>

      <nav className="flex gap-2 overflow-x-auto border-b">
        {corporateNav.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-2 border-b-2 px-2 py-3 text-sm font-medium whitespace-nowrap",
                item.active
                  ? "border-teal-600 text-teal-700"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Active library items", value: summary.activeLibrary, icon: LibraryIcon },
          { label: "Pending proposals", value: summary.pendingProposals, icon: BookOpenCheckIcon },
          { label: "Project reuses", value: summary.reusedActionCount, icon: Repeat2Icon },
          { label: "In implementation", value: summary.implementationCount, icon: TrendingUpIcon },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm">{metric.label}</CardTitle>
                <Icon className="size-4 text-teal-700" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{metric.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Library by Category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.byCategory ?? []).map((item) => (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{item.name}</span>
                  <span className="font-medium">{item.count}</span>
                </div>
                <div className="h-2 rounded bg-muted">
                  <div
                    className="h-2 rounded bg-teal-600"
                    style={{ width: `${Math.max(8, (item.count / maxCategory) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {!isLoading && (data?.byCategory.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No corporate library data.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheckIcon className="size-4" />
              Reuse by Project
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.reuseByProject ?? []).slice(0, 8).map((item) => (
              <div key={item.projectId} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                <span>{item.projectName ?? "Project hidden"}</span>
                <Badge variant="outline">{item.count} actions</Badge>
              </div>
            ))}
            {!isLoading && (data?.reuseByProject.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No project reuse yet.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Corporate Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.recentLibrary ?? []).map((item) => (
              <div key={item.id} className="rounded border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{item.title}</p>
                  <Badge variant="outline">v{item.version}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.category.name} · {item.sourceProject?.name ?? "Source hidden"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending Corporate Proposals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.pendingProposals ?? []).map((item) => (
              <div key={item.id} className="rounded border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{item.title}</p>
                  <Badge variant="secondary">{item.status.replace(/_/g, " ")}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.category.name} · {item.project?.name ?? "Source hidden"}
                </p>
              </div>
            ))}
            <Link href="/corporate/proposals" className="block pt-2 text-sm font-medium text-teal-700">
              Review proposals
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
