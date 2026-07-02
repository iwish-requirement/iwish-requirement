import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../lib/serverAuth";
import { resolveStatsScopeForUser } from "../../../../lib/statScope";
import { DemandStatus, Demand, Priority, type DepartmentWorkflowConfig } from "../../../../types";
import { extractLegacyCustomerProject } from "../../../../lib/legacyDemandFields";
import {
  getBusinessDayEndExclusiveIso,
  getBusinessDayStartIso,
} from "../../../../lib/businessDateRange";

export const runtime = "edge";

type DynamicExportColumn = {
  key: string;
  label: string;
  aliases: string[];
};

function mapStatus(status: string | null): DemandStatus {
  const value = (status ?? "").toString();
  switch (value) {
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
      return "pending";
    case DemandStatus.IN_PROGRESS:
      return "in_progress";
    case DemandStatus.REVIEW:
      return "review";
    case DemandStatus.DONE:
      return "done";
    case DemandStatus.CLOSED:
      return "closed";
    case DemandStatus.DELAYED:
      return "delayed";
    case DemandStatus.IGNORED:
      return "ignored";
    default:
      return undefined;
  }
}

function normalizePriority(raw: any): Priority {
  const value = (raw ?? "").toString();
  if (value.includes("紧急")) return Priority.CRITICAL;
  if (value.includes("高")) return Priority.HIGH;
  if (value.includes("中")) return Priority.MEDIUM;
  if (value.includes("低")) return Priority.LOW;
  return Priority.MEDIUM;
}

function mapRowToDemand(row: any): Demand {
  const fields = (row.fields || {}) as any;

  const code: string = fields.code || `REQ-${String(row.id ?? "").toString().padStart(4, "0")}`;
  const description: string = fields.description || "";
  const priority: Priority = normalizePriority(fields.priority);
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

  return {
    id: code,
    title: row.title as string,
    description,
    departmentId,
    creatorId,
    assigneeId,
    status: mapStatus(row.status as string | null),
    priority,
    createdAt,
    dueDate,
    customFields: Object.keys(rest).length ? rest : undefined,
  };
}

function escapeCsvCell(value: string): string {
  const needsQuote = value.includes(",") || value.includes("\n") || value.includes("\"") || value.startsWith(" ") || value.endsWith(" ");
  if (!needsQuote) return value;
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

function normalizeFieldName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s/_\\\-:：,，.。|｜()[\]（）【】{}]+/g, "");
}

function isWebsiteNameLabel(label: string): boolean {
  const normalized = normalizeFieldName(label);
  return (
    normalized.includes("\u7f51\u7ad9\u540d\u79f0") ||
    normalized.includes("\u5ba2\u6237\u54c1\u724c") ||
    normalized.includes("\u5ba2\u6237\u54c1\u724c\u540d\u79f0")
  );
}

function isWebsiteUrlLabel(label: string): boolean {
  const normalized = normalizeFieldName(label);
  return (
    normalized.includes("\u7f51\u5740") ||
    normalized.includes("\u4ea7\u54c1\u8be6\u60c5\u9875") ||
    normalized.includes("\u5ba2\u6237\u7f51\u5740")
  );
}

function isAdLaunchDateLabel(label: string): boolean {
  return normalizeFieldName(label).includes("\u5e7f\u544a\u4e0a\u7ebf\u65f6\u95f4");
}

function isSubmitterLabel(label: string): boolean {
  return normalizeFieldName(label).includes("\u9700\u6c42\u63d0\u4ea4\u4eba");
}

function labelsShareBusinessMeaning(left: string, right: string): boolean {
  const normalizedLeft = normalizeFieldName(left);
  const normalizedRight = normalizeFieldName(right);
  return (
    normalizedLeft === normalizedRight ||
    (isWebsiteNameLabel(left) && isWebsiteNameLabel(right)) ||
    (isWebsiteUrlLabel(left) && isWebsiteUrlLabel(right)) ||
    (isAdLaunchDateLabel(left) && isAdLaunchDateLabel(right)) ||
    (isSubmitterLabel(left) && isSubmitterLabel(right))
  );
}

