import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../../lib/serverAuth";
import { ensureHasAnyPermission } from "../../../../../lib/serverPermissions";
import { writeAuditLog } from "../../../../../lib/audit";

export const runtime = "edge";

function mapDemandType(row: any) {
  return {
    id: row.id as number,
    departmentId: row.department_id as number,
    name: (row.name as string) || "",
    code: (row.code as string | null) || null,
    fieldTemplateId: (row.field_template_id as number | null) || null,
    description: (row.description as string | null) || null,
    isActive: row.is_active !== false,
    orderIndex: (row.order_index as number | null) || null,
  };
}

export async function GET(
  req: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) return authResult.errorResponse;
    const activeError = ensureActiveUser(authResult.user);
    if (activeError) return activeError;

    const departmentId = Number.parseInt(context.params.id, 10);
    if (Number.isNaN(departmentId) || departmentId <= 0) {
      return NextResponse.json({ error: "invalid department id" }, { status: 400 });
    }

    const url = new URL(req.url);
    const includeInactive =
      url.searchParams.get("includeInactive") === "1" ||
      url.searchParams.get("includeInactive") === "true";

    let query = supabaseAdmin
      .from("demand_types")
      .select("id, department_id, name, code, field_template_id, description, is_active, order_index")
      .eq("department_id", departmentId)
      .order("order_index", { ascending: true })
      .order("id", { ascending: true });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[api/departments/:id/demand-types] query error", error);
      return NextResponse.json({ error: "failed_to_load_demand_types", detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ items: (data || []).map(mapDemandType) });
  } catch (error: any) {
    console.error("[api/departments/:id/demand-types] unexpected error", error);
    return NextResponse.json({ error: "failed_to_load_demand_types", detail: error?.message ?? String(error) }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) return authResult.errorResponse;
    const departmentId = Number.parseInt(context.params.id, 10);
    if (Number.isNaN(departmentId) || departmentId <= 0) {
      return NextResponse.json({ error: "invalid department id" }, { status: 400 });
    }

    const permError = await ensureHasAnyPermission(authResult.user, [
      "settings.fields.manage",
      "department.fields_manage",
      "settings.departments.manage",
    ]);
    if (permError) return permError;

    const body = await req.json();
    const name = ((body.name as string | undefined) || "").trim();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("demand_types")
      .insert({
        department_id: departmentId,
        name,
        code: ((body.code as string | undefined) || "").trim() || null,
        field_template_id: typeof body.fieldTemplateId === "number" ? body.fieldTemplateId : null,
        description: ((body.description as string | undefined) || "").trim() || null,
        is_active: body.isActive === false ? false : true,
        order_index: typeof body.orderIndex === "number" ? body.orderIndex : null,
        updated_at: new Date().toISOString(),
      })
      .select("id, department_id, name, code, field_template_id, description, is_active, order_index")
      .maybeSingle();

    if (error || !data) {
      console.error("[api/departments/:id/demand-types] insert error", error);
      return NextResponse.json({ error: "failed_to_create_demand_type", detail: error?.message }, { status: 500 });
    }

    await writeAuditLog({
      userId: authResult.user?.id,
      entityType: "demand_type",
      entityId: data.id as number,
      action: "create",
      metadata: { departmentId, name },
    });

    return NextResponse.json({ demandType: mapDemandType(data) }, { status: 201 });
  } catch (error: any) {
    console.error("[api/departments/:id/demand-types] create unexpected error", error);
    return NextResponse.json({ error: "failed_to_create_demand_type", detail: error?.message ?? String(error) }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) return authResult.errorResponse;
    const departmentId = Number.parseInt(context.params.id, 10);
    if (Number.isNaN(departmentId) || departmentId <= 0) {
      return NextResponse.json({ error: "invalid department id" }, { status: 400 });
    }

    const permError = await ensureHasAnyPermission(authResult.user, [
      "settings.fields.manage",
      "department.fields_manage",
      "settings.departments.manage",
    ]);
    if (permError) return permError;

    const body = await req.json();
    const id = Number.parseInt(String(body.id || ""), 10);
    if (Number.isNaN(id) || id <= 0) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updates = {
      name: body.name === undefined ? undefined : ((body.name as string | undefined) || "").trim(),
      code: body.code === undefined ? undefined : ((body.code as string | undefined) || "").trim() || null,
      field_template_id: body.fieldTemplateId === undefined ? undefined : typeof body.fieldTemplateId === "number" ? body.fieldTemplateId : null,
      description: body.description === undefined ? undefined : ((body.description as string | undefined) || "").trim() || null,
      is_active: body.isActive === undefined ? undefined : body.isActive === false ? false : true,
      order_index: body.orderIndex === undefined ? undefined : typeof body.orderIndex === "number" ? body.orderIndex : null,
      updated_at: new Date().toISOString(),
    };
    Object.keys(updates).forEach((key) => {
      if ((updates as any)[key] === undefined || (updates as any)[key] === "") delete (updates as any)[key];
    });

    const { data, error } = await supabaseAdmin
      .from("demand_types")
      .update(updates)
      .eq("id", id)
      .eq("department_id", departmentId)
      .select("id, department_id, name, code, field_template_id, description, is_active, order_index")
      .maybeSingle();

    if (error || !data) {
      console.error("[api/departments/:id/demand-types] patch error", error);
      return NextResponse.json({ error: "failed_to_update_demand_type", detail: error?.message }, { status: 500 });
    }

    await writeAuditLog({
      userId: authResult.user?.id,
      entityType: "demand_type",
      entityId: id,
      action: "update",
      changedFields: updates,
    });

    return NextResponse.json({ demandType: mapDemandType(data) });
  } catch (error: any) {
    console.error("[api/departments/:id/demand-types] patch unexpected error", error);
    return NextResponse.json({ error: "failed_to_update_demand_type", detail: error?.message ?? String(error) }, { status: 500 });
  }
}
