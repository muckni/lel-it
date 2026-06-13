// Shared type definitions used across packages
export interface ProjectMetadata {
  location?: string;
  capacityMW?: number;
  turbineCount?: number;
  waterDepthM?: number;
  distanceToShoreKm?: number;
  country?: string;
}
