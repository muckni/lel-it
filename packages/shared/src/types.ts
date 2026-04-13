import type {
  ProjectPhase,
  ProjectStatus,
  MemberRole,
  AssetType,
  LessonActionStatus,
  LessonCycleState,
  LessonEscalationStatus,
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

export interface LessonGateReadiness {
  projectId: string;
  cycleId: string | null;
  status: LessonCycleState | "none";
  totals: {
    ingested: number;
    triaged: number;
    clustered: number;
    classified: number;
    actioned: number;
    reportReady: number;
  };
  blockers: {
    untriaged: number;
    unclassified: number;
    trackAWithoutOwner: number;
    trackADoneWithoutEvidence: number;
    pendingTrackBSubmissions: number;
  };
  isGateReady: boolean;
}

export interface LessonPolicyProfile {
  id: string;
  portfolioId: string | null;
  name: string;
  trackAApprovalEur250k: number;
  trackAApprovalEur1m: number;
  monthlyTriageDay: number;
  preGateLeadWeeks: number;
  reminderSlaDays: number;
  active: boolean;
}

export interface LessonPortfolioKpi {
  activeProjects: number;
  openCycles: number;
  overdueTrackAActions: number;
  pendingTrackBSubmissions: number;
  gateReadyProjects: number;
}

export interface LessonPortfolioProjectRisk {
  projectId: string;
  projectName: string;
  cycleState: LessonCycleState | "none";
  overdueTrackAActions: number;
  pendingTrackBSubmissions: number;
  unresolvedUnknowns: number;
  gateReady: boolean;
}

export interface LessonTrackAActionSummary {
  id: string;
  lessonId: string;
  ownerUserId: string | null;
  status: LessonActionStatus;
  dueAt: string | null;
}

export interface LessonTrackBEscalationSummary {
  id: string;
  lessonId: string;
  status: LessonEscalationStatus;
  submittedAt: string | null;
}
