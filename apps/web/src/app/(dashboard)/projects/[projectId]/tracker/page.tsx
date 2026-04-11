"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TRACKER_ITEM_STATUSES } from "@owit/shared";
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
import { useTRPC } from "@/trpc/client";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function TrackerPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: items = [] } = useQuery(
    trpc.interfaceTracker.listItems.queryOptions({
      projectId,
      status: statusFilter === "all" ? undefined : (statusFilter as any),
      search: search || undefined,
      limit: 500,
    })
  );

  const importMutation = useMutation(
    trpc.interfaceTracker.importWorkbook.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.interfaceTracker.listItems.queryOptions({
            projectId,
            status: statusFilter === "all" ? undefined : (statusFilter as any),
            search: search || undefined,
            limit: 500,
          })
        );
      },
    })
  );

  const statusMutation = useMutation(
    trpc.interfaceTracker.updateStatus.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.interfaceTracker.listItems.queryOptions({
            projectId,
            status: statusFilter === "all" ? undefined : (statusFilter as any),
            search: search || undefined,
            limit: 500,
          })
        );
      },
    })
  );

  const promoteMutation = useMutation(
    trpc.interfaceTracker.promoteToCase.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.interfaceTracker.listItems.queryOptions({
            projectId,
            status: statusFilter === "all" ? undefined : (statusFilter as any),
            search: search || undefined,
            limit: 500,
          })
        );
        await queryClient.invalidateQueries(trpc.interfaceCase.listCases.queryOptions({ projectId }));
      },
    })
  );

  async function handleImport(file: File) {
    const workbookBase64 = await fileToBase64(file);
    importMutation.mutate({
      projectId,
      workbookBase64,
      sourceWorkbook: file.name,
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-bold">Interface Tracker</h1>
        <p className="text-sm text-muted-foreground">
          Import legacy tracker workbooks and promote actions into governed interface cases.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import Tracker Workbook</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Label className="text-sm">Workbook (.xlsx)</Label>
          <Input
            type="file"
            accept=".xlsx"
            className="h-8 w-auto"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleImport(file);
            }}
          />
          <span className="text-xs text-muted-foreground">
            {importMutation.isPending ? "Importing..." : ""}
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tracker Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              className="h-8 max-w-xs"
              placeholder="Search tracker items"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value ?? "all")}
            >
              <SelectTrigger className="w-48 h-8">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {TRACKER_ITEM_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="w-[220px]">Manage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.externalId}</TableCell>
                  <TableCell>{item.sectionTitle ?? "-"}</TableCell>
                  <TableCell>
                    <Select
                      value={item.status}
                      onValueChange={(status) =>
                        statusMutation.mutate({
                          trackerItemId: item.id,
                          status: status as any,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TRACKER_ITEM_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="max-w-[360px] truncate text-sm text-muted-foreground">
                    {item.actionText ?? "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.dueDate ?? item.dueTextRaw ?? "-"}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => promoteMutation.mutate({ trackerItemId: item.id })}
                    >
                      Promote to Case
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No tracker items found.
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
