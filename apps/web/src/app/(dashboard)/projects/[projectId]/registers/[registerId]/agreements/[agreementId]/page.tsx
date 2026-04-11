"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { InterfacePointForm, type InterfacePointFormValues } from "@/components/forms/interface-point-form";
import { PointStatusBadge, CriticalityBadge } from "@/components/status-badge";
import { PlusIcon, ArrowUpDownIcon } from "lucide-react";
import { CRITICALITIES, POINT_STATUSES } from "@owit/shared";
import { format } from "date-fns";

type Point = {
  id: string;
  code: string;
  title: string;
  status: string;
  criticality: string;
  phase: string | null;
  dueDate: string | null;
  queries: unknown[];
  deliverables: unknown[];
};

export default function AgreementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const registerId = params.registerId as string;
  const agreementId = params.agreementId as string;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [criticalityFilter, setCriticalityFilter] = useState<string>("all");

  const { data: agreement, isLoading } = useQuery(
    trpc.agreement.getById.queryOptions({ id: agreementId })
  );

  const { data: points = [] } = useQuery(
    trpc.interfacePoint.list.queryOptions({ agreementId })
  );

  const createMutation = useMutation(
    trpc.interfacePoint.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.interfacePoint.list.queryOptions({ agreementId }));
        setOpen(false);
      },
    })
  );

  const updateMutation = useMutation(
    trpc.interfacePoint.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.interfacePoint.list.queryOptions({ agreementId }));
      },
    })
  );

  const filteredPoints = useMemo(() => {
    return points.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (criticalityFilter !== "all" && p.criticality !== criticalityFilter) return false;
      return true;
    });
  }, [points, statusFilter, criticalityFilter]);

  const columns = useMemo<ColumnDef<Point>[]>(
    () => [
      {
        accessorKey: "code",
        header: "Code",
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.getValue("code")}</span>
        ),
      },
      {
        accessorKey: "title",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-foreground"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Title <ArrowUpDownIcon className="h-3.5 w-3.5" />
          </button>
        ),
        cell: ({ row }) => (
          <span
            className="cursor-pointer hover:underline font-medium text-sm"
            onClick={() =>
              router.push(
                `/projects/${projectId}/registers/${registerId}/agreements/${agreementId}/points/${row.original.id}`
              )
            }
          >
            {row.getValue("title")}
          </span>
        ),
      },
      {
        accessorKey: "criticality",
        header: "Criticality",
        cell: ({ row }) => (
          <CriticalityBadge criticality={row.getValue("criticality") as any} />
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Select
            defaultValue={row.getValue("status")}
            onValueChange={(v) =>
              updateMutation.mutate({ id: row.original.id, status: v as any })
            }
          >
            <SelectTrigger className="h-7 text-xs w-32 border-0 bg-transparent p-0">
              <PointStatusBadge status={row.getValue("status") as any} />
            </SelectTrigger>
            <SelectContent>
              {POINT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  <PointStatusBadge status={s} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ),
      },
      {
        accessorKey: "phase",
        header: "Phase",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground capitalize">
            {(row.getValue("phase") as string)?.replace(/_/g, " ") ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "dueDate",
        header: "Due Date",
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
        id: "queries",
        header: "IQs",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {(row.original.queries as unknown[]).length}
          </span>
        ),
      },
    ],
    [router, projectId, registerId, agreementId, updateMutation]
  );

  const table = useReactTable({
    data: filteredPoints as Point[],
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  function handleCreate(values: InterfacePointFormValues) {
    createMutation.mutate({ agreementId, ...values });
  }

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!agreement) return <div className="p-6 text-sm text-destructive">Agreement not found.</div>;

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href={`/projects/${projectId}/registers`}>Registers</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href={`/projects/${projectId}/registers/${registerId}`}>
                  {agreement.register.code}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{agreement.code}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{agreement.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {agreement.code}
              {agreement.discipline && ` · ${agreement.discipline.replace(/_/g, " ")}`}
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button><PlusIcon className="h-4 w-4 mr-1" />New Interface Point</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Interface Point</DialogTitle>
              </DialogHeader>
              <InterfacePointForm onSubmit={handleCreate} isLoading={createMutation.isPending} />
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <Input
            placeholder="Search points…"
            className="h-8 max-w-xs"
            value={(table.getColumn("title")?.getFilterValue() as string) ?? ""}
            onChange={(e) => table.getColumn("title")?.setFilterValue(e.target.value)}
          />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {POINT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={criticalityFilter} onValueChange={(v) => setCriticalityFilter(v ?? "all")}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="All criticality" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All criticality</SelectItem>
              {CRITICALITIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground ml-auto">
            {filteredPoints.length} point{filteredPoints.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Table */}
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((h) => (
                    <TableHead key={h.id} className="text-xs">
                      {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center text-sm text-muted-foreground py-12">
                    No interface points. Click &ldquo;New Interface Point&rdquo; to add one.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/30">
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
      </div>
    </>
  );
}
