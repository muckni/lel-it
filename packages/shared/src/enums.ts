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

// Project member roles
export const MEMBER_ROLES = ["admin", "editor", "viewer"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const LESSON_TYPES = [
  "problem",
  "success",
  "risk",
  "improvement",
  "process_deviation",
] as const;
export type LessonType = (typeof LESSON_TYPES)[number];

export const CORPORATE_ROLES = [
  "corporate_admin",
  "corporate_ll_manager",
  "senior_management",
  "corporate_viewer",
] as const;
export type CorporateRole = (typeof CORPORATE_ROLES)[number];

export const PROJECT_LESSON_ROLES = [
  "ll_lead",
  "reviewer",
  "contributor",
  "viewer",
] as const;
export type ProjectLessonRole = (typeof PROJECT_LESSON_ROLES)[number];

export const CONFIDENTIALITY_LEVELS = [
  "internal",
  "confidential",
  "strictly_confidential",
] as const;
export type ConfidentialityLevel = (typeof CONFIDENTIALITY_LEVELS)[number];

export const REUSABILITY_LEVELS = [
  "project_specific",
  "reusable_with_adaptation",
  "universally_applicable",
] as const;
export type ReusabilityLevel = (typeof REUSABILITY_LEVELS)[number];

export const IMPACT_LEVELS = ["low", "medium", "high", "critical"] as const;
export type ImpactLevel = (typeof IMPACT_LEVELS)[number];

export const LESSON_V2_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "validated",
  "rejected",
  "archived",
] as const;
export type LessonV2Status = (typeof LESSON_V2_STATUSES)[number];

export const LESSON_CLUSTER_STATUSES = [
  "draft",
  "under_review",
  "approved",
  "archived",
] as const;
export type LessonClusterStatus = (typeof LESSON_CLUSTER_STATUSES)[number];

export const RECOMMENDED_ACTION_STATUSES = [
  "draft",
  "project_approved",
  "proposed_for_corporate",
  "corporate_review",
  "corporate_approved",
  "corporate_rejected",
  "retired",
  "archived",
] as const;
export type RecommendedActionStatus =
  (typeof RECOMMENDED_ACTION_STATUSES)[number];

export const CORPORATE_ACTION_STATUSES = [
  "active",
  "under_review",
  "retired",
] as const;
export type CorporateActionStatus = (typeof CORPORATE_ACTION_STATUSES)[number];

export const PROJECT_ACTION_STATUSES = [
  "added_to_project",
  "assigned",
  "in_progress",
  "blocked",
  "implemented",
  "evidence_submitted",
  "verified",
  "closed",
  "cancelled",
] as const;
export type ProjectActionStatus = (typeof PROJECT_ACTION_STATUSES)[number];

export const EVIDENCE_KINDS = ["file", "link", "note"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const LESSON_COMMENT_KINDS = ["comment", "review_note"] as const;
export type LessonCommentKind = (typeof LESSON_COMMENT_KINDS)[number];

export const LESSON_ENTITY_TYPES = [
  "lesson",
  "lesson_cluster",
  "recommended_action",
  "corporate_recommended_action",
  "project_action",
  "project_membership",
  "project",
  "corporate_role",
  "category",
  "workstream",
  "gate",
  "evidence",
  "comment",
  "export",
] as const;
export type LessonEntityType = (typeof LESSON_ENTITY_TYPES)[number];
