"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusIcon, ArrowUpDownIcon, DownloadIcon } from "lucide-react";
import { exportInterfaceQueries } from "@/lib/excel";
import { QUERY_STATUSES, QUERY_PRIORITIES } from "@owit/shared";
import { format } from "date-fns";
import { DeadlineBadge, getDeadlineRowClassName } from "@/components/deadlines/deadline-badge";
import { TquWizard } from "@/components/wizards/tqu-wizard";

const priorityColors: Record<string, string> = {
  urgent: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-blue-100 text-blue-800",
  low: "bg-gray-100 text-gray-600",
};

const statusColors: Record<string, string> = {
  open: "bg-amber-100 text-amber-800",
  responded: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  closed: "bg-gray-100 text-gray-600",
};

type IQ = {
  id: string;
  code: string;
  subject: string;
  status: string;
  priority: string;
  dueDate: string | null;
  createdAt: Date;
  raisedByPackage: { code: string; name: string; color: string };
  assignedToPackage: { code: string; name: string; color: string };
  responses: unknown[];
  interfacePoint: {
    code: string;
    agreement: {
      code: string;
      register: { code: string };
    };
  };
};

export default function QueriesPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const trpc = useTRPC();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sorting, setSorting] = useState<SortingState>([]);

  const { data: iqs = [], isLoading } = useQuery(
    trpc.interfaceQuery.listByProject.queryOptions({
      projectId,
      status: statusFilter !== "all" ? statusFilter : undefined,
      priority: priorityFilter !== "all" ? priorityFilter : undefined,
    })
  );

  const columns = useMemo<ColumnDef<IQ>[]>(
    () => [
      {
        accessorKey: "code",
        header: "Code",
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.getValue("code")}</span>
        ),
      },
      {
        accessorKey: "subject",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-foreground"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Subject <ArrowUpDownIcon className="h-3.5 w-3.5" />
          </button>
        ),
        cell: ({ row }) => (
          <span
            className="cursor-pointer text-sm font-medium hover:underline"
            onClick={() =>
              router.push(`/projects/${projectId}/queries/${row.original.id}`)
            }
          >
            {row.getValue("subject")}
          </span>
        ),
      },
      {
        id: "interfacePoint",
        header: "Interface Point",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.interfacePoint.code}
          </span>
        ),
      },
      {
        accessorKey: "priority",
        header: "Priority",
        cell: ({ row }) => (
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${priorityColors[row.getValue("priority") as string]}`}
          >
            {row.getValue("priority") as string}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${statusColors[row.getValue("status") as string]}`}
          >
            {(row.getValue("status") as string).replace(/_/g, " ")}
          </span>
        ),
      },
      {
        id: "packages",
        header: "RP → PP",
        cell: ({ row }) => (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: row.original.raisedByPackage.color }}
            />
            {row.original.raisedByPackage.code} — {row.original.raisedByPackage.name ?? "Unknown package"}
            <span className="mx-1">→</span>
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: row.original.assignedToPackage.color }}
            />
            {row.original.assignedToPackage.code} — {row.original.assignedToPackage.name ?? "Unknown package"}
          </span>
        ),
      },
      {
        accessorKey: "dueDate",
        header: "Due",
        cell: ({ row }) => {
          const dueDate = row.getValue("dueDate") as string | null;
          return (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">
                {dueDate ? format(new Date(dueDate), "dd MMM yyyy") : "—"}
              </span>
              <DeadlineBadge dueDate={dueDate} entityType="iq" status={row.original.status} />
            </div>
          );
        },
      },
      {
        id: "responses",
        header: "Responses",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {(row.original.responses as unknown[]).length}
          </span>
        ),
      },
    ],
    [router, projectId]
  );

  const table = useReactTable({
    data: iqs as IQ[],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">TQU / DIR Queries</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {iqs.length} quer{iqs.length !== 1 ? "ies" : "y"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => exportInterfaceQueries(iqs as any[], projectId)}
            disabled={iqs.length === 0}
          >
            <DownloadIcon className="mr-1 h-4 w-4" /> Export
          </Button>
          <Button onClick={() => setWizardOpen(true)}>
            <PlusIcon className="mr-1 h-4 w-4" />
            Create TQU / DIR
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Input
          placeholder="Search queries..."
          className="h-8 max-w-xs"
          value={(table.getColumn("subject")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("subject")?.setFilterValue(event.target.value)
          }
        />
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? "all")}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {QUERY_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value ?? "all")}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue placeholder="All priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {QUERY_PRIORITIES.map((priority) => (
              <SelectItem key={priority} value={priority} className="capitalize">
                {priority}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="text-xs">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    No interface queries yet. Create a TQU / DIR to start the workflow.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={`hover:bg-muted/30 ${getDeadlineRowClassName(
                      row.original.dueDate,
                      "iq",
                      row.original.status
                    )}`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-2.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <TquWizard
        projectId={projectId}
        open={wizardOpen}
        onOpenChange={setWizardOpen}
      />
    </div>
  );
}
