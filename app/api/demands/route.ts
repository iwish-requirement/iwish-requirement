import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../lib/serverAuth";
import { DemandStatus, Priority, Demand, DepartmentWorkflowConfig } from "../../../types";
import { sendWecomAppTextMessage } from "../../../lib/wecomApp";
import { loadEffectivePermissionsForUser } from "../../../lib/serverPermissions";
import { writeAuditLog } from "../../../lib/audit";
import { extractLegacyCustomerProject } from "../../../lib/legacyDemandFields";
import {
  resolveAssignedStatusValue,
  resolveDepartmentDemandRules,
} from "../../../lib/departmentDemandRules";

export const runtime = "edge";


const DEPT_SLUG_MAP: Record<string, string> = {
  d1: "tech",
  d2: "design",
  d3: "marketing",
  d4: "sales",
};

const DEMAND_LIST_SELECT =
  "id, department_id, creator_id, assignee_id, customer_id, project_id, demand_type_id, title, status, priority, fields, created_at, assigned_at, started_at, finished_at, closed_at, delayed_at";

const LEGACY_SEARCH_FIELD_KEYS = [
  "客户",
  "客户名称",
  "客户名",
  "品牌",
  "品牌名",
  "公司",
  "公司名",
  "公司名称",
  "customer",
  "brand",
  "company",
  "项目",
  "项目名称",
  "站点",
  "店铺",
  "链接",
  "网址",
  "project",
  "site",
  "url",
];

function mapStatus(status: string | null): DemandStatus {
  const value = (status ?? '').toString();
  switch (value) {
    case 'pending':
      return DemandStatus.PENDING;
    case 'in_progress':
      return DemandStatus.IN_PROGRESS;
    case 'review':
      return DemandStatus.REVIEW;
    case 'done':
      return DemandStatus.DONE;
    case 'closed':
      return DemandStatus.CLOSED;
    case 'delayed':
      return DemandStatus.DELAYED;
    case 'ignored':
      return DemandStatus.IGNORED;
    default: {
      const all = Object.values(DemandStatus) as string[];
      if (all.includes(value)) {
        return value as DemandStatus;
      }
      return DemandStatus.PENDING;
    }
  }
}

function toDbStatus(status: DemandStatus | undefined | null): string | undefined {
  if (!status) return undefined;
  switch (status) {
    case DemandStatus.PENDING:
      return 'pending';
    case DemandStatus.IN_PROGRESS:
      return 'in_progress';
    case DemandStatus.REVIEW:
      return 'review';
    case DemandStatus.DONE:
      return 'done';
    case DemandStatus.CLOSED:
      return 'closed';
    case DemandStatus.DELAYED:
      return 'delayed';
    case DemandStatus.IGNORED:
      return 'ignored';
    default:
      return undefined;
  }
}

function normalizePriority(raw: any): string {
  const value = (raw ?? '').toString();
  // 向后兼容：如果是旧的中文格式，返回文本；否则直接返回配置值
  if (value.includes('紧急')) return '紧急';
  if (value.includes('高')) return '高';
  if (value.includes('中')) return '中';
  if (value.includes('低')) return '低';
  return value || '中';
}

function mapRowToDemand(row: any): Demand {
  const fields = (row.fields || {}) as any;

  const code: string = fields.code || `REQ-${String(row.id ?? "").toString().padStart(4, "0")}`;
  const description: string = fields.description || "";
  // Priority 现在从数据库 priority 字段读取,如果为空则从 fields 读取
  const priorityFromDb = (row.priority as string | null) || fields.priority || "";
  const priority: Priority = normalizePriority(priorityFromDb) as Priority;
  const dueDate: string = fields.dueDate || "";
  const departmentId: string =
    row.department_id !== undefined && row.department_id !== null
      ? String(row.department_id)
      : fields.departmentKey || "d1";
  const creatorId: string = fields.creatorCode || `U${row.creator_id ?? ""}`;
  const assigneeId: string | undefined = fields.assigneeCode;

  const { code: _c, description: _d, priority: _p, dueDate: _dd, departmentKey: _dk, creatorCode: _cc, assigneeCode: _ac, ...rest } = fields;

  const createdAt = row.created_at
    ? new Date(row.created_at as string).toISOString().slice(0, 10)
    : "";

  // Status 直接从数据库读取,不再映射
  const status = (row.status as string) || "pending";

  return {
    id: code,
    title: row.title as string,
    description,
    departmentId,
    demandTypeId: typeof row.demand_type_id === "number" ? row.demand_type_id : undefined,
    customerId: typeof row.customer_id === "number" ? row.customer_id : undefined,
    projectId: typeof row.project_id === "number" ? row.project_id : undefined,
    creatorId,
    assigneeId,
    creatorUserId: typeof row.creator_id === "number" ? (row.creator_id as number) : undefined,
    assigneeUserId: typeof row.assignee_id === "number" ? (row.assignee_id as number) : undefined,
    status: status as DemandStatus,
    priority,
    createdAt,
    assignedAt: row.assigned_at || null,
    startedAt: row.started_at || null,
    finishedAt: row.finished_at || null,
    closedAt: row.closed_at || null,
    delayedAt: row.delayed_at || null,
    dueDate,
    customFields: Object.keys(rest).length ? rest : undefined,
  };
}

