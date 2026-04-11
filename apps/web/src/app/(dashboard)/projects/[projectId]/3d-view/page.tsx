"use client";

import { useCallback, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  BoxIcon,
  LayoutGridIcon,
  PlusIcon,
  Trash2Icon,
  UploadCloudIcon,
} from "lucide-react";
import { ASSET_TYPES, CRITICALITIES, POINT_STATUSES } from "@owit/shared";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { featureFlags } from "@/lib/feature-flags";

const WindFarmScene = dynamic(
  () => import("@owit/3d").then((m) => ({ default: m.WindFarmScene })),
  { ssr: false, loading: () => <ScenePlaceholder /> }
);

function ScenePlaceholder() {
  return (
    <div className="flex flex-1 items-center justify-center bg-slate-900 text-sm text-slate-400">
      Loading 3D scene...
    </div>
  );
}

const addAssetSchema = z.object({
  assetType: z.enum([
    "turbine",
    "foundation",
    "oss",
    "onshore_substation",
    "array_cable",
    "export_cable",
    "met_mast",
    "other",
  ]),
  label: z.string().min(1).max(100),
  positionX: z.number(),
  positionY: z.number(),
  positionZ: z.number(),
  rotationY: z.number(),
});

type AddAssetFormValues = z.infer<typeof addAssetSchema>;

type ModelAsset = {
  id: string;
  assetType: (typeof ASSET_TYPES)[number];
  semanticTag: string | null;
  versionLabel: string;
  fileName: string;
  signedUrl?: string | null;
};

