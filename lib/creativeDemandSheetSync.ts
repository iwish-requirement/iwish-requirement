import { supabaseAdmin } from "./supabaseAdmin";
import { inferDemandDeliveryCounts } from "./demandDeliveryStats";
import {
  resolveFeishuSpreadsheetTarget,
  writeFeishuSheetValues,
  type FeishuSpreadsheetTarget,
} from "./feishuSheets";

type UserRow = {
  id: number;
  name: string | null;
  email: string | null;
};

type DemandRow = {
  id: number;
  department_id: number;
  creator_id: number | null;
  assignee_id: number | null;
  customer_id: number | null;
  project_id: number | null;
  demand_type_id: number | null;
  title: string | null;
  status: string | null;
  priority: string | null;
  fields: Record<string, unknown> | null;
  created_at: string | null;
  assigned_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  closed_at: string | null;
  delayed_at: string | null;
};

type DepartmentRow = {
  id: number;
  name: string | null;
  slug: string | null;
  priority_config?: unknown;
  status_config?: unknown;
};

type NamedRow = {
  id: number;
  name: string | null;
};

type DemandTypeRow = {
  id: number;
  name: string | null;
  code: string | null;
};

export type CreativeDemandSheetSyncResult = {
  skipped: boolean;
  reason?: string;
  rowCount?: number;
  spreadsheetToken?: string;
  sheetId?: string;
  spreadsheetUrl?: string | null;
  createdSpreadsheet?: boolean;
};

const HEADERS = [
  "需求编号",
  "标题",
  "当前状态",
  "优先级",
  "需求类型",
  "提交人",
  "执行人",
  "创建时间",
  "截止日期",
  "内部排期",
  "开始时间",
  "完成时间",
  "素材合计",
  "平面素材",
  "视频数量",
  "页面数量",
  "客户/品牌",
  "项目",
  "链接/产品详情页",
  "需求描述",
  "需求详情链接",
  "最后同步时间",
];

function getEnv(name: string, fallback = ""): string {
  const value = (process.env[name] || "").toString().trim();
  return value || fallback;
}

function isSyncEnabled(): boolean {
  const raw = getEnv("FEISHU_CREATIVE_SYNC_ENABLED", "true").toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function asString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.map(asString).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function firstField(fields: Record<string, unknown> | null, keys: string[]): string {
  if (!fields) {
    return "";
  }
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(fields, key)) {
      continue;
    }
    const value = asString(fields[key]).trim();
    if (value) {
      return value;
    }
  }
  return "";
}

function demandCode(row: DemandRow): string {
  return firstField(row.fields, ["code"]) || `REQ-${String(row.id).padStart(4, "0")}`;
}

function resolveConfiguredLabel(raw: string | null, config: unknown): string {
  const value = (raw || "").toString();
  if (!value || !Array.isArray(config)) {
    return value;
  }
  const match = config.find((item) => {
    const candidate = item as { value?: unknown; label?: unknown; name?: unknown };
    return (
      asString(candidate.value) === value ||
      asString(candidate.label) === value ||
      asString(candidate.name) === value
    );
  }) as { label?: unknown; name?: unknown } | undefined;
  return asString(match?.label || match?.name).trim() || value;
}

function resolveBaseUrl(): string {
  return (
    getEnv("APP_PUBLIC_URL") ||
    getEnv("NEXT_PUBLIC_APP_URL") ||
    getEnv("VITE_PUBLIC_URL")
  ).replace(/\/+$/, "");
}

function normalizeRows<T extends { id: number }>(rows: T[] | null | undefined): Map<number, T> {
  const map = new Map<number, T>();
  for (const row of rows || []) {
    if (typeof row.id === "number") {
      map.set(row.id, row);
    }
  }
  return map;
}

async function loadDesignDepartment(): Promise<DepartmentRow | null> {
  const { data, error } = await supabaseAdmin
    .from("departments")
    .select("id, name, slug, priority_config, status_config")
    .eq("slug", "design")
    .maybeSingle();
  if (error) {
    throw new Error(`load design department failed: ${error.message}`);
  }
  return (data as DepartmentRow | null) || null;
}

