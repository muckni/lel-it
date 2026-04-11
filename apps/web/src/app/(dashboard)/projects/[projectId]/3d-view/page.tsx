"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { PlusIcon, BoxIcon, Trash2Icon, LayoutGridIcon } from "lucide-react";
import { ASSET_TYPES, CRITICALITIES, POINT_STATUSES } from "@owit/shared";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

// Dynamic import — R3F Canvas uses browser APIs, must be client-side only
const WindFarmScene = dynamic(
  () => import("@owit/3d").then((m) => ({ default: m.WindFarmScene })),
  { ssr: false, loading: () => <ScenePlaceholder /> }
);

function ScenePlaceholder() {
  return (
    <div className="flex flex-1 items-center justify-center bg-slate-900 text-slate-400 text-sm">
      Loading 3D scene…
    </div>
  );
}

const addAssetSchema = z.object({
  assetType: z.enum([
    "turbine", "foundation", "oss", "onshore_substation",
    "array_cable", "export_cable", "met_mast", "other",
  ]),
  label: z.string().min(1).max(100),
  positionX: z.number(),
  positionY: z.number(),
  positionZ: z.number(),
  rotationY: z.number(),
});
type AddAssetFormValues = z.infer<typeof addAssetSchema>;

export default function ThreeDViewPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCriticality, setFilterCriticality] = useState("all");
  const [addAssetOpen, setAddAssetOpen] = useState(false);
  const [showAssetTable, setShowAssetTable] = useState(false);

  const { data: assets = [] } = useQuery(
    trpc.assetPlacement.list.queryOptions({ projectId })
  );

  const { data: allPoints = [] } = useQuery(
    trpc.interfacePoint.listByProject.queryOptions({ projectId })
  );

  const seedDemo = useMutation(
    trpc.assetPlacement.seedDemo.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries(
          trpc.assetPlacement.list.queryOptions({ projectId })
        ),
    })
  );

  const addAsset = useMutation(
    trpc.assetPlacement.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.assetPlacement.list.queryOptions({ projectId })
        );
        setAddAssetOpen(false);
        form.reset();
      },
    })
  );

  const deleteAsset = useMutation(
    trpc.assetPlacement.delete.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries(
          trpc.assetPlacement.list.queryOptions({ projectId })
        ),
    })
  );

  const form = useForm<AddAssetFormValues>({ resolver: zodResolver(addAssetSchema) });

  const handlePointClick = useCallback(
    (id: string) => {
      setSelectedPointId((prev) => (prev === id ? null : id));
    },
    []
  );

  const selectedPoint = allPoints.find((p: any) => p.id === selectedPointId);

  // Map interface points to marker format
  const markers = (allPoints as any[]).map((p) => ({
    id: p.id,
    code: p.code,
    title: p.title,
    status: p.status,
    criticality: p.criticality,
    assetType: p.assetType ?? null,
    assetPositionRef: p.assetPositionRef ?? null,
    spatialX: p.spatialX ?? null,
    spatialY: p.spatialY ?? null,
    spatialZ: p.spatialZ ?? null,
  }));

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-background shrink-0">
        <BoxIcon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Wind Farm 3D</span>
        <div className="flex items-center gap-2 ml-auto">
          {/* Filters */}
          <Select
            value={filterStatus}
            onValueChange={(v) => setFilterStatus(v ?? "all")}
          >
            <SelectTrigger className="h-7 w-32 text-xs">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {POINT_STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="text-xs capitalize">
                  {s.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filterCriticality}
            onValueChange={(v) => setFilterCriticality(v ?? "all")}
          >
            <SelectTrigger className="h-7 w-32 text-xs">
              <SelectValue placeholder="All criticality" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All criticality</SelectItem>
              {CRITICALITIES.map((c) => (
                <SelectItem key={c} value={c} className="text-xs capitalize">
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowAssetTable((v) => !v)}
          >
            <LayoutGridIcon className="h-3.5 w-3.5 mr-1" />
            Layout
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setAddAssetOpen(true)}
          >
            <PlusIcon className="h-3.5 w-3.5 mr-1" />
            Add Asset
          </Button>
          {assets.length === 0 && (
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => seedDemo.mutate({ projectId })}
              disabled={seedDemo.isPending}
            >
              {seedDemo.isPending ? "Loading…" : "Use Demo Layout"}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 3D Canvas */}
        <div className="flex-1 relative">
          <WindFarmScene
            assets={assets}
            interfacePoints={markers}
            onPointClick={handlePointClick}
            selectedPointId={selectedPointId}
            filterStatus={filterStatus !== "all" ? filterStatus : null}
            filterCriticality={
              filterCriticality !== "all" ? filterCriticality : null
            }
          />

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-black/70 rounded-lg px-3 py-2 text-xs text-white space-y-1">
            <p className="font-medium mb-1.5">Interface Points</p>
            {[
              { color: "#F59E0B", label: "Open" },
              { color: "#3B82F6", label: "In Progress" },
              { color: "#10B981", label: "Resolved" },
              { color: "#9CA3AF", label: "Closed" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: item.color }}
                />
                {item.label}
              </div>
            ))}
            <p className="text-gray-400 mt-1.5 text-[10px]">
              {markers.length} points · click to select
            </p>
          </div>

          {/* Selected point detail panel */}
          {selectedPoint && (
            <div className="absolute top-4 right-4 bg-white rounded-lg shadow-xl border p-4 w-64">
              <div className="flex items-start justify-between mb-2">
                <p className="font-mono text-xs text-muted-foreground">
                  {(selectedPoint as any).code}
                </p>
                <button
                  className="text-muted-foreground hover:text-foreground text-xs"
                  onClick={() => setSelectedPointId(null)}
                >
                  ✕
                </button>
              </div>
              <p className="font-semibold text-sm leading-tight">
                {(selectedPoint as any).title}
              </p>
              <p className="text-xs text-muted-foreground capitalize mt-1">
                {(selectedPoint as any).status.replace(/_/g, " ")} ·{" "}
                {(selectedPoint as any).criticality}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-3 h-7 text-xs"
                onClick={() => {
                  const p = selectedPoint as any;
                  const agreementId = p.agreementId;
                  // Navigate to the point detail — we don't have registerId/agreementId here
                  // Use the queries page as a navigation target for now
                  router.push(`/projects/${projectId}/queries`);
                }}
              >
                View Details →
              </Button>
            </div>
          )}
        </div>

        {/* Asset layout panel */}
        {showAssetTable && (
          <div className="w-72 border-l bg-background overflow-y-auto">
            <div className="p-4 border-b">
              <p className="text-sm font-semibold">Asset Layout</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {assets.length} asset{assets.length !== 1 ? "s" : ""} placed
              </p>
            </div>
            <div className="divide-y">
              {assets.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  No assets placed. Add assets or use Demo Layout.
                </p>
              ) : (
                assets.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 px-4 py-2.5"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{a.label}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">
                        {a.assetType.replace(/_/g, " ")} · ({a.positionX},{" "}
                        {a.positionZ})
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => deleteAsset.mutate({ id: a.id })}
                    >
                      <Trash2Icon className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Asset Dialog */}
      <Dialog open={addAssetOpen} onOpenChange={setAddAssetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Asset to Layout</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit((values) =>
              addAsset.mutate({ projectId, ...values })
            )}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Asset Type *</Label>
                <Select
                  onValueChange={(v) =>
                    form.setValue("assetType", v as AddAssetFormValues["assetType"])
                  }
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Select type…" />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="text-xs capitalize">
                        {t.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Label *</Label>
                <Input placeholder="WTG-01" {...form.register("label")} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <Label>X</Label>
                <Input type="number" defaultValue={0} {...form.register("positionX", { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>Y</Label>
                <Input type="number" defaultValue={0} {...form.register("positionY", { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>Z</Label>
                <Input type="number" defaultValue={0} {...form.register("positionZ", { valueAsNumber: true })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Rotation Y (degrees)</Label>
              <Input type="number" defaultValue={0} {...form.register("rotationY", { valueAsNumber: true })} />
            </div>
            <Button type="submit" disabled={addAsset.isPending}>
              {addAsset.isPending ? "Adding…" : "Add Asset"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
