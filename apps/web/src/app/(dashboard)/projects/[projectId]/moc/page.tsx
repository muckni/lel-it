"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MOC_IMPLEMENTATION_STATUSES, MOC_STATUSES } from "@owit/shared";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useTRPC } from "@/trpc/client";

export default function MocPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [form, setForm] = useState({
    mocId: "",
    title: "",
    description: "",
    costImpactEur: "",
    scheduleImpact: false,
    hseqImpact: false,
  });

  const { data: mocs = [] } = useQuery(
    trpc.moc.listByProject.queryOptions({
      projectId,
      status: statusFilter === "all" ? undefined : (statusFilter as any),
    })
  );

  const createMutation = useMutation(
    trpc.moc.create.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.moc.listByProject.queryOptions({
            projectId,
            status: statusFilter === "all" ? undefined : (statusFilter as any),
          })
        );
      },
    })
  );

  const startApprovalMutation = useMutation(
    trpc.moc.startApproval.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.moc.listByProject.queryOptions({
            projectId,
            status: statusFilter === "all" ? undefined : (statusFilter as any),
          })
        );
      },
    })
  );

  const implementationMutation = useMutation(
    trpc.moc.setImplementationStatus.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.moc.listByProject.queryOptions({
            projectId,
            status: statusFilter === "all" ? undefined : (statusFilter as any),
          })
        );
      },
    })
  );

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-bold">Management of Change (MOC)</h1>
        <p className="text-sm text-muted-foreground">
          Capture change records, route approvals, and monitor implementation/audit status.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create MOC</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>MOC ID</Label>
            <Input
              value={form.mocId}
              onChange={(event) => setForm((prev) => ({ ...prev, mocId: event.target.value }))}
              placeholder="e.g. MOC-2135"
            />
          </div>
          <div className="space-y-1">
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Change title"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Description</Label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>Cost Impact (EUR)</Label>
            <Input
              type="number"
              value={form.costImpactEur}
              onChange={(event) => setForm((prev) => ({ ...prev, costImpactEur: event.target.value }))}
            />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.scheduleImpact}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, scheduleImpact: event.target.checked }))
                }
              />
              Schedule impact
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.hseqImpact}
                onChange={(event) => setForm((prev) => ({ ...prev, hseqImpact: event.target.checked }))}
              />
              HSEQ impact
            </label>
          </div>
          <div className="sm:col-span-2">
            <Button
              onClick={() => {
                createMutation.mutate({
                  projectId,
                  mocId: form.mocId,
                  title: form.title,
                  description: form.description || undefined,
                  costImpactEur: form.costImpactEur ? Number(form.costImpactEur) : undefined,
                  scheduleImpact: form.scheduleImpact,
                  hseqImpact: form.hseqImpact,
                });
                setForm({
                  mocId: "",
                  title: "",
                  description: "",
                  costImpactEur: "",
                  scheduleImpact: false,
                  hseqImpact: false,
                });
              }}
              disabled={!form.mocId || !form.title}
            >
              Save MOC
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">MOC Register</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value ?? "all")}
          >
            <SelectTrigger className="w-48 h-8">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {MOC_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>MOC</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cost EUR</TableHead>
                <TableHead>Implementation</TableHead>
                <TableHead className="w-[260px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mocs.map((moc) => (
                <TableRow key={moc.id}>
                  <TableCell className="font-mono text-xs">{moc.mocId}</TableCell>
                  <TableCell>{moc.title}</TableCell>
                  <TableCell>{moc.status}</TableCell>
                  <TableCell>{moc.costImpactEur ?? "-"}</TableCell>
                  <TableCell>
                    <Select
                      value={moc.implementationStatus}
                      onValueChange={(status) =>
                        implementationMutation.mutate({
                          mocChangeId: moc.id,
                          implementationStatus: status as any,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MOC_IMPLEMENTATION_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={moc.status !== "draft" && moc.status !== "postponed"}
                      onClick={() => startApprovalMutation.mutate({ mocChangeId: moc.id })}
                    >
                      Start Approval
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {mocs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No MOC records available.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
