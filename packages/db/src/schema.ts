import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  real,
  jsonb,
  date,
  pgEnum,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const projectPhaseEnum = pgEnum("project_phase", [
  "maturation",
  "feed",
  "detailed_design",
  "procurement",
  "fabrication",
  "installation",
  "commissioning",
  "operations",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "active",
  "archived",
]);

export const registerStatusEnum = pgEnum("register_status", [
  "draft",
  "active",
  "closed",
]);

export const agreementStatusEnum = pgEnum("agreement_status", [
  "draft",
  "under_review",
  "agreed",
  "superseded",
]);

export const pointStatusEnum = pgEnum("point_status", [
  "open",
  "in_progress",
  "resolved",
  "closed",
]);

export const criticalityEnum = pgEnum("criticality", [
  "critical",
  "major",
  "minor",
]);

export const scopeAllocationModeEnum = pgEnum("scope_allocation_mode", [
  "package",
  "not_relevant",
  "multiple",
]);

export const queryStatusEnum = pgEnum("query_status", [
  "open",
  "responded",
  "accepted",
  "rejected",
  "closed",
]);

export const queryPriorityEnum = pgEnum("query_priority", [
  "urgent",
  "high",
  "medium",
  "low",
]);

export const deliverableStatusEnum = pgEnum("deliverable_status", [
  "not_started",
  "in_progress",
  "submitted",
  "accepted",
  "rejected",
]);

export const iqResponseStatusEnum = pgEnum("iq_response_status", [
  "submitted",
  "accepted",
  "rejected",
]);

export const attachmentEntityEnum = pgEnum("attachment_entity", [
  "interface_point",
  "deliverable",
  "iq_response",
]);

export const organizationTypeEnum = pgEnum("organization_type", [
  "employer",
  "contractor",
  "subcontractor",
]);

export const interfacePartyRoleEnum = pgEnum("interface_party_role", [
  "employer_interface_manager",
  "contractor_interface_manager",
  "interface_coordinator",
  "requesting_party",
  "providing_party",
]);

export const interfaceCaseStateEnum = pgEnum("interface_case_state", [
  "draft_dir",
  "employer_validated",
  "forwarded",
  "answered",
  "reviewed",
  "accepted",
  "closed",
  "reopened",
]);

export const interfaceCaseEventTypeEnum = pgEnum("interface_case_event_type", [
  "state_changed",
  "comment_added",
  "assignment_changed",
  "sla_changed",
  "employer_approval_granted",
  "document_attached",
  "closed",
  "reopened",
]);

export const matrixPhaseColumnEnum = pgEnum("matrix_phase_column", [
  "spec",
  "des",
  "sup",
  "on_a",
  "on_t",
  "on_c",
  "off_t",
  "off_i",
  "off_c",
]);

export const trackerItemStatusEnum = pgEnum("tracker_item_status", [
  "open",
  "closed",
  "info",
  "hold",
  "xclosed",
]);

export const mocStatusEnum = pgEnum("moc_status", [
  "draft",
  "under_review",
  "approved",
  "rejected",
  "postponed",
  "implemented",
  "closed",
]);

export const mocImplementationStatusEnum = pgEnum("moc_implementation_status", [
  "not_started",
  "in_progress",
  "implemented",
  "audited",
]);

export const mocApprovalLevelEnum = pgEnum("moc_approval_level", [
  "engineering_manager",
  "epc_director",
  "project_director",
  "steerco_excom",
  "additional",
]);

export const mocApprovalDecisionEnum = pgEnum("moc_approval_decision", [
  "pending",
  "approved",
  "rejected",
  "postponed",
]);

export const memberRoleEnum = pgEnum("member_role", [
  "admin",
  "editor",
  "viewer",
]);

export const disciplineEnum = pgEnum("discipline", [
  "structural",
  "electrical",
  "mechanical",
  "control_systems",
  "marine",
  "geotechnical",
  "hse",
  "other",
]);

export const assetTypeEnum = pgEnum("asset_type", [
  "turbine",
  "foundation",
  "oss",
  "onshore_substation",
  "array_cable",
  "export_cable",
  "met_mast",
  "other",
]);

export const llTypeEnum = pgEnum("ll_type", [
  "problem",
  "success",
  "risk",
  "improvement",
  "process_deviation",
]);

export const llStatusEnum = pgEnum("ll_status", [
  "draft",
  "validated",
  "consolidated",
  "closed",
]);

export const llDisciplineEnum = pgEnum("ll_discipline", [
  "engineering",
  "procurement",
  "construction",
  "installation",
  "commissioning",
  "project_management",
  "hse",
  "commercial",
  "other",
]);

export const llChangeRequestStatusEnum = pgEnum("ll_change_request_status", [
  "pending",
  "approved",
  "rejected",
]);

export const llOwnershipStateEnum = pgEnum("ll_ownership_state", [
  "permissive",
  "restricted",
  "prohibited",
  "unclear",
]);

export const lessonWorkflowStateEnum = pgEnum("lesson_workflow_state", [
  "ingested",
  "triaged",
  "clustered",
  "classified",
  "actioned",
  "report_ready",
]);

export const lessonTriageDecisionEnum = pgEnum("lesson_triage_decision", [
  "retain",
  "drop",
  "defer",
  "hold",
  "duplicate",
  "external_context",
]);

export const lessonCycleTypeEnum = pgEnum("lesson_cycle_type", [
  "monthly",
  "pre_gate",
  "ad_hoc",
]);

export const lessonCycleStateEnum = pgEnum("lesson_cycle_state", [
  "planned",
  "active",
  "completed",
  "archived",
]);

export const lessonActionPriorityEnum = pgEnum("lesson_action_priority", [
  "do",
  "delay",
  "delegate",
  "drop",
]);

export const lessonActionStatusEnum = pgEnum("lesson_action_status", [
  "not_started",
  "in_progress",
  "done",
  "overdue",
]);

export const lessonEscalationStatusEnum = pgEnum("lesson_escalation_status", [
  "draft",
  "submitted",
  "acknowledged",
  "assigned",
  "closed",
]);

export const lessonRoleTypeEnum = pgEnum("lesson_role_type", [
  "ll_manager",
  "document_controller",
  "pmo_director",
  "hope",
]);

export const corporateRoleEnum = pgEnum("corporate_role", [
  "corporate_admin",
  "corporate_ll_manager",
  "senior_management",
  "corporate_viewer",
]);

export const projectLessonRoleEnum = pgEnum("project_lesson_role", [
  "ll_lead",
  "reviewer",
  "contributor",
  "viewer",
]);

export const confidentialityLevelEnum = pgEnum("confidentiality_level", [
  "internal",
  "confidential",
  "strictly_confidential",
]);

export const reusabilityLevelEnum = pgEnum("reusability_level", [
  "project_specific",
  "reusable_with_adaptation",
  "universally_applicable",
]);

export const lessonV2StatusEnum = pgEnum("lesson_v2_status", [
  "draft",
  "submitted",
  "under_review",
  "validated",
  "rejected",
  "archived",
]);

export const lessonClusterStatusEnum = pgEnum("lesson_cluster_status", [
  "draft",
  "under_review",
  "approved",
  "archived",
]);

export const recommendedActionStatusEnum = pgEnum("recommended_action_status", [
  "draft",
  "project_approved",
  "proposed_for_corporate",
  "corporate_review",
  "corporate_approved",
  "corporate_rejected",
  "retired",
  "archived",
]);

export const corporateActionStatusEnum = pgEnum("corporate_action_status", [
  "active",
  "under_review",
  "retired",
]);

export const projectActionStatusEnum = pgEnum("project_action_status", [
  "added_to_project",
  "assigned",
  "in_progress",
  "blocked",
  "implemented",
  "evidence_submitted",
  "verified",
  "closed",
  "cancelled",
]);

export const evidenceKindEnum = pgEnum("evidence_kind", ["file", "link", "note"]);

export const lessonCommentKindEnum = pgEnum("lesson_comment_kind", [
  "comment",
  "review_note",
]);

export const lessonEntityTypeEnum = pgEnum("lesson_entity_type", [
  "lesson",
  "lesson_cluster",
  "recommended_action",
  "corporate_recommended_action",
  "project_action",
  "project_membership",
  "project",
]);

// ─── Tables ──────────────────────────────────────────────────────────────────

export const portfolios = pgTable("portfolios", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerId: uuid("owner_id").notNull(), // references Supabase auth.users
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    phase: projectPhaseEnum("phase").notNull().default("maturation"),
    status: projectStatusEnum("status").notNull().default("active"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("projects_portfolio_id_idx").on(table.portfolioId)]
);

export const workPackages = pgTable(
  "work_packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    responsibleOrg: text("responsible_org"),
    isTemplate: boolean("is_template").notNull().default(false),
    color: text("color").notNull().default("#6366F1"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("work_packages_project_id_idx").on(table.projectId),
    uniqueIndex("work_packages_project_code_idx").on(
      table.projectId,
      table.code
    ),
  ]
);

export const interfaceRegisters = pgTable(
  "interface_registers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    packageAId: uuid("package_a_id")
      .notNull()
      .references(() => workPackages.id),
    packageBId: uuid("package_b_id")
      .notNull()
      .references(() => workPackages.id),
    status: registerStatusEnum("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("interface_registers_project_id_idx").on(table.projectId),
  ]
);

