// Project lifecycle phases
export const PROJECT_PHASES = [
  "maturation",
  "feed",
  "detailed_design",
  "procurement",
  "fabrication",
  "installation",
  "commissioning",
  "operations",
] as const;
export type ProjectPhase = (typeof PROJECT_PHASES)[number];

// Project status
export const PROJECT_STATUSES = ["active", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

// Interface register status
export const REGISTER_STATUSES = ["draft", "active", "closed"] as const;
export type RegisterStatus = (typeof REGISTER_STATUSES)[number];

// Interface agreement status
export const AGREEMENT_STATUSES = [
  "draft",
  "under_review",
  "agreed",
  "superseded",
] as const;
export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number];

// Interface point status
export const POINT_STATUSES = [
  "open",
  "in_progress",
  "resolved",
  "closed",
] as const;
export type PointStatus = (typeof POINT_STATUSES)[number];

// Interface point criticality
export const CRITICALITIES = ["critical", "major", "minor"] as const;
export type Criticality = (typeof CRITICALITIES)[number];

// Interface point scope allocation phases (IMP/ERQ matrix)
export const SCOPE_ALLOCATION_PHASES = [
  { key: "scopeSpec", label: "Spec", description: "Specification / requirements" },
  { key: "scopeDes", label: "Des", description: "Design and engineering" },
  { key: "scopeSup", label: "Sup", description: "Supply / provision / execution" },
  { key: "scopeOnA", label: "On-A", description: "Onshore assembly" },
  { key: "scopeOnT", label: "On-T", description: "Onshore transport / delivery" },
  { key: "scopeOnC", label: "On-C", description: "Onshore commissioning and testing" },
  { key: "scopeOffT", label: "Off-T", description: "Offshore transport to site" },
  { key: "scopeOffI", label: "Off-I", description: "Offshore assembly / installation" },
  { key: "scopeOffC", label: "Off-C", description: "Offshore commissioning and testing" },
] as const;
export type ScopeAllocationPhase = (typeof SCOPE_ALLOCATION_PHASES)[number]["key"];

export const SCOPE_ALLOCATION_MODES = [
  "package",
  "not_relevant",
  "multiple",
] as const;
export type ScopeAllocationMode = (typeof SCOPE_ALLOCATION_MODES)[number];

// Interface query status
export const QUERY_STATUSES = [
  "open",
  "responded",
  "accepted",
  "rejected",
  "closed",
] as const;
export type QueryStatus = (typeof QUERY_STATUSES)[number];

// Interface query priority
export const QUERY_PRIORITIES = ["urgent", "high", "medium", "low"] as const;
export type QueryPriority = (typeof QUERY_PRIORITIES)[number];

// Deliverable status
export const DELIVERABLE_STATUSES = [
  "not_started",
  "in_progress",
  "submitted",
  "accepted",
  "rejected",
] as const;
export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number];

// IQ response status
export const IQ_RESPONSE_STATUSES = [
  "submitted",
  "accepted",
  "rejected",
] as const;
export type IqResponseStatus = (typeof IQ_RESPONSE_STATUSES)[number];

// Project member roles
export const MEMBER_ROLES = ["admin", "editor", "viewer"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

// Interface compliance workflow roles
export const INTERFACE_PARTY_ROLES = [
  "employer_interface_manager",
  "contractor_interface_manager",
  "interface_coordinator",
  "requesting_party",
  "providing_party",
] as const;
export type InterfacePartyRole = (typeof INTERFACE_PARTY_ROLES)[number];

export const INTERFACE_CASE_STATES = [
  "draft_dir",
  "employer_validated",
  "forwarded",
  "answered",
  "reviewed",
  "accepted",
  "closed",
  "reopened",
] as const;
export type InterfaceLifecycleState = (typeof INTERFACE_CASE_STATES)[number];

export const COMPLIANCE_STATUSES = [
  "compliant",
  "attention",
  "breach",
] as const;
export type ComplianceStatus = (typeof COMPLIANCE_STATUSES)[number];

export const TRACKER_ITEM_STATUSES = [
  "open",
  "closed",
  "info",
  "hold",
  "xclosed",
] as const;
export type TrackerItemStatus = (typeof TRACKER_ITEM_STATUSES)[number];

export const MOC_STATUSES = [
  "draft",
  "under_review",
  "approved",
  "rejected",
  "postponed",
  "implemented",
  "closed",
] as const;
export type MocStatus = (typeof MOC_STATUSES)[number];

export const MOC_IMPLEMENTATION_STATUSES = [
  "not_started",
  "in_progress",
  "implemented",
  "audited",
] as const;
export type MocImplementationStatus = (typeof MOC_IMPLEMENTATION_STATUSES)[number];

export const MOC_APPROVAL_LEVELS = [
  "engineering_manager",
  "epc_director",
  "project_director",
  "steerco_excom",
  "additional",
] as const;
export type MocApprovalLevel = (typeof MOC_APPROVAL_LEVELS)[number];

// Disciplines for interface agreements
export const DISCIPLINES = [
  "structural",
  "electrical",
  "mechanical",
  "control_systems",
  "marine",
  "geotechnical",
  "hse",
  "other",
] as const;
export type Discipline = (typeof DISCIPLINES)[number];

// Asset types for 3D visualization
export const ASSET_TYPES = [
  "turbine",
  "foundation",
  "oss",
  "onshore_substation",
  "array_cable",
  "export_cable",
  "met_mast",
  "other",
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const LESSON_TYPES = [
  "problem",
  "success",
  "risk",
  "improvement",
  "process_deviation",
] as const;
export type LessonType = (typeof LESSON_TYPES)[number];

export const LESSON_STATUSES = [
  "draft",
  "validated",
  "consolidated",
  "closed",
] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];

export const LESSON_DISCIPLINES = [
  "engineering",
  "procurement",
  "construction",
  "installation",
  "commissioning",
  "project_management",
  "hse",
  "commercial",
  "other",
] as const;
export type LessonDiscipline = (typeof LESSON_DISCIPLINES)[number];

export const LESSON_CHANGE_REQUEST_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const;
export type LessonChangeRequestStatus =
  (typeof LESSON_CHANGE_REQUEST_STATUSES)[number];

// Default work package templates
export const DEFAULT_WORK_PACKAGES = [
  { code: "WTG", name: "Wind Turbine Generator", color: "#3B82F6" },
  { code: "FND", name: "Foundation", color: "#8B5CF6" },
  { code: "ARR", name: "Array Cables", color: "#F59E0B" },
  { code: "EXP", name: "Export Cable", color: "#EF4444" },
  { code: "OSS", name: "Offshore Substation", color: "#10B981" },
  { code: "ONS", name: "Onshore Substation", color: "#6366F1" },
  { code: "INS", name: "Installation", color: "#EC4899" },
] as const;
