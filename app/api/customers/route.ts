import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../lib/serverAuth";
import { ensureHasAnyPermission } from "../../../lib/serverPermissions";
import { writeAuditLog } from "../../../lib/audit";

export const runtime = "edge";

function mapCustomer(row: any) {
  return {
    id: row.id as number,
    name: (row.name as string) || "",
    level: (row.level as string | null) || null,
    ownerUserId: (row.owner_user_id as number | null) || null,
    status: (row.status as string | null) || null,
    remark: (row.remark as string | null) || null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) return authResult.errorResponse;
    const activeError = ensureActiveUser(authResult.user);
    if (activeError) return activeError;

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();

    let query = supabaseAdmin
      .from("customers")
      .select("id, name, level, owner_user_id, status, remark")
      .order("name", { ascending: true })
      .limit(100);

    if (q) {
      query = query.ilike("name", `%${q}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[api/customers] query error", error);
      return NextResponse.json({ error: "failed_to_load_customers", detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ items: (data || []).map(mapCustomer) });
  } catch (error: any) {
    console.error("[api/customers] unexpected error", error);
    return NextResponse.json({ error: "failed_to_load_customers", detail: error?.message ?? String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) return authResult.errorResponse;
    const permError = await ensureHasAnyPermission(authResult.user, ["demand.create", "settings.departments.manage"]);
    if (permError) return permError;

    const body = await req.json();
    const name = ((body.name as string | undefined) || "").trim();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const payload = {
      name,
      level: ((body.level as string | undefined) || "").trim() || null,
      status: ((body.status as string | undefined) || "").trim() || "active",
      remark: ((body.remark as string | undefined) || "").trim() || null,
      owner_user_id: typeof body.ownerUserId === "number" ? body.ownerUserId : authResult.user?.id ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("customers")
      .insert(payload)
      .select("id, name, level, owner_user_id, status, remark")
      .maybeSingle();

    if (error || !data) {
      console.error("[api/customers] insert error", error);
      return NextResponse.json({ error: "failed_to_create_customer", detail: error?.message }, { status: 500 });
    }

    await writeAuditLog({
      userId: authResult.user?.id,
      entityType: "customer",
      entityId: data.id as number,
      action: "create",
      metadata: { name },
    });

    return NextResponse.json({ customer: mapCustomer(data) }, { status: 201 });
  } catch (error: any) {
    console.error("[api/customers] create unexpected error", error);
    return NextResponse.json({ error: "failed_to_create_customer", detail: error?.message ?? String(error) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) return authResult.errorResponse;
    const permError = await ensureHasAnyPermission(authResult.user, ["demand.create", "settings.departments.manage"]);
    if (permError) return permError;

    const body = await req.json();
    const id = Number.parseInt(String(body.id || ""), 10);
    if (Number.isNaN(id) || id <= 0) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updates = {
      name: ((body.name as string | undefined) || "").trim() || undefined,
      level: body.level === undefined ? undefined : ((body.level as string | undefined) || "").trim() || null,
      status: body.status === undefined ? undefined : ((body.status as string | undefined) || "").trim() || "active",
      remark: body.remark === undefined ? undefined : ((body.remark as string | undefined) || "").trim() || null,
      owner_user_id: body.ownerUserId === undefined ? undefined : typeof body.ownerUserId === "number" ? body.ownerUserId : null,
      updated_at: new Date().toISOString(),
    };
    Object.keys(updates).forEach((key) => {
      if ((updates as any)[key] === undefined) delete (updates as any)[key];
    });

    const { data, error } = await supabaseAdmin
      .from("customers")
      .update(updates)
      .eq("id", id)
      .select("id, name, level, owner_user_id, status, remark")
      .maybeSingle();

    if (error || !data) {
      console.error("[api/customers] patch error", error);
      return NextResponse.json({ error: "failed_to_update_customer", detail: error?.message }, { status: 500 });
    }

    await writeAuditLog({
      userId: authResult.user?.id,
      entityType: "customer",
      entityId: id,
      action: "update",
      changedFields: updates,
    });

    return NextResponse.json({ customer: mapCustomer(data) });
  } catch (error: any) {
    console.error("[api/customers] patch unexpected error", error);
    return NextResponse.json({ error: "failed_to_update_customer", detail: error?.message ?? String(error) }, { status: 500 });
  }
}
