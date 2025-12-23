import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../lib/serverAuth";
import { DemandStatus, Demand, Priority } from "../../../../types";

export const runtime = "edge";

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

    let userMap = new Map<number, { id: number; name: string | null; email: string | null }>();

    if (allUserIds.length > 0) {
      const { data: users, error: usersError } = await supabaseAdmin
        .from("users")
        .select("id, name, email")
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
          });
        }
      }
    }

    const departmentIds = Array.from(
      new Set(
        rows
          .map((row) => row.department_id as number | null)
          .filter((id) => typeof id === "number" && Number.isFinite(id))
      )
    ) as number[];

    let departmentMap = new Map<number, string>();

    if (departmentIds.length > 0) {
      const { data: departments, error: departmentsError } = await supabaseAdmin
        .from("departments")
        .select("id, name")
        .in("id", departmentIds);

      if (departmentsError) {
        console.error("[api/demands/export] load departments error", departmentsError);
      } else if (departments) {
        for (const d of departments) {
          const id = d.id as number;
          const name = (d.name as string | null) ?? "";
          departmentMap.set(id, name);
        }
      }
    }

    let dynamicColumns: { key: string; label: string }[] = [];

    let departmentIdForFields: number | null = null;
    if (departmentIdParam) {
      const parsed = Number.parseInt(departmentIdParam, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        departmentIdForFields = parsed;
      }
    }

    if (departmentIdForFields !== null) {
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
      }

      if (assigneeUser) {
        demand.assigneeName = assigneeUser.name || demand.assigneeId;
        demand.assigneeEmail = assigneeUser.email || undefined;
      }

      return demand as Demand;
    });

    // 构造 CSV 头（先实现固定字段，动态字段后续可按部门配置扩展）
    const headers = [
      "需求ID",
      "标题",
      "描述",
      "部门",
      "提交人",
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
      row.push(escapeCsvCell(d.creatorName || d.creatorId || ""));
      row.push(escapeCsvCell(d.assigneeName || d.assigneeId || ""));
      row.push(escapeCsvCell(d.status || ""));
      row.push(escapeCsvCell(d.priority || ""));
      row.push(escapeCsvCell(d.createdAt || ""));
      row.push(escapeCsvCell(d.dueDate || ""));

      const customFields = (d.customFields || {}) as Record<string, any>;
      for (const column of dynamicColumns) {
        const rawValue = customFields[column.key];
        let value = "";
        if (rawValue !== undefined && rawValue !== null) {
          if (
            typeof rawValue === "string" ||
            typeof rawValue === "number" ||
            typeof rawValue === "boolean"
          ) {
            value = String(rawValue);
          } else {
            value = JSON.stringify(rawValue);
          }
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