function normalizeOptionalId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

async function loadWorkflowConfigForDepartment(
  departmentId: number | null,
): Promise<DepartmentWorkflowConfig | null> {
  if (!departmentId || !Number.isFinite(departmentId)) {
    return null;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("departments")
      .select("priority_config, status_config")
      .eq("id", departmentId)
      .maybeSingle();

    if (error || !data) {
      console.error("[api/demands] load workflow config for message error", error);
      return null;
    }

    const cfg: DepartmentWorkflowConfig = {
      priorities: ((data as any).priority_config as any[]) || [],
      statuses: ((data as any).status_config as any[]) || [],
    };

    return cfg;
  } catch (e) {
    console.error("[api/demands] load workflow config for message unexpected error", e);
    return null;
  }
}

function resolvePriorityLabelForMessage(
  rawPriority: string | undefined | null,
  cfg: DepartmentWorkflowConfig | null,
): string | null {
  const value = (rawPriority ?? "").toString();
  if (!value) return null;

  if (cfg && cfg.priorities && cfg.priorities.length > 0) {
    const found =
      cfg.priorities.find((p) => p.value === value) ||
      cfg.priorities.find((p) => p.label === value);
    if (found) return found.label;
  }

  const lower = value.toLowerCase();
  if (value.includes("紧急") || lower === "critical" || lower === "p0") return "紧急";
  if (value.includes("高") || lower === "high" || lower === "p1") return "高";
  if (value.includes("中") || lower === "medium" || lower === "p2") return "中";
  if (value.includes("低") || lower === "low" || lower === "p3") return "低";

  return value;
}