export const interfaceAgreements = pgTable(
  "interface_agreements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    registerId: uuid("register_id")
      .notNull()
      .references(() => interfaceRegisters.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    discipline: disciplineEnum("discipline"),
    status: agreementStatusEnum("status").notNull().default("draft"),
    agreedDate: timestamp("agreed_date", { withTimezone: true }),
    revision: integer("revision").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("interface_agreements_register_id_idx").on(table.registerId),
  ]
);

export const interfacePoints = pgTable(
  "interface_points",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agreementId: uuid("agreement_id")
      .notNull()
      .references(() => interfaceAgreements.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    criticality: criticalityEnum("criticality").notNull().default("minor"),
    status: pointStatusEnum("status").notNull().default("open"),
    phase: projectPhaseEnum("phase"),
    dueDate: date("due_date"),
    scopeSpecPackageId: uuid("scope_spec_package_id").references(() => workPackages.id),
    scopeSpecMode: scopeAllocationModeEnum("scope_spec_mode").notNull().default("package"),
    scopeDesPackageId: uuid("scope_des_package_id").references(() => workPackages.id),
    scopeDesMode: scopeAllocationModeEnum("scope_des_mode").notNull().default("package"),
    scopeSupPackageId: uuid("scope_sup_package_id").references(() => workPackages.id),
    scopeSupMode: scopeAllocationModeEnum("scope_sup_mode").notNull().default("package"),
    scopeOnAPackageId: uuid("scope_on_a_package_id").references(() => workPackages.id),
    scopeOnAMode: scopeAllocationModeEnum("scope_on_a_mode").notNull().default("package"),
    scopeOnTPackageId: uuid("scope_on_t_package_id").references(() => workPackages.id),
    scopeOnTMode: scopeAllocationModeEnum("scope_on_t_mode").notNull().default("package"),
    scopeOnCPackageId: uuid("scope_on_c_package_id").references(() => workPackages.id),
    scopeOnCMode: scopeAllocationModeEnum("scope_on_c_mode").notNull().default("package"),
    scopeOffTPackageId: uuid("scope_off_t_package_id").references(() => workPackages.id),
    scopeOffTMode: scopeAllocationModeEnum("scope_off_t_mode").notNull().default("package"),
    scopeOffIPackageId: uuid("scope_off_i_package_id").references(() => workPackages.id),
    scopeOffIMode: scopeAllocationModeEnum("scope_off_i_mode").notNull().default("package"),
    scopeOffCPackageId: uuid("scope_off_c_package_id").references(() => workPackages.id),
    scopeOffCMode: scopeAllocationModeEnum("scope_off_c_mode").notNull().default("package"),
    assetType: assetTypeEnum("asset_type"),
    assetPositionRef: text("asset_position_ref"),
    spatialX: real("spatial_x"),
    spatialY: real("spatial_y"),
    spatialZ: real("spatial_z"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("interface_points_agreement_id_status_idx").on(
      table.agreementId,
      table.status
    ),
    index("interface_points_scope_spec_pkg_idx").on(table.scopeSpecPackageId),
    index("interface_points_scope_des_pkg_idx").on(table.scopeDesPackageId),
    index("interface_points_scope_sup_pkg_idx").on(table.scopeSupPackageId),
    index("interface_points_scope_on_a_pkg_idx").on(table.scopeOnAPackageId),
    index("interface_points_scope_on_t_pkg_idx").on(table.scopeOnTPackageId),
    index("interface_points_scope_on_c_pkg_idx").on(table.scopeOnCPackageId),
    index("interface_points_scope_off_t_pkg_idx").on(table.scopeOffTPackageId),
    index("interface_points_scope_off_i_pkg_idx").on(table.scopeOffIPackageId),
    index("interface_points_scope_off_c_pkg_idx").on(table.scopeOffCPackageId),
  ]
);

export const deliverables = pgTable(
  "deliverables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    interfacePointId: uuid("interface_point_id")
      .notNull()
      .references(() => interfacePoints.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    responsiblePackageId: uuid("responsible_package_id").references(
      () => workPackages.id
    ),
    status: deliverableStatusEnum("status").notNull().default("not_started"),
    dueDate: date("due_date"),
    documentRef: text("document_ref"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("deliverables_interface_point_id_idx").on(table.interfacePointId),
  ]
);

export const interfaceQueries = pgTable(
  "interface_queries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    interfacePointId: uuid("interface_point_id")
      .notNull()
      .references(() => interfacePoints.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    raisedByPackageId: uuid("raised_by_package_id")
      .notNull()
      .references(() => workPackages.id),
    raisedByUserId: uuid("raised_by_user_id").notNull(),
    assignedToPackageId: uuid("assigned_to_package_id")
      .notNull()
      .references(() => workPackages.id),
    subject: text("subject").notNull(),
    description: text("description"),
    priority: queryPriorityEnum("priority").notNull().default("medium"),
    status: queryStatusEnum("status").notNull().default("open"),
    dueDate: date("due_date"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => [
    index("interface_queries_point_id_status_idx").on(
      table.interfacePointId,
      table.status
    ),
  ]
);

export const iqResponses = pgTable(
  "iq_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    queryId: uuid("query_id")
      .notNull()
      .references(() => interfaceQueries.id, { onDelete: "cascade" }),
    respondedByUserId: uuid("responded_by_user_id").notNull(),
    content: text("content").notNull(),
    status: iqResponseStatusEnum("status").notNull().default("submitted"),
    documentRef: text("document_ref"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("iq_responses_query_id_idx").on(table.queryId)]
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentType: text("parent_type").notNull(), // 'interface_point' | 'interface_query'
    parentId: uuid("parent_id").notNull(),
    authorId: uuid("author_id").notNull(),
    content: text("content").notNull(),
    mentions: uuid("mentions").array(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("comments_parent_idx").on(
      table.parentType,
      table.parentId,
      table.createdAt
    ),
  ]
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    type: text("type").notNull(),
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),
    message: text("message").notNull(),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("notifications_user_id_read_idx").on(
      table.userId,
      table.read,
      table.createdAt
    ),
  ]
);

export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    // actor display name cached at write time
    actorName: text("actor_name").notNull().default("Unknown"),
    // e.g. 'interface_point.created', 'iq.raised', 'iq.responded', 'deliverable.accepted'
    eventType: text("event_type").notNull(),
    // e.g. 'interface_point' | 'interface_query' | 'deliverable'
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    // short human label for the entity, cached at write time
    entityLabel: text("entity_label").notNull().default(""),
    // optional extra context (e.g. new status value)
    meta: jsonb("meta"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("activities_project_id_idx").on(table.projectId, table.createdAt),
    index("activities_entity_idx").on(table.entityType, table.entityId),
  ]
);

export const projectMembers = pgTable(
  "project_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    role: memberRoleEnum("role").notNull().default("viewer"),
    workPackageId: uuid("work_package_id").references(() => workPackages.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("project_members_project_user_idx").on(
      table.projectId,
      table.userId
    ),
  ]
);

export const userCorporateRoles = pgTable(
  "user_corporate_roles",
  {
    userId: uuid("user_id").primaryKey(),
    role: corporateRoleEnum("role").notNull().default("corporate_viewer"),
    assignedById: uuid("assigned_by_id"),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("user_corporate_roles_role_idx").on(table.role)]
);

export const lessonProjectMemberships = pgTable(
  "lesson_project_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    role: projectLessonRoleEnum("role").notNull().default("viewer"),
    canExport: boolean("can_export").notNull().default(false),
    createdById: uuid("created_by_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("lesson_project_memberships_project_user_idx").on(table.projectId, table.userId),
    index("lesson_project_memberships_project_role_idx").on(table.projectId, table.role),
  ]
);

export const memberWorkPackages = pgTable(
  "member_work_packages",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => projectMembers.id, { onDelete: "cascade" }),
    workPackageId: uuid("work_package_id")
      .notNull()
      .references(() => workPackages.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.memberId, table.workPackageId] })]
);

export const lessonCategories = pgTable(
  "lesson_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("lesson_categories_name_idx").on(table.name),
    index("lesson_categories_active_idx").on(table.active, table.sortOrder),
  ]
);

export const lessonWorkstreams = pgTable(
  "lesson_workstreams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("lesson_workstreams_project_name_idx").on(table.projectId, table.name),
    index("lesson_workstreams_project_active_idx").on(table.projectId, table.active),
  ]
);

export const lessonGates = pgTable(
  "lesson_gates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    plannedDate: date("planned_date"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("lesson_gates_project_name_idx").on(table.projectId, table.name),
    index("lesson_gates_project_date_idx").on(table.projectId, table.plannedDate),
  ]
);

export const assetPlacements = pgTable(
  "asset_placements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    assetType: assetTypeEnum("asset_type").notNull(),
    label: text("label").notNull(),
    positionX: real("position_x").notNull().default(0),
    positionY: real("position_y").notNull().default(0),
    positionZ: real("position_z").notNull().default(0),
    rotationY: real("rotation_y").notNull().default(0),
    modelRegistryAssetId: uuid("model_registry_asset_id").references(
      () => modelRegistryAssets.id
    ),
    lodLevel: integer("lod_level").notNull().default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("asset_placements_project_id_type_idx").on(
      table.projectId,
      table.assetType
    ),
  ]
);

