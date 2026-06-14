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

export const attachmentEntityEnum = pgEnum("attachment_entity", ["lesson"]);

export const inboxItemStatusEnum = pgEnum("inbox_item_status", [
  "new",
  "assigned",
  "discarded",
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

export const memberRoleEnum = pgEnum("member_role", [
  "admin",
  "editor",
  "viewer",
]);

export const llTypeEnum = pgEnum("ll_type", [
  "problem",
  "success",
  "risk",
  "improvement",
  "process_deviation",
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

export const lessonRoleTypeEnum = pgEnum("lesson_role_type", [
  "ll_manager",
  "document_controller",
  "pmo_director",
  "hope",
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
  "corporate_role",
  "category",
  "workstream",
  "gate",
  "evidence",
  "comment",
  "export",
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

export const inboxItems = pgTable(
  "inbox_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(), // references Supabase auth.users
    messageId: text("message_id").notNull(),
    fromEmail: text("from_email").notNull(),
    fromName: text("from_name"),
    subject: text("subject").notNull().default(""),
    textBody: text("text_body").notNull().default(""),
    htmlBody: text("html_body"),
    status: inboxItemStatusEnum("status").notNull().default("new"),
    lessonId: uuid("lesson_id").references(() => lessonsV2.id, {
      onDelete: "set null",
    }),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("inbox_items_message_id_idx").on(table.messageId),
    index("inbox_items_user_status_idx").on(
      table.userId,
      table.status,
      table.receivedAt
    ),
  ]
);

export const inboxItemAttachments = pgTable(
  "inbox_item_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inboxItemId: uuid("inbox_item_id")
      .notNull()
      .references(() => inboxItems.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storagePath: text("storage_path").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("inbox_item_attachments_item_idx").on(table.inboxItemId),
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

export const lessonsV2 = pgTable(
  "lessons_v2",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    content: jsonb("content").$type<Record<string, unknown> | null>(),
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
    uniqueIndex("project_lesson_role_unique_idx").on(
      table.projectId,
      table.memberId,
      table.roleType
    ),
    index("project_lesson_role_project_idx").on(table.projectId, table.roleType),
  ]
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const portfoliosRelations = relations(portfolios, ({ many }) => ({
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  portfolio: one(portfolios, {
    fields: [projects.portfolioId],
    references: [portfolios.id],
  }),
  projectMembers: many(projectMembers),
  lessonProjectMemberships: many(lessonProjectMemberships),
  lessonWorkstreams: many(lessonWorkstreams),
  lessonGates: many(lessonGates),
  attachments: many(attachments),
  deadlineDigestSends: many(deadlineDigestSends),
  organizations: many(organizations),
  lessonsV2: many(lessonsV2),
  lessonClustersV2: many(lessonClustersV2),
  recommendedActions: many(recommendedActions),
  sourceCorporateRecommendedActions: many(corporateRecommendedActions),
  projectActions: many(projectActions),
  actionAssignments: many(actionAssignments),
  lessonEvidence: many(lessonEvidence),
  lessonComments: many(lessonComments),
  lessonAuditLog: many(lessonAuditLog),
  projectLessonRoleAssignments: many(projectLessonRoleAssignments),
}));

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

export const projectMembersRelations = relations(
  projectMembers,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [projectMembers.projectId],
      references: [projects.id],
    }),
    organizationRoles: many(projectMemberOrganizationRoles),
    lessonRoleAssignments: many(projectLessonRoleAssignments),
  })
);

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

export const activitiesRelations = relations(activities, ({ one }) => ({
  project: one(projects, {
    fields: [activities.projectId],
    references: [projects.id],
  }),
}));

export const inboxItemsRelations = relations(inboxItems, ({ one, many }) => ({
  lesson: one(lessonsV2, {
    fields: [inboxItems.lessonId],
    references: [lessonsV2.id],
  }),
  attachments: many(inboxItemAttachments),
}));

export const inboxItemAttachmentsRelations = relations(
  inboxItemAttachments,
  ({ one }) => ({
    inboxItem: one(inboxItems, {
      fields: [inboxItemAttachments.inboxItemId],
      references: [inboxItems.id],
    }),
  })
);
