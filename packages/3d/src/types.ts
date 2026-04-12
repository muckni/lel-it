import type { AssetAnchorDefinition, FocusedAssetType } from "@owit/shared";

export interface AssetPlacement {
  id: string;
  assetType: "turbine" | "foundation" | "oss" | "onshore_substation" | "array_cable" | "export_cable" | "met_mast" | "other";
  label: string;
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationY: number;
  modelRegistryAssetId?: string | null;
  modelUrl?: string | null;
  lodLevel?: number;
}

export interface InterfacePointMarker {
  id: string;
  code: string;
  title: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  criticality: "critical" | "major" | "minor";
  assetType: string | null;
  assetPositionRef: string | null;
  dueDate?: string | null;
  spatialX: number | null;
  spatialY: number | null;
  spatialZ: number | null;
}

export interface CableRoute {
  id: string;
  cableType: "array_cable" | "export_cable";
  fromAssetId: string;
  toAssetId: string;
  label: string;
  color?: string;
  waypoints?: [number, number, number][];
}

export type SceneMode = "representative" | "layout";

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
}

export interface WindFarmSceneProps {
  assets: AssetPlacement[];
  cableRoutes?: CableRoute[];
  interfacePoints: InterfacePointMarker[];
  onPointClick?: (pointId: string) => void;
  selectedPointId?: string | null;
  filterStatus?: string | null;
  filterCriticality?: string | null;
  sceneMode?: SceneMode;
  focusAssetType?: FocusedAssetType;
  anchorCatalog?: readonly AssetAnchorDefinition[];
  representativeModelUrl?: string | null;
  mappingTargetPointId?: string | null;
  onAnchorClick?: (anchorKey: string) => void;
  /** Initial camera state to restore on mount */
  initialCamera?: CameraState | null;
  /** Called when the user finishes orbiting — use to persist camera state */
  onOrbitEnd?: (state: CameraState) => void;
  /** Imperative ref to trigger camera presets from outside the canvas */
  cameraControlRef?: React.MutableRefObject<CameraControl | null>;
  /** When true, enables two-click distance measurement mode */
  measurementActive?: boolean;
}

export interface CameraControl {
  setPreset: (preset: "top" | "iso" | "side") => void;
}