export const modelRegistryAssets = pgTable(
  "model_registry_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    assetType: assetTypeEnum("asset_type").notNull(),
    semanticTag: text("semantic_tag"),
    versionLabel: text("version_label").notNull().default("v1"),
    fileName: text("file_name").notNull(),
    storagePath: text("storage_path").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    isActiveVersion: boolean("is_active_version").notNull().default(false),
    uploadedByUserId: uuid("uploaded_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("model_registry_assets_project_idx").on(table.projectId, table.createdAt),
    index("model_registry_assets_type_idx").on(table.projectId, table.assetType),
    uniqueIndex("model_registry_assets_storage_path_idx").on(table.storagePath),
  ]
);

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    entityType: attachmentEntityEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    fileName: text("file_name").notNull(),
    storagePath: text("storage_path").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedByUserId: uuid("uploaded_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("attachments_storage_path_idx").on(table.storagePath),
    index("attachments_project_id_idx").on(table.projectId, table.createdAt),
    index("attachments_entity_idx").on(
      table.entityType,
      table.entityId,
      table.createdAt
    ),
  ]
);

export const deadlineDigestSends = pgTable(
  "deadline_digest_sends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    digestDate: date("digest_date").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    contentHash: text("content_hash").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("deadline_digest_unique_idx").on(
      table.digestDate,
      table.projectId,
      table.userId
    ),
    index("deadline_digest_date_idx").on(table.digestDate, table.projectId),
  ]
);

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: organizationTypeEnum("type").notNull(),
    abbreviation: text("abbreviation"),
    color: text("color"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("organizations_project_idx").on(table.projectId),
    uniqueIndex("organizations_project_name_idx").on(table.projectId, table.name),
  ]
);

export const projectMemberOrganizationRoles = pgTable(
  "project_member_organization_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectMemberId: uuid("project_member_id")
      .notNull()
      .references(() => projectMembers.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    interfaceRole: interfacePartyRoleEnum("interface_role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("member_org_roles_member_idx").on(table.projectMemberId),
    uniqueIndex("member_org_roles_unique_idx").on(
      table.projectMemberId,
      table.organizationId,
      table.interfaceRole
    ),
  ]
);

export const interfaceCases = pgTable(
  "interface_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    sourceEntityType: text("source_entity_type"),
    sourceEntityId: uuid("source_entity_id"),
    requestingOrganizationId: uuid("requesting_organization_id").references(
      () => organizations.id
    ),
    providingOrganizationId: uuid("providing_organization_id").references(
      () => organizations.id
    ),
    responsibleOrganizationId: uuid("responsible_organization_id").references(
      () => organizations.id
    ),
    requestingPartyMemberId: uuid("requesting_party_member_id").references(
      () => projectMembers.id
    ),
    providingPartyMemberId: uuid("providing_party_member_id").references(
      () => projectMembers.id
    ),
    responsiblePartyMemberId: uuid("responsible_party_member_id").references(
      () => projectMembers.id
    ),
    employerGateRequired: boolean("employer_gate_required").notNull().default(true),
    employerApprovalId: uuid("employer_approval_id"),
    currentState: interfaceCaseStateEnum("current_state")
      .notNull()
      .default("draft_dir"),
    dueDate: date("due_date"),
    slaDueAt: timestamp("sla_due_at", { withTimezone: true }),
    employerValidatedAt: timestamp("employer_validated_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("interface_cases_project_state_idx").on(table.projectId, table.currentState),
    index("interface_cases_sla_idx").on(table.projectId, table.slaDueAt),
  ]
);

export const interfaceCaseEvents = pgTable(
  "interface_case_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => interfaceCases.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    eventType: interfaceCaseEventTypeEnum("event_type").notNull(),
    fromState: interfaceCaseStateEnum("from_state"),
    toState: interfaceCaseStateEnum("to_state"),
    actorMemberId: uuid("actor_member_id").references(() => projectMembers.id),
    actorUserId: uuid("actor_user_id").notNull(),
    summary: text("summary"),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("interface_case_events_case_idx").on(table.caseId, table.createdAt),
    index("interface_case_events_project_idx").on(table.projectId, table.createdAt),
  ]
);

export const interfaceMatrixRevisions = pgTable(
  "interface_matrix_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    revisionLabel: text("revision_label").notNull(),
    sourceDocumentRef: text("source_document_ref"),
    issuedFor: text("issued_for"),
    preparedBy: text("prepared_by"),
    checkedBy: text("checked_by"),
    approvedBy: text("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    effectiveDate: date("effective_date"),
    isLocked: boolean("is_locked").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("interface_matrix_revision_unique_idx").on(
      table.projectId,
      table.revisionLabel
    ),
  ]
);

export const interfaceMatrixRows = pgTable(
  "interface_matrix_rows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    revisionId: uuid("revision_id")
      .notNull()
      .references(() => interfaceMatrixRevisions.id, { onDelete: "cascade" }),
    interfaceId: text("interface_id").notNull(),
    emplInternalRevision: integer("empl_internal_revision"),
    groupCode: text("group_code"),
    groupName: text("group_name"),
    interfaceComponent: text("interface_component").notNull(),
    description: text("description"),
    displayOrder: integer("display_order"),
    parentRowId: uuid("parent_row_id"),
    isActive: boolean("is_active").notNull().default(true),
    specOrgId: uuid("spec_org_id").references(() => organizations.id),
    desOrgId: uuid("des_org_id").references(() => organizations.id),
    supOrgId: uuid("sup_org_id").references(() => organizations.id),
    onAOrgId: uuid("on_a_org_id").references(() => organizations.id),
    onTOrgId: uuid("on_t_org_id").references(() => organizations.id),
    onCOrgId: uuid("on_c_org_id").references(() => organizations.id),
    offTOrgId: uuid("off_t_org_id").references(() => organizations.id),
    offIOrgId: uuid("off_i_org_id").references(() => organizations.id),
    offCOrgId: uuid("off_c_org_id").references(() => organizations.id),
    responsibleOrganizationId: uuid("responsible_organization_id").references(
      () => organizations.id
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("interface_matrix_rows_unique_id_idx").on(
      table.projectId,
      table.revisionId,
      table.interfaceId
    ),
    index("interface_matrix_rows_revision_idx").on(table.revisionId),
  ]
);

export const interfaceMatrixAllocations = pgTable(
  "interface_matrix_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    rowId: uuid("row_id")
      .notNull()
      .references(() => interfaceMatrixRows.id, { onDelete: "cascade" }),
    phaseColumn: matrixPhaseColumnEnum("phase_column").notNull(),
    organizationId: uuid("organization_id").references(() => organizations.id),
    isResponsible: boolean("is_responsible").notNull().default(false),
    isNotRelevant: boolean("is_not_relevant").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("interface_matrix_allocations_row_idx").on(table.rowId, table.phaseColumn),
    index("interface_matrix_allocations_project_idx").on(table.projectId, table.createdAt),
  ]
);

export const interfaceMatrixPacks = pgTable(
  "interface_matrix_packs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    revisionId: uuid("revision_id")
      .notNull()
      .references(() => interfaceMatrixRevisions.id, { onDelete: "cascade" }),
    xlsxStoragePath: text("xlsx_storage_path").notNull(),
    pdfStoragePath: text("pdf_storage_path").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    generatedBy: uuid("generated_by").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("interface_matrix_packs_revision_idx").on(table.revisionId, table.generatedAt)]
);

export const interfaceMeetings = pgTable(
  "interface_meetings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    meetingType: text("meeting_type").notNull().default("regular"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    agenda: text("agenda"),
    minutes: text("minutes"),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("interface_meetings_project_idx").on(table.projectId, table.startsAt)]
);

export const interfaceMeetingAttendance = pgTable(
  "interface_meeting_attendance",
  {
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => interfaceMeetings.id, { onDelete: "cascade" }),
    projectMemberId: uuid("project_member_id")
      .notNull()
      .references(() => projectMembers.id, { onDelete: "cascade" }),
    attended: boolean("attended").notNull().default(false),
  },
  (table) => [primaryKey({ columns: [table.meetingId, table.projectMemberId] })]
);

export const interfaceMonthlyReports = pgTable(
  "interface_monthly_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    organizationId: uuid("organization_id").references(() => organizations.id),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    generatedBy: uuid("generated_by").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  },
  (table) => [
    uniqueIndex("interface_monthly_reports_unique_idx").on(
      table.projectId,
      table.year,
      table.month,
      table.organizationId
    ),
  ]
);

export const interfaceAuditExports = pgTable(
  "interface_audit_exports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    exportType: text("export_type").notNull(),
    requestedBy: uuid("requested_by").notNull(),
    storagePath: text("storage_path"),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("interface_audit_exports_project_idx").on(table.projectId, table.createdAt)]
);

export const interfaceTrackerItems = pgTable(
  "interface_tracker_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    sectionTitle: text("section_title"),
    status: trackerItemStatusEnum("status").notNull().default("open"),
    openedOn: date("opened_on"),
    actionText: text("action_text"),
    actionOwnerText: text("action_owner_text"),
    whoText: text("who_text"),
    dueTextRaw: text("due_text_raw"),
    dueDate: date("due_date"),
    impactedText: text("impacted_text"),
    commentsText: text("comments_text"),
    sourceWorkbook: text("source_workbook"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("interface_tracker_items_unique_idx").on(
      table.projectId,
      table.externalId,
      table.sectionTitle
    ),
    index("interface_tracker_items_status_idx").on(table.projectId, table.status),
  ]
);

export const interfaceTrackerEvents = pgTable(
  "interface_tracker_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    trackerItemId: uuid("tracker_item_id")
      .notNull()
      .references(() => interfaceTrackerItems.id, { onDelete: "cascade" }),
    eventDate: date("event_date"),
    content: text("content").notNull(),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("interface_tracker_events_item_idx").on(table.trackerItemId, table.createdAt)]
);

