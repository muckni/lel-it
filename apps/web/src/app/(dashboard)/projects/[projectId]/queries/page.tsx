"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PlusIcon, ArrowUpDownIcon } from "lucide-react";
import { QUERY_STATUSES, QUERY_PRIORITIES } from "@owit/shared";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

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

const createSchema = z.object({
  interfacePointId: z.string().uuid("Select an interface point"),
  raisedByPackageId: z.string().uuid("Select package"),
  assignedToPackageId: z.string().uuid("Select package"),
  subject: z.string().min(1).max(255),
  description: z.string().optional(),
  priority: z.enum(["urgent", "high", "medium", "low"]),
  dueDate: z.string().optional(),
});
type CreateFormValues = z.infer<typeof createSchema>;

type IQ = {
  id: string;
  code: string;
  subject: string;
  status: string;
  priority: string;
  dueDate: string | null;
  createdAt: Date;
  raisedByPackage: { code: string; color: string };
  assignedToPackage: { code: string; color: string };
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
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
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

  const { data: workPackages = [] } = useQuery(
    trpc.workPackage.list.queryOptions({ projectId })
  );

  // For point picker — gather all points via project registers
  const { data: registers = [] } = useQuery(
    trpc.register.list.queryOptions({ projectId })
  );

  const createMutation = useMutation(
    trpc.interfaceQuery.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.interfaceQuery.listByProject.queryOptions({ projectId })
        );
        setOpen(false);
        form.reset();
      },
    })
  );

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { priority: "medium" },
  });

  // Flatten all points from registers for the point selector
  const allPoints = useMemo(() => {
    return registers.flatMap((r) =>
      r.agreements.flatMap((a) =>
        (a.points ?? []).map((p) => ({
          ...p,
          agreementCode: a.code,
          registerCode: r.code,
        }))
      )
    );
  }, [registers]);

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
            className="cursor-pointer hover:underline font-medium text-sm"
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
          <span className="text-xs text-muted-foreground font-mono">
            {row.original.interfacePoint.code}
          </span>
        ),
      },
      {
        accessorKey: "priority",
        header: "Priority",
        cell: ({ row }) => (
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${priorityColors[row.getValue("priority") as string]}`}
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
            className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${statusColors[row.getValue("status") as string]}`}
          >
            {(row.getValue("status") as string).replace(/_/g, " ")}
          </span>
        ),
      },
      {
        id: "packages",
        header: "From → To",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: row.original.raisedByPackage.color }}
            />
            {row.original.raisedByPackage.code}
            <span className="mx-1">→</span>
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: row.original.assignedToPackage.color }}
            />
            {row.original.assignedToPackage.code}
          </span>
        ),
      },
      {
        accessorKey: "dueDate",
        header: "Due",
        cell: ({ row }) => {
          const d = row.getValue("dueDate") as string | null;
          return (
            <span className="text-xs text-muted-foreground">
              {d ? format(new Date(d), "dd MMM yyyy") : "—"}
            </span>
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

  function handleCreate(values: CreateFormValues) {
    createMutation.mutate({
      ...values,
      dueDate: values.dueDate || undefined,
      description: values.description || undefined,
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Interface Queries</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {iqs.length} quer{iqs.length !== 1 ? "ies" : "y"}
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <PlusIcon className="h-4 w-4 mr-1" />
          Raise IQ
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search queries…"
          className="h-8 max-w-xs"
          value={(table.getColumn("subject")?.getFilterValue() as string) ?? ""}
          onChange={(e) =>
            table.getColumn("subject")?.setFilterValue(e.target.value)
          }
        />
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v ?? "all")}
        >
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {QUERY_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={priorityFilter}
          onValueChange={(v) => setPriorityFilter(v ?? "all")}
        >
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue placeholder="All priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {QUERY_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p} className="capitalize">
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((h) => (
                    <TableHead key={h.id} className="text-xs">
                      {h.isPlaceholder
                        ? null
                        : flexRender(
                            h.column.columnDef.header,
                            h.getContext()
                          )}
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
                    className="text-center text-sm text-muted-foreground py-12"
                  >
                    No interface queries yet. Raise an IQ to start the workflow.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/30">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-2.5">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create IQ Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Raise Interface Query</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit(handleCreate)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Interface Point *</Label>
              <Select
                onValueChange={(v) =>
                  form.setValue("interfacePointId", v as string)
                }
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select interface point…" />
                </SelectTrigger>
                <SelectContent>
                  {allPoints.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.code} — {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.interfacePointId && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.interfacePointId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Subject *</Label>
              <Input
                placeholder="Clarification on flange bolt pattern"
                {...form.register("subject")}
              />
              {form.formState.errors.subject && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.subject.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Raised By *</Label>
                <Select
                  onValueChange={(v) =>
                    form.setValue("raisedByPackageId", v as string)
                  }
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Package…" />
                  </SelectTrigger>
                  <SelectContent>
                    {workPackages.map((wp) => (
                      <SelectItem key={wp.id} value={wp.id} className="text-xs">
                        {wp.code} – {wp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assigned To *</Label>
                <Select
                  onValueChange={(v) =>
                    form.setValue("assignedToPackageId", v as string)
                  }
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Package…" />
                  </SelectTrigger>
                  <SelectContent>
                    {workPackages.map((wp) => (
                      <SelectItem key={wp.id} value={wp.id} className="text-xs">
                        {wp.code} – {wp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  defaultValue="medium"
                  onValueChange={(v) =>
                    form.setValue(
                      "priority",
                      (v as typeof QUERY_PRIORITIES[number]) ?? "medium"
                    )
                  }
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUERY_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p} className="text-xs capitalize">
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input type="date" {...form.register("dueDate")} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea rows={3} {...form.register("description")} />
            </div>

            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Raising…" : "Raise IQ"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