function buildFieldAliases(
  key: string,
  label: string,
  departmentFields: { key: string | null; label: string | null }[],
): string[] {
  const aliases = new Set<string>([key, label]);

  for (const field of departmentFields) {
    const fieldKey = (field.key || "").trim();
    const fieldLabel = (field.label || "").trim();
    if (!fieldKey || !fieldLabel) continue;
    if (labelsShareBusinessMeaning(label, fieldLabel)) {
      aliases.add(fieldKey);
      aliases.add(fieldLabel);
    }
  }

  if (isWebsiteNameLabel(label)) {
    [
      "website_name",
      "customerName",
      "customer_name",
      "brand",
      "brand_name",
      "\u7f51\u7ad9\u540d\u79f0",
      "\u7f51\u7ad9\u540d\u79f0/\u5ba2\u6237\u54c1\u724c",
      "\u5ba2\u6237/\u54c1\u724c",
      "\u5ba2\u6237",
      "\u54c1\u724c",
    ].forEach((alias) => aliases.add(alias));
  }

  if (isWebsiteUrlLabel(label)) {
    [
      "website_url",
      "projectName",
      "project_name",
      "url",
      "site_url",
      "\u7f51\u5740",
      "\u7f51\u5740/\u4ea7\u54c1\u8be6\u60c5\u9875",
      "\u9700\u652f\u6301\u7684\u5ba2\u6237\u7f51\u5740",
      "\u94fe\u63a5",
      "\u9879\u76ee",
    ].forEach((alias) => aliases.add(alias));
  }

  if (isAdLaunchDateLabel(label)) {
    ["ad_launch_date", "\u5e7f\u544a\u4e0a\u7ebf\u65f6\u95f4"].forEach((alias) => aliases.add(alias));
  }

  return Array.from(aliases);
}

function readCustomFieldValue(
  customFields: Record<string, any>,
  column: Pick<DynamicExportColumn, "key" | "label" | "aliases">,
) {
  const aliases = new Set([column.key, column.label, ...column.aliases].filter(Boolean));
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(customFields, alias)) {
      return customFields[alias];
    }
  }

  const normalizedAliases = new Set(Array.from(aliases).map((alias) => normalizeFieldName(alias)));
  for (const [fieldKey, value] of Object.entries(customFields)) {
    if (normalizedAliases.has(normalizeFieldName(fieldKey))) {
      return value;
    }
  }

  return undefined;
}

function stringifyExportValue(rawValue: any): string {
  if (rawValue === undefined || rawValue === null) return "";
  if (
    typeof rawValue === "string" ||
    typeof rawValue === "number" ||
    typeof rawValue === "boolean"
  ) {
    return String(rawValue);
  }
  if (Array.isArray(rawValue)) {
    return rawValue.map((item) => stringifyExportValue(item)).filter(Boolean).join("; ");
  }
  return JSON.stringify(rawValue);
}

const CUSTOMER_BRAND_COLUMN: DynamicExportColumn = {
  key: "customerBrandName",
  label: "\u5ba2\u6237/\u54c1\u724c",
  aliases: buildFieldAliases("customerBrandName", "\u7f51\u7ad9\u540d\u79f0/\u5ba2\u6237\u54c1\u724c", []),
};