export const interfaceTrackerCaseLinks = pgTable(
  "interface_tracker_case_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    trackerItemId: uuid("tracker_item_id")
      .notNull()
      .references(() => interfaceTrackerItems.id, { onDelete: "cascade" }),
    caseId: uuid("case_id")
      .notNull()
      .references(() => interfaceCases.id, { onDelete: "cascade" }),
    linkedBy: uuid("linked_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("interface_tracker_case_links_unique_idx").on(table.trackerItemId, table.caseId),
    index("interface_tracker_case_links_project_idx").on(table.projectId, table.createdAt),
  ]
);

export const mocChanges = pgTable(
  "moc_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    mocId: text("moc_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    decisionLogRef: text("decision_log_ref"),
    thresholdFlag: boolean("threshold_flag").notNull().default(false),
    affectsMultiplePackages: boolean("affects_multiple_packages").notNull().default(false),
    costImpactEur: real("cost_impact_eur"),
    hseqImpact: boolean("hseq_impact").notNull().default(false),
    scheduleImpact: boolean("schedule_impact").notNull().default(false),
    status: mocStatusEnum("status").notNull().default("draft"),
    implementationStatus: mocImplementationStatusEnum("implementation_status")
      .notNull()
      .default("not_started"),
    auditDueAt: timestamp("audit_due_at", { withTimezone: true }),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("moc_changes_project_moc_id_idx").on(table.projectId, table.mocId),
    index("moc_changes_project_status_idx").on(table.projectId, table.status),
  ]
);

export const mocApprovals = pgTable(
  "moc_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    mocChangeId: uuid("moc_change_id")
      .notNull()
      .references(() => mocChanges.id, { onDelete: "cascade" }),
    approvalLevel: mocApprovalLevelEnum("approval_level").notNull(),
    decision: mocApprovalDecisionEnum("decision").notNull().default("pending"),
    approverMemberId: uuid("approver_member_id").references(() => projectMembers.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("moc_approvals_unique_level_idx").on(table.mocChangeId, table.approvalLevel),
    index("moc_approvals_project_idx").on(table.projectId, table.createdAt),
  ]
);

export const mocEntityLinks = pgTable(
  "moc_entity_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    mocChangeId: uuid("moc_change_id")
      .notNull()
      .references(() => mocChanges.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    linkedBy: uuid("linked_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("moc_entity_links_unique_idx").on(table.mocChangeId, table.entityType, table.entityId),
    index("moc_entity_links_project_idx").on(table.projectId, table.createdAt),
  ]
);

export const customAnchorDefinitions = pgTable("custom_anchor_definitions", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  assetType: text("asset_type").notNull(),
  key: text("key").notNull(),
  label: text("label").notNull(),
  positionX: real("position_x").notNull(),
  positionY: real("position_y").notNull(),
  positionZ: real("position_z").notNull(),
  normalX: real("normal_x"),
  normalY: real("normal_y"),
  normalZ: real("normal_z"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("custom_anchor_project_asset_key_idx").on(table.projectId, table.assetType, table.key),
]);

export const lessonsLearned = pgTable(
  "lessons_learned",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    recommendation: text("recommendation"),
    type: llTypeEnum("type").notNull().default("problem"),
    discipline: llDisciplineEnum("discipline").notNull().default("other"),
    projectPhase: projectPhaseEnum("project_phase"),
    status: llStatusEnum("status").notNull().default("draft"),
    workflowState: lessonWorkflowStateEnum("workflow_state").notNull().default("ingested"),
    authorId: uuid("author_id").notNull(),
    validatedById: uuid("validated_by_id"),
    validatedAt: timestamp("validated_at", { withTimezone: true }),
    consolidatedById: uuid("consolidated_by_id"),
    consolidatedAt: timestamp("consolidated_at", { withTimezone: true }),
    workPackageId: uuid("work_package_id").references(() => workPackages.id, {
      onDelete: "set null",
    }),
    ownershipState: llOwnershipStateEnum("ownership_state").notNull().default("permissive"),
    ownershipChangedById: uuid("ownership_changed_by_id"),
    ownershipChangedAt: timestamp("ownership_changed_at", { withTimezone: true }),
    ownershipRationale: text("ownership_rationale"),
    location: text("location"),
    tags: text("tags").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("lessons_learned_project_id_idx").on(table.projectId),
    index("lessons_learned_project_status_idx").on(table.projectId, table.status),
    index("lessons_learned_project_discipline_idx").on(table.projectId, table.discipline),
    index("lessons_learned_project_ownership_idx").on(table.projectId, table.ownershipState),
  ]
);

export const lessonLearnedPoints = pgTable(
  "lesson_learned_points",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessonsLearned.id, { onDelete: "cascade" }),
    interfacePointId: uuid("interface_point_id")
      .notNull()
      .references(() => interfacePoints.id, { onDelete: "cascade" }),
    linkedBy: uuid("linked_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("lesson_learned_points_unique_idx").on(table.lessonId, table.interfacePointId),
    index("lesson_learned_points_lesson_idx").on(table.lessonId, table.createdAt),
    index("lesson_learned_points_point_idx").on(table.interfacePointId, table.createdAt),
  ]
);

export const lessonLearnedChangeRequests = pgTable(
  "lesson_learned_change_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessonsLearned.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    proposerId: uuid("proposer_id").notNull(),
    status: llChangeRequestStatusEnum("status").notNull().default("pending"),
    proposedTitle: text("proposed_title").notNull(),
    proposedDescription: text("proposed_description").notNull(),
    proposedRecommendation: text("proposed_recommendation"),
    proposedType: llTypeEnum("proposed_type").notNull(),
    proposedDiscipline: llDisciplineEnum("proposed_discipline").notNull(),
    proposedProjectPhase: projectPhaseEnum("proposed_project_phase"),
    proposedWorkPackageId: uuid("proposed_work_package_id").references(
      () => workPackages.id,
      { onDelete: "set null" }
    ),
    reviewerId: uuid("reviewer_id"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("lesson_learned_change_requests_project_idx").on(table.projectId, table.status),
    index("lesson_learned_change_requests_lesson_idx").on(table.lessonId, table.status),
  ]
);

export const lessonPolicyProfiles = pgTable(
  "lesson_policy_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    portfolioId: uuid("portfolio_id").references(() => portfolios.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull().default("Default Policy"),
    trackAApprovalEur250k: integer("track_a_approval_eur_250k").notNull().default(250000),
    trackAApprovalEur1m: integer("track_a_approval_eur_1m").notNull().default(1000000),
    monthlyTriageDay: integer("monthly_triage_day").notNull().default(1),
    preGateLeadWeeks: integer("pre_gate_lead_weeks").notNull().default(6),
    reminderSlaDays: integer("reminder_sla_days").notNull().default(5),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("lesson_policy_profiles_portfolio_idx").on(table.portfolioId, table.active),
  ]
);

export const projectLessonPolicyAssignments = pgTable(
  "project_lesson_policy_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    policyProfileId: uuid("policy_profile_id")
      .notNull()
      .references(() => lessonPolicyProfiles.id, { onDelete: "cascade" }),
    assignedBy: uuid("assigned_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("project_lesson_policy_assignments_project_idx").on(table.projectId),
  ]
);

export const projectLessonRoleAssignments = pgTable(
  "project_lesson_role_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => projectMembers.id, { onDelete: "cascade" }),
    roleType: lessonRoleTypeEnum("role_type").notNull(),
    assignedBy: uuid("assigned_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("project_lesson_role_unique_idx").on(table.projectId, table.memberId, table.roleType),
    index("project_lesson_role_project_idx").on(table.projectId, table.roleType),
  ]
);

export const lessonCycles = pgTable(
  "lesson_cycles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    policyProfileId: uuid("policy_profile_id").references(() => lessonPolicyProfiles.id, {
      onDelete: "set null",
    }),
    cycleType: lessonCycleTypeEnum("cycle_type").notNull(),
    state: lessonCycleStateEnum("state").notNull().default("planned"),
    cycleLabel: text("cycle_label").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    gateDate: date("gate_date"),
    tMinus6At: timestamp("t_minus_6_at", { withTimezone: true }),
    tMinus5At: timestamp("t_minus_5_at", { withTimezone: true }),
    tMinus4At: timestamp("t_minus_4_at", { withTimezone: true }),
    tMinus3At: timestamp("t_minus_3_at", { withTimezone: true }),
    tMinus2At: timestamp("t_minus_2_at", { withTimezone: true }),
    tMinus1At: timestamp("t_minus_1_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("lesson_cycles_project_state_idx").on(table.projectId, table.state, table.cycleType),
  ]
);

export const lessonTriageDecisions = pgTable(
  "lesson_triage_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    cycleId: uuid("cycle_id").references(() => lessonCycles.id, { onDelete: "set null" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessonsLearned.id, { onDelete: "cascade" }),
    decision: lessonTriageDecisionEnum("decision").notNull(),
    rationale: text("rationale").notNull(),
    duplicateOfLessonId: uuid("duplicate_of_lesson_id").references(() => lessonsLearned.id, {
      onDelete: "set null",
    }),
    deferTrigger: text("defer_trigger"),
    reviewerId: uuid("reviewer_id").notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("lesson_triage_decisions_lesson_unique_idx").on(table.lessonId),
    index("lesson_triage_decisions_project_decision_idx").on(table.projectId, table.decision),
  ]
);