function resolveStatusLabelForMessage(
  rawStatus: string | undefined | null,
  cfg: DepartmentWorkflowConfig | null,
): string | null {
  const value = (rawStatus ?? "").toString();
  if (!value) return null;

  if (cfg && cfg.statuses && cfg.statuses.length > 0) {
    const found =
      cfg.statuses.find((s) => s.value === value) ||
      cfg.statuses.find((s) => s.label === value);
    if (found) return found.label;
  }

  switch (value) {
    case "unassigned":
      return "待负责人分配";
    case "pending":
      return DemandStatus.PENDING;
    case "in_progress":
      return DemandStatus.IN_PROGRESS;
    case "review":
      return DemandStatus.REVIEW;
    case "done":
      return DemandStatus.DONE;
    case "closed":
      return DemandStatus.CLOSED;
    case "delayed":
      return DemandStatus.DELAYED;
    case "ignored":
      return DemandStatus.IGNORED;
    default: {
      const all = Object.values(DemandStatus) as string[];
      if (all.includes(value)) {
        return value;
      }
      return value;
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const activeError = ensureActiveUser(authResult.user);
    if (activeError) {
      return activeError;
    }
    const currentUser = authResult.user!;

    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const priorityParam = url.searchParams.get("priority");
    const departmentIdParam = url.searchParams.get("departmentId");
    const creatorCode = url.searchParams.get("creatorCode");
    const creatorUserIdParam = url.searchParams.get("creatorUserId");
    const assigneeUserIdParam = url.searchParams.get("assigneeUserId");
    const customerIdParam = url.searchParams.get("customerId");
    const projectIdParam = url.searchParams.get("projectId");
    const demandTypeIdParam = url.searchParams.get("demandTypeId");
    const q = url.searchParams.get("q") || "";
    const createdFrom = url.searchParams.get("createdFrom");
    const createdTo = url.searchParams.get("createdTo");
    const dueFrom = url.searchParams.get("dueFrom");
    const dueTo = url.searchParams.get("dueTo");

    const customFieldFilters: { key: string; value: string }[] = [];
    for (const [key, value] of url.searchParams.entries()) {
      if (!key.startsWith("cf_")) continue;
      const fieldKey = key.slice(3);
      if (!fieldKey || !value) continue;
      customFieldFilters.push({ key: fieldKey, value });
    }

    const pageParam = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSizeParam = parseInt(url.searchParams.get("pageSize") || "20", 10);
    const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
    const basePageSize = Number.isNaN(pageSizeParam) || pageSizeParam < 1 ? 20 : pageSizeParam;
    const pageSize = Math.min(basePageSize, 100);

    const summaryParam = url.searchParams.get("summary");
    const summaryMode = summaryParam === "1" || summaryParam === "true";
    const recentSizeParam = parseInt(url.searchParams.get("recentSize") || "4", 10);
    const recentSize = Number.isNaN(recentSizeParam) || recentSizeParam < 1 ? 4 : Math.min(recentSizeParam, 10);
    const effectivePermissions = await loadEffectivePermissionsForUser(currentUser);
    const canViewAll = effectivePermissions.includes("demand.view_all");
    const canViewDepartment = effectivePermissions.includes("demand.view_department");
    const canViewPersonal = effectivePermissions.includes("demand.view_personal");

    if (!canViewAll && !canViewDepartment && !canViewPersonal) {
      return NextResponse.json(
        { error: "forbidden", detail: "current user cannot view demands" },
        { status: 403 }
      );
    }

    const applyFilters = (
      qb: any,
      options?: { statusOverride?: string | null; skipStatusParam?: boolean },
    ) => {
      const statusOverride = options?.statusOverride ?? null;
      const skipStatusParam = options?.skipStatusParam ?? false;

      let query = qb;

      if (!skipStatusParam && statusParam) {
        query = query.eq("status", statusParam);
      }

      if (statusOverride) {
        query = query.eq("status", statusOverride);
      }

      if (priorityParam) {
        query = query.eq("priority", priorityParam);
      }

      if (departmentIdParam) {
        const asNumber = Number.parseInt(departmentIdParam, 10);
        if (!Number.isNaN(asNumber)) {
          query = query.eq("department_id", asNumber);
        } else {
          query = query.eq("fields->>departmentKey", departmentIdParam);
        }
      }

      if (creatorCode) {
        query = query.eq("fields->>creatorCode", creatorCode);
      }

      if (creatorUserIdParam) {
        const creatorUserIdNumber = Number.parseInt(creatorUserIdParam, 10);
        if (!Number.isNaN(creatorUserIdNumber) && creatorUserIdNumber > 0) {
          query = query.eq("creator_id", creatorUserIdNumber);
        }
      }

      if (assigneeUserIdParam) {
        const assigneeUserIdNumber = Number.parseInt(assigneeUserIdParam, 10);
        if (!Number.isNaN(assigneeUserIdNumber) && assigneeUserIdNumber > 0) {
          query = query.eq("assignee_id", assigneeUserIdNumber);
        }
      }

      if (createdFrom) {
        query = query.gte("created_at", createdFrom);
      }

      if (createdTo) {
        query = query.lte("created_at", createdTo);
      }

      if (dueFrom) {
        query = query.gte("fields->>dueDate", dueFrom);
      }

      if (dueTo) {
        query = query.lte("fields->>dueDate", dueTo);
      }

      if (customFieldFilters.length > 0) {
        for (const filter of customFieldFilters) {
          query = query.eq(`fields->>${filter.key}`, filter.value);
        }
      }

      if (q) {
        const pattern = `%${q}%`;
        const legacyFieldClauses = LEGACY_SEARCH_FIELD_KEYS.map((key) => `fields->>${key}.ilike.${pattern}`);
        query = query.or([
          `title.ilike.${pattern}`,
          `fields->>description.ilike.${pattern}`,
          `fields->>code.ilike.${pattern}`,
          ...legacyFieldClauses,
        ].join(","));
      }

      if (canViewAll) {
        return query;
      }

      if (canViewDepartment && currentUser.departmentId) {
        return query.eq("department_id", currentUser.departmentId);
      }

      return query.or(`creator_id.eq.${currentUser.id},assignee_id.eq.${currentUser.id}`);

    };

    const buildDemandsWithDisplayFields = async (rows: any[]): Promise<Demand[]> => {
      const creatorIds = Array.from(
        new Set(
          rows
            .map((row: any) => row.creator_id as number | null)
            .filter((id) => typeof id === "number" && Number.isFinite(id))
        )
      ) as number[];

      const assigneeIds = Array.from(
        new Set(
          rows
            .map((row: any) => row.assignee_id as number | null)
            .filter((id) => typeof id === "number" && Number.isFinite(id))
        )
      ) as number[];

      const allUserIds = Array.from(new Set([...(creatorIds || []), ...(assigneeIds || [])]));

      const userMap = new Map<number, { id: number; name: string | null; email: string | null }>();

      if (allUserIds.length > 0) {
        const { data: users, error: usersError } = await supabaseAdmin
          .from("users")
          .select("id, name, email")
          .in("id", allUserIds);

        if (usersError) {
          console.error("[api/demands] load users for list error", usersError);
        } else if (users) {
          for (const u of users) {
            const id = u.id as number;
            userMap.set(id, {
              id,
              name: (u.name as string | null) ?? null,
              email: (u.email as string | null) ?? null,
            });
          }
        }
      }

      const deptIdsForConfig = Array.from(
        new Set(
          rows
            .map((row: any) => row.department_id as number | null)
            .filter((id) => typeof id === "number" && Number.isFinite(id))
        )
      ) as number[];

      const workflowConfigMap = new Map<number, DepartmentWorkflowConfig>();
      const customerIds = Array.from(
        new Set(
          rows
            .map((row: any) => row.customer_id as number | null)
            .filter((id) => typeof id === "number" && Number.isFinite(id))
        )
      ) as number[];
      const projectIds = Array.from(
        new Set(
          rows
            .map((row: any) => row.project_id as number | null)
            .filter((id) => typeof id === "number" && Number.isFinite(id))
        )
      ) as number[];
      const demandTypeIds = Array.from(
        new Set(
          rows
            .map((row: any) => row.demand_type_id as number | null)
            .filter((id) => typeof id === "number" && Number.isFinite(id))
        )
      ) as number[];
      const customerMap = new Map<number, string>();
      const projectMap = new Map<number, string>();
      const demandTypeMap = new Map<number, string>();

      if (deptIdsForConfig.length > 0) {
        const { data: deptRows, error: deptCfgError } = await supabaseAdmin
          .from("departments")
          .select("id, priority_config, status_config")
          .in("id", deptIdsForConfig);

        if (deptCfgError) {
          console.error("[api/demands] load workflow config for list error", deptCfgError);
        } else if (deptRows) {
          for (const d of deptRows as any[]) {
            const id = d.id as number;
            const cfg: DepartmentWorkflowConfig = {
              priorities: ((d as any).priority_config as any[]) || [],
              statuses: ((d as any).status_config as any[]) || [],
            };
            workflowConfigMap.set(id, cfg);
          }
        }
      }

      if (customerIdParam) {
        const customerIdNumber = Number.parseInt(customerIdParam, 10);
        if (!Number.isNaN(customerIdNumber) && customerIdNumber > 0) {
          query = query.eq("customer_id", customerIdNumber);
        }
      }

      if (projectIdParam) {
        const projectIdNumber = Number.parseInt(projectIdParam, 10);
        if (!Number.isNaN(projectIdNumber) && projectIdNumber > 0) {
          query = query.eq("project_id", projectIdNumber);
        }
      }

      if (demandTypeIdParam) {
        const demandTypeIdNumber = Number.parseInt(demandTypeIdParam, 10);
        if (!Number.isNaN(demandTypeIdNumber) && demandTypeIdNumber > 0) {
          query = query.eq("demand_type_id", demandTypeIdNumber);
        }
      }

      await Promise.all([
        customerIds.length > 0
          ? supabaseAdmin
              .from("customers")
              .select("id, name")
              .in("id", customerIds)
              .then(({ data, error }) => {
                if (error) {
                  console.error("[api/demands] load customers for list error", error);
                  return;
                }
                for (const row of data || []) {
                  customerMap.set(row.id as number, (row.name as string) || "未命名客户");
                }
              })
          : Promise.resolve(),
        projectIds.length > 0
          ? supabaseAdmin
              .from("projects")
              .select("id, name")
              .in("id", projectIds)
              .then(({ data, error }) => {
                if (error) {
                  console.error("[api/demands] load projects for list error", error);
                  return;
                }
                for (const row of data || []) {
                  projectMap.set(row.id as number, (row.name as string) || "未命名项目");
                }
              })
          : Promise.resolve(),
        demandTypeIds.length > 0
          ? supabaseAdmin
              .from("demand_types")
              .select("id, name")
              .in("id", demandTypeIds)
              .then(({ data, error }) => {
                if (error) {
                  console.error("[api/demands] load demand types for list error", error);
                  return;
                }
                for (const row of data || []) {
                  demandTypeMap.set(row.id as number, (row.name as string) || "未命名类型");
                }
              })
          : Promise.resolve(),
      ]);

      const items = rows.map((row: any) => {
        const demand: any = mapRowToDemand(row);

        const deptIdForConfig =
          typeof row.department_id === "number" && Number.isFinite(row.department_id)
            ? (row.department_id as number)
            : null;
        const cfgForRow = deptIdForConfig ? workflowConfigMap.get(deptIdForConfig) ?? null : null;

        if (cfgForRow) {
          const priorityLabel = resolvePriorityLabelForMessage(demand.priority as any, cfgForRow);
          const statusLabel = resolveStatusLabelForMessage(demand.status as any, cfgForRow);

          if (priorityLabel) {
            demand.priorityLabel = priorityLabel;
            const pCfg =
              cfgForRow.priorities.find(
                (p) => p.value === (demand.priority as any) || p.label === priorityLabel,
              ) || null;
            if (pCfg && pCfg.color) {
              demand.priorityColor = pCfg.color;
            }
          }

          if (statusLabel) {
            demand.statusLabel = statusLabel;
            const sCfg =
              cfgForRow.statuses.find(
                (s) => s.value === (demand.status as any) || s.label === statusLabel,
              ) || null;
            if (sCfg && sCfg.color) {
              demand.statusColor = sCfg.color;
            }
          }
        } else {
          const priorityLabel = resolvePriorityLabelForMessage(demand.priority as any, null);
          const statusLabel = resolveStatusLabelForMessage(demand.status as any, null);
          if (priorityLabel) {
            demand.priorityLabel = priorityLabel;
          }
          if (statusLabel) {
            demand.statusLabel = statusLabel;
          }
        }

        const creatorUser = row.creator_id ? userMap.get(row.creator_id as number) : undefined;
        const assigneeUser = row.assignee_id ? userMap.get(row.assignee_id as number) : undefined;

        if (creatorUser) {
          demand.creatorName = creatorUser.name || demand.creatorId;
          demand.creatorEmail = creatorUser.email || undefined;
        }

        if (assigneeUser) {
          demand.assigneeName = assigneeUser.name || demand.assigneeId;
          demand.assigneeEmail = assigneeUser.email || undefined;
        }

        if (typeof row.customer_id === "number") {
          demand.customerName = customerMap.get(row.customer_id);
        }
        if (typeof row.project_id === "number") {
          demand.projectName = projectMap.get(row.project_id);
        }
        if (typeof row.demand_type_id === "number") {
          demand.demandTypeName = demandTypeMap.get(row.demand_type_id);
        }

        const legacyDisplay = extractLegacyCustomerProject(demand.customFields || {});
        demand.legacyCustomerName = legacyDisplay.legacyCustomerName;
        demand.legacyProjectName = legacyDisplay.legacyProjectName;
        demand.customerDisplaySource = demand.customerName || demand.projectName
          ? "entity"
          : legacyDisplay.legacyCustomerName || legacyDisplay.legacyProjectName
          ? "legacy"
          : null;

        return demand as Demand;
      });

      return items;
    };

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    if (summaryMode) {
      let summaryQuery = applyFilters(
        supabaseAdmin
          .from("demands")
          .select(DEMAND_LIST_SELECT, { count: "exact" })
          .order("created_at", { ascending: false }),
        { skipStatusParam: true },
      );

      const { data, error, count } = await summaryQuery.range(0, recentSize - 1);

      if (error) {
        console.error("[api/demands] summary query error", error);
        return NextResponse.json(
          { error: "failed to load demands summary", detail: error.message },
          { status: 500 },
        );
      }

      const rows = (data || []) as any[];
      const items = await buildDemandsWithDisplayFields(rows);

      const countForStatus = async (statusValue: string) => {
        const { count: statusCount, error: statusError } = await applyFilters(
          supabaseAdmin.from("demands").select("id", { head: true, count: "exact" }),
          { statusOverride: statusValue, skipStatusParam: true },
        );

        if (statusError) {
          console.error("[api/demands] summary count error", statusError);
          return null;
        }

        return statusCount ?? 0;
      };

      const [pendingSummary, inProgressSummary, doneSummary] = await Promise.all([
        countForStatus("pending"),
        countForStatus("in_progress"),
        countForStatus("done"),
      ]);

      return NextResponse.json({
        items,
        page: 1,
        pageSize: recentSize,
        total: count ?? items.length,
        counts: {
          pending: pendingSummary,
          in_progress: inProgressSummary,
          done: doneSummary,
        },
      });
    }

    let query = applyFilters(
      supabaseAdmin
        .from("demands")
        .select(DEMAND_LIST_SELECT, { count: "exact" })
        .order("created_at", { ascending: false }),
    );

    const { data, error, count } = await query.range(from, to);

    if (error) {
      console.error("[api/demands] query error", error);
      return NextResponse.json(
        { error: "failed to load demands", detail: error.message },
        { status: 500 }
      );
    }

    const rows = (data || []) as any[];
    const items = await buildDemandsWithDisplayFields(rows);

    return NextResponse.json({
      items,
      page,
      pageSize,
      total: count ?? items.length,
    });

  } catch (error: any) {

    console.error("[api/demands] error", error);
    return NextResponse.json(
      {
        error: "failed to load demands",
        detail: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const activeError = ensureActiveUser(authResult.user);
    if (activeError) {
      return activeError;
    }

    const body = await req.json();
    const title = (body.title as string | undefined)?.trim();
    const description = (body.description as string | undefined)?.trim() || "";
    const departmentIdRaw = body.departmentId as string | number | undefined;
    const priority = (body.priority as Priority | undefined) || Priority.MEDIUM;
    const dueDate = (body.dueDate as string | undefined) || "";
    const creatorEmail = (body.creatorEmail as string | undefined)?.trim();
    const assigneeEmail = (body.assigneeEmail as string | undefined)?.trim();
    const customFields = (body.customFields as Record<string, any> | undefined) || {};
    const customerId = normalizeOptionalId(body.customerId);
    const projectId = normalizeOptionalId(body.projectId);
    const demandTypeId = normalizeOptionalId(body.demandTypeId);

    if (!title || departmentIdRaw === undefined || departmentIdRaw === null || !creatorEmail) {
      return NextResponse.json(
        { error: "title, departmentId and creatorEmail are required" },
        { status: 400 }
      );
    }

    let departmentIdNumber: number | null = null;
    let departmentKeyForFields: string | null = null;

    if (typeof departmentIdRaw === "number") {
      if (Number.isFinite(departmentIdRaw) && departmentIdRaw > 0) {
        departmentIdNumber = departmentIdRaw;
      }
    } else if (typeof departmentIdRaw === "string") {
      const trimmed = departmentIdRaw.trim();
      if (trimmed && /^\d+$/.test(trimmed)) {
        const parsed = Number.parseInt(trimmed, 10);
        if (!Number.isNaN(parsed) && parsed > 0) {
          departmentIdNumber = parsed;
        }
      } else {
        departmentKeyForFields = trimmed || null;
      }
    }

    let deptSlug: string | null = null;

    if (!departmentIdNumber && departmentKeyForFields) {
      const mappedSlug = DEPT_SLUG_MAP[departmentKeyForFields];
      if (!mappedSlug) {
        return NextResponse.json(
          { error: "invalid departmentId" },
          { status: 400 }
        );
      }
      deptSlug = mappedSlug;
    }

    const [
      {
        data: dept,
        error: deptError,
      },
      { data: creatorUser, error: creatorError },
      { data: assigneeUser, error: assigneeError },
      { data: demandType, error: demandTypeError },
    ] = await Promise.all([
      departmentIdNumber
        ? supabaseAdmin
            .from("departments")
            .select("id, slug, config, status_config")
            .eq("id", departmentIdNumber)
            .maybeSingle()
        : supabaseAdmin
            .from("departments")
            .select("id, slug, config, status_config")
            .eq("slug", deptSlug as string)
            .maybeSingle(),
      supabaseAdmin
        .from("users")
        .select("id, department_id, wecom_user_id")
        .eq("email", creatorEmail)
        .maybeSingle(),
      assigneeEmail
        ? supabaseAdmin
            .from("users")
            .select("id, department_id, wecom_user_id")
            .eq("email", assigneeEmail)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
      demandTypeId
        ? supabaseAdmin
            .from("demand_types")
            .select("id, department_id, field_template_id, name")
            .eq("id", demandTypeId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),

    ]);

    if (deptError || !dept) {
      console.error("[api/demands] dept error", deptError);
      return NextResponse.json(
        { error: "department not found", detail: deptError?.message },
        { status: 400 }
      );
    }

    if (!departmentIdNumber) {
      departmentIdNumber = dept.id as number;
    }

    if (demandTypeId && (demandTypeError || !demandType)) {
      return NextResponse.json(
        { error: "demand type not found", detail: demandTypeError?.message },
        { status: 400 }
      );
    }

    if (demandType && (demandType as any).department_id !== departmentIdNumber) {
      return NextResponse.json(
        { error: "demand type does not belong to selected department" },
        { status: 400 }
      );
    }

    if (!departmentKeyForFields && dept.slug) {
      departmentKeyForFields = dept.slug as string;
    }

    const workflowRules = resolveDepartmentDemandRules((dept as any).config, (dept as any).slug);
    const requiresLeaderAssignment = workflowRules.requireLeaderAssignment === true;

    if (creatorError || !creatorUser) {
      console.error("[api/demands] creator user error", creatorError);
      return NextResponse.json(
        { error: "creator user not found", detail: creatorError?.message },
        { status: 400 }
      );
    }

    if (!requiresLeaderAssignment && !assigneeEmail) {
      return NextResponse.json(
        { error: "assigneeEmail is required for the selected department" },
        { status: 400 }
      );
    }

    if (assigneeEmail && (assigneeError || !assigneeUser)) {
      console.error("[api/demands] assignee user error", assigneeError);
      return NextResponse.json(
        { error: "assignee user not found", detail: assigneeError?.message },
        { status: 400 }
      );
    }

    const code =
      (body.code as string | undefined)?.trim() ||
      `REQ-${new Date().getFullYear()}-${Math.floor(Date.now() % 100000)
        .toString()
        .padStart(5, "0")}`;

    const creatorCode = creatorEmail.split("@")[0]?.toUpperCase();
    const assigneeCode = assigneeEmail?.split("@")[0]?.toUpperCase();

    const fields = {
      code,
      description,
      // 不再在 fields 中存储 priority,改为数据库字段
      dueDate,
      departmentKey: departmentKeyForFields || undefined,
      creatorCode,
      assigneeCode,
      assigneeEmail: assigneeEmail || undefined,
      ...customFields,
    };

    if (!assigneeCode) {
      delete (fields as any).assigneeCode;
    }
    if (!assigneeEmail) {
      delete (fields as any).assigneeEmail;
    }

    const initialStatus = requiresLeaderAssignment
      ? workflowRules.unassignedStatus || "unassigned"
      : resolveAssignedStatusValue(
          workflowRules,
          (((dept as any).status_config as DepartmentWorkflowConfig["statuses"]) || []),
        );

    const { data, error } = await supabaseAdmin
      .from("demands")
      .insert({
        department_id: departmentIdNumber,
        creator_id: creatorUser.id,
        assignee_id: assigneeUser?.id || null,
        customer_id: customerId,
        project_id: projectId,
        demand_type_id: demandTypeId,
        title,
        status: initialStatus,
        priority: priority as string, // 支持自定义优先级
        field_template_id: (demandType as any)?.field_template_id || null,
        assigned_at: assigneeUser?.id ? new Date().toISOString() : null,
        fields,
      })
      .select("*")
      .maybeSingle();

    if (error || !data) {
      console.error("[api/demands] insert error", error);
      return NextResponse.json(
        { error: "failed to create demand", detail: error?.message ?? "insert failed" },
        { status: 500 }
      );
    }

    const demand = mapRowToDemand(data);

    const recentInputs: { user_id: number; input_type: string; value: string; metadata?: Record<string, any> }[] = [];
    if (customerId) recentInputs.push({ user_id: creatorUser.id as number, input_type: "customer", value: String(customerId) });
    if (projectId) recentInputs.push({ user_id: creatorUser.id as number, input_type: "project", value: String(projectId) });
    if (demandTypeId) recentInputs.push({ user_id: creatorUser.id as number, input_type: "demand_type", value: String(demandTypeId) });
    if (dueDate) recentInputs.push({ user_id: creatorUser.id as number, input_type: "due_date", value: dueDate });
    for (const [key, value] of Object.entries(customFields)) {
      if (typeof value === "string" && value.trim() && /url|link|站点|链接|site/i.test(key)) {
        recentInputs.push({ user_id: creatorUser.id as number, input_type: "link", value: value.trim(), metadata: { key } });
      }
    }
    if (recentInputs.length > 0) {
      supabaseAdmin.from("user_recent_inputs").insert(recentInputs).then(({ error }) => {
        if (error) console.error("[api/demands] insert recent inputs error", error);
      });
    }

    writeAuditLog({
      userId: creatorUser.id as number,
      entityType: "demand",
      entityId: data.id as number,
      action: "create",
      metadata: { code: demand.id, source: "web" },
    });

    const workflowConfigForMessage = await loadWorkflowConfigForDepartment(
      departmentIdNumber || (dept.id as number),
    );

    // 异步触发 demand.created 类型的 webhook 事件，失败不会影响主流程
    import("../../../lib/webhooks").then((mod) => {

      mod
        .enqueueAndDispatchWebhook("demand.created", {
          demand,
          departmentId: departmentIdNumber,
          creatorUserId: creatorUser.id as number,
          assigneeUserId: assigneeUser ? (assigneeUser.id as number) : undefined,
        })
        .catch((e) => {
          console.error("[api/demands] enqueue webhook error", e);
        });
    });

    // 直接在服务端同步调用企业微信应用消息发送
    const assigneeWecomId = ((assigneeUser as any)?.wecom_user_id || "").toString().trim();
    console.log("[api/demands] wecom message assigneeWecomId", assigneeWecomId);
    if (assigneeWecomId) {
      const baseUrlEnv =
        process.env.APP_PUBLIC_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.VITE_PUBLIC_URL ||
        "";
      const baseUrl = baseUrlEnv.replace(/\/+$/, "");
      const link = baseUrl && demand.id ? `${baseUrl}/demands/${encodeURIComponent(demand.id)}` : "";

      const priorityLabelForMessage = resolvePriorityLabelForMessage(
        demand.priority as any,
        workflowConfigForMessage,
      );
      const statusLabelForMessage = resolveStatusLabelForMessage(
        demand.status as any,
        workflowConfigForMessage,
      );

      const prefix = ((process.env.WECOM_MESSAGE_PREFIX as string | undefined) || "【需求系统】").toString().trim();

      let content = `${prefix}你有一条新的需求需要处理：${demand.title}`;
      if (priorityLabelForMessage) {
        content += `\n优先级：${priorityLabelForMessage}`;
      }
      if (statusLabelForMessage) {
        content += `\n当前状态：${statusLabelForMessage}`;
      }

      if (link) {
        content += `\n查看详情：${link}`;
      }


      console.log("[api/demands] wecom message content", content);

      await sendWecomAppTextMessage([assigneeWecomId], content);
    }




    const wecomDebug = {
      assigneeWecomId: ((assigneeUser as any)?.wecom_user_id || "").toString().trim(),
      hasProxyUrl: !!process.env.WECOM_MESSAGE_PROXY_URL,
      hasProxyToken: !!process.env.WECOM_MESSAGE_PROXY_TOKEN,
    };

    return NextResponse.json({ demand, wecomDebug }, { status: 201 });



  } catch (error: any) {
    console.error("[api/demands] create error", error);
    return NextResponse.json(
      {
        error: "failed to create demand",
        detail: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}
