import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../lib/serverAuth";
import { ensureHasPermission } from "../../../../lib/serverPermissions";

export const runtime = "edge";

function normalizeId(value: unknown): number | null {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
}

function mapDraft(row: any) {
  return {
    id: row.id as number,
    source: (row.source as string) || "manual",
    departmentId: (row.department_id as number | null) || null,
    demandTypeId: (row.demand_type_id as number | null) || null,
    customerId: (row.customer_id as number | null) || null,
    projectId: (row.project_id as number | null) || null,
    title: (row.title as string | null) || null,
    payload: (row.payload || {}) as Record<string, any>,
    status: (row.status as string) || "draft",
  };
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) return authResult.errorResponse;
    const activeError = ensureActiveUser(authResult.user);
    if (activeError) return activeError;

    const { data, error } = await supabaseAdmin
      .from("demand_drafts")
      .select("id, source, department_id, demand_type_id, customer_id, project_id, title, payload, status")
      .eq("creator_id", authResult.user!.id)
      .in("status", ["draft", "parsed"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[api/demands/drafts] query error", error);
      return NextResponse.json({ error: "failed_to_load_drafts", detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ items: (data || []).map(mapDraft) });
  } catch (error: any) {
    console.error("[api/demands/drafts] unexpected error", error);
    return NextResponse.json({ error: "failed_to_load_drafts", detail: error?.message ?? String(error) }, { status: 500 });
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
    const payload = (body.payload && typeof body.payload === "object" ? body.payload : body) as Record<string, any>;
    const title = ((payload.title as string | undefined) || (body.title as string | undefined) || "").trim() || null;

    const { data, error } = await supabaseAdmin
      .from("demand_drafts")
      .insert({
        creator_id: authResult.user!.id,
        source: ((body.source as string | undefined) || "manual").trim() || "manual",
        department_id: normalizeId(body.departmentId ?? payload.departmentId),
        demand_type_id: normalizeId(body.demandTypeId ?? payload.demandTypeId),
        customer_id: normalizeId(body.customerId ?? payload.customerId),
        project_id: normalizeId(body.projectId ?? payload.projectId),
        title,
        payload,
        status: "draft",
        updated_at: new Date().toISOString(),
      })
      .select("id, source, department_id, demand_type_id, customer_id, project_id, title, payload, status")
      .maybeSingle();

    if (error || !data) {
      console.error("[api/demands/drafts] insert error", error);
      return NextResponse.json({ error: "failed_to_create_draft", detail: error?.message }, { status: 500 });
    }

    return NextResponse.json({ draft: mapDraft(data) }, { status: 201 });
  } catch (error: any) {
    console.error("[api/demands/drafts] create unexpected error", error);
    return NextResponse.json({ error: "failed_to_create_draft", detail: error?.message ?? String(error) }, { status: 500 });
  }
}
