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

// ─── Relations ───────────────────────────────────────────────────────────────

export const portfoliosRelations = relations(portfolios, ({ many }) => ({
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  portfolio: one(portfolios, {
    fields: [projects.portfolioId],
    references: [portfolios.id],
  }),
  workPackages: many(workPackages),
  interfaceRegisters: many(interfaceRegisters),
  projectMembers: many(projectMembers),
  assetPlacements: many(assetPlacements),
  attachments: many(attachments),
  deadlineDigestSends: many(deadlineDigestSends),
}));

export const workPackagesRelations = relations(workPackages, ({ one }) => ({
  project: one(projects, {
    fields: [workPackages.projectId],
    references: [projects.id],
  }),
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
  })
);

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

export const activitiesRelations = relations(activities, ({ one }) => ({
  project: one(projects, {
    fields: [activities.projectId],
    references: [projects.id],
  }),
}));