async function shouldSyncForDepartment(
  departmentId: number | null | undefined,
  designDepartment: DepartmentRow,
): Promise<boolean> {
  if (!departmentId) {
    return true;
  }
  if (departmentId === designDepartment.id) {
    return true;
  }
  const { data, error } = await supabaseAdmin
    .from("departments")
    .select("slug")
    .eq("id", departmentId)
    .maybeSingle();
  if (error) {
    console.error("[creative-demand-sheet-sync] department check error", error);
    return false;
  }
  return ((data as { slug?: string | null } | null)?.slug || "").toLowerCase() === "design";
}

async function loadCreativeDemandRows(departmentId: number): Promise<DemandRow[]> {
  const { data, error } = await supabaseAdmin
    .from("demands")
    .select(
      "id, department_id, creator_id, assignee_id, customer_id, project_id, demand_type_id, title, status, priority, fields, created_at, assigned_at, started_at, finished_at, closed_at, delayed_at",
    )
    .eq("department_id", departmentId)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`load creative demands failed: ${error.message}`);
  }
  return ((data || []) as DemandRow[]) || [];
}

async function loadLookupRows(rows: DemandRow[]) {
  const userIds = Array.from(
    new Set(rows.flatMap((row) => [row.creator_id, row.assignee_id]).filter((id): id is number => typeof id === "number")),
  );
  const customerIds = Array.from(new Set(rows.map((row) => row.customer_id).filter((id): id is number => typeof id === "number")));
  const projectIds = Array.from(new Set(rows.map((row) => row.project_id).filter((id): id is number => typeof id === "number")));
  const demandTypeIds = Array.from(new Set(rows.map((row) => row.demand_type_id).filter((id): id is number => typeof id === "number")));

  const [users, customers, projects, demandTypes] = await Promise.all([
    userIds.length
      ? supabaseAdmin.from("users").select("id, name, email").in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
    customerIds.length
      ? supabaseAdmin.from("customers").select("id, name").in("id", customerIds)
      : Promise.resolve({ data: [], error: null }),
    projectIds.length
      ? supabaseAdmin.from("projects").select("id, name").in("id", projectIds)
      : Promise.resolve({ data: [], error: null }),
    demandTypeIds.length
      ? supabaseAdmin.from("demand_types").select("id, name, code").in("id", demandTypeIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  for (const result of [users, customers, projects, demandTypes]) {
    if (result.error) {
      throw new Error(`load creative demand lookup rows failed: ${result.error.message}`);
    }
  }

  return {
    users: normalizeRows((users.data || []) as UserRow[]),
    customers: normalizeRows((customers.data || []) as NamedRow[]),
    projects: normalizeRows((projects.data || []) as NamedRow[]),
    demandTypes: normalizeRows((demandTypes.data || []) as DemandTypeRow[]),
  };
}

function buildSheetRows(
  rows: DemandRow[],
  department: DepartmentRow,
  lookup: Awaited<ReturnType<typeof loadLookupRows>>,
): string[][] {
  const baseUrl = resolveBaseUrl();
  const syncedAt = formatDateTime(new Date().toISOString());
  const values = rows.map((row) => {
    const fields = row.fields || {};
    const code = demandCode(row);
    const creator = row.creator_id ? lookup.users.get(row.creator_id) : null;
    const assignee = row.assignee_id ? lookup.users.get(row.assignee_id) : null;
    const demandType = row.demand_type_id ? lookup.demandTypes.get(row.demand_type_id) : null;
    const customer = row.customer_id ? lookup.customers.get(row.customer_id) : null;
    const project = row.project_id ? lookup.projects.get(row.project_id) : null;
    const delivery = inferDemandDeliveryCounts(fields);
    const detailLink = baseUrl ? `${baseUrl}/demands/${encodeURIComponent(code)}` : "";

    return [
      code,
      row.title || "",
      resolveConfiguredLabel(row.status, department.status_config),
      resolveConfiguredLabel(row.priority, department.priority_config),
      demandType?.name || demandType?.code || "",
      creator?.name || creator?.email || "",
      assignee?.name || assignee?.email || "",
      formatDateTime(row.created_at),
      firstField(fields, ["dueDate", "due_date", "截止日期"]),
      firstField(fields, ["scheduled_start_date", "scheduledStartDate", "内部排期", "排期开始日期"]),
      formatDateTime(row.started_at),
      formatDateTime(row.finished_at || row.closed_at),
      String(delivery.materialCount),
      String(delivery.imageMaterialCount),
      String(delivery.videoMaterialCount),
      String(delivery.pageCount),
      customer?.name || firstField(fields, ["customer", "customerName", "客户", "客户名称", "brand", "品牌"]),
      project?.name || firstField(fields, ["project", "projectName", "项目", "项目名称"]),
      firstField(fields, ["url", "link", "site", "website", "productUrl", "assetUrl", "网址", "链接", "产品详情页", "官网/产品详情页"]),
      firstField(fields, ["description", "需求描述"]),
      detailLink,
      syncedAt,
    ];
  });

  return [HEADERS, ...values];
}

function padRowsForFullRefresh(rows: string[][]): string[][] {
  const configured = Number.parseInt(getEnv("FEISHU_CREATIVE_SHEET_CLEAR_ROWS", "1000"), 10);
  const targetRows = Math.max(rows.length, Number.isFinite(configured) && configured > 0 ? configured : 1000);
  const columnCount = HEADERS.length;
  const padded = rows.map((row) => {
    const next = row.slice(0, columnCount);
    while (next.length < columnCount) {
      next.push("");
    }
    return next;
  });
  while (padded.length < targetRows) {
    padded.push(Array.from({ length: columnCount }, () => ""));
  }
  return padded;
}

export async function syncCreativeDemandsToFeishuSheet(options: {
  changedDepartmentId?: number | null;
  source?: string;
} = {}): Promise<CreativeDemandSheetSyncResult> {
  if (!isSyncEnabled()) {
    return { skipped: true, reason: "disabled" };
  }

  const department = await loadDesignDepartment();
  if (!department) {
    return { skipped: true, reason: "design_department_not_found" };
  }

  const relevant = await shouldSyncForDepartment(options.changedDepartmentId, department);
  if (!relevant) {
    return { skipped: true, reason: "non_design_department" };
  }

  const title = getEnv("FEISHU_CREATIVE_SHEET_TITLE", "创意部需求同步表");
  const target = await resolveFeishuSpreadsheetTarget(title);
  if (!target) {
    return { skipped: true, reason: "missing_feishu_credentials" };
  }

  const rows = await loadCreativeDemandRows(department.id);
  const lookup = await loadLookupRows(rows);
  const sheetRows = padRowsForFullRefresh(buildSheetRows(rows, department, lookup));

  await writeFeishuSheetValues(target, sheetRows);

  logCreatedSpreadsheet(target);

  return {
    skipped: false,
    rowCount: rows.length,
    spreadsheetToken: target.spreadsheetToken,
    sheetId: target.sheetId,
    spreadsheetUrl: target.url,
    createdSpreadsheet: target.created,
  };
}

export function triggerCreativeDemandSheetSync(options: {
  changedDepartmentId?: number | null;
  source?: string;
} = {}): void {
  syncCreativeDemandsToFeishuSheet(options).catch((error) => {
    console.error("[creative-demand-sheet-sync] sync failed", error);
  });
}

function logCreatedSpreadsheet(target: FeishuSpreadsheetTarget): void {
  if (!target.created) {
    return;
  }
  console.warn(
    `[creative-demand-sheet-sync] created Feishu spreadsheet. Set FEISHU_CREATIVE_SPREADSHEET_TOKEN=${target.spreadsheetToken} and FEISHU_CREATIVE_SHEET_ID=${target.sheetId}. URL=${target.url || ""}`,
  );
}
