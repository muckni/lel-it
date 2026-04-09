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
