import { pgTable, serial, integer, varchar, text, boolean, timestamp, jsonb, bigint } from "drizzle-orm/pg-core";

// Departments
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }),
  config: jsonb("config"),
  priorityConfig: jsonb("priority_config").default('[]'),
  statusConfig: jsonb("status_config").default('[]'),
  createdAt: timestamp("created_at").defaultNow(),
});

// Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  authUserId: varchar("auth_user_id", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  departmentId: integer("department_id"),
  position: varchar("position", { length: 50 }),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  role: varchar("role", { length: 32 }).notNull().default("user"),
  wecomUserId: varchar("wecom_user_id", { length: 255 }),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Roles
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 32 }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  permissions: jsonb("permissions").notNull(), // string[] of permission keys
  isBuiltin: boolean("is_builtin").default(false),
});


// User Roles
export const userRoles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  roleId: integer("role_id").notNull(),
});

// Department Field Templates (版本化字段模板)
export const departmentFieldTemplates = pgTable("department_field_templates", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id").notNull(),
  version: integer("version").notNull(),
  name: varchar("name", { length: 255 }),
  isActive: boolean("is_active").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Department Fields (动态字段定义)
export const departmentFields = pgTable("department_fields", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id").notNull(),
  templateId: integer("template_id").notNull(),
  key: varchar("key", { length: 100 }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  required: boolean("required").default(false),
  filterable: boolean("filterable").default(false),
  exportable: boolean("exportable").default(true),
  orderIndex: integer("order_index"),
  config: jsonb("config"),
});

// Demands
export const demands = pgTable("demands", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id").notNull(),
  creatorId: integer("creator_id").notNull(),
  assigneeId: integer("assignee_id"),
  customerId: integer("customer_id"),
  projectId: integer("project_id"),
  demandTypeId: integer("demand_type_id"),
  title: varchar("title", { length: 255 }).notNull(),
  status: text("status").notNull(),
  priority: text("priority"),
  fieldTemplateId: integer("field_template_id"),
  fields: jsonb("fields"),
  createdAt: timestamp("created_at").defaultNow(),
  assignedAt: timestamp("assigned_at"),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  closedAt: timestamp("closed_at"),
  delayedAt: timestamp("delayed_at"),
});