export const lessonClusters = pgTable(
  "lesson_clusters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    cycleId: uuid("cycle_id").references(() => lessonCycles.id, { onDelete: "set null" }),
    packageId: uuid("package_id").references(() => workPackages.id, { onDelete: "set null" }),
    clusterName: text("cluster_name").notNull(),
    phase: projectPhaseEnum("phase"),
    rootCause: text("root_cause"),
    eventNarrative: text("event_narrative"),
    impactSummary: text("impact_summary"),
    impactCostEur: integer("impact_cost_eur"),
    impactScheduleDays: integer("impact_schedule_days"),
    isCrossPackage: boolean("is_cross_package").notNull().default(false),
    trackType: text("track_type"),
    trackRationale: text("track_rationale"),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("lesson_clusters_project_cycle_idx").on(table.projectId, table.cycleId, table.createdAt),
    index("lesson_clusters_project_track_idx").on(table.projectId, table.trackType),
  ]
);

export const lessonClusterItems = pgTable(
  "lesson_cluster_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    clusterId: uuid("cluster_id")
      .notNull()
      .references(() => lessonClusters.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessonsLearned.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("lesson_cluster_items_unique_idx").on(table.clusterId, table.lessonId),
    index("lesson_cluster_items_project_cluster_idx").on(table.projectId, table.clusterId),
  ]
);

export const lessonTrackAActions = pgTable(
  "lesson_track_a_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    cycleId: uuid("cycle_id").references(() => lessonCycles.id, { onDelete: "set null" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessonsLearned.id, { onDelete: "cascade" }),
    clusterId: uuid("cluster_id").references(() => lessonClusters.id, { onDelete: "set null" }),
    ownerUserId: uuid("owner_user_id"),
    approvalLevel: text("approval_level"),
    priority: lessonActionPriorityEnum("priority").notNull().default("do"),
    status: lessonActionStatusEnum("status").notNull().default("not_started"),
    actionText: text("action_text").notNull(),
    successCriteria: text("success_criteria"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    estimatedCostEur: integer("estimated_cost_eur"),
    approvedBy: uuid("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("lesson_track_a_actions_project_status_idx").on(table.projectId, table.status, table.dueAt),
    index("lesson_track_a_actions_project_owner_idx").on(table.projectId, table.ownerUserId),
  ]
);

export const lessonActionEvidence = pgTable(
  "lesson_action_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    actionId: uuid("action_id")
      .notNull()
      .references(() => lessonTrackAActions.id, { onDelete: "cascade" }),
    evidenceType: text("evidence_type").notNull(),
    evidenceRef: text("evidence_ref").notNull(),
    notes: text("notes"),
    addedBy: uuid("added_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("lesson_action_evidence_project_action_idx").on(table.projectId, table.actionId),
  ]
);

export const lessonTrackBEscalations = pgTable(
  "lesson_track_b_escalations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    cycleId: uuid("cycle_id").references(() => lessonCycles.id, { onDelete: "set null" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessonsLearned.id, { onDelete: "cascade" }),
    clusterId: uuid("cluster_id").references(() => lessonClusters.id, { onDelete: "set null" }),
    status: lessonEscalationStatusEnum("status").notNull().default("draft"),
    structuralIssue: text("structural_issue").notNull(),
    proposedCorporateAction: text("proposed_corporate_action").notNull(),
    departmentOwner: text("department_owner"),
    recommendedTargetPhase: projectPhaseEnum("recommended_target_phase"),
    submittedBy: uuid("submitted_by"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    acknowledgedBy: uuid("acknowledged_by"),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    dueBy: timestamp("due_by", { withTimezone: true }),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("lesson_track_b_escalations_project_status_idx").on(table.projectId, table.status, table.dueBy),
  ]
);

export const lessonPackageReports = pgTable(
  "lesson_package_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    cycleId: uuid("cycle_id").references(() => lessonCycles.id, { onDelete: "set null" }),
    packageId: uuid("package_id").references(() => workPackages.id, { onDelete: "set null" }),
    version: integer("version").notNull().default(1),
    reportHtmlPath: text("report_html_path").notNull(),
    reportPdfPath: text("report_pdf_path").notNull(),
    reportXlsxPath: text("report_xlsx_path").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    generatedBy: uuid("generated_by").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("lesson_package_reports_project_cycle_idx").on(table.projectId, table.cycleId, table.generatedAt),
  ]
);

export const lessonsV2 = pgTable(
  "lessons_v2",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    type: llTypeEnum("type").notNull().default("problem"),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => lessonCategories.id, { onDelete: "restrict" }),
    status: lessonV2StatusEnum("status").notNull().default("draft"),
    authorId: uuid("author_id").notNull(),
    observedDate: date("observed_date"),
    workstreamId: uuid("workstream_id").references(() => lessonWorkstreams.id, {
      onDelete: "set null",
    }),
    packageRef: text("package_ref"),
    projectPhase: projectPhaseEnum("project_phase"),
    gateId: uuid("gate_id").references(() => lessonGates.id, { onDelete: "set null" }),
    impactLevel: text("impact_level"),
    rootCause: text("root_cause"),
    sourceOrganisation: text("source_organisation"),
    tags: text("tags").array().notNull().default([]),
    confidentialityLevel: confidentialityLevelEnum("confidentiality_level")
      .notNull()
      .default("internal"),
    duplicateOfLessonId: uuid("duplicate_of_lesson_id"),
    validatedById: uuid("validated_by_id"),
    validatedAt: timestamp("validated_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("lessons_v2_project_status_idx").on(table.projectId, table.status),
    index("lessons_v2_project_category_idx").on(table.projectId, table.categoryId),
    index("lessons_v2_project_workstream_idx").on(table.projectId, table.workstreamId),
    index("lessons_v2_project_gate_idx").on(table.projectId, table.gateId),
    index("lessons_v2_author_idx").on(table.authorId, table.createdAt),
  ]
);

export const lessonClustersV2 = pgTable(
  "lesson_clusters_v2",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    summary: text("summary").notNull(),
    status: lessonClusterStatusEnum("status").notNull().default("draft"),
    workstreamId: uuid("workstream_id").references(() => lessonWorkstreams.id, {
      onDelete: "set null",
    }),
    projectPhase: projectPhaseEnum("project_phase"),
    rootCause: text("root_cause"),
    impactSummary: text("impact_summary"),
    impactCostEur: integer("impact_cost_eur"),
    impactScheduleDays: integer("impact_schedule_days"),
    createdById: uuid("created_by_id").notNull(),
    approvedById: uuid("approved_by_id"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("lesson_clusters_v2_project_status_idx").on(table.projectId, table.status),
    index("lesson_clusters_v2_project_workstream_idx").on(table.projectId, table.workstreamId),
  ]
);

export const lessonClusterLinksV2 = pgTable(
  "lesson_cluster_links_v2",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clusterId: uuid("cluster_id")
      .notNull()
      .references(() => lessonClustersV2.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessonsV2.id, { onDelete: "cascade" }),
    addedById: uuid("added_by_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("lesson_cluster_links_v2_unique_idx").on(table.clusterId, table.lessonId),
    index("lesson_cluster_links_v2_lesson_idx").on(table.lessonId),
  ]
);

export const recommendedActions = pgTable(
  "recommended_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    actionDescription: text("action_description").notNull(),
    implementationGuidance: text("implementation_guidance"),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => lessonCategories.id, { onDelete: "restrict" }),
    status: recommendedActionStatusEnum("status").notNull().default("draft"),
    reusabilityLevel: reusabilityLevelEnum("reusability_level")
      .notNull()
      .default("project_specific"),
    confidentialityLevel: confidentialityLevelEnum("confidentiality_level")
      .notNull()
      .default("internal"),
    sourceLessonId: uuid("source_lesson_id").references(() => lessonsV2.id, {
      onDelete: "set null",
    }),
    sourceClusterId: uuid("source_cluster_id").references(() => lessonClustersV2.id, {
      onDelete: "set null",
    }),
    isCorporateCandidate: boolean("is_corporate_candidate").notNull().default(false),
    corporateActionId: uuid("corporate_action_id"),
    transferChecklist: jsonb("transfer_checklist").$type<Record<string, boolean> | null>(),
    transferProposedById: uuid("transfer_proposed_by_id"),
    transferProposedAt: timestamp("transfer_proposed_at", { withTimezone: true }),
    corporateReviewById: uuid("corporate_review_by_id"),
    corporateReviewedAt: timestamp("corporate_reviewed_at", { withTimezone: true }),
    corporateReviewNote: text("corporate_review_note"),
    createdById: uuid("created_by_id").notNull(),
    approvedById: uuid("approved_by_id"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    retiredReason: text("retired_reason"),
    tags: text("tags").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("recommended_actions_project_status_idx").on(table.projectId, table.status),
    index("recommended_actions_project_category_idx").on(table.projectId, table.categoryId),
    index("recommended_actions_source_lesson_idx").on(table.sourceLessonId),
    index("recommended_actions_source_cluster_idx").on(table.sourceClusterId),
    index("recommended_actions_corporate_action_idx").on(table.corporateActionId),
  ]
);

export const corporateRecommendedActions = pgTable(
  "corporate_recommended_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    actionDescription: text("action_description").notNull(),
    implementationGuidance: text("implementation_guidance"),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => lessonCategories.id, { onDelete: "restrict" }),
    status: corporateActionStatusEnum("status").notNull().default("active"),
    reusabilityLevel: reusabilityLevelEnum("reusability_level")
      .notNull()
      .default("reusable_with_adaptation"),
    applicablePhases: projectPhaseEnum("applicable_phases").array().notNull().default([]),
    applicableWorkstreams: text("applicable_workstreams").array().notNull().default([]),
    tags: text("tags").array().notNull().default([]),
    sourceRecommendedActionId: uuid("source_recommended_action_id")
      .notNull()
      .references(() => recommendedActions.id, { onDelete: "restrict" }),
    sourceProjectId: uuid("source_project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    originSummary: text("origin_summary"),
    sourceProjectVisibleToManagersOnly: boolean("source_project_visible_to_managers_only")
      .notNull()
      .default(true),
    publishedById: uuid("published_by_id").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    retiredReason: text("retired_reason"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("corporate_recommended_actions_status_idx").on(table.status, table.publishedAt),
    index("corporate_recommended_actions_category_idx").on(table.categoryId),
    index("corporate_recommended_actions_source_idx").on(table.sourceRecommendedActionId),
  ]
);

