"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTRPC } from "@/trpc/client";

type Section = "cases" | "matrix" | "tracker" | "moc" | "reports";

export default function InterfacesWorkspacePage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [section, setSection] = useState<Section>("cases");
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  const { data: revisions = [] } = useQuery(
    trpc.interfaceMatrix.listRevisions.queryOptions({ projectId })
  );
  const activeRevisionId = selectedRevisionId ?? revisions[0]?.id ?? null;

  const { data: overview } = useQuery(
    trpc.interfaceWorkspace.getOverview.queryOptions({
      projectId,
      revisionId: activeRevisionId ?? undefined,
    })
  );

  const { data: cases = [] } = useQuery(
    trpc.interfaceCase.listCases.queryOptions({ projectId, onlyOpen: false, limit: 300 })
  );
  const filteredCases = useMemo(() => {
    if (!search.trim()) return cases;
    const q = search.trim().toLowerCase();
    return cases.filter((row: any) => String(row.title ?? "").toLowerCase().includes(q));
  }, [cases, search]);

  const { data: matrixRows = [] } = useQuery(
    trpc.interfaceMatrix.listRows.queryOptions({
      projectId,
      revisionId: activeRevisionId ?? undefined,
    })
  );

  const { data: trackerItems = [] } = useQuery(
    trpc.interfaceTracker.listItems.queryOptions({ projectId, limit: 200 })
  );

  const { data: mocs = [] } = useQuery(
    trpc.moc.listByProject.queryOptions({ projectId })
  );

  const { data: reportSnapshot } = useQuery(
    trpc.interfaceReport.complianceKpis.queryOptions({ projectId })
  );

  const forwardMutation = useMutation(
    trpc.interfaceCase.forward.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.interfaceCase.listCases.queryOptions({ projectId, onlyOpen: false, limit: 300 })
        );
      },
    })
  );
  const answerMutation = useMutation(
    trpc.interfaceCase.answerDir.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.interfaceCase.listCases.queryOptions({ projectId, onlyOpen: false, limit: 300 })
        );
      },
    })
  );
  const closeMutation = useMutation(
    trpc.interfaceCase.closeCase.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.interfaceCase.listCases.queryOptions({ projectId, onlyOpen: false, limit: 300 })
        );
      },
    })
  );

  const selectedCase = filteredCases.find((row: any) => row.id === selectedCaseId) as any;

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Interfaces Workspace</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Active Revision</Label>
            <Select value={activeRevisionId ?? ""} onValueChange={(v) => setSelectedRevisionId(v)}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Select revision" />
              </SelectTrigger>
              <SelectContent>
                {revisions.map((revision) => (
                  <SelectItem key={revision.id} value={revision.id}>
                    {revision.revisionLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Open Cases</Label>
            <p className="text-2xl font-semibold">{overview?.counters.openCases ?? 0}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Overdue SLA</Label>
            <p className="text-2xl font-semibold text-red-700">
              {overview?.counters.overdueCases ?? 0}
            </p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Quick Actions</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                href={`/projects/${projectId}/cases`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Open Cases
              </Link>
              <Link
                href={`/projects/${projectId}/matrix`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Open Matrix
              </Link>
              <Link
                href={`/projects/${projectId}/tracker`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Open Tracker
              </Link>
              <Link
                href={`/projects/${projectId}/moc`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Open MOC
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {(overview?.blockingIssues.length ?? 0) > 0 && (
        <Card className="border-amber-300 bg-amber-50/40">
          <CardHeader>
            <CardTitle className="text-base text-amber-900">
              Blocking Matrix Validation Issues ({overview?.blockingIssues.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {overview?.blockingIssues.slice(0, 8).map((issue, idx) => (
              <p key={`${issue.rowId}-${idx}`} className="text-amber-900">
                {issue.message}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs value={section} onValueChange={(value) => setSection(value as Section)}>
        <TabsList>
          <TabsTrigger value="cases">Cases</TabsTrigger>
          <TabsTrigger value="matrix">Matrix</TabsTrigger>
          <TabsTrigger value="tracker">Tracker</TabsTrigger>
          <TabsTrigger value="moc">MOC</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
      </Tabs>

      {section === "cases" && (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Case Workspace</CardTitle>
              <Input
                placeholder="Search case title"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 max-w-sm"
              />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>SLA</TableHead>
                    <TableHead className="w-[220px]">Action Rail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCases.map((row: any) => (
                    <TableRow
                      key={row.id}
                      className={selectedCaseId === row.id ? "bg-accent/40" : ""}
                      onClick={() => setSelectedCaseId(row.id)}
                    >
                      <TableCell>{row.title}</TableCell>
                      <TableCell>{row.current_state ?? row.currentState}</TableCell>
                      <TableCell>{row.sla_due_at ?? row.slaDueAt ?? "-"}</TableCell>
                      <TableCell className="space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            forwardMutation.mutate({ caseId: row.id });
                          }}
                        >
                          Forward
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            answerMutation.mutate({
                              caseId: row.id,
                              answer: "Answer recorded via workspace",
                            });
                          }}
                        >
                          Answer
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            closeMutation.mutate({ caseId: row.id });
                          }}
                        >
                          Close
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Case Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {!selectedCase && <p className="text-muted-foreground">Select a case to inspect.</p>}
              {selectedCase && (
                <>
                  <p className="font-medium">{selectedCase.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Source: {selectedCase.source_entity_type ?? selectedCase.sourceEntityType ?? "-"}
                    </p>
                  <div className="space-y-2 pt-2">
                    <div className="rounded border p-2">
                      <p className="font-mono text-xs">
                        {selectedCase.current_state ?? selectedCase.currentState}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Created {new Date(selectedCase.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="rounded border p-2">
                      <p className="font-mono text-xs">SLA Due</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedCase.sla_due_at ?? selectedCase.slaDueAt ?? "-"}
                      </p>
                    </div>
                    <div className="rounded border p-2">
                      <p className="font-mono text-xs">Responsible</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedCase.responsible_party ?? selectedCase.responsibleParty ?? "-"}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {section === "matrix" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Matrix Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Rows in revision: {matrixRows.length}
            </p>
            <p className="text-sm text-muted-foreground">
              Blocking issues: {overview?.blockingIssues.length ?? 0}
            </p>
            <Link
              href={`/projects/${projectId}/matrix`}
              className={buttonVariants({ size: "sm" })}
            >
              Open Full Matrix Editor
            </Link>
          </CardContent>
        </Card>
      )}

      {section === "tracker" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tracker Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Items: {trackerItems.length}</p>
            <div className="space-y-2">
              {trackerItems.slice(0, 8).map((item) => (
                <div key={item.id} className="rounded border p-2 text-sm">
                  <p className="font-mono text-xs">{item.externalId}</p>
                  <p>{item.sectionTitle ?? "-"}</p>
                </div>
              ))}
            </div>
            <Link
              href={`/projects/${projectId}/tracker`}
              className={buttonVariants({ size: "sm" })}
            >
              Open Full Tracker
            </Link>
          </CardContent>
        </Card>
      )}

      {section === "moc" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">MOC Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {mocs.slice(0, 10).map((moc) => (
              <div key={moc.id} className="flex items-center justify-between rounded border p-2 text-sm">
                <span className="font-mono">{moc.mocId}</span>
                <span>{moc.status}</span>
              </div>
            ))}
            {mocs.length === 0 && <p className="text-sm text-muted-foreground">No MOC entries yet.</p>}
            <Link
              href={`/projects/${projectId}/moc`}
              className={buttonVariants({ size: "sm" })}
            >
              Open Full MOC Workspace
            </Link>
          </CardContent>
        </Card>
      )}

      {section === "reports" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Interface Reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Total cases: {reportSnapshot?.totalCases ?? 0}</p>
            <p>Open cases: {reportSnapshot?.openCases ?? 0}</p>
            <p>SLA breaches: {reportSnapshot?.slaBreaches ?? 0}</p>
            <p>Average cycle time (days): {reportSnapshot?.avgCycleTimeDays ?? 0}</p>
            <Link
              href={`/projects/${projectId}/reports`}
              className={buttonVariants({ size: "sm" })}
            >
              Open Reports
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