// Customers
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  level: varchar("level", { length: 50 }),
  ownerUserId: integer("owner_user_id"),
  status: varchar("status", { length: 50 }).default("active"),
  remark: text("remark"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Projects
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }),
  url: text("url"),
  ownerUserId: integer("owner_user_id"),
  status: varchar("status", { length: 50 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Demand Types (部门 + 需求类型模板)
export const demandTypes = pgTable("demand_types", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 100 }),
  fieldTemplateId: integer("field_template_id"),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  orderIndex: integer("order_index"),
  config: jsonb("config"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Demand Quick Templates
export const demandQuickTemplates = pgTable("demand_quick_templates", {
  id: serial("id").primaryKey(),
  ownerUserId: integer("owner_user_id"),
  departmentId: integer("department_id").notNull(),
  demandTypeId: integer("demand_type_id"),
  name: varchar("name", { length: 255 }).notNull(),
  scope: varchar("scope", { length: 20 }).notNull().default("personal"),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Demand Drafts
export const demandDrafts = pgTable("demand_drafts", {
  id: serial("id").primaryKey(),
  creatorId: integer("creator_id").notNull(),
  source: varchar("source", { length: 50 }).notNull().default("manual"),
  departmentId: integer("department_id"),
  demandTypeId: integer("demand_type_id"),
  customerId: integer("customer_id"),
  projectId: integer("project_id"),
  title: varchar("title", { length: 255 }),
  payload: jsonb("payload").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  createdDemandId: integer("created_demand_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// User Recent Inputs
export const userRecentInputs = pgTable("user_recent_inputs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  inputType: varchar("input_type", { length: 50 }).notNull(),
  value: text("value").notNull(),
  metadata: jsonb("metadata"),
  lastUsedAt: timestamp("last_used_at").defaultNow(),
});

// Score Templates (按部门的评分模板)
export const scoreTemplates = pgTable("score_templates", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id").notNull(),
  name: varchar("name", { length: 255 }),
  items: jsonb("items").notNull(), // [{ label, max, required }]
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Score Periods (评分周期配置：服务月 + 评分窗口)
export const scorePeriods = pgTable("score_periods", {
  id: serial("id").primaryKey(),
  period: varchar("period", { length: 20 }).notNull().unique(), // e.g. "2025-11"，表示服务月，唯一
  scoreWindowStart: timestamp("score_window_start"),
  scoreWindowEnd: timestamp("score_window_end"),
  status: varchar("status", { length: 20 }).notNull().default("planned"), // planned/open/closed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Score Tasks (评分任务：周期内 scorer 对 targetUser 的评分任务)
export const scoreTasks = pgTable("score_tasks", {
  id: serial("id").primaryKey(),
  period: varchar("period", { length: 20 }).notNull(), // e.g. "2025-11"
  scorerId: integer("scorer_id").notNull(),
  targetUserId: integer("target_user_id").notNull(),
  departmentId: integer("department_id").notNull(),
  templateId: integer("template_id").notNull(),
  status: varchar("status", { length: 20 }).notNull(), // pending/completed/missed/reminded
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  lastReminderAt: timestamp("last_reminder_at"),
});

// Score Records (评分结果)
export const scoreRecords = pgTable("score_records", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  scorerId: integer("scorer_id").notNull(),
  targetUserId: integer("target_user_id").notNull(),
  departmentId: integer("department_id").notNull(),
  period: varchar("period", { length: 20 }).notNull(),
  scores: jsonb("scores").notNull(), // { [label]: value }
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});


// Audit Logs (操作审计)
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: integer("entity_id"),
  action: varchar("action", { length: 50 }).notNull(),
  changedFields: jsonb("changed_fields"), // { field: { before, after } }
  metadata: jsonb("metadata"), // ip, ua, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// Demand Comments (需求评论，支持子评论)
export const demandComments = pgTable("demand_comments", {
  id: serial("id").primaryKey(),
  demandId: integer("demand_id").notNull(),
  authorId: integer("author_id").notNull(),
  parentCommentId: integer("parent_comment_id"),
  content: text("content").notNull(),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Demand Attachments (需求附件)
export const demandAttachments = pgTable("demand_attachments", {
  id: serial("id").primaryKey(),
  demandId: integer("demand_id").notNull(),
  uploaderId: integer("uploader_id").notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileUrl: text("file_url").notNull(),
  mimeType: varchar("mime_type", { length: 100 }),
  size: bigint("size", { mode: "number" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// AI Reports (部门月度 AI 报告)
export const aiReports = pgTable("ai_reports", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id").notNull(),
  scopeType: varchar("scope_type", { length: 50 }).notNull().default("department"),
  scopeId: integer("scope_id"),
  period: varchar("period", { length: 20 }).notNull(),
  reportType: varchar("report_type", { length: 50 }).notNull(),
  mode: varchar("mode", { length: 20 }).notNull().default("rule"),
  status: varchar("status", { length: 20 }).notNull().default("success"),
  error: text("error"),
  generatedByUserId: integer("generated_by_user_id"),
  generatedAt: timestamp("generated_at").defaultNow(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Webhook Subscriptions
export const webhookSubscriptions = pgTable("webhook_subscriptions", {
  id: serial("id").primaryKey(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  url: text("url").notNull(),
  secret: varchar("secret", { length: 255 }),
  provider: varchar("provider", { length: 50 }),
  enabled: boolean("enabled").notNull().default(true),
  createdByUserId: integer("created_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Webhook Events
export const webhookEvents = pgTable("webhook_events", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").notNull(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  requestId: varchar("request_id", { length: 64 }).notNull(),
  payload: jsonb("payload").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  attemptCount: integer("attempt_count").notNull().default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow(),
  lastAttemptAt: timestamp("last_attempt_at"),
  deliveredAt: timestamp("delivered_at"),
});

