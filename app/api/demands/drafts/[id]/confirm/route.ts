import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../../../lib/serverAuth";
import { ensureHasPermission } from "../../../../../../lib/serverPermissions";
import { writeAuditLog } from "../../../../../../lib/audit";
import {
  resolveAssignedStatusValue,
  resolveDepartmentDemandRules,
} from "../../../../../../lib/departmentDemandRules";

export const runtime = "edge";

function makeDemandCode() {
  return `REQ-${new Date().getFullYear()}-${Math.floor(Date.now() % 100000)
    .toString()
    .padStart(5, "0")}`;
}

export async function POST(
  req: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) return authResult.errorResponse;
    const activeError = ensureActiveUser(authResult.user);
    if (activeError) return activeError;
    const permError = await ensureHasPermission(authResult.user, "demand.create");
    if (permError) return permError;

    const id = Number.parseInt(context.params.id, 10);
    if (Number.isNaN(id) || id <= 0) {
      return NextResponse.json({ error: "invalid draft id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { data: draft, error: draftError } = await supabaseAdmin
      .from("demand_drafts")
      .select("id, creator_id, department_id, demand_type_id, customer_id, project_id, title, payload, status, created_demand_id")
      .eq("id", id)
      .eq("creator_id", authResult.user!.id)
      .maybeSingle();

    if (draftError || !draft) {
      return NextResponse.json({ error: "draft not found", detail: draftError?.message }, { status: 404 });
    }
    if ((draft.status as string) === "created") {
      const createdDemandId = (draft as any).created_demand_id;
      return NextResponse.json({
        error: "draft already created",
        demand: createdDemandId ? { id: String(createdDemandId) } : null,
      }, { status: 409 });
    }

    const payload = {
      ...((draft.payload || {}) as Record<string, any>),
      ...((body.payload && typeof body.payload === "object" ? body.payload : {}) as Record<string, any>),
    };
    const departmentId = Number.parseInt(String(body.departmentId || draft.department_id || ""), 10);
    if (Number.isNaN(departmentId) || departmentId <= 0) {
      return NextResponse.json({ error: "department is required" }, { status: 400 });
    }
    const title = ((body.title as string | undefined) || (draft.title as string | null) || payload.title || "").trim();
    const description = ((body.description as string | undefined) || payload.description || payload.rawText || "").trim();
    if (!title || !description) {
      return NextResponse.json({ error: "title and description are required" }, { status: 400 });
    }

    const { data: department, error: deptError } = await supabaseAdmin
      .from("departments")
      .select("id, slug, config, status_config")
      .eq("id", departmentId)
      .maybeSingle();
    if (deptError || !department) {
      return NextResponse.json({ error: "department not found", detail: deptError?.message }, { status: 400 });
    }

    const rules = resolveDepartmentDemandRules((department as any).config, (department as any).slug);
    const initialStatus = rules.requireLeaderAssignment
      ? rules.unassignedStatus || "unassigned"
      : resolveAssignedStatusValue(rules, (((department as any).status_config as any[]) || []));
    const code = makeDemandCode();
    const mergedCustomFields = {
      ...((payload.customFields || {}) as Record<string, any>),
    };
    const customerName = ((payload.customerName as string | undefined) || "").trim();
    const projectName = ((payload.projectName as string | undefined) || "").trim();
    if (customerName) mergedCustomFields["客户"] = customerName;
    if (projectName) mergedCustomFields["项目"] = projectName;

    const fields = {
      code,
      description,
      dueDate: ((body.dueDate as string | undefined) || payload.dueDate || "").trim(),
      creatorCode: authResult.user!.email.split("@")[0]?.toUpperCase(),
      ...mergedCustomFields,
    };

    const demandTypeId = Number.parseInt(String(body.demandTypeId || draft.demand_type_id || ""), 10);
    if (Number.isNaN(demandTypeId) || demandTypeId <= 0) {
      return NextResponse.json({ error: "demand type is required" }, { status: 400 });
    }
    const customerId = Number.parseInt(String(body.customerId || draft.customer_id || ""), 10);
    const projectId = Number.parseInt(String(body.projectId || draft.project_id || ""), 10);

    const { data: demand, error: insertError } = await supabaseAdmin
      .from("demands")
      .insert({
        department_id: departmentId,
        creator_id: authResult.user!.id,
        customer_id: Number.isNaN(customerId) ? null : customerId,
        project_id: Number.isNaN(projectId) ? null : projectId,
        demand_type_id: Number.isNaN(demandTypeId) ? null : demandTypeId,
        title,
        status: initialStatus,
        priority: payload.priority || "中",
        fields,
      })
      .select("id, fields")
      .maybeSingle();

    if (insertError || !demand) {
      console.error("[api/demands/drafts/:id/confirm] insert demand error", insertError);
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
      userId: authResult.user?.id,
      entityType: "demand_draft",
      entityId: draft.id as number,
      action: "confirm",
      metadata: { demandId: demand.id },
    });

    return NextResponse.json({
      demand: { id: ((demand.fields as any)?.code as string) || String(demand.id) },
    }, { status: 201 });
  } catch (error: any) {
    console.error("[api/demands/drafts/:id/confirm] unexpected error", error);
    return NextResponse.json({ error: "failed_to_confirm_draft", detail: error?.message ?? String(error) }, { status: 500 });
  }
}