export const projectActions = pgTable(
  "project_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    actionDescription: text("action_description").notNull(),
    implementationGuidance: text("implementation_guidance"),
    categoryId: uuid("category_id").references(() => lessonCategories.id, {
      onDelete: "set null",
    }),
    status: projectActionStatusEnum("status").notNull().default("added_to_project"),
    sourceCorporateActionId: uuid("source_corporate_action_id").references(
      () => corporateRecommendedActions.id,
      { onDelete: "set null" }
    ),
    sourceCorporateActionVersion: integer("source_corporate_action_version"),
    sourceRecommendedActionId: uuid("source_recommended_action_id").references(
      () => recommendedActions.id,
      { onDelete: "set null" }
    ),
    currentOwnerId: uuid("current_owner_id"),
    deadline: date("deadline"),
    blockedReason: text("blocked_reason"),
    verifiedById: uuid("verified_by_id"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    closedById: uuid("closed_by_id"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    cancelledReason: text("cancelled_reason"),
    duplicateOverrideReason: text("duplicate_override_reason"),
    tags: text("tags").array().notNull().default([]),
    createdById: uuid("created_by_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("project_actions_project_status_idx").on(table.projectId, table.status, table.deadline),
    index("project_actions_project_owner_idx").on(table.projectId, table.currentOwnerId),
    index("project_actions_source_corporate_idx").on(table.sourceCorporateActionId, table.projectId),
    index("project_actions_source_recommended_idx").on(table.sourceRecommendedActionId, table.projectId),
  ]
);

export const actionAssignments = pgTable(
  "action_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectActionId: uuid("project_action_id")
      .notNull()
      .references(() => projectActions.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    ownerId: uuid("owner_id").notNull(),
    assignedById: uuid("assigned_by_id").notNull(),
    deadlineAtAssignment: date("deadline_at_assignment").notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
  },
  (table) => [
    index("action_assignments_action_idx").on(table.projectActionId, table.assignedAt),
    index("action_assignments_project_owner_idx").on(table.projectId, table.ownerId),
  ]
);

export const lessonEvidence = pgTable(
  "lesson_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    entityType: lessonEntityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    kind: evidenceKindEnum("kind").notNull(),
    fileName: text("file_name"),
    storagePath: text("storage_path"),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    url: text("url"),
    note: text("note"),
    addedById: uuid("added_by_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("lesson_evidence_entity_idx").on(table.entityType, table.entityId, table.createdAt),
    index("lesson_evidence_project_idx").on(table.projectId, table.createdAt),
    uniqueIndex("lesson_evidence_storage_path_idx").on(table.storagePath),
  ]
);

export const lessonComments = pgTable(
  "lesson_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    entityType: lessonEntityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    authorId: uuid("author_id").notNull(),
    body: text("body").notNull(),
    kind: lessonCommentKindEnum("kind").notNull().default("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("lesson_comments_entity_idx").on(table.entityType, table.entityId, table.createdAt),
    index("lesson_comments_project_idx").on(table.projectId, table.createdAt),
  ]
);

export const lessonAuditLog = pgTable(
  "lesson_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    entityType: lessonEntityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    eventType: text("event_type").notNull(),
    actorId: uuid("actor_id").notNull(),
    actorName: text("actor_name"),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    note: text("note"),
    previousValue: jsonb("previous_value").$type<Record<string, unknown> | null>(),
    newValue: jsonb("new_value").$type<Record<string, unknown> | null>(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("lesson_audit_log_entity_idx").on(table.entityType, table.entityId, table.createdAt),
    index("lesson_audit_log_project_idx").on(table.projectId, table.createdAt),
    index("lesson_audit_log_actor_idx").on(table.actorId, table.createdAt),
    index("lesson_audit_log_event_idx").on(table.eventType, table.createdAt),
  ]
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const portfoliosRelations = relations(portfolios, ({ many }) => ({
  projects: many(projects),
  lessonPolicyProfiles: many(lessonPolicyProfiles),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  portfolio: one(portfolios, {
    fields: [projects.portfolioId],
    references: [portfolios.id],
  }),
  workPackages: many(workPackages),
  interfaceRegisters: many(interfaceRegisters),
  projectMembers: many(projectMembers),
  lessonProjectMemberships: many(lessonProjectMemberships),
  lessonWorkstreams: many(lessonWorkstreams),
  lessonGates: many(lessonGates),
  assetPlacements: many(assetPlacements),
  cableRoutes: many(cableRoutes),
  modelRegistryAssets: many(modelRegistryAssets),
  attachments: many(attachments),
  deadlineDigestSends: many(deadlineDigestSends),
  organizations: many(organizations),
  interfaceCases: many(interfaceCases),
  interfaceCaseEvents: many(interfaceCaseEvents),
  interfaceMatrixRevisions: many(interfaceMatrixRevisions),
  interfaceMatrixRows: many(interfaceMatrixRows),
  interfaceMeetings: many(interfaceMeetings),
  interfaceMonthlyReports: many(interfaceMonthlyReports),
  interfaceAuditExports: many(interfaceAuditExports),
  lessonsLearned: many(lessonsLearned),
  lessonsV2: many(lessonsV2),
  lessonClustersV2: many(lessonClustersV2),
  recommendedActions: many(recommendedActions),
  sourceCorporateRecommendedActions: many(corporateRecommendedActions),
  projectActions: many(projectActions),
  actionAssignments: many(actionAssignments),
  lessonEvidence: many(lessonEvidence),
  lessonComments: many(lessonComments),
  lessonAuditLog: many(lessonAuditLog),
  lessonLearnedChangeRequests: many(lessonLearnedChangeRequests),
  lessonPolicyAssignments: many(projectLessonPolicyAssignments),
  projectLessonRoleAssignments: many(projectLessonRoleAssignments),
  lessonCycles: many(lessonCycles),
  lessonTriageDecisions: many(lessonTriageDecisions),
  lessonClusters: many(lessonClusters),
  lessonTrackAActions: many(lessonTrackAActions),
  lessonTrackBEscalations: many(lessonTrackBEscalations),
  lessonPackageReports: many(lessonPackageReports),
}));

export const workPackagesRelations = relations(workPackages, ({ one, many }) => ({
  project: one(projects, {
    fields: [workPackages.projectId],
    references: [projects.id],
  }),
  legacyLessons: many(lessonsLearned),
  lessonsV2: many(lessonsV2),
}));

export const interfaceRegistersRelations = relations(
  interfaceRegisters,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [interfaceRegisters.projectId],
      references: [projects.id],
    }),
    packageA: one(workPackages, {
      fields: [interfaceRegisters.packageAId],
      references: [workPackages.id],
      relationName: "packageA",
    }),
    packageB: one(workPackages, {
      fields: [interfaceRegisters.packageBId],
      references: [workPackages.id],
      relationName: "packageB",
    }),
    agreements: many(interfaceAgreements),
  })
);

export const interfaceAgreementsRelations = relations(
  interfaceAgreements,
  ({ one, many }) => ({
    register: one(interfaceRegisters, {
      fields: [interfaceAgreements.registerId],
      references: [interfaceRegisters.id],
    }),
    points: many(interfacePoints),
  })
);

export const interfacePointsRelations = relations(
  interfacePoints,
  ({ one, many }) => ({
    agreement: one(interfaceAgreements, {
      fields: [interfacePoints.agreementId],
      references: [interfaceAgreements.id],
    }),
    deliverables: many(deliverables),
    queries: many(interfaceQueries),
    lessonLinks: many(lessonLearnedPoints),
  })
);

export const lessonsLearnedRelations = relations(lessonsLearned, ({ one, many }) => ({
  project: one(projects, {
    fields: [lessonsLearned.projectId],
    references: [projects.id],
  }),
  workPackage: one(workPackages, {
    fields: [lessonsLearned.workPackageId],
    references: [workPackages.id],
  }),
  linkedPoints: many(lessonLearnedPoints),
  changeRequests: many(lessonLearnedChangeRequests),
}));

export const lessonLearnedPointsRelations = relations(lessonLearnedPoints, ({ one }) => ({
  lesson: one(lessonsLearned, {
    fields: [lessonLearnedPoints.lessonId],
    references: [lessonsLearned.id],
  }),
  interfacePoint: one(interfacePoints, {
    fields: [lessonLearnedPoints.interfacePointId],
    references: [interfacePoints.id],
  }),
}));

export const lessonLearnedChangeRequestsRelations = relations(
  lessonLearnedChangeRequests,
  ({ one }) => ({
    lesson: one(lessonsLearned, {
      fields: [lessonLearnedChangeRequests.lessonId],
      references: [lessonsLearned.id],
    }),
    project: one(projects, {
      fields: [lessonLearnedChangeRequests.projectId],
      references: [projects.id],
    }),
    proposedWorkPackage: one(workPackages, {
      fields: [lessonLearnedChangeRequests.proposedWorkPackageId],
      references: [workPackages.id],
    }),
  })
);

