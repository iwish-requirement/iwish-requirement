import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { DemandStatus, Priority, Demand } from "../../../../types";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../lib/serverAuth";

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
    creatorId,
    assigneeId,
    status: status as DemandStatus,
    priority,
    createdAt,
    dueDate,
    customFields: Object.keys(rest).length ? rest : undefined,
  };
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
      .select("*")
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

    if (!title && !description && !priority && !dueDate && !customFields && !status) {
      return NextResponse.json(
        { error: "no fields to update" },
        { status: 400 }
      );
    }

    const { data: existing, error: loadError } = await supabaseAdmin
      .from("demands")
      .select("*")
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

    const fields = { ...(existing.fields || {}) } as any;

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

    // 状态更新到数据库字段（不再映射）
    if (status) {
      updates.status = status;
    }

    // 如果状态更新为已完成且之前没有完成时间，则写入 finished_at，方便后续评分与统计
    if (status === "done" && !existing.finished_at) {
      updates.finished_at = new Date().toISOString();
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

    const demand = mapRowToDemand(data);

    if (status && status !== previousStatus) {
      import("../../../../lib/webhooks").then((mod) => {
        mod
          .enqueueAndDispatchWebhook("demand.status_changed", {
            demand,
            departmentId: data.department_id as number | undefined,
            fromStatus: previousStatus,
            toStatus: status,
          })
          .catch((e) => {
            console.error("[api/demands/:id] enqueue status_changed webhook error", e);
          });
      });

      const normalizedStatus = (status || "").toString().toLowerCase();
      const isTerminalStatus =
        normalizedStatus === "done" ||
        normalizedStatus === "closed" ||
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
              content += `\n最终状态：${status}`;
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
      .select("id")
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