function resolvePriorityLabel(
  rawPriority: string | undefined | null,
  cfg: DepartmentWorkflowConfig | null,
): string {
  const value = (rawPriority ?? "").toString();
  if (!value) return "";

  if (cfg?.priorities?.length) {
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

function resolveStatusLabel(
  rawStatus: string | undefined | null,
  cfg: DepartmentWorkflowConfig | null,
): string {
  const value = (rawStatus ?? "").toString();
  if (!value) return "";

  if (cfg?.statuses?.length) {
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
    default:
      return value;
  }
}

function fieldsPriority(row: any): string | null {
  const fields = (row?.fields || {}) as Record<string, unknown>;
  const value = fields.priority;
  return value === undefined || value === null ? null : String(value);
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

    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const departmentIdParam = url.searchParams.get("departmentId");
    const creatorCode = url.searchParams.get("creatorCode");
    const creatorUserIdParam = url.searchParams.get("creatorUserId");
    const assigneeUserIdParam = url.searchParams.get("assigneeUserId");
    const q = url.searchParams.get("q") || "";
    const createdFrom = getBusinessDayStartIso(url.searchParams.get("createdFrom"));
    const createdTo = getBusinessDayEndExclusiveIso(url.searchParams.get("createdTo"));
    const dueFrom = url.searchParams.get("dueFrom");
    const dueTo = url.searchParams.get("dueTo");

    const customFieldFilters: { key: string; value: string }[] = [];
    for (const [key, value] of url.searchParams.entries()) {
      if (!key.startsWith("cf_")) continue;
      const fieldKey = key.slice(3);
      if (!fieldKey || !value) continue;
      customFieldFilters.push({ key: fieldKey, value });
    }

    let query = supabaseAdmin
      .from("demands")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (statusParam) {
      const dbStatus = toDbStatus(statusParam as DemandStatus);
      if (dbStatus) {
        query = query.eq("status", dbStatus);
      }
    }

    const scopeResult = resolveStatsScopeForUser(authResult.user, departmentIdParam);
    if (scopeResult.errorResponse) {
      return scopeResult.errorResponse;
    }
    const scopedDepartmentId = scopeResult.scope!.departmentId;

    if (scopedDepartmentId !== null) {
      query = query.eq("department_id", scopedDepartmentId);
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
      query = query.lt("created_at", createdTo);
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
      query = query.or(
        `title.ilike.${pattern},fields->>description.ilike.${pattern},fields->>code.ilike.${pattern}`
      );
    }

    // 导出不分页，但为了安全限制最大行数
    const MAX_EXPORT_ROWS = 2000;
    const { data, error, count } = await query.limit(MAX_EXPORT_ROWS);

    if (error) {
      console.error("[api/demands/export] query error", error);
      return NextResponse.json(
        { error: "failed to export demands", detail: error.message },
        { status: 500 }
      );
    }

    const rows = (data || []) as any[];

    const creatorIds = Array.from(
      new Set(
        rows
          .map((row) => row.creator_id as number | null)
          .filter((id) => typeof id === "number" && Number.isFinite(id))
      )
    ) as number[];

    const assigneeIds = Array.from(
      new Set(
        rows
          .map((row) => row.assignee_id as number | null)
          .filter((id) => typeof id === "number" && Number.isFinite(id))
      )
    ) as number[];

    const allUserIds = Array.from(new Set([...(creatorIds || []), ...(assigneeIds || [])]));

    let userMap = new Map<number, { id: number; name: string | null; email: string | null; departmentId: number | null }>();

    if (allUserIds.length > 0) {
      const { data: users, error: usersError } = await supabaseAdmin
        .from("users")
        .select("id, name, email, department_id")
        .in("id", allUserIds);

      if (usersError) {
        console.error("[api/demands/export] load users error", usersError);
      } else if (users) {
        for (const u of users) {
          const id = u.id as number;
          userMap.set(id, {
            id,
            name: (u.name as string | null) ?? null,
            email: (u.email as string | null) ?? null,
            departmentId: (u.department_id as number | null) ?? null,
          });
        }
      }
    }

    const userDepartmentIds = Array.from(
      new Set(
        Array.from(userMap.values())
          .map((user) => user.departmentId)
          .filter((id): id is number => typeof id === "number" && Number.isFinite(id))
      )
    );

    const departmentIds = Array.from(
      new Set(
        [
          ...rows
          .map((row) => row.department_id as number | null)
          .filter((id) => typeof id === "number" && Number.isFinite(id)),
          ...userDepartmentIds,
        ]
      )
    ) as number[];

    let departmentMap = new Map<number, string>();
    let departmentWorkflowMap = new Map<number, DepartmentWorkflowConfig>();

    if (departmentIds.length > 0) {
      const { data: departments, error: departmentsError } = await supabaseAdmin
        .from("departments")
        .select("id, name, priority_config, status_config")
        .in("id", departmentIds);

      if (departmentsError) {
        console.error("[api/demands/export] load departments error", departmentsError);
      } else if (departments) {
        for (const d of departments) {
          const id = d.id as number;
          const name = (d.name as string | null) ?? "";
          departmentMap.set(id, name);
          departmentWorkflowMap.set(id, {
            priorities: Array.isArray((d as any).priority_config) ? ((d as any).priority_config as any[]) : [],
            statuses: Array.isArray((d as any).status_config) ? ((d as any).status_config as any[]) : [],
          });
        }
      }
    }

    const customerIds = Array.from(
      new Set(
        rows
          .map((row) => row.customer_id as number | null)
          .filter((id) => typeof id === "number" && Number.isFinite(id))
      )
    ) as number[];

    let customerMap = new Map<number, string>();

    if (customerIds.length > 0) {
      const { data: customers, error: customersError } = await supabaseAdmin
        .from("customers")
        .select("id, name")
        .in("id", customerIds);

      if (customersError) {
        console.error("[api/demands/export] load customers error", customersError);
      } else if (customers) {
        for (const customer of customers) {
          customerMap.set(customer.id as number, ((customer.name as string | null) || "").toString());
        }
      }
    }

    let dynamicColumns: DynamicExportColumn[] = [];
    let departmentFieldAliases: { key: string | null; label: string | null }[] = [];

    let departmentIdForFields: number | null = null;
    if (departmentIdParam) {
      const parsed = Number.parseInt(departmentIdParam, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        departmentIdForFields = parsed;
      }
    }

    if (departmentIdForFields !== null) {
      const { data: allDepartmentFields, error: allDepartmentFieldsError } = await supabaseAdmin
        .from("department_fields")
        .select("key, label")
        .eq("department_id", departmentIdForFields);

      if (allDepartmentFieldsError) {
        console.error("[api/demands/export] load department field aliases error", allDepartmentFieldsError);
      } else if (allDepartmentFields) {
        departmentFieldAliases = allDepartmentFields as { key: string | null; label: string | null }[];
      }

      const { data: activeTemplate, error: tplError } = await supabaseAdmin
        .from("department_field_templates")
        .select("id")
        .eq("department_id", departmentIdForFields)
        .eq("is_active", true)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tplError) {
        console.error("[api/demands/export] load active field template error", tplError);
      } else if (activeTemplate) {
        const { data: fields, error: fieldsError } = await supabaseAdmin
          .from("department_fields")
          .select("key, label, exportable")
          .eq("department_id", departmentIdForFields)
          .eq("template_id", activeTemplate.id)
          .order("order_index", { ascending: true });

        if (fieldsError) {
          console.error("[api/demands/export] load exportable fields error", fieldsError);
        } else if (fields) {
          dynamicColumns = (fields as any[])
            .filter((field) =>
              field.exportable === undefined || field.exportable === null
                ? true
                : Boolean(field.exportable),
            )
            .map((field) => ({
              key: String(field.key),
              label: String(field.label),
              aliases: buildFieldAliases(String(field.key), String(field.label), departmentFieldAliases),
            }));
        }
      }
    }

    const demands: Demand[] = rows.map((row) => {
      const demand: any = mapRowToDemand(row);

      const creatorUser = row.creator_id ? userMap.get(row.creator_id as number) : undefined;
      const assigneeUser = row.assignee_id ? userMap.get(row.assignee_id as number) : undefined;

      if (creatorUser) {
        demand.creatorName = creatorUser.name || demand.creatorId;
        demand.creatorEmail = creatorUser.email || undefined;
        demand.creatorDepartmentName = creatorUser.departmentId
          ? departmentMap.get(creatorUser.departmentId) || ""
          : "";
      }

      if (assigneeUser) {
        demand.assigneeName = assigneeUser.name || demand.assigneeId;
        demand.assigneeEmail = assigneeUser.email || undefined;
      }

      const workflowConfig =
        typeof row.department_id === "number" ? departmentWorkflowMap.get(row.department_id) || null : null;
      demand.statusLabel = resolveStatusLabel(row.status as string | null, workflowConfig);
      demand.priorityLabel = resolvePriorityLabel((row.priority as string | null) || fieldsPriority(row), workflowConfig);
      const customFields = (demand.customFields || {}) as Record<string, any>;
      const legacyDisplay = extractLegacyCustomerProject(demand.customFields || {});
      const customerBrandFromFields = stringifyExportValue(readCustomFieldValue(customFields, CUSTOMER_BRAND_COLUMN));
      demand.customerBrandName =
        (typeof row.customer_id === "number" ? customerMap.get(row.customer_id) || "" : "") ||
        customerBrandFromFields ||
        legacyDisplay.legacyCustomerName ||
        "";

      return demand as Demand;
    });

    // 构造 CSV 头（先实现固定字段，动态字段后续可按部门配置扩展）
    const headers = [
      "需求ID",
      "标题",
      "描述",
      "部门",
      "客户/品牌",
      "提交人",
      "提交人部门",
      "执行人",
      "状态",
      "优先级",
      "创建日期",
      "截止日期",
      ...dynamicColumns.map((column) => column.label),
    ];

    const lines: string[] = [];
    lines.push(headers.map((h) => escapeCsvCell(h)).join(","));

    for (const d of demands) {
      const row: string[] = [];
      row.push(escapeCsvCell(d.id || ""));
      row.push(escapeCsvCell(d.title || ""));
      row.push(escapeCsvCell(d.description || ""));

      let departmentName = "";
      if (d.departmentId) {
        const asNumber = Number.parseInt(d.departmentId, 10);
        if (!Number.isNaN(asNumber)) {
          departmentName = departmentMap.get(asNumber) || d.departmentId;
        } else {
          departmentName = d.departmentId;
        }
      }

      row.push(escapeCsvCell(departmentName));
      row.push(escapeCsvCell((d as any).customerBrandName || ""));
      row.push(escapeCsvCell(d.creatorName || d.creatorId || ""));
      row.push(escapeCsvCell((d as any).creatorDepartmentName || ""));
      row.push(escapeCsvCell(d.assigneeName || d.assigneeId || ""));
      row.push(escapeCsvCell((d as any).statusLabel || d.status || ""));
      row.push(escapeCsvCell((d as any).priorityLabel || d.priority || ""));
      row.push(escapeCsvCell(d.createdAt || ""));
      row.push(escapeCsvCell(d.dueDate || ""));

      const customFields = (d.customFields || {}) as Record<string, any>;
      for (const column of dynamicColumns) {
        const rawValue = readCustomFieldValue(customFields, column);
        let value = stringifyExportValue(rawValue);
        if (!value && isSubmitterLabel(column.label)) {
          value = d.creatorName || d.creatorId || "";
        }
        row.push(escapeCsvCell(value));
      }

      lines.push(row.join(","));
    }

    const csvContent = "\uFEFF" + lines.join("\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="demands-export.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("[api/demands/export] error", error);
    return NextResponse.json(
      {
        error: "failed to export demands",
        detail: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}
