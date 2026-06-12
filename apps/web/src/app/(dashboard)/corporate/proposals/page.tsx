"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3Icon,
  BookOpenCheckIcon,
  CheckIcon,
  LibraryIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

const corporateNav = [
  { label: "Library", href: "/corporate/library", active: false, icon: LibraryIcon },
  { label: "Proposals", href: "/corporate/proposals", active: true, icon: BookOpenCheckIcon },
  { label: "Dashboard", href: "/corporate/dashboard", active: false, icon: BarChart3Icon },
] as const;

export default function CorporateProposalsPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: proposals = [], isLoading } = useQuery(trpc.lessonV2.listCorporateProposals.queryOptions());
  const approveProposal = useMutation(
    trpc.lessonV2.approveCorporateProposal.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.lessonV2.listCorporateProposals.queryOptions()),
          queryClient.invalidateQueries(trpc.lessonV2.listCorporateLibrary.queryOptions()),
          queryClient.invalidateQueries(trpc.lessonV2.corporateDashboard.queryOptions()),
        ]);
      },
    })
  );

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-teal-700">
          Corporate View
        </p>
        <h1 className="text-2xl font-semibold">Corporate Proposals</h1>
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

      <div className="grid gap-3 xl:grid-cols-2">
        {proposals.map((proposal) => (
          <Card key={proposal.id}>
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="secondary">{proposal.status.replace(/_/g, " ")}</Badge>
                <span className="text-xs text-muted-foreground">
                  {proposal.project?.name ?? "Source hidden"}
                </span>
              </div>
              <CardTitle className="text-base leading-snug">{proposal.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{proposal.actionDescription}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{proposal.category.name}</Badge>
                <Badge variant="outline">{proposal.reusabilityLevel.replace(/_/g, " ")}</Badge>
                <Badge variant="outline">{proposal.confidentialityLevel.replace(/_/g, " ")}</Badge>
              </div>
              {proposal.sourceLesson ? (
                <p className="text-xs text-muted-foreground">
                  Source lesson: {proposal.sourceLesson.title}
                </p>
              ) : null}
              {proposal.sourceCluster ? (
                <p className="text-xs text-muted-foreground">
                  Source cluster: {proposal.sourceCluster.name}
                </p>
              ) : null}
              <Button
                className="w-full"
                disabled={approveProposal.isPending}
                onClick={() =>
                  approveProposal.mutate({
                    projectId: proposal.projectId,
                    recommendedActionId: proposal.id,
                    originSummary:
                      proposal.sourceLesson?.title ?? proposal.sourceCluster?.name ?? proposal.title,
                  })
                }
              >
                <CheckIcon className="size-4" />
                Publish to Corporate Library
              </Button>
            </CardContent>
          </Card>
        ))}
        {!isLoading && proposals.length === 0 ? (
          <Card className="xl:col-span-2">
            <CardContent className="py-6 text-sm text-muted-foreground">
              No corporate proposals waiting for review.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
