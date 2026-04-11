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
  spatialX: number | null;
  spatialY: number | null;
  spatialZ: number | null;
}

export interface WindFarmSceneProps {
  assets: AssetPlacement[];
  interfacePoints: InterfacePointMarker[];
  onPointClick?: (pointId: string) => void;
  selectedPointId?: string | null;
  filterStatus?: string | null;
  filterCriticality?: string | null;
}
