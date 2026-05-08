import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../../lib/serverAuth";
import { ensureHasPermission } from "../../../../../lib/serverPermissions";
import { writeAuditLog } from "../../../../../lib/audit";

export const runtime = "edge";

export async function DELETE(
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

    const { error } = await supabaseAdmin
      .from("demand_drafts")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("creator_id", authResult.user!.id);

    if (error) {
      console.error("[api/demands/drafts/:id] delete error", error);
      return NextResponse.json({ error: "failed_to_delete_draft", detail: error.message }, { status: 500 });
    }

    await writeAuditLog({
      userId: authResult.user?.id,
      entityType: "demand_draft",
      entityId: id,
      action: "cancel",
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[api/demands/drafts/:id] delete unexpected error", error);
    return NextResponse.json({ error: "failed_to_delete_draft", detail: error?.message ?? String(error) }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) return authResult.errorResponse;
    const activeError = ensureActiveUser(authResult.user);
    if (activeError) return activeError;

    const id = Number.parseInt(context.params.id, 10);
    if (Number.isNaN(id) || id <= 0) {
      return NextResponse.json({ error: "invalid draft id" }, { status: 400 });
    }

    const body = await req.json();
    const payload = (body.payload && typeof body.payload === "object" ? body.payload : null) as Record<string, any> | null;
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (payload) updates.payload = payload;
    if (body.title !== undefined) updates.title = ((body.title as string | undefined) || "").trim() || null;
    if (body.departmentId !== undefined) updates.department_id = Number.parseInt(String(body.departmentId || ""), 10) || null;
    if (body.demandTypeId !== undefined) updates.demand_type_id = Number.parseInt(String(body.demandTypeId || ""), 10) || null;
    if (body.customerId !== undefined) updates.customer_id = Number.parseInt(String(body.customerId || ""), 10) || null;
    if (body.projectId !== undefined) updates.project_id = Number.parseInt(String(body.projectId || ""), 10) || null;

    const { data, error } = await supabaseAdmin
      .from("demand_drafts")
      .update(updates)
      .eq("id", id)
      .eq("creator_id", authResult.user!.id)
      .select("id, source, department_id, demand_type_id, customer_id, project_id, title, payload, status")
      .maybeSingle();

    if (error || !data) {
      console.error("[api/demands/drafts/:id] patch error", error);
      return NextResponse.json({ error: "failed_to_update_draft", detail: error?.message }, { status: 500 });
    }

    await writeAuditLog({
      userId: authResult.user?.id,
      entityType: "demand_draft",
      entityId: id,
      action: "update",
      changedFields: updates,
    });

    return NextResponse.json({ draft: data });
  } catch (error: any) {
    console.error("[api/demands/drafts/:id] patch unexpected error", error);
    return NextResponse.json({ error: "failed_to_update_draft", detail: error?.message ?? String(error) }, { status: 500 });
  }
}
