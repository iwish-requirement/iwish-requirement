import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../lib/serverAuth";
import { DemandStatus, Priority, Demand } from "../../../types";

export const runtime = "edge";

const DEPT_SLUG_MAP: Record<string, string> = {
  d1: "tech",
  d2: "design",
  d3: "marketing",
  d4: "sales",
};

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
    creatorId,
    assigneeId,
    status: status as DemandStatus,
    priority,
    createdAt,
    dueDate,
    customFields: Object.keys(rest).length ? rest : undefined,
  };
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
    const priorityParam = url.searchParams.get("priority");
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

    const pageParam = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSizeParam = parseInt(url.searchParams.get("pageSize") || "20", 10);
    const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
    const basePageSize = Number.isNaN(pageSizeParam) || pageSizeParam < 1 ? 20 : pageSizeParam;
    const pageSize = Math.min(basePageSize, 100);

    let query = supabaseAdmin
      .from("demands")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    // 状态筛选：直接使用数据库状态值
    if (statusParam) {
      query = query.eq("status", statusParam);
    }

    // 优先级筛选：直接使用数据库优先级值
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
      query = query.or(
        `title.ilike.${pattern},fields->>description.ilike.${pattern},fields->>code.ilike.${pattern}`
      );
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await query.range(from, to);

    if (error) {
      console.error("[api/demands] query error", error);
      return NextResponse.json(
        { error: "failed to load demands", detail: error.message },
        { status: 500 }
      );
    }

    const rows = (data || []) as any[];

    // 为当前页的所有需求批量加载创建人和执行人信息，用于列表展示中文姓名
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

    const items = rows.map((row) => {
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

    if (!title || departmentIdRaw === undefined || departmentIdRaw === null || !creatorEmail || !assigneeEmail) {
      return NextResponse.json(
        { error: "title, departmentId, creatorEmail and assigneeEmail are required" },
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
    ] = await Promise.all([
      departmentIdNumber
        ? supabaseAdmin
            .from("departments")
            .select("id, slug")
            .eq("id", departmentIdNumber)
            .maybeSingle()
        : supabaseAdmin
            .from("departments")
            .select("id, slug")
            .eq("slug", deptSlug as string)
            .maybeSingle(),
      supabaseAdmin
        .from("users")
        .select("id, department_id, wecom_user_id")
        .eq("email", creatorEmail)
        .maybeSingle(),
      supabaseAdmin
        .from("users")
        .select("id, department_id, wecom_user_id")
        .eq("email", assigneeEmail)
        .maybeSingle(),

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

    if (!departmentKeyForFields && dept.slug) {
      departmentKeyForFields = dept.slug as string;
    }

    if (creatorError || !creatorUser) {
      console.error("[api/demands] creator user error", creatorError);
      return NextResponse.json(
        { error: "creator user not found", detail: creatorError?.message },
        { status: 400 }
      );
    }

    if (assigneeError || !assigneeUser) {
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
    const assigneeCode = assigneeEmail.split("@")[0]?.toUpperCase();

    const fields = {
      code,
      description,
      // 不再在 fields 中存储 priority,改为数据库字段
      dueDate,
      departmentKey: departmentKeyForFields || undefined,
      creatorCode,
      assigneeCode,
      assigneeEmail,
      ...customFields,
    };

    const { data, error } = await supabaseAdmin
      .from("demands")
      .insert({
        department_id: departmentIdNumber,
        creator_id: creatorUser.id,
        assignee_id: assigneeUser.id,
        title,
        status: "pending",
        priority: priority as string, // 支持自定义优先级
        field_template_id: null,
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

    // 异步触发 demand.created 类型的 webhook 事件，失败不会影响主流程
    import("../../../lib/webhooks").then((mod) => {
      mod
        .enqueueAndDispatchWebhook("demand.created", {
          demand,
          departmentId: departmentIdNumber,
          creatorUserId: creatorUser.id as number,
          assigneeUserId: assigneeUser.id as number,
        })
        .catch((e) => {
          console.error("[api/demands] enqueue webhook error", e);
        });
    });

    // 异步给执行人发送企业微信应用消息（仅通知 assignee）
    import("../../../lib/wecomApp").then((mod) => {
      const assigneeWecomId = ((assigneeUser as any).wecom_user_id || "").toString().trim();
      console.log("[api/demands] wecom message assigneeWecomId", assigneeWecomId);
      if (!assigneeWecomId) {
        return;
      }

      const baseUrlEnv =
        process.env.APP_PUBLIC_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.VITE_PUBLIC_URL ||
        "";
      const baseUrl = baseUrlEnv.replace(/\/+$/, "");
      const link = baseUrl && demand.id ? `${baseUrl}/demands/${encodeURIComponent(demand.id)}` : "";

      let content = `你有一条新的需求需要处理：${demand.title}`;
      if (demand.priority) {
        content += `\n优先级：${demand.priority}`;
      }
      if (demand.status) {
        content += `\n当前状态：${demand.status}`;
      }
      if (link) {
        content += `\n查看详情：${link}`;
      }

      console.log("[api/demands] wecom message content", content);

      mod
        .sendWecomAppTextMessage([assigneeWecomId], content)
        .catch((e: any) => {
          console.error("[api/demands] send wecom app message error", e);
        });
    });



    const wecomDebug = {
      assigneeWecomId: ((assigneeUser as any).wecom_user_id || "").toString().trim(),
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