export default function ThreeDViewPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCriticality, setFilterCriticality] = useState("all");
  const [showImpactedOnly, setShowImpactedOnly] = useState(false);
  const [addAssetOpen, setAddAssetOpen] = useState(false);
  const [uploadModelOpen, setUploadModelOpen] = useState(false);
  const [showAssetTable, setShowAssetTable] = useState(false);
  const [uploadType, setUploadType] = useState<(typeof ASSET_TYPES)[number]>("turbine");
  const [uploadTag, setUploadTag] = useState("");
  const [uploadVersion, setUploadVersion] = useState("v1");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const { data: assetsRaw = [] } = useQuery(
    trpc.assetPlacement.list.queryOptions({ projectId })
  );

  const { data: allPoints = [] } = useQuery(
    trpc.interfacePoint.listByProject.queryOptions({ projectId })
  );

  const { data: registryModels = [] } = useQuery({
    ...trpc.modelRegistry.list.queryOptions({
      projectId,
      includeSignedUrls: true,
    }),
    enabled: featureFlags.threeDModelRegistry,
  });

  const seedDemo = useMutation(
    trpc.assetPlacement.seedDemo.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.assetPlacement.list.queryOptions({ projectId })
        );
      },
    })
  );

  const addAsset = useMutation(
    trpc.assetPlacement.create.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.assetPlacement.list.queryOptions({ projectId })
        );
        setAddAssetOpen(false);
        form.reset();
      },
    })
  );

  const deleteAsset = useMutation(
    trpc.assetPlacement.delete.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.assetPlacement.list.queryOptions({ projectId })
        );
      },
    })
  );

  const setModelReference = useMutation(
    trpc.assetPlacement.setModelReference.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.assetPlacement.list.queryOptions({ projectId })
        );
      },
    })
  );

  const createUploadIntent = useMutation(
    trpc.modelRegistry.createUploadIntent.mutationOptions()
  );
  const completeUpload = useMutation(
    trpc.modelRegistry.completeUpload.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.modelRegistry.list.queryOptions({
            projectId,
            includeSignedUrls: true,
          })
        );
      },
    })
  );

  const form = useForm<AddAssetFormValues>({
    resolver: zodResolver(addAssetSchema),
    defaultValues: {
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      rotationY: 0,
    },
  });

  const models = registryModels as ModelAsset[];
  const modelsById = useMemo(
    () => new Map(models.map((model) => [model.id, model])),
    [models]
  );

  const assets = useMemo(
    () =>
      (assetsRaw as any[]).map((asset) => {
        const model = asset.modelRegistryAssetId
          ? modelsById.get(asset.modelRegistryAssetId)
          : null;
        return {
          ...asset,
          modelUrl: model?.signedUrl ?? null,
        };
      }),
    [assetsRaw, modelsById]
  );

  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) ?? null;

  const markers = useMemo(() => {
    const source = allPoints as any[];
    const filteredByAsset = selectedAsset
      ? source.filter((point) => {
          if (point.assetPositionRef && point.assetPositionRef === selectedAsset.label) {
            return true;
          }
          if (point.assetType && point.assetType === selectedAsset.assetType) {
            return true;
          }
          return false;
        })
      : source;

    const impactedFiltered = showImpactedOnly
      ? filteredByAsset.filter(
          (point) =>
            !!point.assetPositionRef ||
            point.spatialX !== null ||
            point.spatialY !== null ||
            point.spatialZ !== null
        )
      : filteredByAsset;

    return impactedFiltered.map((point) => ({
      id: point.id,
      code: point.code,
      title: point.title,
      status: point.status,
      criticality: point.criticality,
      assetType: point.assetType ?? null,
      assetPositionRef: point.assetPositionRef ?? null,
      spatialX: point.spatialX ?? null,
      spatialY: point.spatialY ?? null,
      spatialZ: point.spatialZ ?? null,
    }));
  }, [allPoints, selectedAsset, showImpactedOnly]);

  const selectedPoint = (allPoints as any[]).find((point) => point.id === selectedPointId);

  const handlePointClick = useCallback((id: string) => {
    setSelectedPointId((prev) => (prev === id ? null : id));
  }, []);

  async function onUploadModel(file: File) {
    try {
      setUploadError(null);
      setUploadSuccess(null);

      if (!file.name.toLowerCase().endsWith(".glb") && !file.name.toLowerCase().endsWith(".gltf")) {
        setUploadError("Only .glb or .gltf files are supported.");
        return;
      }
      if (file.size > 250 * 1024 * 1024) {
        setUploadError("File too large. Maximum is 250 MB.");
        return;
      }

      const intent = await createUploadIntent.mutateAsync({
        projectId,
        assetType: uploadType,
        semanticTag: uploadTag.trim() || undefined,
        versionLabel: uploadVersion.trim() || "v1",
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });

      const uploadResponse = await fetch(intent.signedUploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "content-type": file.type || "application/octet-stream",
          "x-upsert": "false",
        },
      });

      if (!uploadResponse.ok) {
        setUploadError(`Upload failed (${uploadResponse.status}).`);
        return;
      }

      await completeUpload.mutateAsync({
        modelId: intent.modelId,
        projectId,
        assetType: uploadType,
        semanticTag: uploadTag.trim() || undefined,
        versionLabel: uploadVersion.trim() || "v1",
        fileName: file.name,
        storagePath: intent.storagePath,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });

      setUploadSuccess("Model uploaded and added to registry.");
      setUploadModelOpen(false);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    }
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-3 border-b bg-background px-4 py-2">
        <BoxIcon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Wind Farm 3D</span>

        <div className="ml-auto flex items-center gap-2">
          <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value ?? "all")}>
            <SelectTrigger className="h-7 w-36 text-xs">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {POINT_STATUSES.map((status) => (
                <SelectItem key={status} value={status} className="text-xs capitalize">
                  {status.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filterCriticality}
            onValueChange={(value) => setFilterCriticality(value ?? "all")}
          >
            <SelectTrigger className="h-7 w-36 text-xs">
              <SelectValue placeholder="All criticality" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All criticality</SelectItem>
              {CRITICALITIES.map((criticality) => (
                <SelectItem
                  key={criticality}
                  value={criticality}
                  className="text-xs capitalize"
                >
                  {criticality}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={showImpactedOnly ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowImpactedOnly((value) => !value)}
          >
            Impacted Only
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowAssetTable((value) => !value)}
          >
            <LayoutGridIcon className="mr-1 h-3.5 w-3.5" />
            Layout
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setAddAssetOpen(true)}
          >
            <PlusIcon className="mr-1 h-3.5 w-3.5" />
            Add Asset
          </Button>

          {featureFlags.threeDModelRegistry && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setUploadModelOpen(true)}
            >
              <UploadCloudIcon className="mr-1 h-3.5 w-3.5" />
              Upload Model
            </Button>
          )}

          {assets.length === 0 && (
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => seedDemo.mutate({ projectId })}
              disabled={seedDemo.isPending}
            >
              {seedDemo.isPending ? "Loading..." : "Use Demo Layout"}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1">
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

          <div className="absolute bottom-4 left-4 space-y-1 rounded-lg bg-black/70 px-3 py-2 text-xs text-white">
            <p className="mb-1.5 font-medium">Interface Points</p>
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
            <p className="mt-1.5 text-[10px] text-gray-300">
              {markers.length} points shown{selectedAsset ? ` for ${selectedAsset.label}` : ""}
            </p>
          </div>

          {selectedPoint && (
            <div className="absolute right-4 top-4 w-72 rounded-lg border bg-white p-4 shadow-xl">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="font-mono text-xs text-muted-foreground">{selectedPoint.code}</p>
                <button
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setSelectedPointId(null)}
                >
                  x
                </button>
              </div>
              <p className="text-sm font-semibold leading-tight">{selectedPoint.title}</p>
              <p className="mt-1 text-xs capitalize text-muted-foreground">
                {String(selectedPoint.status).replace(/_/g, " ")} · {selectedPoint.criticality}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {selectedPoint.assetPositionRef
                  ? `Asset Ref: ${selectedPoint.assetPositionRef}`
                  : "No linked asset reference"}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 h-7 w-full text-xs"
                onClick={() => {
                  const registerId = selectedPoint.agreement?.register?.id;
                  const agreementId = selectedPoint.agreement?.id;
                  if (registerId && agreementId) {
                    router.push(
                      `/projects/${projectId}/registers/${registerId}/agreements/${agreementId}/points/${selectedPoint.id}`
                    );
                    return;
                  }
                  router.push(`/projects/${projectId}/queries`);
                }}
              >
                View Details
              </Button>
            </div>
          )}
        </div>

        {showAssetTable && (
          <div className="w-80 overflow-y-auto border-l bg-background">
            <div className="border-b p-4">
              <p className="text-sm font-semibold">Asset Layout</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {assets.length} asset{assets.length === 1 ? "" : "s"} placed
              </p>
              {uploadError && <p className="mt-2 text-xs text-red-600">{uploadError}</p>}
              {uploadSuccess && <p className="mt-2 text-xs text-green-700">{uploadSuccess}</p>}
            </div>

            <div className="divide-y">
              {assets.length === 0 && (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  No assets placed. Add assets or use Demo Layout.
                </p>
              )}

              {assets.map((asset) => {
                const sameTypeModels = models.filter((model) => model.assetType === asset.assetType);
                return (
                  <div
                    key={asset.id}
                    className={`space-y-2 px-4 py-3 ${
                      selectedAssetId === asset.id ? "bg-accent/40" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        className="min-w-0 flex-1 text-left"
                        onClick={() =>
                          setSelectedAssetId((prev) => (prev === asset.id ? null : asset.id))
                        }
                      >
                        <p className="truncate text-xs font-medium">{asset.label}</p>
                        <p className="text-[10px] capitalize text-muted-foreground">
                          {asset.assetType.replace(/_/g, " ")} · ({asset.positionX}, {asset.positionZ})
                        </p>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteAsset.mutate({ id: asset.id })}
                      >
                        <Trash2Icon className="h-3 w-3" />
                      </Button>
                    </div>

                    {featureFlags.threeDModelRegistry && (
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Model</Label>
                        <Select
                          value={asset.modelRegistryAssetId ?? "procedural"}
                          onValueChange={(value) => {
                            setModelReference.mutate({
                              id: asset.id,
                              modelRegistryAssetId:
                                value === "procedural" ? null : value,
                              lodLevel: asset.lodLevel ?? 0,
                            });
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="procedural">Procedural Fallback</SelectItem>
                            {sameTypeModels.map((model) => (
                              <SelectItem key={model.id} value={model.id}>
                                {model.versionLabel} · {model.fileName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

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
                  onValueChange={(value) =>
                    form.setValue("assetType", value as AddAssetFormValues["assetType"])
                  }
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_TYPES.map((assetType) => (
                      <SelectItem
                        key={assetType}
                        value={assetType}
                        className="text-xs capitalize"
                      >
                        {assetType.replace(/_/g, " ")}
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
                <Input
                  type="number"
                  defaultValue={0}
                  {...form.register("positionX", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label>Y</Label>
                <Input
                  type="number"
                  defaultValue={0}
                  {...form.register("positionY", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label>Z</Label>
                <Input
                  type="number"
                  defaultValue={0}
                  {...form.register("positionZ", { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Rotation Y (degrees)</Label>
              <Input
                type="number"
                defaultValue={0}
                {...form.register("rotationY", { valueAsNumber: true })}
              />
            </div>

            <Button type="submit" disabled={addAsset.isPending}>
              {addAsset.isPending ? "Adding..." : "Add Asset"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={uploadModelOpen} onOpenChange={setUploadModelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload glTF Model</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Asset Type</Label>
                <Select value={uploadType} onValueChange={(value) => setUploadType(value as (typeof ASSET_TYPES)[number])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_TYPES.map((assetType) => (
                      <SelectItem key={assetType} value={assetType} className="capitalize">
                        {assetType.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Version</Label>
                <Input
                  value={uploadVersion}
                  onChange={(event) => setUploadVersion(event.target.value)}
                  placeholder="v1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Semantic Tag (optional)</Label>
              <Input
                value={uploadTag}
                onChange={(event) => setUploadTag(event.target.value)}
                placeholder="WTG"
              />
            </div>

            <div className="space-y-2">
              <Label>Model File (.glb/.gltf)</Label>
              <Input
                type="file"
                accept=".glb,.gltf,model/gltf+json,model/gltf-binary"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void onUploadModel(file);
                  }
                }}
                disabled={createUploadIntent.isPending || completeUpload.isPending}
              />
              <p className="text-xs text-muted-foreground">Uploads to private storage and keeps versioned metadata.</p>
            </div>

            {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
            {uploadSuccess && <p className="text-xs text-green-700">{uploadSuccess}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
