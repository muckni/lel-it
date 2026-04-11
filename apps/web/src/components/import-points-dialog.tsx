"use client";

import { useState, useRef } from "react";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UploadIcon, DownloadIcon, CheckCircle2Icon, AlertCircleIcon } from "lucide-react";
import { parseExcelFile } from "@/lib/excel";

interface Props {
  agreementId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// Expected columns (case-insensitive)
const COL_MAP: Record<string, string> = {
  title: "title",
  "interface point title": "title",
  description: "description",
  criticality: "criticality",
  phase: "phase",
  "due date": "dueDate",
  duedate: "dueDate",
};

function mapRow(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    const mapped = COL_MAP[key.toLowerCase().trim()];
    if (mapped && value != null) {
      out[mapped] = String(value).trim();
    }
  }
  return out;
}

export function ImportPointsDialog({ agreementId, open, onOpenChange, onSuccess }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const bulkCreate = useMutation(
    trpc.interfacePoint.bulkCreate.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.interfacePoint.list.queryOptions({ agreementId })
        );
        setPreview([]);
        onSuccess();
        onOpenChange(false);
      },
    })
  );

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    try {
      const rows = await parseExcelFile(file);
      const mapped = rows.map(mapRow).filter((r) => r.title);
      if (mapped.length === 0) {
        setParseError('No rows with a "Title" column found. Check your file format.');
        return;
      }
      setPreview(mapped);
    } catch {
      setParseError("Failed to parse file. Make sure it is a valid .xlsx file.");
    }
  }

  function handleImport() {
    bulkCreate.mutate({
      agreementId,
      rows: preview.map((r) => ({
        title: r.title,
        description: r.description || undefined,
        criticality: (r.criticality?.toLowerCase() as any) || undefined,
        phase: (r.phase?.toLowerCase().replace(/ /g, "_") as any) || undefined,
        dueDate: r.dueDate || undefined,
      })),
    });
  }

  function downloadTemplate() {
    import("@/lib/excel").then(({ exportToExcel }) => {
      exportToExcel(
        [
          {
            Title: "Tower flange bolt pattern interface",
            Description: "Defines the bolt pattern at the tower-to-TP flange",
            Criticality: "critical",
            Phase: "detailed_design",
            "Due Date": "2025-06-30",
          },
          {
            Title: "Cable hang-off arrangement",
            Description: "",
            Criticality: "major",
            Phase: "installation",
            "Due Date": "",
          },
        ],
        "interface-points-import-template"
      );
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setPreview([]); setParseError(null); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Interface Points from Excel</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <DownloadIcon className="h-3.5 w-3.5 mr-1" /> Download Template
            </Button>
            <span className="text-xs text-muted-foreground">
              Required column: <code className="bg-muted px-1 rounded">Title</code>. Optional: Description, Criticality, Phase, Due Date.
            </span>
          </div>

          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <UploadIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Click to upload .xlsx file</p>
            <p className="text-xs text-muted-foreground mt-1">or drag and drop</p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFile}
            />
          </div>

          {parseError && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircleIcon className="h-4 w-4 shrink-0" />
              {parseError}
            </div>
          )}

          {preview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-700 text-sm">
                <CheckCircle2Icon className="h-4 w-4" />
                {preview.length} row{preview.length !== 1 ? "s" : ""} ready to import
              </div>
              <div className="rounded-lg border overflow-auto max-h-48">
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Title</th>
                      <th className="text-left px-3 py-2 font-medium">Criticality</th>
                      <th className="text-left px-3 py-2 font-medium">Phase</th>
                      <th className="text-left px-3 py-2 font-medium">Due Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.slice(0, 10).map((row, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5 truncate max-w-[200px]">{row.title}</td>
                        <td className="px-3 py-1.5 capitalize">{row.criticality || "—"}</td>
                        <td className="px-3 py-1.5">{row.phase?.replace(/_/g, " ") || "—"}</td>
                        <td className="px-3 py-1.5">{row.dueDate || "—"}</td>
                      </tr>
                    ))}
                    {preview.length > 10 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-1.5 text-muted-foreground text-center">
                          +{preview.length - 10} more rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <Button onClick={handleImport} disabled={bulkCreate.isPending}>
                {bulkCreate.isPending ? "Importing…" : `Import ${preview.length} Points`}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
