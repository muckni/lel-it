"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MATRIX_SCOPE_COLUMNS } from "@owit/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

type AllocationDraft = Record<string, string>;

function parseAllocationInput(input: string) {
  return input
    .split(/[,\n;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, index) => {
      const isNotRelevant = /^n\.r\.?$/i.test(entry);
      const isResponsible = /\(r\)/i.test(entry);
      const code = entry.replace(/\(r\)/gi, "").trim();
      return { code, isResponsible, isNotRelevant, sortOrder: index };
    });
}

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

export default function MatrixPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [newRevision, setNewRevision] = useState("R01");
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null);
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false);
  const [allocationRowId, setAllocationRowId] = useState<string | null>(null);
  const [allocationDraft, setAllocationDraft] = useState<AllocationDraft>(() =>
    Object.fromEntries(MATRIX_SCOPE_COLUMNS.map((phase) => [phase, ""]))
  );

  const [newRow, setNewRow] = useState({
    interfaceId: "",
    interfaceComponent: "",
    description: "",
  });

  const { data: revisions = [] } = useQuery(
    trpc.interfaceMatrix.listRevisions.queryOptions({ projectId })
  );

  const activeRevisionId = selectedRevisionId ?? revisions[0]?.id ?? null;

  const { data: stakeholders = [] } = useQuery(
    trpc.interfaceMatrix.listStakeholders.queryOptions({ projectId })
  );

  const stakeholderByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const org of stakeholders) {
      if (org.abbreviation) map.set(org.abbreviation.toLowerCase(), org.id);
      map.set(org.name.toLowerCase(), org.id);
    }
    return map;
  }, [stakeholders]);

  const { data: rows = [] } = useQuery(
    trpc.interfaceMatrix.listRows.queryOptions({
      projectId,
      revisionId: activeRevisionId ?? undefined,
    })
  );

  const { data: packs = [] } = useQuery(
    trpc.interfaceMatrix.listPacks.queryOptions({ revisionId: activeRevisionId ?? undefined })
  );

  const createRevisionMutation = useMutation(
    trpc.interfaceMatrix.createRevision.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.interfaceMatrix.listRevisions.queryOptions({ projectId }));
      },
    })
  );

  const publishMutation = useMutation(
    trpc.interfaceMatrix.publishRevision.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.interfaceMatrix.listRevisions.queryOptions({ projectId }));
      },
    })
  );

  const lockMutation = useMutation(
    trpc.interfaceMatrix.lockRevision.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.interfaceMatrix.listRevisions.queryOptions({ projectId }));
      },
    })
  );

  const createRowMutation = useMutation(
    trpc.interfaceMatrix.upsertRow.mutationOptions({
      onSuccess: async () => {
        if (!activeRevisionId) return;
        await queryClient.invalidateQueries(
          trpc.interfaceMatrix.listRows.queryOptions({ projectId, revisionId: activeRevisionId })
        );
      },
    })
  );

  const updateAllocationsMutation = useMutation(
    trpc.interfaceMatrix.upsertAllocations.mutationOptions({
      onSuccess: async () => {
        if (!activeRevisionId) return;
        await queryClient.invalidateQueries(
          trpc.interfaceMatrix.listRows.queryOptions({ projectId, revisionId: activeRevisionId })
        );
      },
    })
  );

  const importMutation = useMutation(
    trpc.interfaceMatrix.importFromTemplate.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.interfaceMatrix.listRows.queryOptions({
            projectId,
            revisionId: activeRevisionId ?? undefined,
          })
        );
        await queryClient.invalidateQueries(trpc.interfaceMatrix.listRevisions.queryOptions({ projectId }));
      },
    })
  );

  const generatePackMutation = useMutation(
    trpc.interfaceMatrix.generatePack.mutationOptions({
      onSuccess: async () => {
        if (!activeRevisionId) return;
        await queryClient.invalidateQueries(
          trpc.interfaceMatrix.listPacks.queryOptions({ revisionId: activeRevisionId })
        );
      },
    })
  );

  const downloadPackMutation = useMutation(trpc.interfaceMatrix.downloadPack.mutationOptions());

  async function handleTemplateImport(file: File) {
    const workbookBase64 = await fileToBase64(file);
    importMutation.mutate({
      projectId,
      revisionId: activeRevisionId ?? undefined,
      revisionLabel: activeRevisionId ? undefined : newRevision,
      workbookBase64,
    });
  }

  function openAllocationEditor(rowId: string) {
    const row = rows.find((item: any) => item.id === rowId);
    if (!row) return;

    const nextDraft: AllocationDraft = Object.fromEntries(
      MATRIX_SCOPE_COLUMNS.map((phase) => {
        const values = row.allocations
          .filter((allocation: any) => allocation.phaseColumn === phase)
          .map((allocation: any) => {
            if (allocation.isNotRelevant) return "n.r.";
            const org = stakeholders.find((entry) => entry.id === allocation.organizationId);
            const base = org?.abbreviation || org?.name || "";
            return `${base}${allocation.isResponsible ? " (R)" : ""}`;
          })
          .filter(Boolean)
          .join("\n");
        return [phase, values];
      })
    );

    setAllocationDialogOpen(true);
    setAllocationRowId(rowId);
    setAllocationDraft(nextDraft);
  }

  function saveAllocations() {
    if (!allocationRowId) return;

    const allocations = MATRIX_SCOPE_COLUMNS.flatMap((phase) =>
      parseAllocationInput(allocationDraft[phase] ?? "").map((entry) => ({
        phaseColumn: phase,
        organizationId: entry.isNotRelevant ? null : stakeholderByCode.get(entry.code.toLowerCase()) ?? null,
        isResponsible: entry.isResponsible,
        isNotRelevant: entry.isNotRelevant,
        sortOrder: entry.sortOrder,
      }))
    );

    updateAllocationsMutation.mutate({
      rowId: allocationRowId,
      allocations,
    });

    setAllocationDialogOpen(false);
    setAllocationRowId(null);
  }

  const activeRevision = revisions.find((item) => item.id === activeRevisionId);

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Interface Matrix</h1>
          <p className="text-sm text-muted-foreground">
            Govern revisions, allocations, and export packs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={newRevision}
            onChange={(event) => setNewRevision(event.target.value)}
            className="w-36 h-8"
            placeholder="Revision"
          />
          <Button
            size="sm"
            onClick={() => createRevisionMutation.mutate({ projectId, revisionLabel: newRevision })}
          >
            Create Revision
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revision Controls</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Select value={activeRevisionId ?? ""} onValueChange={(value) => setSelectedRevisionId(value)}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select revision" />
            </SelectTrigger>
            <SelectContent>
              {revisions.map((revision) => (
                <SelectItem key={revision.id} value={revision.id}>
                  {revision.revisionLabel} {revision.isLocked ? "(Locked)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            disabled={!activeRevisionId}
            onClick={() => activeRevisionId && publishMutation.mutate({ revisionId: activeRevisionId })}
          >
            Publish
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!activeRevisionId || !!activeRevision?.isLocked}
            onClick={() =>
              activeRevisionId && lockMutation.mutate({ revisionId: activeRevisionId, isLocked: true })
            }
          >
            Lock
          </Button>
          <Button
            size="sm"
            disabled={!activeRevisionId}
            onClick={() => activeRevisionId && generatePackMutation.mutate({ revisionId: activeRevisionId })}
          >
            Generate XLSX + PDF Pack
          </Button>

          <Label className="ml-3 text-xs text-muted-foreground">Import template:</Label>
          <Input
            type="file"
            accept=".xlsx"
            className="h-8 w-auto"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleTemplateImport(file);
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Matrix Row</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3">
          <Input
            placeholder="Interface ID"
            value={newRow.interfaceId}
            onChange={(event) => setNewRow((prev) => ({ ...prev, interfaceId: event.target.value }))}
          />
          <Input
            placeholder="Interface component"
            value={newRow.interfaceComponent}
            onChange={(event) => setNewRow((prev) => ({ ...prev, interfaceComponent: event.target.value }))}
          />
          <Input
            placeholder="Description"
            value={newRow.description}
            onChange={(event) => setNewRow((prev) => ({ ...prev, description: event.target.value }))}
          />
          <div className="sm:col-span-3">
            <Button
              size="sm"
              disabled={!activeRevisionId || !newRow.interfaceId || !newRow.interfaceComponent}
              onClick={() => {
                if (!activeRevisionId) return;
                createRowMutation.mutate({
                  revisionId: activeRevisionId,
                  interfaceId: newRow.interfaceId,
                  interfaceComponent: newRow.interfaceComponent,
                  description: newRow.description || undefined,
                });
                setNewRow({ interfaceId: "", interfaceComponent: "", description: "" });
              }}
            >
              Save Row
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Matrix Rows</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Component</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[180px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row: any) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.interfaceId}</TableCell>
                  <TableCell>{row.interfaceComponent}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{row.description ?? "-"}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => openAllocationEditor(row.id)}>
                      Edit Allocations
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground text-sm">
                    No rows in this revision.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generated Packs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {packs.map((pack) => (
            <div key={pack.id} className="flex items-center justify-between rounded border p-2 text-sm">
              <span>{new Date(pack.generatedAt).toLocaleString()}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const urls = await downloadPackMutation.mutateAsync({ packId: pack.id });
                  window.open(urls.xlsxUrl, "_blank");
                  window.open(urls.pdfUrl, "_blank");
                }}
              >
                Download
              </Button>
            </div>
          ))}
          {packs.length === 0 && <p className="text-sm text-muted-foreground">No pack generated yet.</p>}
        </CardContent>
      </Card>

      <Dialog open={allocationDialogOpen} onOpenChange={setAllocationDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Allocations</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {MATRIX_SCOPE_COLUMNS.map((phase) => (
              <div key={phase} className="space-y-1">
                <Label className="uppercase text-xs">{phase.replace("_", "-")}</Label>
                <Textarea
                  rows={3}
                  value={allocationDraft[phase] ?? ""}
                  onChange={(event) =>
                    setAllocationDraft((prev) => ({
                      ...prev,
                      [phase]: event.target.value,
                    }))
                  }
                  placeholder="Use stakeholder abbreviations, add (R) for responsible, n.r. for not relevant"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAllocationDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveAllocations}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
