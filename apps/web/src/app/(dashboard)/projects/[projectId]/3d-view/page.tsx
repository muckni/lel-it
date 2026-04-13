"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CameraControl, CameraState } from "@owit/3d";
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
  LinkIcon,
  UnlinkIcon,
  CameraIcon,
  RouteIcon,
  RulerIcon,
  DownloadIcon,
  FolderOpenIcon,
} from "lucide-react";
import { exportToExcel, parseExcelFile } from "@/lib/excel";
import {
  ASSET_TYPES,
  CRITICALITIES,
  POINT_STATUSES,
  ASSET_ANCHOR_CATALOG,
  FOCUSED_ASSET_TYPES,
  type FocusedAssetType,
  getAnchorLabel,
} from "@owit/shared";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { featureFlags } from "@/lib/feature-flags";
import { useProjectRole } from "@/hooks/use-project-role";
import { ModelPreview } from "@/components/model-preview";

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
  foundationVariant: z
    .enum(["monopile", "monopile_tpless", "jacket", "tripod", "pinpile"])
    .optional(),
});

type AddAssetFormValues = z.infer<typeof addAssetSchema>;

type ModelAsset = {
  id: string;
  assetType: (typeof ASSET_TYPES)[number];
  semanticTag: string | null;
  versionLabel: string;
  fileName: string;
  isActiveVersion: boolean;
  signedUrl?: string | null;
};

type SceneMode = "representative" | "layout";

const FOCUSED_ASSET_LABELS: Record<FocusedAssetType, string> = {
  turbine: "Turbine",
  oss: "OSS",
  monopile: "Monopile",
  monopile_tpless: "Monopile TP-less",
  jacket: "Jacket",
  tripod: "Tripod",
  pinpile: "Pin-pile cluster",
};

const REPRESENTATIVE_PART_LEGEND: Record<
  FocusedAssetType,
  Array<{ label: string; color: string }>
> = {
  turbine: [
    { label: "Tower", color: "#D8D8D8" },
    { label: "Transition Piece", color: "#A0A0A0" },
    { label: "Hub / Blades", color: "#EFEFEF" },
    { label: "Cable Entry", color: "#374151" },
  ],
  oss: [
    { label: "Jacket Structure", color: "#6B7280" },
    { label: "Main / Cellar Deck", color: "#9CA3AF" },
    { label: "HV Switchgear", color: "#1E3A5F" },
    { label: "Cable Pull-in Heads", color: "#374151" },
  ],
  monopile: [
    { label: "Monopile (MP)", color: "#7A5C3A" },
    { label: "Transition Piece (TP)", color: "#909090" },
    { label: "Cable Hang-off", color: "#60a5fa" },
    { label: "J-tube / Pull-in", color: "#374151" },
  ],
  monopile_tpless: [
    { label: "Monopile (TP-less)", color: "#7A5C3A" },
    { label: "Grouted Collar", color: "#8f8f8f" },
    { label: "Cable Pull-in", color: "#374151" },
  ],
  jacket: [
    { label: "Jacket Legs", color: "#6B7280" },
    { label: "Bracing", color: "#5B6370" },
    { label: "TP Flange Node", color: "#7a7f89" },
    { label: "Cable J-tube", color: "#60a5fa" },
  ],
  tripod: [
    { label: "Central Column", color: "#6b7280" },
    { label: "Brace Arms", color: "#64748b" },
    { label: "Pile Sleeves", color: "#6b7280" },
    { label: "Cable J-tube", color: "#60a5fa" },
  ],
  pinpile: [
    { label: "Levelling Frame", color: "#6f6f72" },
    { label: "Pin Piles", color: "#5f6368" },
    { label: "Grout Grid", color: "#a3a3a8" },
  ],
};

function isFocusedAssetType(
  value: string | null | undefined
): value is FocusedAssetType {
  return !!value && (FOCUSED_ASSET_TYPES as readonly string[]).includes(value);
}

function isFoundationFocus(assetType: FocusedAssetType) {
  return (
    assetType === "monopile" ||
    assetType === "monopile_tpless" ||
    assetType === "jacket" ||
    assetType === "tripod" ||
    assetType === "pinpile"
  );
}

function focusFromProjectSetup(setup: {
  foundationType?: string;
  hasOssInterface?: boolean;
} | undefined): FocusedAssetType {
  if (!setup) return "turbine";
  if (setup.foundationType === "jacket") return "jacket";
  if (setup.foundationType === "monopile_without_tp") return "monopile_tpless";
  if (setup.foundationType === "other") return setup.hasOssInterface ? "oss" : "turbine";
  return "monopile";
}

