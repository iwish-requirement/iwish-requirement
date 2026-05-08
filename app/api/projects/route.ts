import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../lib/serverAuth";
import { ensureHasAnyPermission } from "../../../lib/serverPermissions";
import { writeAuditLog } from "../../../lib/audit";

export const runtime = "edge";

function mapProject(row: any) {
  return {
    id: row.id as number,
    customerId: row.customer_id as number,
    name: (row.name as string) || "",
    type: (row.type as string | null) || null,
    url: (row.url as string | null) || null,
    ownerUserId: (row.owner_user_id as number | null) || null,
    status: (row.status as string | null) || null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) return authResult.errorResponse;
    const activeError = ensureActiveUser(authResult.user);
    if (activeError) return activeError;

    const url = new URL(req.url);
    const customerId = Number.parseInt(url.searchParams.get("customerId") || "", 10);
    const q = (url.searchParams.get("q") || "").trim();

    let query = supabaseAdmin
      .from("projects")
      .select("id, customer_id, name, type, url, owner_user_id, status")
      .order("name", { ascending: true })
      .limit(100);

    if (!Number.isNaN(customerId) && customerId > 0) {
      query = query.eq("customer_id", customerId);
    }
    if (q) {
      query = query.ilike("name", `%${q}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[api/projects] query error", error);
      return NextResponse.json({ error: "failed_to_load_projects", detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ items: (data || []).map(mapProject) });
  } catch (error: any) {
    console.error("[api/projects] unexpected error", error);
    return NextResponse.json({ error: "failed_to_load_projects", detail: error?.message ?? String(error) }, { status: 500 });
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
    const customerId = Number.parseInt(String(body.customerId || ""), 10);
    if (!name || Number.isNaN(customerId) || customerId <= 0) {
      return NextResponse.json({ error: "name and customerId are required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("projects")
      .insert({
        customer_id: customerId,
        name,
        type: ((body.type as string | undefined) || "").trim() || null,
        url: ((body.url as string | undefined) || "").trim() || null,
        status: ((body.status as string | undefined) || "").trim() || "active",
        owner_user_id: typeof body.ownerUserId === "number" ? body.ownerUserId : authResult.user?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .select("id, customer_id, name, type, url, owner_user_id, status")
      .maybeSingle();

    if (error || !data) {
      console.error("[api/projects] insert error", error);
      return NextResponse.json({ error: "failed_to_create_project", detail: error?.message }, { status: 500 });
    }

    await writeAuditLog({
      userId: authResult.user?.id,
      entityType: "project",
      entityId: data.id as number,
      action: "create",
      metadata: { customerId, name },
    });

    return NextResponse.json({ project: mapProject(data) }, { status: 201 });
  } catch (error: any) {
    console.error("[api/projects] create unexpected error", error);
    return NextResponse.json({ error: "failed_to_create_project", detail: error?.message ?? String(error) }, { status: 500 });
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

    const customerId = body.customerId === undefined ? undefined : Number.parseInt(String(body.customerId || ""), 10);
    const updates = {
      customer_id: customerId === undefined ? undefined : Number.isNaN(customerId) || customerId <= 0 ? undefined : customerId,
      name: body.name === undefined ? undefined : ((body.name as string | undefined) || "").trim(),
      type: body.type === undefined ? undefined : ((body.type as string | undefined) || "").trim() || null,
      url: body.url === undefined ? undefined : ((body.url as string | undefined) || "").trim() || null,
      status: body.status === undefined ? undefined : ((body.status as string | undefined) || "").trim() || "active",
      owner_user_id: body.ownerUserId === undefined ? undefined : typeof body.ownerUserId === "number" ? body.ownerUserId : null,
      updated_at: new Date().toISOString(),
    };
    Object.keys(updates).forEach((key) => {
      if ((updates as any)[key] === undefined || (updates as any)[key] === "") delete (updates as any)[key];
    });

    const { data, error } = await supabaseAdmin
      .from("projects")
      .update(updates)
      .eq("id", id)
      .select("id, customer_id, name, type, url, owner_user_id, status")
      .maybeSingle();

    if (error || !data) {
      console.error("[api/projects] patch error", error);
      return NextResponse.json({ error: "failed_to_update_project", detail: error?.message }, { status: 500 });
    }

    await writeAuditLog({
      userId: authResult.user?.id,
      entityType: "project",
      entityId: id,
      action: "update",
      changedFields: updates,
    });

    return NextResponse.json({ project: mapProject(data) });
  } catch (error: any) {
    console.error("[api/projects] patch unexpected error", error);
    return NextResponse.json({ error: "failed_to_update_project", detail: error?.message ?? String(error) }, { status: 500 });
  }
}
