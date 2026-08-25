import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../../lib/serverAuth";
import { ensureHasPermission } from "../../../../../lib/serverPermissions";
import { writeAuditLog } from "../../../../../lib/audit";
import {
  resolveAssignedStatusValue,
  resolveDepartmentDemandRules,
} from "../../../../../lib/departmentDemandRules";
import { sanitizeRequesterCustomFields } from "../../../../../lib/internalDemandFields";
import { makeDemandCode } from "../../../../../lib/demandCode";
import { applyDemandIdentifierFilter } from "../../../../../lib/demandIdentifier";
import { isDepartmentDemandTypeRequired } from "../../../../../lib/demandTypeRules";

export const runtime = "edge";

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

    const sourceIdentifier = context.params.id;
    const body = await req.json().catch(() => ({}));
    const titleOverride = ((body.title as string | undefined) || "").trim();
    const demandTypeOverride = Number.parseInt(String(body.demandTypeId || ""), 10);

    const { data: source, error: sourceError } = await applyDemandIdentifierFilter(
      supabaseAdmin
        .from("demands")
        .select("id, department_id, customer_id, project_id, demand_type_id, priority, title, fields, field_template_id"),
      sourceIdentifier,
    ).maybeSingle();

    if (sourceError) {
      console.error("[api/demands/:id/copy] load source error", sourceError);
      return NextResponse.json({ error: "failed_to_load_source_demand", detail: sourceError.message }, { status: 500 });
    }
    if (!source) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const { data: department, error: deptError } = await supabaseAdmin
      .from("departments")
      .select("id, name, slug, config, status_config")
      .eq("id", source.department_id)
      .maybeSingle();

    if (deptError || !department) {
      return NextResponse.json({ error: "failed_to_load_department", detail: deptError?.message }, { status: 500 });
    }

    const demandTypeId = Number.isFinite(demandTypeOverride) && demandTypeOverride > 0
      ? demandTypeOverride
      : (source.demand_type_id as number | null) ?? null;

    if (
      isDepartmentDemandTypeRequired(
        (department as any).config,
        (department as any).slug,
        (department as any).name,
      ) &&
      !demandTypeId
    ) {
      return NextResponse.json(
        {
          error: "demand_type_required",
          detail: "该创意需求缺少类型，复制前必须选择有效的需求类型。",
        },
        { status: 400 },
      );
    }

    const { data: demandType, error: demandTypeError } = demandTypeId
      ? await supabaseAdmin
          .from("demand_types")
          .select("id, department_id, field_template_id, is_active")
          .eq("id", demandTypeId)
          .maybeSingle()
      : { data: null, error: null };

    if (
      demandTypeId &&
      (demandTypeError ||
        !demandType ||
        demandType.department_id !== source.department_id ||
        demandType.is_active === false)
    ) {
      return NextResponse.json(
        {
          error: "invalid_demand_type",
          detail: demandTypeError?.message || "需求类型不存在、已停用或不属于当前部门。",
        },
        { status: 400 },
      );
    }

    const rules = resolveDepartmentDemandRules((department as any).config, (department as any).slug);
    const fields = sanitizeRequesterCustomFields(
      { ...((source.fields || {}) as Record<string, any>) },
      department as any,
    );
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
        demand_type_id: demandTypeId,
        title: titleOverride || `${source.title}（复制）`,
        status: initialStatus,
        priority: source.priority || null,
        field_template_id: demandType?.field_template_id || source.field_template_id || null,
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
      metadata: { sourceDemandId: source.id, sourceIdentifier, demandTypeId },
    });

    return NextResponse.json({
      demand: {
        databaseId: inserted.id as number,
        id: ((inserted.fields as any)?.code as string) || String(inserted.id),
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error("[api/demands/:id/copy] unexpected error", error);
    return NextResponse.json({ error: "failed_to_copy_demand", detail: error?.message ?? String(error) }, { status: 500 });
  }
}
