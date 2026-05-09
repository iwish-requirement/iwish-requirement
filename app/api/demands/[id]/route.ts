import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { DemandStatus, Priority, Demand, type DepartmentWorkflowConfig } from "../../../../types";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../lib/serverAuth";
import {
  resolveAssignedStatusValue,
  resolveDepartmentDemandRules,
} from "../../../../lib/departmentDemandRules";
import { sendWecomAppTextMessage } from "../../../../lib/wecomApp";
import { buildDemandStatusGroups, type DemandStatusGroups } from "../../../../lib/demandStatusGroups";
import { loadEffectivePermissionsForUser } from "../../../../lib/serverPermissions";

export const runtime = "edge";

const DEMAND_DETAIL_SELECT =
  "id, department_id, creator_id, assignee_id, customer_id, project_id, demand_type_id, field_template_id, title, status, priority, fields, created_at, assigned_at, started_at, finished_at, closed_at, delayed_at";

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

function mapRowToDemand(row: any): Demand {
  const fields = (row.fields || {}) as any;

  const code: string = fields.code || `REQ-${String(row.id ?? "").toString().padStart(4, "0")}`;
  const description: string = fields.description || "";
  // Priority 从数据库字段读取，并做兼容处理
  const priorityFromDb = (row.priority as string | null) || "";
  const normalizedPriority = (() => {
    const value = (priorityFromDb ?? "").toString();
    if (value.includes("紧急")) return Priority.CRITICAL;
    if (value.includes("高")) return Priority.HIGH;
    if (value.includes("中")) return Priority.MEDIUM;
    if (value.includes("低")) return Priority.LOW;

    const lower = value.toLowerCase();
    if (lower === "critical" || lower === "p0") return Priority.CRITICAL;
    if (lower === "high" || lower === "p1") return Priority.HIGH;
    if (lower === "medium" || lower === "p2") return Priority.MEDIUM;
    if (lower === "low" || lower === "p3") return Priority.LOW;

    return (value as Priority) || Priority.MEDIUM;
  })();
  const priority: Priority = normalizedPriority as Priority;

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

  // Status 直接从数据库读取
  const status = (row.status as string) || "pending";

  return {
    id: code,
    title: row.title as string,
    description,
    departmentId,
    demandTypeId: typeof row.demand_type_id === "number" ? row.demand_type_id : undefined,
    fieldTemplateId: typeof row.field_template_id === "number" ? row.field_template_id : null,
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

function normalizeOptionalId(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === "") {
    return null;
  }
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

function buildStatusTimestampUpdates(status: string | undefined, existing: any, statusGroups?: DemandStatusGroups) {
  const updates: Record<string, string> = {};
  if (!status) return updates;
  const normalized = status.toLowerCase();
  const now = new Date().toISOString();
  const isActive = statusGroups
    ? statusGroups.active.includes(normalized) && !statusGroups.pending.includes(normalized)
    : normalized === "in_progress" || normalized === "review";
  const isDelayed = statusGroups ? statusGroups.delayed.includes(normalized) : normalized === "delayed";
  const isCompleted = statusGroups
    ? statusGroups.completed.includes(normalized)
    : normalized === "done" || normalized === "closed";

  if (isActive && !existing.started_at) {
    updates.started_at = now;
  }
  if (isDelayed && !existing.delayed_at) {
    updates.delayed_at = now;
  }
  if (isCompleted && !existing.finished_at) {
    updates.finished_at = now;
  }
  if (normalized === "closed" && !existing.closed_at) {
    updates.closed_at = now;
  }

  return updates;
}

async function enrichDemandUsers(demand: Demand, row: any): Promise<Demand> {
  const [creatorResult, assigneeResult] = await Promise.all([
    row.creator_id
      ? supabaseAdmin.from("users").select("name, email").eq("id", row.creator_id).maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
    row.assignee_id
      ? supabaseAdmin.from("users").select("name, email").eq("id", row.assignee_id).maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
  ]);

  if (creatorResult.error) {
    console.error("[api/demands/:id] enrich creator error", creatorResult.error);
  } else if (creatorResult.data) {
    demand.creatorName = (creatorResult.data.name as string | null) || demand.creatorId;
    demand.creatorEmail = (creatorResult.data.email as string | null) || undefined;
  }

  if (assigneeResult.error) {
    console.error("[api/demands/:id] enrich assignee error", assigneeResult.error);
  } else if (assigneeResult.data) {
    demand.assigneeName = (assigneeResult.data.name as string | null) || demand.assigneeId;
    demand.assigneeEmail = (assigneeResult.data.email as string | null) || undefined;
  }

  return demand;
}

async function loadWorkflowConfigForDepartment(
  departmentId: number | null | undefined,
): Promise<DepartmentWorkflowConfig | null> {
  if (!departmentId || !Number.isFinite(departmentId)) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("departments")
    .select("priority_config, status_config")
    .eq("id", departmentId)
    .maybeSingle();

  if (error || !data) {
    console.error("[api/demands/:id] load workflow config error", error);
    return null;
  }

  return {
    priorities: (((data as any).priority_config as any[]) || []),
    statuses: (((data as any).status_config as any[]) || []),
  };
}

function resolvePriorityLabelForMessage(
  rawPriority: string | undefined | null,
  cfg: DepartmentWorkflowConfig | null,
): string | null {
  const value = (rawPriority ?? "").toString();
  if (!value) return null;

  if (cfg?.priorities?.length) {
    const found =
      cfg.priorities.find((item) => item.value === value) ||
      cfg.priorities.find((item) => item.label === value);
    if (found) return found.label;
  }

  return value;
}

function resolveStatusLabelForMessage(
  rawStatus: string | undefined | null,
  cfg: DepartmentWorkflowConfig | null,
): string | null {
  const value = (rawStatus ?? "").toString();
  if (!value) return null;

  if (cfg?.statuses?.length) {
    const found =
      cfg.statuses.find((item) => item.value === value) ||
      cfg.statuses.find((item) => item.label === value);
    if (found) return found.label;
  }

  return value;
}

export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const id = context.params.id;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("demands")
      .select(DEMAND_DETAIL_SELECT)
      .eq("fields->>code", id)
      .maybeSingle();

    if (error) {
      console.error("[api/demands/:id] query error", error);
      return NextResponse.json(
        { error: "failed to load demand", detail: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    let creatorUser: { id: number; name: string | null; email: string | null } | null = null;
    let assigneeUser: { id: number; name: string | null; email: string | null } | null = null;

    try {
      const [creatorResult, assigneeResult] = await Promise.all([
        data.creator_id
          ? supabaseAdmin
              .from("users")
              .select("id, name, email")
              .eq("id", data.creator_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),
        data.assignee_id
          ? supabaseAdmin
              .from("users")
              .select("id, name, email")
              .eq("id", data.assignee_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),
      ]);

      if (creatorResult.error) {
        console.error("[api/demands/:id] load creator user error", creatorResult.error);
      } else {
        creatorUser = (creatorResult.data || null) as any;
      }

      if (assigneeResult.error) {
        console.error("[api/demands/:id] load assignee user error", assigneeResult.error);
      } else {
        assigneeUser = (assigneeResult.data || null) as any;
      }
    } catch (userError) {
      console.error("[api/demands/:id] load users error", userError);
    }

    const demand: any = mapRowToDemand(data);

    if (creatorUser) {
      demand.creatorName = creatorUser.name || demand.creatorId;
      demand.creatorEmail = creatorUser.email || undefined;
    }

    if (assigneeUser) {
      demand.assigneeName = assigneeUser.name || demand.assigneeId;
      demand.assigneeEmail = assigneeUser.email || undefined;
    }

    const [customerResult, projectResult, demandTypeResult] = await Promise.all([
      data.customer_id
        ? supabaseAdmin.from("customers").select("name").eq("id", data.customer_id).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
      data.project_id
        ? supabaseAdmin.from("projects").select("name").eq("id", data.project_id).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
      data.demand_type_id
        ? supabaseAdmin.from("demand_types").select("name").eq("id", data.demand_type_id).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
    ]);

    if (!customerResult.error && customerResult.data) {
      demand.customerName = (customerResult.data.name as string | null) || undefined;
    }
    if (!projectResult.error && projectResult.data) {
      demand.projectName = (projectResult.data.name as string | null) || undefined;
    }
    if (!demandTypeResult.error && demandTypeResult.data) {
      demand.demandTypeName = (demandTypeResult.data.name as string | null) || undefined;
    }

    return NextResponse.json({ demand });
  } catch (error: any) {
    console.error("[api/demands/:id] error", error);
    return NextResponse.json(
      {
        error: "failed to load demand",
        detail: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const activeError = ensureActiveUser(authResult.user);
    if (activeError) {
      return activeError;
    }

    const id = context.params.id;
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const body = await req.json();
    const title = (body.title as string | undefined)?.trim();
    const description = (body.description as string | undefined)?.trim();
    const priority = body.priority as string | undefined;
    const dueDate = (body.dueDate as string | undefined) || undefined;
    const customFields = (body.customFields as Record<string, any> | undefined) || undefined;
    const status = body.status as string | undefined;
    const assigneeEmail = (body.assigneeEmail as string | undefined)?.trim();
    const customerId = normalizeOptionalId(body.customerId);
    const projectId = normalizeOptionalId(body.projectId);
    const demandTypeId = normalizeOptionalId(body.demandTypeId);

    if (!title && !description && !priority && !dueDate && !customFields && !status && !assigneeEmail && customerId === undefined && projectId === undefined && demandTypeId === undefined) {
      return NextResponse.json(
        { error: "no fields to update" },
        { status: 400 }
      );
    }

    const { data: existing, error: loadError } = await supabaseAdmin
      .from("demands")
      .select(DEMAND_DETAIL_SELECT)
      .eq("fields->>code", id)
      .maybeSingle();

    if (loadError) {
      console.error("[api/demands/:id] load error", loadError);
      return NextResponse.json(
        { error: "failed to load demand", detail: loadError.message },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const { data: department, error: departmentError } = await supabaseAdmin
      .from("departments")
      .select("id, slug, config, status_config")
      .eq("id", existing.department_id)
      .maybeSingle();

    if (departmentError || !department) {
      console.error("[api/demands/:id] load department error", departmentError);
      return NextResponse.json(
        { error: "failed to load demand department", detail: departmentError?.message },
        { status: 500 }
      );
    }

    const fields = { ...(existing.fields || {}) } as any;
    const workflowRules = resolveDepartmentDemandRules(
      (department as any).config,
      (department as any).slug,
    );
    const statusGroups = buildDemandStatusGroups([department as { status_config?: unknown }]);
    const previousAssigneeId =
      typeof existing.assignee_id === "number" ? (existing.assignee_id as number) : null;
    let assignedWecomUserId = "";
    let assignedUserId: number | null = null;
    const canAssignDemand =
      authResult.user?.role === "admin" ||
      (authResult.user?.role === "manager" && authResult.user.departmentId === existing.department_id);

    if (description !== undefined) {
      fields.description = description;
    }
    if (dueDate !== undefined) {
      fields.dueDate = dueDate;
    }
    if (customFields) {
      Object.assign(fields, customFields);
    }

    const updates: any = { fields };
    const previousStatus = (existing.status as string) || "";


    if (title) {
      updates.title = title;
    }

    // 优先级更新到数据库字段
    if (priority) {
      updates.priority = priority;
    }

    if (customerId !== undefined) {
      updates.customer_id = customerId;
    }
    if (projectId !== undefined) {
      updates.project_id = projectId;
    }
    if (demandTypeId !== undefined) {
      if (demandTypeId) {
        const { data: demandType, error: demandTypeError } = await supabaseAdmin
          .from("demand_types")
          .select("id, department_id, field_template_id")
          .eq("id", demandTypeId)
          .maybeSingle();
        if (demandTypeError || !demandType || (demandType as any).department_id !== existing.department_id) {
          return NextResponse.json(
            { error: "invalid demand type", detail: demandTypeError?.message },
            { status: 400 },
          );
        }
        updates.demand_type_id = demandTypeId;
        updates.field_template_id = (demandType as any).field_template_id || existing.field_template_id || null;
      } else {
        updates.demand_type_id = null;
      }
    }

    // 状态更新到数据库字段（不再映射）
    if (status) {
      updates.status = status;
      Object.assign(updates, buildStatusTimestampUpdates(status, existing, statusGroups));
    }

    if (assigneeEmail) {
      if (!canAssignDemand) {
        return NextResponse.json(
          { error: "forbidden", detail: "only department managers or admins can assign demands" },
          { status: 403 }
        );
      }

      const { data: assigneeUser, error: assigneeError } = await supabaseAdmin
        .from("users")
        .select("id, email, name, department_id, wecom_user_id")
        .eq("email", assigneeEmail)
        .eq("department_id", existing.department_id)
        .maybeSingle();

      if (assigneeError || !assigneeUser) {
        console.error("[api/demands/:id] assign user error", assigneeError);
        return NextResponse.json(
          { error: "assignee user not found in this department", detail: assigneeError?.message },
          { status: 400 }
        );
      }

      updates.assignee_id = assigneeUser.id;
      if (!existing.assigned_at || previousAssigneeId !== (assigneeUser.id as number)) {
        updates.assigned_at = new Date().toISOString();
      }
      assignedUserId = assigneeUser.id as number;
      assignedWecomUserId = ((assigneeUser as any).wecom_user_id || "").toString().trim();
      fields.assigneeEmail = assigneeEmail;
      fields.assigneeCode = assigneeEmail.split("@")[0]?.toUpperCase();

      if (!status && existing.status === (workflowRules.unassignedStatus || "unassigned")) {
        updates.status = resolveAssignedStatusValue(
          workflowRules,
          (((department as any).status_config as any[]) || []),
        );
      }
    }

    const { data, error } = await supabaseAdmin
      .from("demands")
      .update(updates)
      .eq("id", existing.id)
      .select("*")
      .maybeSingle();

    if (error || !data) {
      console.error("[api/demands/:id] update error", error);
      return NextResponse.json(
        { error: "failed to update demand", detail: error?.message ?? "update failed" },
        { status: 500 }
      );
    }

    const demand = await enrichDemandUsers(mapRowToDemand(data), data);

    const nextStatus = ((data.status as string | null) || "").toString();

    if (
      assignedUserId &&
      assignedUserId !== previousAssigneeId &&
      assignedWecomUserId
    ) {
      const workflowConfigForMessage = await loadWorkflowConfigForDepartment(
        data.department_id as number | null | undefined,
      );
      const baseUrlEnv =
        process.env.APP_PUBLIC_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.VITE_PUBLIC_URL ||
        "";
      const baseUrl = baseUrlEnv.replace(/\/+$/, "");
      const link = baseUrl && demand.id ? `${baseUrl}/demands/${encodeURIComponent(demand.id)}` : "";
      const prefix = ((process.env.WECOM_MESSAGE_PREFIX as string | undefined) || "【需求系统】")
        .toString()
        .trim();
      const priorityLabel = resolvePriorityLabelForMessage(demand.priority as any, workflowConfigForMessage);
      const statusLabel = resolveStatusLabelForMessage(nextStatus || demand.status, workflowConfigForMessage);

      let content = `${prefix}你有一条新的需求被分配待处理：${demand.title}`;
      if (priorityLabel) {
        content += `\n优先级：${priorityLabel}`;
      }
      if (statusLabel) {
        content += `\n当前状态：${statusLabel}`;
      }
      if (link) {
        content += `\n查看详情：${link}`;
      }

      sendWecomAppTextMessage([assignedWecomUserId], content).catch((e) => {
        console.error("[api/demands/:id] send assignment wecom message error", e);
      });
    }

    if (nextStatus && nextStatus !== previousStatus) {
      import("../../../../lib/webhooks").then((mod) => {
        mod
          .enqueueAndDispatchWebhook("demand.status_changed", {
            demand,
            departmentId: data.department_id as number | undefined,
            fromStatus: previousStatus,
            toStatus: nextStatus,
          })
          .catch((e) => {
            console.error("[api/demands/:id] enqueue status_changed webhook error", e);
          });
      });

      const normalizedStatus = nextStatus.toLowerCase();
      const isTerminalStatus =
        statusGroups.completed.includes(normalizedStatus) ||
        normalizedStatus === "ignored";

      const creatorId =
        data.creator_id && typeof data.creator_id === "number"
          ? (data.creator_id as number)
          : null;

      if (isTerminalStatus && creatorId) {
        import("../../../../lib/wecomApp").then((mod) => {
          mod
            .loadWecomUserIdsForDemandParticipants(creatorId, null)
            .then((toUserIds) => {
              const uniqueIds = toUserIds.filter((v, idx, arr) => v && arr.indexOf(v) === idx);
              if (!uniqueIds.length) {
                return;
              }

              const baseUrlEnv =
                process.env.APP_PUBLIC_URL ||
                process.env.NEXT_PUBLIC_APP_URL ||
                process.env.VITE_PUBLIC_URL ||
                "";
              const baseUrl = baseUrlEnv.replace(/\/+$/, "");
              const link = baseUrl && demand.id ? `${baseUrl}/demands/${encodeURIComponent(demand.id)}` : "";

              const prefix = ((process.env.WECOM_MESSAGE_PREFIX as string | undefined) || "【需求系统】").toString().trim();

              let content = `${prefix}你提交的需求已处理完成：${demand.title}`;
              content += `\n最终状态：${nextStatus}`;
              if (link) {
                content += `\n查看详情：${link}`;
              }


              mod
                .sendWecomAppTextMessage(uniqueIds, content)
                .catch((e: any) => {
                  console.error("[api/demands/:id] send wecom app message error", e);
                });
            })
            .catch((e: any) => {
              console.error("[api/demands/:id] load wecom_user_id for creator error", e);
            });
        });
      }
    }


    return NextResponse.json({ demand });


  } catch (error: any) {
    console.error("[api/demands/:id] update error", error);
    return NextResponse.json(
      {
        error: "failed to update demand",
        detail: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const activeError = ensureActiveUser(authResult.user);
    if (activeError) {
      return activeError;
    }

    const id = context.params.id;
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { data: existing, error: loadError } = await supabaseAdmin
      .from("demands")
      .select("id, creator_id")
      .eq("fields->>code", id)
      .maybeSingle();

    if (loadError) {
      console.error("[api/demands/:id] load error", loadError);
      return NextResponse.json(
        { error: "failed to load demand", detail: loadError.message },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const currentUser = authResult.user!;
    const permissions = await loadEffectivePermissionsForUser(currentUser);
    const canDeleteByPermission = permissions.includes("demand.delete");
    const isCreator = typeof existing.creator_id === "number" && existing.creator_id === currentUser.id;

    if (!canDeleteByPermission && !isCreator) {
      return NextResponse.json(
        { error: "forbidden", detail: "只有需求创建人或具备删除权限的账号才能删除需求" },
        { status: 403 }
      );
    }

    const { error: delError } = await supabaseAdmin
      .from("demands")
      .delete()
      .eq("id", existing.id);

    if (delError) {
      console.error("[api/demands/:id] delete error", delError);
      return NextResponse.json(
        { error: "failed to delete demand", detail: delError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[api/demands/:id] delete error", error);
    return NextResponse.json(
      {
        error: "failed to delete demand",
        detail: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}
