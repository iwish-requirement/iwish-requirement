import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../../lib/serverAuth";
import { ensureHasPermission } from "../../../../../lib/serverPermissions";
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

    const sourceCode = context.params.id;
    const body = await req.json().catch(() => ({}));
    const titleOverride = ((body.title as string | undefined) || "").trim();

    const { data: source, error: sourceError } = await supabaseAdmin
      .from("demands")
      .select("id, department_id, customer_id, project_id, demand_type_id, priority, title, fields, field_template_id")
      .eq("fields->>code", sourceCode)
      .maybeSingle();

    if (sourceError) {
      console.error("[api/demands/:id/copy] load source error", sourceError);
      return NextResponse.json({ error: "failed_to_load_source_demand", detail: sourceError.message }, { status: 500 });
    }
    if (!source) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const { data: department, error: deptError } = await supabaseAdmin
      .from("departments")
      .select("id, slug, config, status_config")
      .eq("id", source.department_id)
      .maybeSingle();

    if (deptError || !department) {
      return NextResponse.json({ error: "failed_to_load_department", detail: deptError?.message }, { status: 500 });
    }

    const rules = resolveDepartmentDemandRules((department as any).config, (department as any).slug);
    const fields = { ...((source.fields || {}) as Record<string, any>) };
    fields.code = makeDemandCode();
    fields.creatorCode = authResult.user!.email.split("@")[0]?.toUpperCase();
    delete fields.assigneeCode;
    delete fields.assigneeEmail;

    const initialStatus = rules.requireLeaderAssignment
      ? rules.unassignedStatus || "unassigned"
      : resolveAssignedStatusValue(rules, (((department as any).status_config as any[]) || []));

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("demands")
      .insert({
        department_id: source.department_id,
        creator_id: authResult.user!.id,
        assignee_id: null,
        customer_id: source.customer_id || null,
        project_id: source.project_id || null,
        demand_type_id: source.demand_type_id || null,
        title: titleOverride || `${source.title}（复制）`,
        status: initialStatus,
        priority: source.priority || null,
        field_template_id: source.field_template_id || null,
        fields,
      })
      .select("id, fields")
      .maybeSingle();

    if (insertError || !inserted) {
      console.error("[api/demands/:id/copy] insert error", insertError);
      return NextResponse.json({ error: "failed_to_copy_demand", detail: insertError?.message }, { status: 500 });
    }

    await writeAuditLog({
      userId: authResult.user?.id,
      entityType: "demand",
      entityId: inserted.id as number,
      action: "copy",
      metadata: { sourceDemandId: source.id, sourceCode },
    });

    return NextResponse.json({
      demand: {
        id: ((inserted.fields as any)?.code as string) || String(inserted.id),
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error("[api/demands/:id/copy] unexpected error", error);
    return NextResponse.json({ error: "failed_to_copy_demand", detail: error?.message ?? String(error) }, { status: 500 });
  }
}
