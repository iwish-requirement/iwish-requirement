import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../lib/serverAuth";
import { ensureHasPermission } from "../../../lib/serverPermissions";
import { writeAuditLog } from "../../../lib/audit";

export const runtime = "edge";

function mapTemplate(row: any) {
  return {
    id: row.id as number,
    ownerUserId: (row.owner_user_id as number | null) || null,
    departmentId: row.department_id as number,
    demandTypeId: (row.demand_type_id as number | null) || null,
    name: (row.name as string) || "",
    scope: (row.scope as string) || "personal",
    payload: (row.payload || {}) as Record<string, any>,
  };
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) return authResult.errorResponse;
    const activeError = ensureActiveUser(authResult.user);
    if (activeError) return activeError;

    const url = new URL(req.url);
    const departmentId = Number.parseInt(url.searchParams.get("departmentId") || "", 10);
    let query = supabaseAdmin
      .from("demand_quick_templates")
      .select("id, owner_user_id, department_id, demand_type_id, name, scope, payload")
      .or(`scope.eq.public,owner_user_id.eq.${authResult.user!.id}`)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!Number.isNaN(departmentId) && departmentId > 0) {
      query = query.eq("department_id", departmentId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[api/demand-quick-templates] query error", error);
      return NextResponse.json({ error: "failed_to_load_templates", detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ items: (data || []).map(mapTemplate) });
  } catch (error: any) {
    console.error("[api/demand-quick-templates] unexpected error", error);
    return NextResponse.json({ error: "failed_to_load_templates", detail: error?.message ?? String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) return authResult.errorResponse;
    const activeError = ensureActiveUser(authResult.user);
    if (activeError) return activeError;
    const permError = await ensureHasPermission(authResult.user, "demand.create");
    if (permError) return permError;

    const body = await req.json();
    const name = ((body.name as string | undefined) || "").trim();
    const departmentId = Number.parseInt(String(body.departmentId || ""), 10);
    if (!name || Number.isNaN(departmentId) || departmentId <= 0) {
      return NextResponse.json({ error: "name and departmentId are required" }, { status: 400 });
    }

    const demandTypeId = Number.parseInt(String(body.demandTypeId || ""), 10);
    const scope = body.scope === "public" && authResult.user?.role === "admin" ? "public" : "personal";
    const payload = body.payload && typeof body.payload === "object" ? body.payload : {};

    const { data, error } = await supabaseAdmin
      .from("demand_quick_templates")
      .insert({
        owner_user_id: scope === "personal" ? authResult.user!.id : null,
        department_id: departmentId,
        demand_type_id: Number.isNaN(demandTypeId) ? null : demandTypeId,
        name,
        scope,
        payload,
        updated_at: new Date().toISOString(),
      })
      .select("id, owner_user_id, department_id, demand_type_id, name, scope, payload")
      .maybeSingle();

    if (error || !data) {
      console.error("[api/demand-quick-templates] insert error", error);
      return NextResponse.json({ error: "failed_to_create_template", detail: error?.message }, { status: 500 });
    }

    await writeAuditLog({
      userId: authResult.user?.id,
      entityType: "demand_quick_template",
      entityId: data.id as number,
      action: "create",
      metadata: { name, scope },
    });

    return NextResponse.json({ template: mapTemplate(data) }, { status: 201 });
  } catch (error: any) {
    console.error("[api/demand-quick-templates] create unexpected error", error);
    return NextResponse.json({ error: "failed_to_create_template", detail: error?.message ?? String(error) }, { status: 500 });
  }
}
