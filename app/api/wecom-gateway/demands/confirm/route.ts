import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { loadEffectivePermissionsForUser } from "../../../../../lib/serverPermissions";
import { writeAuditLog } from "../../../../../lib/audit";
import {
  resolveAssignedStatusValue,
  resolveDepartmentDemandRules,
} from "../../../../../lib/departmentDemandRules";

export const runtime = "edge";

function makeDemandCode() {
  return `REQ-${new Date().getFullYear()}-${Math.floor(Date.now() % 100000)
    .toString()
    .padStart(5, "0")}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const draftId = Number.parseInt(String(body.draftId || ""), 10);
    const wecomUserId = ((body.wecomUserId as string | undefined) || "").trim();
    if (Number.isNaN(draftId) || draftId <= 0 || !wecomUserId) {
      return NextResponse.json({ error: "draftId and wecomUserId are required" }, { status: 400 });
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, email, name, role, department_id, status")
      .eq("wecom_user_id", wecomUserId)
      .maybeSingle();
    if (!user) {
      return NextResponse.json({ error: "wecom user is not bound" }, { status: 403 });
    }
    const permissions = await loadEffectivePermissionsForUser({
      id: user.id as number,
      email: user.email as string,
      name: (user as any).name || null,
      role: (user as any).role || "user",
      departmentId: (user as any).department_id || null,
      status: (user as any).status || "active",
    } as any);
    if (!permissions.includes("demand.create" as any)) {
      return NextResponse.json({ error: "forbidden", detail: "当前账号无权通过企微提交需求" }, { status: 403 });
    }

    const { data: draft, error: draftError } = await supabaseAdmin
      .from("demand_drafts")
      .select("id, creator_id, department_id, demand_type_id, customer_id, project_id, title, payload, status, created_demand_id")
      .eq("id", draftId)
      .eq("creator_id", user.id)
      .maybeSingle();

    if (draftError || !draft) {
      return NextResponse.json({ error: "draft not found", detail: draftError?.message }, { status: 404 });
    }
    if ((draft.status as string) === "created") {
      return NextResponse.json({
        error: "draft already created",
        demand: (draft as any).created_demand_id ? { id: String((draft as any).created_demand_id) } : null,
        message: "该草稿已创建过需求，请勿重复确认。",
      }, { status: 409 });
    }
    if (!draft.department_id) {
      return NextResponse.json({ error: "draft missing department" }, { status: 400 });
    }
    if (!draft.demand_type_id) {
      return NextResponse.json({ error: "draft missing demand type" }, { status: 400 });
    }

    const { data: department, error: deptError } = await supabaseAdmin
      .from("departments")
      .select("id, slug, config, status_config")
      .eq("id", draft.department_id)
      .maybeSingle();
    if (deptError || !department) {
      return NextResponse.json({ error: "department not found", detail: deptError?.message }, { status: 400 });
    }

    const rules = resolveDepartmentDemandRules((department as any).config, (department as any).slug);
    const initialStatus = rules.requireLeaderAssignment
      ? rules.unassignedStatus || "unassigned"
      : resolveAssignedStatusValue(rules, (((department as any).status_config as any[]) || []));
    const payload = (draft.payload || {}) as Record<string, any>;
    const code = makeDemandCode();
    const mergedCustomFields = {
      ...((payload.customFields || {}) as Record<string, any>),
    };
    if (payload.customerName) mergedCustomFields["客户"] = payload.customerName;
    if (payload.projectName) mergedCustomFields["项目"] = payload.projectName;
    const fields = {
      code,
      description: payload.description || payload.rawText || "",
      dueDate: payload.dueDate || "",
      creatorCode: ((user.email as string) || "").split("@")[0]?.toUpperCase(),
      ...mergedCustomFields,
    };

    const { data: demand, error: insertError } = await supabaseAdmin
      .from("demands")
      .insert({
        department_id: draft.department_id,
        creator_id: user.id,
        customer_id: draft.customer_id || null,
        project_id: draft.project_id || null,
        demand_type_id: draft.demand_type_id,
        title: draft.title || payload.title || "企业微信需求",
        status: initialStatus,
        priority: payload.priority || "中",
        fields,
      })
      .select("id, fields")
      .maybeSingle();

    if (insertError || !demand) {
      console.error("[api/wecom-gateway/demands/confirm] demand insert error", insertError);
      return NextResponse.json({ error: "failed_to_create_demand", detail: insertError?.message }, { status: 500 });
    }

    await supabaseAdmin
      .from("demand_drafts")
      .update({
        status: "created",
        created_demand_id: demand.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", draft.id);

    await writeAuditLog({
      userId: user.id as number,
      entityType: "demand_draft",
      entityId: draft.id as number,
      action: "wecom_confirm",
      metadata: { demandId: demand.id },
    });

    return NextResponse.json({
      demand: {
        id: ((demand.fields as any)?.code as string) || String(demand.id),
      },
      message: `需求已创建：${((demand.fields as any)?.code as string) || demand.id}`,
    }, { status: 201 });
  } catch (error: any) {
    console.error("[api/wecom-gateway/demands/confirm] unexpected error", error);
    return NextResponse.json({ error: "failed_to_confirm_wecom_demand", detail: error?.message ?? String(error) }, { status: 500 });
  }
}