export const lessonPolicyProfilesRelations = relations(
  lessonPolicyProfiles,
  ({ one, many }) => ({
    portfolio: one(portfolios, {
      fields: [lessonPolicyProfiles.portfolioId],
      references: [portfolios.id],
    }),
    projectAssignments: many(projectLessonPolicyAssignments),
    cycles: many(lessonCycles),
  })
);

export const projectLessonPolicyAssignmentsRelations = relations(
  projectLessonPolicyAssignments,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectLessonPolicyAssignments.projectId],
      references: [projects.id],
    }),
    policyProfile: one(lessonPolicyProfiles, {
      fields: [projectLessonPolicyAssignments.policyProfileId],
      references: [lessonPolicyProfiles.id],
    }),
  })
);

export const projectLessonRoleAssignmentsRelations = relations(
  projectLessonRoleAssignments,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectLessonRoleAssignments.projectId],
      references: [projects.id],
    }),
    member: one(projectMembers, {
      fields: [projectLessonRoleAssignments.memberId],
      references: [projectMembers.id],
    }),
  })
);

export const lessonCyclesRelations = relations(lessonCycles, ({ one, many }) => ({
  project: one(projects, {
    fields: [lessonCycles.projectId],
    references: [projects.id],
  }),
  policyProfile: one(lessonPolicyProfiles, {
    fields: [lessonCycles.policyProfileId],
    references: [lessonPolicyProfiles.id],
  }),
  triageDecisions: many(lessonTriageDecisions),
  clusters: many(lessonClusters),
  trackAActions: many(lessonTrackAActions),
  trackBEscalations: many(lessonTrackBEscalations),
  reports: many(lessonPackageReports),
}));

export const lessonTriageDecisionsRelations = relations(
  lessonTriageDecisions,
  ({ one }) => ({
    project: one(projects, {
      fields: [lessonTriageDecisions.projectId],
      references: [projects.id],
    }),
    cycle: one(lessonCycles, {
      fields: [lessonTriageDecisions.cycleId],
      references: [lessonCycles.id],
    }),
    lesson: one(lessonsLearned, {
      fields: [lessonTriageDecisions.lessonId],
      references: [lessonsLearned.id],
    }),
  })
);

export const lessonClustersRelations = relations(lessonClusters, ({ one, many }) => ({
  project: one(projects, {
    fields: [lessonClusters.projectId],
    references: [projects.id],
  }),
  cycle: one(lessonCycles, {
    fields: [lessonClusters.cycleId],
    references: [lessonCycles.id],
  }),
  package: one(workPackages, {
    fields: [lessonClusters.packageId],
    references: [workPackages.id],
  }),
  clusterItems: many(lessonClusterItems),
  trackAActions: many(lessonTrackAActions),
  trackBEscalations: many(lessonTrackBEscalations),
}));

export const lessonClusterItemsRelations = relations(
  lessonClusterItems,
  ({ one }) => ({
    project: one(projects, {
      fields: [lessonClusterItems.projectId],
      references: [projects.id],
    }),
    cluster: one(lessonClusters, {
      fields: [lessonClusterItems.clusterId],
      references: [lessonClusters.id],
    }),
    lesson: one(lessonsLearned, {
      fields: [lessonClusterItems.lessonId],
      references: [lessonsLearned.id],
    }),
  })
);

export const lessonTrackAActionsRelations = relations(
  lessonTrackAActions,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [lessonTrackAActions.projectId],
      references: [projects.id],
    }),
    cycle: one(lessonCycles, {
      fields: [lessonTrackAActions.cycleId],
      references: [lessonCycles.id],
    }),
    lesson: one(lessonsLearned, {
      fields: [lessonTrackAActions.lessonId],
      references: [lessonsLearned.id],
    }),
    cluster: one(lessonClusters, {
      fields: [lessonTrackAActions.clusterId],
      references: [lessonClusters.id],
    }),
    evidence: many(lessonActionEvidence),
  })
);

export const lessonActionEvidenceRelations = relations(
  lessonActionEvidence,
  ({ one }) => ({
    project: one(projects, {
      fields: [lessonActionEvidence.projectId],
      references: [projects.id],
    }),
    action: one(lessonTrackAActions, {
      fields: [lessonActionEvidence.actionId],
      references: [lessonTrackAActions.id],
    }),
  })
);

export const lessonTrackBEscalationsRelations = relations(
  lessonTrackBEscalations,
  ({ one }) => ({
    project: one(projects, {
      fields: [lessonTrackBEscalations.projectId],
      references: [projects.id],
    }),
    cycle: one(lessonCycles, {
      fields: [lessonTrackBEscalations.cycleId],
      references: [lessonCycles.id],
    }),
    lesson: one(lessonsLearned, {
      fields: [lessonTrackBEscalations.lessonId],
      references: [lessonsLearned.id],
    }),
    cluster: one(lessonClusters, {
      fields: [lessonTrackBEscalations.clusterId],
      references: [lessonClusters.id],
    }),
  })
);

export const lessonPackageReportsRelations = relations(
  lessonPackageReports,
  ({ one }) => ({
    project: one(projects, {
      fields: [lessonPackageReports.projectId],
      references: [projects.id],
    }),
    cycle: one(lessonCycles, {
      fields: [lessonPackageReports.cycleId],
      references: [lessonCycles.id],
    }),
    package: one(workPackages, {
      fields: [lessonPackageReports.packageId],
      references: [workPackages.id],
    }),
  })
);

export const userCorporateRolesRelations = relations(userCorporateRoles, () => ({}));

export const lessonProjectMembershipsRelations = relations(
  lessonProjectMemberships,
  ({ one }) => ({
    project: one(projects, {
      fields: [lessonProjectMemberships.projectId],
      references: [projects.id],
    }),
  })
);

export const lessonCategoriesRelations = relations(
  lessonCategories,
  ({ many }) => ({
    lessonsV2: many(lessonsV2),
    recommendedActions: many(recommendedActions),
    corporateRecommendedActions: many(corporateRecommendedActions),
    projectActions: many(projectActions),
  })
);

export const lessonWorkstreamsRelations = relations(
  lessonWorkstreams,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [lessonWorkstreams.projectId],
      references: [projects.id],
    }),
    lessonsV2: many(lessonsV2),
    lessonClustersV2: many(lessonClustersV2),
  })
);

export const lessonGatesRelations = relations(lessonGates, ({ one, many }) => ({
  project: one(projects, {
    fields: [lessonGates.projectId],
    references: [projects.id],
  }),
  lessonsV2: many(lessonsV2),
}));

export const lessonsV2Relations = relations(lessonsV2, ({ one, many }) => ({
  project: one(projects, {
    fields: [lessonsV2.projectId],
    references: [projects.id],
  }),
  category: one(lessonCategories, {
    fields: [lessonsV2.categoryId],
    references: [lessonCategories.id],
  }),
  workstream: one(lessonWorkstreams, {
    fields: [lessonsV2.workstreamId],
    references: [lessonWorkstreams.id],
  }),
  gate: one(lessonGates, {
    fields: [lessonsV2.gateId],
    references: [lessonGates.id],
  }),
  clusterLinks: many(lessonClusterLinksV2),
  recommendedActions: many(recommendedActions, {
    relationName: "recommendedActionSourceLesson",
  }),
}));

export const lessonClustersV2Relations = relations(
  lessonClustersV2,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [lessonClustersV2.projectId],
      references: [projects.id],
    }),
    workstream: one(lessonWorkstreams, {
      fields: [lessonClustersV2.workstreamId],
      references: [lessonWorkstreams.id],
    }),
    clusterLinks: many(lessonClusterLinksV2),
    recommendedActions: many(recommendedActions, {
      relationName: "recommendedActionSourceCluster",
    }),
  })
);

export const lessonClusterLinksV2Relations = relations(
  lessonClusterLinksV2,
  ({ one }) => ({
    cluster: one(lessonClustersV2, {
      fields: [lessonClusterLinksV2.clusterId],
      references: [lessonClustersV2.id],
    }),
    lesson: one(lessonsV2, {
      fields: [lessonClusterLinksV2.lessonId],
      references: [lessonsV2.id],
    }),
  })
);

export const recommendedActionsRelations = relations(
  recommendedActions,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [recommendedActions.projectId],
      references: [projects.id],
    }),
    category: one(lessonCategories, {
      fields: [recommendedActions.categoryId],
      references: [lessonCategories.id],
    }),
    sourceLesson: one(lessonsV2, {
      fields: [recommendedActions.sourceLessonId],
      references: [lessonsV2.id],
      relationName: "recommendedActionSourceLesson",
    }),
    sourceCluster: one(lessonClustersV2, {
      fields: [recommendedActions.sourceClusterId],
      references: [lessonClustersV2.id],
      relationName: "recommendedActionSourceCluster",
    }),
    corporateEntries: many(corporateRecommendedActions, {
      relationName: "corporateActionSourceRecommendation",
    }),
    projectActions: many(projectActions, {
      relationName: "projectActionSourceRecommendation",
    }),
  })
);

export const corporateRecommendedActionsRelations = relations(
  corporateRecommendedActions,
  ({ one, many }) => ({
    category: one(lessonCategories, {
      fields: [corporateRecommendedActions.categoryId],
      references: [lessonCategories.id],
    }),
    sourceRecommendedAction: one(recommendedActions, {
      fields: [corporateRecommendedActions.sourceRecommendedActionId],
      references: [recommendedActions.id],
      relationName: "corporateActionSourceRecommendation",
    }),
    sourceProject: one(projects, {
      fields: [corporateRecommendedActions.sourceProjectId],
      references: [projects.id],
    }),
    projectActions: many(projectActions, {
      relationName: "projectActionSourceCorporate",
    }),
  })
);

