import type {
  ProjectPhase,
  ProjectStatus,
  MemberRole,
  AssetType,
} from "./enums";

// Shared type definitions used across packages
export interface ProjectMetadata {
  location?: string;
  capacityMW?: number;
  turbineCount?: number;
  waterDepthM?: number;
  distanceToShoreKm?: number;
  country?: string;
}

export interface AssetPlacementData {
  assetType: AssetType;
  label: string;
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationY: number;
  metadata?: Record<string, unknown>;
}

export interface ModelRegistryAsset {
  id: string;
  projectId: string;
  assetType: AssetType;
  semanticTag?: string | null;
  versionLabel: string;
  fileName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  isActiveVersion: boolean;
}

export interface AssetModelReference {
  placementId: string;
  modelRegistryAssetId: string | null;
  lodLevel: number;
}

export interface MatrixValidationIssue {
  type:
    | "unresolved_org_code"
    | "multi_responsible"
    | "missing_required_allocation";
  rowId: string;
  phaseColumn?: string;
  message: string;
}

export interface InterfaceWorkspaceOverview {
  projectId: string;
  revisionId: string | null;
  counters: {
    openCases: number;
    overdueCases: number;
    trackerOpen: number;
    matrixRows: number;
    mocUnderReview: number;
  };
  blockingIssues: MatrixValidationIssue[];
}
