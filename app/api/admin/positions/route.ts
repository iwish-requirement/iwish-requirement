import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest } from "../../../../lib/serverAuth";
import { ensureHasAnyPermission } from "../../../../lib/serverPermissions";
import { writeAuditLog } from "../../../../lib/audit";

export const runtime = "edge";

function normalizePositionCode(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

function normalizeDemandTypeCodes(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => (item || "").toString().trim())
      .filter((item) => item.length > 0);
  }

  if (typeof raw === "string") {
    return raw
      .split(/[\n,，\s]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [];
}

function mapPosition(row: any) {
  return {
    id: Number(row.id),
    departmentId: row.department_id == null ? null : Number(row.department_id),
    code: (row.code || "").toString(),
    name: (row.name || "").toString(),
    description: row.description == null ? null : String(row.description),
    demandTypeCodes: Array.isArray(row.demand_type_codes) ? row.demand_type_codes : [],
    accessScope: row.access_scope === "all" ? "all" : "demand_types",
    isActive: row.is_active !== false,
    orderIndex: row.order_index == null ? null : Number(row.order_index),
  };
}

async function ensureCanManagePositions(user: any) {
  return ensureHasAnyPermission(user, [
    "admin.user_manage",
    "settings.roles.manage",
    "settings.departments.manage",
  ]);
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) return authResult.errorResponse;

    const permError = await ensureHasAnyPermission(authResult.user, [
      "admin.user_manage",
      "settings.roles.view",
      "settings.roles.manage",
      "settings.departments.view",
      "settings.departments.manage",
    ]);
    if (permError) return permError;

    const url = new URL(req.url);
    const departmentIdRaw = url.searchParams.get("departmentId");
    const includeInactive =
      url.searchParams.get("includeInactive") === "1" ||
      url.searchParams.get("includeInactive") === "true";

    let query = supabaseAdmin
      .from("user_positions")
      .select("id, department_id, code, name, description, demand_type_codes, access_scope, is_active, order_index")
      .order("department_id", { ascending: true })
      .order("order_index", { ascending: true })
      .order("id", { ascending: true });

    if (departmentIdRaw && departmentIdRaw !== "all") {
      const departmentId = Number.parseInt(departmentIdRaw, 10);
      if (!Number.isNaN(departmentId) && departmentId > 0) {
        query = query.eq("department_id", departmentId);
      }
    }

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[api/admin/positions] list error", error);
      return NextResponse.json(
        { error: "failed_to_load_positions", detail: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ items: (data || []).map(mapPosition) });
  } catch (error: any) {
    console.error("[api/admin/positions] GET error", error);
    return NextResponse.json(
      { error: "failed_to_load_positions", detail: error?.message ?? String(error) },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) return authResult.errorResponse;
    const permError = await ensureCanManagePositions(authResult.user);
    if (permError) return permError;

    const body = await req.json();
    const departmentId = Number.parseInt(String(body.departmentId || ""), 10);
    const name = ((body.name as string | undefined) || "").trim();
    const code = normalizePositionCode(((body.code as string | undefined) || name).trim());
    const accessScope = body.accessScope === "all" ? "all" : "demand_types";
    const demandTypeCodes = accessScope === "all" ? [] : normalizeDemandTypeCodes(body.demandTypeCodes);

    if (Number.isNaN(departmentId) || departmentId <= 0) {
      return NextResponse.json({ error: "departmentId is required" }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!code) {
      return NextResponse.json({ error: "code is required" }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("user_positions")
      .insert({
        department_id: departmentId,
        code,
        name,
        description: ((body.description as string | undefined) || "").trim() || null,
        demand_type_codes: demandTypeCodes,
        access_scope: accessScope,
        is_active: body.isActive === false ? false : true,
        order_index: typeof body.orderIndex === "number" ? body.orderIndex : null,
        updated_at: nowIso,
      })
      .select("id, department_id, code, name, description, demand_type_codes, access_scope, is_active, order_index")
      .maybeSingle();

    if (error || !data) {
      console.error("[api/admin/positions] create error", error);
      return NextResponse.json(
        { error: "failed_to_create_position", detail: error?.message ?? "insert failed" },
        { status: 500 },
      );
    }

    await writeAuditLog({
      userId: authResult.user?.id,
      entityType: "user_position",
      entityId: Number(data.id),
      action: "create",
      metadata: { departmentId, code, name },
    });

    return NextResponse.json({ position: mapPosition(data) }, { status: 201 });
  } catch (error: any) {
    console.error("[api/admin/positions] POST error", error);
    return NextResponse.json(
      { error: "failed_to_create_position", detail: error?.message ?? String(error) },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) return authResult.errorResponse;
    const permError = await ensureCanManagePositions(authResult.user);
    if (permError) return permError;

    const body = await req.json();
    const id = Number.parseInt(String(body.id || ""), 10);
    if (Number.isNaN(id) || id <= 0) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (body.departmentId !== undefined) {
      const departmentId = Number.parseInt(String(body.departmentId || ""), 10);
      updates.department_id = Number.isNaN(departmentId) || departmentId <= 0 ? null : departmentId;
    }
    if (body.name !== undefined) {
      const name = ((body.name as string | undefined) || "").trim();
      if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
      updates.name = name;
    }
    if (body.code !== undefined) {
      const code = normalizePositionCode((body.code as string | undefined) || "");
      if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });
      updates.code = code;
    }
    if (body.description !== undefined) {
      updates.description = ((body.description as string | undefined) || "").trim() || null;
    }
    if (body.accessScope !== undefined) {
      updates.access_scope = body.accessScope === "all" ? "all" : "demand_types";
    }
    if (body.demandTypeCodes !== undefined) {
      updates.demand_type_codes = normalizeDemandTypeCodes(body.demandTypeCodes);
    }
    if (body.isActive !== undefined) {
      updates.is_active = body.isActive === false ? false : true;
    }
    if (body.orderIndex !== undefined) {
      updates.order_index = typeof body.orderIndex === "number" ? body.orderIndex : null;
    }
    if (updates.access_scope === "all") {
      updates.demand_type_codes = [];
    }

    const { data, error } = await supabaseAdmin
      .from("user_positions")
      .update(updates)
      .eq("id", id)
      .select("id, department_id, code, name, description, demand_type_codes, access_scope, is_active, order_index")
      .maybeSingle();

    if (error || !data) {
      console.error("[api/admin/positions] update error", error);
      return NextResponse.json(
        { error: "failed_to_update_position", detail: error?.message ?? "update failed" },
        { status: 500 },
      );
    }

    await writeAuditLog({
      userId: authResult.user?.id,
      entityType: "user_position",
      entityId: id,
      action: "update",
      changedFields: updates,
    });

    return NextResponse.json({ position: mapPosition(data) });
  } catch (error: any) {
    console.error("[api/admin/positions] PATCH error", error);
    return NextResponse.json(
      { error: "failed_to_update_position", detail: error?.message ?? String(error) },
      { status: 500 },
    );
  }
}
