import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  date,
  integer,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ============================================================
// ENUMS
// ============================================================

export const userRoleEnum = pgEnum("user_role", [
  "social_worker",
  "center_director",
  "admin",
]);

export const genderEnum = pgEnum("gender", ["male", "female"]);

export const visitTypeEnum = pgEnum("visit_type", [
  "care_visit",
  "activity_invite",
  "individual_service",
  "family_service",
  "resource_link",
  "end_of_life_care",
  "other",
]);

export const familyMemberTypeEnum = pgEnum("family_member_type", [
  "father",
  "mother",
  "brother",
  "sister",
  "spouse",
  "son",
  "daughter",
  "other",
]);

export const documentTypeEnum = pgEnum("document_type", ["a04", "a05"]);

export const documentStatusEnum = pgEnum("document_status", [
  "draft",
  "generated",
  "reviewed",
  "finalized",
]);

// ============================================================
// CORE TABLES
// ============================================================

export const facilities = pgTable("facilities", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  shortName: text("short_name"),
  address: text("address"),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    discordUserId: text("discord_user_id").notNull(),
    discordUsername: text("discord_username"),
    displayName: text("display_name").notNull(),
    role: userRoleEnum("role").notNull().default("social_worker"),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_users_discord").on(table.discordUserId),
  ]
);

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id),
    caseNumber: text("case_number").notNull(),
    name: text("name").notNull(),
    gender: genderEnum("gender").notNull(),
    dateOfBirth: date("date_of_birth").notNull(),
    caseOpenDate: date("case_open_date").notNull(),
    creationDate: date("creation_date").notNull(),
    revisionLabel: text("revision_label").default("初版"),
    isActive: boolean("is_active").notNull().default(true),
    assignedWorkerId: uuid("assigned_worker_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_clients_facility_case").on(
      table.facilityId,
      table.caseNumber
    ),
    index("idx_clients_facility").on(table.facilityId),
  ]
);

// ============================================================
// A05 — Monthly Dynamic Record (個案動態記錄表)
// ============================================================

export const monthlyRecords = pgTable(
  "monthly_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    rocYear: integer("roc_year").notNull(),
    month: integer("month").notNull(),
    visitTypes: text("visit_types").array().notNull().default([]),
    otherDescription: text("other_description"),
    visitContent: text("visit_content"),
    aiPromptNotes: text("ai_prompt_notes"),
    socialWorkerId: uuid("social_worker_id").references(() => users.id),
    status: documentStatusEnum("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_monthly_records_unique").on(
      table.clientId,
      table.rocYear,
      table.month
    ),
    index("idx_monthly_records_lookup").on(
      table.clientId,
      table.rocYear,
      table.month
    ),
  ]
);

// ============================================================
// A04 — Case Service Plan (個案服務計畫記錄表)
// ============================================================

export const clientAssessments = pgTable(
  "client_assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    rocYear: integer("roc_year").notNull(),
    version: integer("version").notNull().default(1),
    // Section 2.1: Physiological
    languageAbility: text("language_ability"),
    selfCareAbility: text("self_care_ability"),
    intelligenceAbility: text("intelligence_ability"),
    // Section 2.2: Psychological
    psychologicalAssessment: text("psychological_assessment"),
    // Section 2.3: Family visit pattern
    familyVisitPattern: text("family_visit_pattern"),
    // Section 2.4: Social behavior
    socialBehavior: text("social_behavior"),
    // Section 4: AI-generated assessment analysis
    assessmentAnalysis: text("assessment_analysis"),
    // Section 5: AI-generated treatment plan
    treatmentPlan: jsonb("treatment_plan"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_client_assessments_lookup").on(table.clientId, table.rocYear),
  ]
);

export const clientFamilyMembers = pgTable(
  "client_family_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    memberType: familyMemberTypeEnum("member_type").notNull(),
    count: integer("count").notNull().default(1),
    description: text("description"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  () => []
);

export const quarterlyFollowups = pgTable(
  "quarterly_followups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    rocYear: integer("roc_year").notNull(),
    quarter: integer("quarter").notNull(),
    trackingDate: date("tracking_date"),
    narrative: text("narrative"),
    aiPromptNotes: text("ai_prompt_notes"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_quarterly_followups_unique").on(
      table.clientId,
      table.rocYear,
      table.quarter
    ),
  ]
);

export const familyDiscussions = pgTable(
  "family_discussions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    rocYear: integer("roc_year").notNull(),
    half: integer("half").notNull(),
    discussionDate: date("discussion_date"),
    narrative: text("narrative"),
    aiPromptNotes: text("ai_prompt_notes"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_family_discussions_unique").on(
      table.clientId,
      table.rocYear,
      table.half
    ),
  ]
);

// ============================================================
// AUDIT & DOCUMENT TRACKING
// ============================================================

export const generatedDocuments = pgTable(
  "generated_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    documentType: documentTypeEnum("document_type").notNull(),
    rocYear: integer("roc_year").notNull(),
    periodDetail: integer("period_detail"),
    fileName: text("file_name").notNull(),
    filePath: text("file_path"),
    fileSizeBytes: integer("file_size_bytes"),
    generatedBy: uuid("generated_by")
      .notNull()
      .references(() => users.id),
    discordMessageId: text("discord_message_id"),
    discordChannelId: text("discord_channel_id"),
    status: documentStatusEnum("status").notNull().default("generated"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_generated_documents_client").on(
      table.clientId,
      table.documentType,
      table.rocYear
    ),
  ]
);

export const aiGenerationLog = pgTable(
  "ai_generation_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetTable: text("target_table").notNull(),
    targetId: uuid("target_id").notNull(),
    promptText: text("prompt_text").notNull(),
    responseText: text("response_text").notNull(),
    modelUsed: text("model_used").notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    latencyMs: integer("latency_ms"),
    triggeredBy: uuid("triggered_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_ai_generation_log_target").on(
      table.targetTable,
      table.targetId
    ),
  ]
);