function assetTypeDisplayLabel(assetType: string) {
  if (assetType in FOCUSED_ASSET_LABELS) {
    return FOCUSED_ASSET_LABELS[assetType as FocusedAssetType];
  }
  if (assetType === "foundation") return "Foundation";
  if (assetType === "array_cable") return "Array Cable";
  if (assetType === "export_cable") return "Export Cable";
  return assetType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function focusedAssetTypeForPlacement(asset: {
  assetType: string;
  foundationVariant?: "monopile" | "monopile_tpless" | "jacket" | "tripod" | "pinpile" | null;
}): FocusedAssetType | null {
  if (asset.assetType === "turbine") return "turbine";
  if (asset.assetType === "oss") return "oss";
  if (asset.assetType === "foundation") return asset.foundationVariant ?? "monopile";
  return null;
}

export default function ThreeDViewPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectId = params.projectId as string;

  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { canEdit, isAdmin } = useProjectRole(projectId);

  const defaultSceneMode: SceneMode =
    featureFlags.threeDRepresentativeMode && searchParams.get("mode") !== "layout"
      ? "representative"
      : "layout";
  const assetQuery = searchParams.get("asset");
  const defaultFocusAssetType: FocusedAssetType = isFocusedAssetType(assetQuery)
    ? assetQuery
    : "turbine";

  const [sceneMode, setSceneMode] = useState<SceneMode>(defaultSceneMode);
  const [focusAssetType, setFocusAssetType] = useState<FocusedAssetType>(
    defaultFocusAssetType
  );

  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCriticality, setFilterCriticality] = useState("all");
  const [showImpactedOnly, setShowImpactedOnly] = useState(false);
  const [addAssetOpen, setAddAssetOpen] = useState(false);
  const [addCableOpen, setAddCableOpen] = useState(false);
  const [uploadModelOpen, setUploadModelOpen] = useState(false);
  const [showAssetTable, setShowAssetTable] = useState(false);
  const [uploadType, setUploadType] = useState<(typeof ASSET_TYPES)[number]>("turbine");
  const [uploadTag, setUploadTag] = useState("");
  const [uploadVersion, setUploadVersion] = useState("v1");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const [cableFromAssetId, setCableFromAssetId] = useState("");
  const [cableToAssetId, setCableToAssetId] = useState("");
  const [cableCableType, setCableCableType] = useState<"array_cable" | "export_cable">("array_cable");
  const [cableLabel, setCableLabel] = useState("");
  const [cableError, setCableError] = useState<string | null>(null);

  const [mappingPointId, setMappingPointId] = useState<string | null>(null);
  const [mappingSearch, setMappingSearch] = useState("");
  const [mappingError, setMappingError] = useState<string | null>(null);

  const [addAnchorKey, setAddAnchorKey] = useState("");
  const [addAnchorLabel, setAddAnchorLabel] = useState("");
  const [addAnchorAssetType, setAddAnchorAssetType] = useState<FocusedAssetType>("turbine");
  const [addAnchorX, setAddAnchorX] = useState("0");
  const [addAnchorY, setAddAnchorY] = useState("0");
  const [addAnchorZ, setAddAnchorZ] = useState("0");
  const [addAnchorError, setAddAnchorError] = useState<string | null>(null);
  const [measurementActive, setMeasurementActive] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);

  // Camera state from URL params
  const cameraControlRef = useRef<CameraControl | null>(null);
  const cameraDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initialCamera = useMemo<CameraState | null>(() => {
    const cx = parseFloat(searchParams.get("cx") ?? "");
    const cy = parseFloat(searchParams.get("cy") ?? "");
    const cz = parseFloat(searchParams.get("cz") ?? "");
    const tx = parseFloat(searchParams.get("tx") ?? "");
    const ty = parseFloat(searchParams.get("ty") ?? "");
    const tz = parseFloat(searchParams.get("tz") ?? "");
    if ([cx, cy, cz, tx, ty, tz].some(isNaN)) return null;
    return { position: [cx, cy, cz], target: [tx, ty, tz] };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount — intentionally not reactive to searchParams changes

  const handleOrbitEnd = useCallback(
    (state: CameraState) => {
      if (cameraDebounceRef.current) clearTimeout(cameraDebounceRef.current);
      cameraDebounceRef.current = setTimeout(() => {
        const next = new URLSearchParams(searchParams.toString());
        const [cx, cy, cz] = state.position;
        const [tx, ty, tz] = state.target;
        next.set("cx", cx.toFixed(2));
        next.set("cy", cy.toFixed(2));
        next.set("cz", cz.toFixed(2));
        next.set("tx", tx.toFixed(2));
        next.set("ty", ty.toFixed(2));
        next.set("tz", tz.toFixed(2));
        router.replace(`${pathname}?${next.toString()}`);
      }, 500);
    },
    [searchParams, router, pathname]
  );

  function applyPreset(preset: "top" | "iso" | "side") {
    cameraControlRef.current?.setPreset(preset);
  }

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (cameraDebounceRef.current) clearTimeout(cameraDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    const currentMode = searchParams.get("mode");
    const currentAsset = searchParams.get("asset");
    const needsModeUpdate = currentMode !== sceneMode;
    const needsAssetUpdate =
      sceneMode === "representative"
        ? currentAsset !== focusAssetType
        : currentAsset !== null;
    if (!needsModeUpdate && !needsAssetUpdate) return;

    const next = new URLSearchParams(searchParams.toString());
    next.set("mode", sceneMode);
    if (sceneMode === "representative") {
      next.set("asset", focusAssetType);
    } else {
      next.delete("asset");
    }
    router.replace(`${pathname}?${next.toString()}`);
  }, [sceneMode, focusAssetType, searchParams, router, pathname]);

  const { data: assetsRaw = [] } = useQuery(
    trpc.assetPlacement.list.queryOptions({ projectId })
  );

  const { data: cableRoutesRaw = [] } = useQuery(
    trpc.cableRoute.list.queryOptions({ projectId })
  );

  const { data: allPoints = [] } = useQuery(
    trpc.interfacePoint.listByProject.queryOptions({ projectId })
  );
  const { data: project } = useQuery(
    trpc.project.getById.queryOptions({ id: projectId })
  );

  const { data: registryModels = [] } = useQuery({
    ...trpc.modelRegistry.list.queryOptions({
      projectId,
      includeSignedUrls: true,
    }),
    enabled: featureFlags.threeDModelRegistry,
  });

  useEffect(() => {
    if (searchParams.get("asset")) return;
    if (sceneMode !== "representative") return;

    const setup = (
      project?.metadata as { setup?: { foundationType?: string; hasOssInterface?: boolean } }
      | undefined
    )?.setup;
    if (!setup) return;
    setFocusAssetType(focusFromProjectSetup(setup));
  }, [project, sceneMode, searchParams]);

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

  const createCableRoute = useMutation(
    trpc.cableRoute.create.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.cableRoute.list.queryOptions({ projectId })
        );
        setAddCableOpen(false);
        setCableFromAssetId("");
        setCableToAssetId("");
        setCableCableType("array_cable");
        setCableLabel("");
        setCableError(null);
      },
      onError: (error) => setCableError(error.message),
    })
  );

  const deleteCableRoute = useMutation(
    trpc.cableRoute.delete.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.cableRoute.list.queryOptions({ projectId })
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

  const set3dAnchor = useMutation(
    trpc.interfacePoint.set3dAnchor.mutationOptions({
      onSuccess: async (updated) => {
        await queryClient.invalidateQueries(
          trpc.interfacePoint.listByProject.queryOptions({ projectId })
        );
        setMappingError(null);
        setMappingPointId(null);
        setSelectedPointId(updated.id);
      },
      onError: (error) => setMappingError(error.message),
    })
  );

  const clear3dAnchor = useMutation(
    trpc.interfacePoint.clear3dAnchor.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.interfacePoint.listByProject.queryOptions({ projectId })
        );
        setMappingError(null);
      },
      onError: (error) => setMappingError(error.message),
    })
  );

  const { data: mergedAnchors = [] } = useQuery(
    trpc.anchorCatalog.list.queryOptions({ projectId })
  );
  const mergedAnchorsForFocus = useMemo(
    () => (mergedAnchors as any[]).filter((anchor) => anchor.assetType === focusAssetType),
    [mergedAnchors, focusAssetType]
  );
  const resolveAnchorLabel = useCallback(
    (assetType: string | null | undefined, anchorKey: string | null | undefined) => {
      if (!assetType || !anchorKey) return null;
      const customMatch = (mergedAnchors as any[]).find(
        (anchor) => anchor.assetType === assetType && anchor.key === anchorKey
      );
      if (customMatch?.label) return customMatch.label as string;
      if (isFocusedAssetType(assetType)) {
        return getAnchorLabel(assetType, anchorKey);
      }
      if (assetType === "foundation" && isFoundationFocus(focusAssetType)) {
        return getAnchorLabel(focusAssetType, anchorKey);
      }
      return null;
    },
    [mergedAnchors, focusAssetType]
  );

  const createAnchor = useMutation(
    trpc.anchorCatalog.create.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.anchorCatalog.list.queryOptions({ projectId })
        );
        setAddAnchorKey("");
        setAddAnchorLabel("");
        setAddAnchorX("0");
        setAddAnchorY("0");
        setAddAnchorZ("0");
        setAddAnchorError(null);
      },
      onError: (error) => setAddAnchorError(error.message),
    })
  );

  const deleteAnchor = useMutation(
    trpc.anchorCatalog.delete.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.anchorCatalog.list.queryOptions({ projectId })
        );
      },
    })
  );

  const importLayout = useMutation(
    trpc.assetPlacement.importLayout.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.assetPlacement.list.queryOptions({ projectId })
        );
        setImportError(null);
      },
      onError: (error) => setImportError(error.message),
    })
  );

  async function handleImportFile(file: File) {
    setImportError(null);
    try {
      const rows = await parseExcelFile(file);
      const required = ["label", "assetType", "positionX", "positionY", "positionZ"];
      if (rows.length === 0) {
        setImportError("File is empty.");
        return;
      }
      const firstRow = rows[0];
      const missing = required.filter((col) => !(col in firstRow));
      if (missing.length > 0) {
        setImportError(`Missing columns: ${missing.join(", ")}`);
        return;
      }
      const validAssetTypes = [
        "turbine", "foundation", "oss", "onshore_substation",
        "array_cable", "export_cable", "met_mast", "other",
      ] as const;
      type ValidAssetType = (typeof validAssetTypes)[number];
      const placements = rows.map((row, i) => {
        const at = String(row.assetType ?? "");
        if (!(validAssetTypes as readonly string[]).includes(at)) {
          throw new Error(`Row ${i + 1}: invalid assetType "${at}"`);
        }
        return {
          label: String(row.label ?? ""),
          assetType: at as ValidAssetType,
          positionX: Number(row.positionX ?? 0),
          positionY: Number(row.positionY ?? 0),
          positionZ: Number(row.positionZ ?? 0),
          rotationY: Number(row.rotationY ?? 0),
        };
      });
      await importLayout.mutateAsync({ projectId, placements });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed.");
    }
  }

  async function handleExportLayout() {
    const rows = await queryClient.fetchQuery(
      trpc.assetPlacement.exportLayout.queryOptions({ projectId })
    );
    exportToExcel(rows as Record<string, unknown>[], "asset-layout");
  }

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
      assetType: "turbine",
      label: "",
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      rotationY: 0,
      foundationVariant: "monopile",
    },
  });
  const watchedAssetType = form.watch("assetType");

  const models = registryModels as ModelAsset[];
  const modelsById = useMemo(
    () => new Map(models.map((model) => [model.id, model])),
    [models]
  );

  const representativeModelUrl = useMemo(() => {
    const byType = models.filter((model) => model.assetType === focusAssetType);
    if (byType.length === 0) return null;

    const activeGeneric = byType.find(
      (model) => model.isActiveVersion && (model.semanticTag ?? "").toLowerCase() === "generic"
    );
    const activeAny = byType.find((model) => model.isActiveVersion);
    const genericAny = byType.find(
      (model) => (model.semanticTag ?? "").toLowerCase() === "generic"
    );
    const selected = activeGeneric ?? activeAny ?? genericAny ?? byType[0];
    return selected.signedUrl ?? null;
  }, [models, focusAssetType]);

  const assets = useMemo(
    () =>
      (assetsRaw as any[]).map((asset) => {
        const model = asset.modelRegistryAssetId
          ? modelsById.get(asset.modelRegistryAssetId)
          : null;
        const metadata = (asset.metadata ?? {}) as Record<string, unknown>;
        return {
          ...asset,
          modelUrl: model?.signedUrl ?? null,
          foundationVariant:
            (metadata.foundationVariant as AddAssetFormValues["foundationVariant"] | undefined) ??
            null,
        };
      }),
    [assetsRaw, modelsById]
  );

  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) ?? null;

  const allProjectPoints = allPoints as any[];
  const mappedPointsForFocus = useMemo(
    () =>
      allProjectPoints.filter(
        (point) =>
          (isFoundationFocus(focusAssetType)
            ? point.assetType === "foundation"
            : point.assetType === focusAssetType) &&
          !!point.assetPositionRef
      ),
    [allProjectPoints, focusAssetType]
  );

  const unmappedPointsForFocus = useMemo(() => {
    const q = mappingSearch.trim().toLowerCase();
    return allProjectPoints
      .filter((point) => !point.assetPositionRef)
      .filter((point) => (q ? String(point.title ?? "").toLowerCase().includes(q) : true));
  }, [allProjectPoints, mappingSearch]);

  const markers = useMemo(() => {
    const source = allProjectPoints;

    if (sceneMode === "representative") {
      return source
        .filter((point) =>
          isFoundationFocus(focusAssetType)
            ? point.assetType === "foundation"
            : point.assetType === focusAssetType
        )
        .map((point) => ({
          id: point.id,
          code: point.code,
          title: point.title,
          status: point.status,
          criticality: point.criticality,
          dueDate: point.dueDate ?? null,
          assetType: point.assetType ?? null,
          assetPositionRef: point.assetPositionRef ?? null,
          spatialX: point.spatialX ?? null,
          spatialY: point.spatialY ?? null,
          spatialZ: point.spatialZ ?? null,
        }));
    }

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

    return impactedFiltered.map((point) => {
      if (
        selectedAsset &&
        point.assetPositionRef &&
        point.spatialX == null &&
        point.spatialY == null &&
        point.spatialZ == null
      ) {
        const focusedType = focusedAssetTypeForPlacement(selectedAsset);
        const anchor = focusedType
          ? ASSET_ANCHOR_CATALOG[focusedType].find((entry) => entry.key === point.assetPositionRef)
          : null;
        if (anchor) {
          return {
            id: point.id,
            code: point.code,
            title: point.title,
            status: point.status,
            criticality: point.criticality,
            dueDate: point.dueDate ?? null,
            assetType: point.assetType ?? null,
            assetPositionRef: point.assetPositionRef ?? null,
            spatialX: selectedAsset.positionX + anchor.position[0],
            spatialY: selectedAsset.positionY + anchor.position[1],
            spatialZ: selectedAsset.positionZ + anchor.position[2],
          };
        }
      }

      return {
        id: point.id,
        code: point.code,
        title: point.title,
        status: point.status,
        criticality: point.criticality,
        dueDate: point.dueDate ?? null,
        assetType: point.assetType ?? null,
        assetPositionRef: point.assetPositionRef ?? null,
        spatialX: point.spatialX ?? null,
        spatialY: point.spatialY ?? null,
        spatialZ: point.spatialZ ?? null,
      };
    });
  }, [allProjectPoints, selectedAsset, showImpactedOnly, sceneMode, focusAssetType]);

  const selectedPoint = allProjectPoints.find((point) => point.id === selectedPointId);

  const handlePointClick = useCallback((id: string) => {
    setSelectedPointId((prev) => (prev === id ? null : id));
  }, []);

  const handleAnchorClick = useCallback(
    (anchorKey: string) => {
      if (!mappingPointId || !canEdit) return;
      set3dAnchor.mutate({
        id: mappingPointId,
        assetType: focusAssetType,
        anchorKey,
      });
    },
    [mappingPointId, canEdit, set3dAnchor, focusAssetType]
  );

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
          <Select value={sceneMode} onValueChange={(value) => setSceneMode(value as SceneMode)}>
            <SelectTrigger className="h-7 w-44 text-xs">
              <SelectValue placeholder="View" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="representative">Representative View</SelectItem>
              <SelectItem value="layout">Full Layout View</SelectItem>
            </SelectContent>
          </Select>

          {sceneMode === "representative" && (
            <Select
              value={focusAssetType}
              onValueChange={(value) => {
                setFocusAssetType(value as FocusedAssetType);
                setMappingPointId(null);
              }}
            >
              <SelectTrigger className="h-7 w-32 text-xs">
                <SelectValue placeholder="Asset" />
              </SelectTrigger>
              <SelectContent>
                {FOCUSED_ASSET_TYPES.map((assetType) => (
                  <SelectItem key={assetType} value={assetType}>
                    {FOCUSED_ASSET_LABELS[assetType]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

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

          {/* Camera preset buttons — always visible regardless of scene mode */}
          <div className="flex items-center gap-1 border-l pl-2">
            <CameraIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => applyPreset("top")}
              title="Top-down view"
            >
              Top
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => applyPreset("iso")}
              title="Isometric view"
            >
              Iso
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => applyPreset("side")}
              title="Side view"
            >
              Side
            </Button>
          </div>

          {sceneMode === "layout" && (
            <>
              <Button
                variant={measurementActive ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setMeasurementActive((value) => !value)}
                title="Measure distance between two points"
              >
                <RulerIcon className="mr-1 h-3.5 w-3.5" />
                Measure
              </Button>

              {process.env.NODE_ENV === "development" && (
                <Button
                  variant={showStats ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowStats((value) => !value)}
                  title="Toggle performance stats overlay"
                >
                  Stats
                </Button>
              )}

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

              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setAddAssetOpen(true)}
                >
                  <PlusIcon className="mr-1 h-3.5 w-3.5" />
                  Add Asset
                </Button>
              )}

              {canEdit && assets.length >= 2 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setAddCableOpen(true)}
                >
                  <RouteIcon className="mr-1 h-3.5 w-3.5" />
                  Add Cable
                </Button>
              )}

              {featureFlags.threeDModelRegistry && canEdit && (
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

              {assets.length === 0 && canEdit && (
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => seedDemo.mutate({ projectId })}
                  disabled={seedDemo.isPending}
                >
                  {seedDemo.isPending ? "Loading..." : "Use Demo Layout"}
                </Button>
              )}

              {assets.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleExportLayout}
                  title="Download layout as Excel file"
                >
                  <DownloadIcon className="mr-1 h-3.5 w-3.5" />
                  Export Layout
                </Button>
              )}

              {canEdit && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => importFileRef.current?.click()}
                    disabled={importLayout.isPending}
                    title="Import layout from Excel or CSV file"
                  >
                    <FolderOpenIcon className="mr-1 h-3.5 w-3.5" />
                    {importLayout.isPending ? "Importing..." : "Import Layout"}
                  </Button>
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        void handleImportFile(file);
                        e.target.value = "";
                      }
                    }}
                  />
                  {importError && (
                    <span className="text-xs text-red-500 max-w-[200px] truncate" title={importError}>
                      {importError}
                    </span>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1">
          <WindFarmScene
            assets={assets}
            cableRoutes={cableRoutesRaw as any[]}
            interfacePoints={markers}
            onPointClick={handlePointClick}
            selectedPointId={selectedPointId}
            filterStatus={filterStatus !== "all" ? filterStatus : null}
            filterCriticality={
              filterCriticality !== "all" ? filterCriticality : null
            }
            sceneMode={sceneMode}
            focusAssetType={focusAssetType}
            anchorCatalog={mergedAnchorsForFocus}
            representativeModelUrl={sceneMode === "representative" ? null : representativeModelUrl}
            mappingTargetPointId={mappingPointId}
            onAnchorClick={handleAnchorClick}
            initialCamera={initialCamera}
            onOrbitEnd={handleOrbitEnd}
            cameraControlRef={cameraControlRef}
            measurementActive={measurementActive}
            showStats={showStats}
          />

          {measurementActive && sceneMode === "layout" && (
            <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-lg bg-black/80 px-3 py-1.5 text-xs text-amber-300 pointer-events-none">
              Click two points to measure distance
            </div>
          )}

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
              {markers.length} points shown
              {sceneMode === "representative"
                ? ` for ${FOCUSED_ASSET_LABELS[focusAssetType]}`
                : selectedAsset
                  ? ` for ${selectedAsset.label}`
                  : ""}
            </p>
            {mappingPointId && (
              <p className="mt-1.5 text-[10px] text-amber-300">
                Select an anchor in the scene to map the selected topic.
              </p>
            )}
          </div>

          {selectedPoint && (
            <div className="absolute right-4 top-4 w-80 rounded-lg border bg-white p-4 shadow-xl">
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
                {selectedPoint.assetType && selectedPoint.assetPositionRef
                  ? `${assetTypeDisplayLabel(selectedPoint.assetType)} · ${resolveAnchorLabel(
                      selectedPoint.assetType,
                      selectedPoint.assetPositionRef
                    ) ?? selectedPoint.assetPositionRef}`
                  : "Unmapped topic"}
              </p>
              {selectedPoint.dueDate && (
                <p className="mt-1 text-xs text-muted-foreground">Due: {selectedPoint.dueDate}</p>
              )}
              {canEdit && !selectedPoint.assetPositionRef && sceneMode === "representative" && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-3 h-7 w-full text-xs"
                  onClick={() => {
                    setMappingPointId(selectedPoint.id);
                  }}
                >
                  Map This Topic
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className={`${canEdit && !selectedPoint.assetPositionRef && sceneMode === "representative" ? "mt-2" : "mt-3"} h-7 w-full text-xs`}
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

        {sceneMode === "representative" && (
          <div className="w-96 overflow-y-auto border-l bg-background">
            <div className="border-b p-4">
              <p className="text-xs font-medium uppercase text-muted-foreground">Visible Parts</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Representative view uses procedural parts so TP, cable, MP and structural zones remain distinct.
              </p>
              <div className="mt-2 space-y-1.5">
                {REPRESENTATIVE_PART_LEGEND[focusAssetType].map((part) => (
                  <div key={part.label} className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2.5 w-2.5 rounded-full border border-border"
                      style={{ backgroundColor: part.color }}
                    />
                    <span>{part.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-b p-4 space-y-2">
              <p className="text-sm font-semibold">Topic Mapping</p>
              <p className="text-xs text-muted-foreground">
                Map interface topics to {FOCUSED_ASSET_LABELS[focusAssetType].toLowerCase()} anchors.
              </p>
              <Input
                placeholder="Search unmapped topics"
                value={mappingSearch}
                onChange={(event) => setMappingSearch(event.target.value)}
                className="h-8 text-xs"
              />
              {mappingError && <p className="text-xs text-red-600">{mappingError}</p>}
              {!canEdit && (
                <p className="text-xs text-muted-foreground">
                  Read-only: viewer role cannot change mappings.
                </p>
              )}
            </div>

            <div className="border-b p-4">
              <p className="text-xs font-medium uppercase text-muted-foreground">Mapped Topics</p>
              <div className="mt-2 space-y-2">
                {mappedPointsForFocus.length === 0 && (
                  <p className="text-xs text-muted-foreground">No mapped topics yet.</p>
                )}
                {mappedPointsForFocus.map((point) => (
                  <div key={point.id} className="rounded border px-2.5 py-2">
                    <button
                      className="w-full text-left"
                      onClick={() => setSelectedPointId(point.id)}
                    >
                      <p className="font-mono text-[10px] text-muted-foreground">{point.code}</p>
                      <p className="text-xs font-medium line-clamp-2">{point.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {resolveAnchorLabel(focusAssetType, point.assetPositionRef) ?? point.assetPositionRef}
                      </p>
                    </button>
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-1 h-6 px-2 text-[11px]"
                        onClick={() => clear3dAnchor.mutate({ id: point.id })}
                        disabled={clear3dAnchor.isPending}
                      >
                        <UnlinkIcon className="mr-1 h-3 w-3" />
                        Clear
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4">
              <p className="text-xs font-medium uppercase text-muted-foreground">Unmapped Topics</p>
              <div className="mt-2 space-y-2">
                {unmappedPointsForFocus.length === 0 && (
                  <p className="text-xs text-muted-foreground">No unmapped topics.</p>
                )}
                {unmappedPointsForFocus.map((point) => (
                  <div key={point.id} className="rounded border px-2.5 py-2">
                    <button className="w-full text-left" onClick={() => setSelectedPointId(point.id)}>
                      <p className="font-mono text-[10px] text-muted-foreground">{point.code}</p>
                      <p className="text-xs font-medium line-clamp-2">{point.title}</p>
                    </button>
                    {canEdit && (
                      <Button
                        size="sm"
                        variant={mappingPointId === point.id ? "default" : "outline"}
                        className="mt-1 h-6 px-2 text-[11px]"
                        onClick={() => {
                          setMappingPointId(point.id);
                          setSelectedPointId(point.id);
                        }}
                        disabled={set3dAnchor.isPending}
                      >
                        <LinkIcon className="mr-1 h-3 w-3" />
                        {mappingPointId === point.id ? "Select Anchor..." : "Map"}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Anchors section — admin only */}
            {isAdmin && (
              <div className="border-t p-4 space-y-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">Custom Anchors</p>

                {/* List custom anchors with delete */}
                <div className="space-y-1">
                  {mergedAnchorsForFocus.filter((a) => a.isCustom).map((a) => (
                    <div key={a.key} className="flex items-center justify-between rounded border px-2 py-1">
                      <span className="text-xs">{a.label} <span className="text-muted-foreground">({a.key})</span></span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1.5 text-[11px] text-destructive hover:text-destructive"
                        onClick={() => {
                          if (a.id) deleteAnchor.mutate({ id: a.id, projectId });
                        }}
                        disabled={deleteAnchor.isPending || !a.id}
                      >
                        <Trash2Icon className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {mergedAnchorsForFocus.filter((a) => a.isCustom).length === 0 && (
                    <p className="text-xs text-muted-foreground">No custom anchors yet.</p>
                  )}
                </div>

                {/* Add Anchor form */}
                <div className="space-y-2 rounded border p-2">
                  <p className="text-[11px] font-medium">Add Anchor</p>
                  {addAnchorError && <p className="text-[11px] text-red-600">{addAnchorError}</p>}
                  <div className="space-y-1">
                    <Label className="text-[10px]">Asset Type</Label>
                    <select
                      value={addAnchorAssetType}
                      onChange={(e) => setAddAnchorAssetType(e.target.value as FocusedAssetType)}
                      className="h-7 w-full rounded border bg-background px-2 text-xs"
                    >
                      {FOCUSED_ASSET_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Key (unique, no spaces)</Label>
                    <Input
                      value={addAnchorKey}
                      onChange={(e) => setAddAnchorKey(e.target.value)}
                      className="h-7 text-xs"
                      placeholder="e.g. custom_bolt_flange"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Label</Label>
                    <Input
                      value={addAnchorLabel}
                      onChange={(e) => setAddAnchorLabel(e.target.value)}
                      className="h-7 text-xs"
                      placeholder="e.g. Bolt Flange"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <div className="space-y-1">
                      <Label className="text-[10px]">X</Label>
                      <Input value={addAnchorX} onChange={(e) => setAddAnchorX(e.target.value)} className="h-7 text-xs" type="number" step="0.1" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Y</Label>
                      <Input value={addAnchorY} onChange={(e) => setAddAnchorY(e.target.value)} className="h-7 text-xs" type="number" step="0.1" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Z</Label>
                      <Input value={addAnchorZ} onChange={(e) => setAddAnchorZ(e.target.value)} className="h-7 text-xs" type="number" step="0.1" />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="h-7 w-full text-xs"
                    disabled={createAnchor.isPending || !addAnchorKey.trim() || !addAnchorLabel.trim()}
                    onClick={() => {
                      setAddAnchorError(null);
                      const x = parseFloat(addAnchorX);
                      const y = parseFloat(addAnchorY);
                      const z = parseFloat(addAnchorZ);
                      if (isNaN(x) || isNaN(y) || isNaN(z)) {
                        setAddAnchorError("Position values must be numbers.");
                        return;
                      }
                      createAnchor.mutate({
                        projectId,
                        assetType: addAnchorAssetType,
                        key: addAnchorKey.trim(),
                        label: addAnchorLabel.trim(),
                        positionX: x,
                        positionY: y,
                        positionZ: z,
                      });
                    }}
                  >
                    <PlusIcon className="mr-1 h-3 w-3" />
                    {createAnchor.isPending ? "Adding..." : "Add Anchor"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {sceneMode === "layout" && showAssetTable && (
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
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteAsset.mutate({ id: asset.id })}
                        >
                          <Trash2Icon className="h-3 w-3" />
                        </Button>
                      )}
                    </div>

                    {featureFlags.threeDModelRegistry && canEdit && (
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
                        {asset.modelUrl && (
                          <ModelPreview
                            url={asset.modelUrl}
                            className="h-32 w-full rounded border bg-muted"
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {cableRoutesRaw.length > 0 && (
              <div className="border-t">
                <div className="border-b p-4">
                  <p className="text-sm font-semibold">Cable Routes</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {cableRoutesRaw.length} route{cableRoutesRaw.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="divide-y">
                  {(cableRoutesRaw as any[]).map((route) => (
                    <div key={route.id} className="flex items-center gap-2 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{route.label}</p>
                        <p className="text-[10px] capitalize text-muted-foreground">
                          {route.cableType.replace(/_/g, " ")}
                        </p>
                      </div>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteCableRoute.mutate({ id: route.id })}
                        >
                          <Trash2Icon className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={addCableOpen} onOpenChange={setAddCableOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Cable Route</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>From Asset *</Label>
              <Select value={cableFromAssetId} onValueChange={(value) => setCableFromAssetId(value ?? "")}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select asset..." />
                </SelectTrigger>
                <SelectContent>
                  {assets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id} className="text-xs">
                      {asset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>To Asset *</Label>
              <Select value={cableToAssetId} onValueChange={(value) => setCableToAssetId(value ?? "")}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select asset..." />
                </SelectTrigger>
                <SelectContent>
                  {assets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id} className="text-xs">
                      {asset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cable Type *</Label>
              <Select
                value={cableCableType}
                onValueChange={(value) => setCableCableType(value as "array_cable" | "export_cable")}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="array_cable" className="text-xs">Array Cable</SelectItem>
                  <SelectItem value="export_cable" className="text-xs">Export Cable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Label *</Label>
              <Input
                placeholder="Cable-01"
                value={cableLabel}
                onChange={(event) => setCableLabel(event.target.value)}
              />
            </div>
            {cableError && <p className="text-xs text-red-600">{cableError}</p>}
            <Button
              onClick={() => {
                if (!cableFromAssetId || !cableToAssetId || !cableLabel.trim()) {
                  setCableError("All fields are required.");
                  return;
                }
                setCableError(null);
                createCableRoute.mutate({
                  projectId,
                  fromAssetId: cableFromAssetId,
                  toAssetId: cableToAssetId,
                  cableType: cableCableType,
                  label: cableLabel.trim(),
                });
              }}
              disabled={createCableRoute.isPending}
            >
              {createCableRoute.isPending ? "Adding..." : "Add Cable Route"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addAssetOpen} onOpenChange={setAddAssetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Asset to Layout</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit((values) =>
              addAsset.mutate({
                projectId,
                assetType: values.assetType,
                label: values.label,
                positionX: values.positionX,
                positionY: values.positionY,
                positionZ: values.positionZ,
                rotationY: values.rotationY,
                metadata:
                  values.assetType === "foundation" && values.foundationVariant
                    ? { foundationVariant: values.foundationVariant }
                    : undefined,
              })
            )}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Asset Type *</Label>
                <Select
                  value={form.watch("assetType")}
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

            {watchedAssetType === "foundation" && (
              <div className="space-y-2">
                <Label>Foundation type</Label>
                <Select
                  value={form.watch("foundationVariant") ?? "monopile"}
                  onValueChange={(value) =>
                    form.setValue(
                      "foundationVariant",
                      value as AddAssetFormValues["foundationVariant"]
                    )
                  }
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monopile">Monopile</SelectItem>
                    <SelectItem value="monopile_tpless">Monopile TP-less</SelectItem>
                    <SelectItem value="jacket">Jacket</SelectItem>
                    <SelectItem value="tripod">Tripod</SelectItem>
                    <SelectItem value="pinpile">Pin-pile cluster</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

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
                placeholder="generic"
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