export const projectActionsRelations = relations(
  projectActions,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [projectActions.projectId],
      references: [projects.id],
    }),
    category: one(lessonCategories, {
      fields: [projectActions.categoryId],
      references: [lessonCategories.id],
    }),
    sourceCorporateAction: one(corporateRecommendedActions, {
      fields: [projectActions.sourceCorporateActionId],
      references: [corporateRecommendedActions.id],
      relationName: "projectActionSourceCorporate",
    }),
    sourceRecommendedAction: one(recommendedActions, {
      fields: [projectActions.sourceRecommendedActionId],
      references: [recommendedActions.id],
      relationName: "projectActionSourceRecommendation",
    }),
    assignments: many(actionAssignments),
  })
);

export const actionAssignmentsRelations = relations(
  actionAssignments,
  ({ one }) => ({
    projectAction: one(projectActions, {
      fields: [actionAssignments.projectActionId],
      references: [projectActions.id],
    }),
    project: one(projects, {
      fields: [actionAssignments.projectId],
      references: [projects.id],
    }),
  })
);

export const lessonEvidenceRelations = relations(lessonEvidence, ({ one }) => ({
  project: one(projects, {
    fields: [lessonEvidence.projectId],
    references: [projects.id],
  }),
}));

export const lessonCommentsRelations = relations(lessonComments, ({ one }) => ({
  project: one(projects, {
    fields: [lessonComments.projectId],
    references: [projects.id],
  }),
}));

export const lessonAuditLogRelations = relations(lessonAuditLog, ({ one }) => ({
  project: one(projects, {
    fields: [lessonAuditLog.projectId],
    references: [projects.id],
  }),
}));

export const deliverablesRelations = relations(deliverables, ({ one }) => ({
  interfacePoint: one(interfacePoints, {
    fields: [deliverables.interfacePointId],
    references: [interfacePoints.id],
  }),
  responsiblePackage: one(workPackages, {
    fields: [deliverables.responsiblePackageId],
    references: [workPackages.id],
  }),
}));

export const interfaceQueriesRelations = relations(
  interfaceQueries,
  ({ one, many }) => ({
    interfacePoint: one(interfacePoints, {
      fields: [interfaceQueries.interfacePointId],
      references: [interfacePoints.id],
    }),
    raisedByPackage: one(workPackages, {
      fields: [interfaceQueries.raisedByPackageId],
      references: [workPackages.id],
      relationName: "raisedBy",
    }),
    assignedToPackage: one(workPackages, {
      fields: [interfaceQueries.assignedToPackageId],
      references: [workPackages.id],
      relationName: "assignedTo",
    }),
    responses: many(iqResponses),
  })
);

export const iqResponsesRelations = relations(iqResponses, ({ one }) => ({
  query: one(interfaceQueries, {
    fields: [iqResponses.queryId],
    references: [interfaceQueries.id],
  }),
}));

export const projectMembersRelations = relations(
  projectMembers,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [projectMembers.projectId],
      references: [projects.id],
    }),
    workPackage: one(workPackages, {
      fields: [projectMembers.workPackageId],
      references: [workPackages.id],
    }),
    memberWorkPackages: many(memberWorkPackages),
    organizationRoles: many(projectMemberOrganizationRoles),
    lessonRoleAssignments: many(projectLessonRoleAssignments),
  })
);

export const memberWorkPackagesRelations = relations(
  memberWorkPackages,
  ({ one }) => ({
    member: one(projectMembers, {
      fields: [memberWorkPackages.memberId],
      references: [projectMembers.id],
    }),
    workPackage: one(workPackages, {
      fields: [memberWorkPackages.workPackageId],
      references: [workPackages.id],
    }),
  })
);

export const assetPlacementsRelations = relations(
  assetPlacements,
  ({ one }) => ({
    project: one(projects, {
      fields: [assetPlacements.projectId],
      references: [projects.id],
    }),
    modelRegistryAsset: one(modelRegistryAssets, {
      fields: [assetPlacements.modelRegistryAssetId],
      references: [modelRegistryAssets.id],
    }),
  })
);

export const modelRegistryAssetsRelations = relations(
  modelRegistryAssets,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [modelRegistryAssets.projectId],
      references: [projects.id],
    }),
    placements: many(assetPlacements),
  })
);

export const cableRoutes = pgTable(
  "cable_routes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    cableType: text("cable_type").notNull(), // "array_cable" | "export_cable"
    fromAssetId: uuid("from_asset_id")
      .notNull()
      .references(() => assetPlacements.id, { onDelete: "cascade" }),
    toAssetId: uuid("to_asset_id")
      .notNull()
      .references(() => assetPlacements.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    color: text("color"),
    waypoints: jsonb("waypoints").$type<[number, number, number][]>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("cable_routes_project_id_idx").on(table.projectId)]
);

export const cableRoutesRelations = relations(cableRoutes, ({ one }) => ({
  project: one(projects, {
    fields: [cableRoutes.projectId],
    references: [projects.id],
  }),
  fromAsset: one(assetPlacements, {
    fields: [cableRoutes.fromAssetId],
    references: [assetPlacements.id],
    relationName: "cableFrom",
  }),
  toAsset: one(assetPlacements, {
    fields: [cableRoutes.toAssetId],
    references: [assetPlacements.id],
    relationName: "cableTo",
  }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  project: one(projects, {
    fields: [attachments.projectId],
    references: [projects.id],
  }),
}));

export const deadlineDigestSendsRelations = relations(
  deadlineDigestSends,
  ({ one }) => ({
    project: one(projects, {
      fields: [deadlineDigestSends.projectId],
      references: [projects.id],
    }),
  })
);

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  project: one(projects, {
    fields: [organizations.projectId],
    references: [projects.id],
  }),
  memberRoles: many(projectMemberOrganizationRoles),
}));

export const projectMemberOrganizationRolesRelations = relations(
  projectMemberOrganizationRoles,
  ({ one }) => ({
    projectMember: one(projectMembers, {
      fields: [projectMemberOrganizationRoles.projectMemberId],
      references: [projectMembers.id],
    }),
    organization: one(organizations, {
      fields: [projectMemberOrganizationRoles.organizationId],
      references: [organizations.id],
    }),
  })
);

export const interfaceCasesRelations = relations(interfaceCases, ({ one, many }) => ({
  project: one(projects, {
    fields: [interfaceCases.projectId],
    references: [projects.id],
  }),
  requestingOrganization: one(organizations, {
    fields: [interfaceCases.requestingOrganizationId],
    references: [organizations.id],
    relationName: "requestingOrg",
  }),
  providingOrganization: one(organizations, {
    fields: [interfaceCases.providingOrganizationId],
    references: [organizations.id],
    relationName: "providingOrg",
  }),
  responsibleOrganization: one(organizations, {
    fields: [interfaceCases.responsibleOrganizationId],
    references: [organizations.id],
    relationName: "responsibleOrg",
  }),
  events: many(interfaceCaseEvents),
}));

export const interfaceCaseEventsRelations = relations(
  interfaceCaseEvents,
  ({ one }) => ({
    case: one(interfaceCases, {
      fields: [interfaceCaseEvents.caseId],
      references: [interfaceCases.id],
    }),
    project: one(projects, {
      fields: [interfaceCaseEvents.projectId],
      references: [projects.id],
    }),
  })
);

export const interfaceMatrixRevisionsRelations = relations(
  interfaceMatrixRevisions,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [interfaceMatrixRevisions.projectId],
      references: [projects.id],
    }),
    rows: many(interfaceMatrixRows),
  })
);

export const interfaceMatrixRowsRelations = relations(interfaceMatrixRows, ({ one }) => ({
  project: one(projects, {
    fields: [interfaceMatrixRows.projectId],
    references: [projects.id],
  }),
  revision: one(interfaceMatrixRevisions, {
    fields: [interfaceMatrixRows.revisionId],
    references: [interfaceMatrixRevisions.id],
  }),
}));

export const interfaceMeetingsRelations = relations(interfaceMeetings, ({ one, many }) => ({
  project: one(projects, {
    fields: [interfaceMeetings.projectId],
    references: [projects.id],
  }),
  attendance: many(interfaceMeetingAttendance),
}));

export const interfaceMeetingAttendanceRelations = relations(
  interfaceMeetingAttendance,
  ({ one }) => ({
    meeting: one(interfaceMeetings, {
      fields: [interfaceMeetingAttendance.meetingId],
      references: [interfaceMeetings.id],
    }),
    projectMember: one(projectMembers, {
      fields: [interfaceMeetingAttendance.projectMemberId],
      references: [projectMembers.id],
    }),
  })
);

export const interfaceMonthlyReportsRelations = relations(
  interfaceMonthlyReports,
  ({ one }) => ({
    project: one(projects, {
      fields: [interfaceMonthlyReports.projectId],
      references: [projects.id],
    }),
    organization: one(organizations, {
      fields: [interfaceMonthlyReports.organizationId],
      references: [organizations.id],
    }),
  })
);

export const interfaceAuditExportsRelations = relations(
  interfaceAuditExports,
  ({ one }) => ({
    project: one(projects, {
      fields: [interfaceAuditExports.projectId],
      references: [projects.id],
    }),
  })
);

export const activitiesRelations = relations(activities, ({ one }) => ({
  project: one(projects, {
    fields: [activities.projectId],
    references: [projects.id],
  }),
}));
