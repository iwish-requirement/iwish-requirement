import { NextRequest, NextResponse } from "next/server";
import { applyDemandIdentifierFilter } from "../../../../../lib/demandIdentifier";
import { ensureActiveUser, getBusinessUserFromRequest } from "../../../../../lib/serverAuth";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const runtime = "edge";

type AuditChange = { before?: unknown; after?: unknown };

function readChangedFields(value: unknown): Record<string, AuditChange> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, AuditChange>;
}

function collectUserId(target: Set<number>, value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    target.add(value);
  }
}

export async function GET(req: NextRequest, context: { params: { id: string } }) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) return authResult.errorResponse;
    const activeError = ensureActiveUser(authResult.user);
    if (activeError) return activeError;

    const identifier = context.params.id;
    if (!identifier) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { data: demand, error: demandError } = await applyDemandIdentifierFilter(
      supabaseAdmin.from("demands").select("id"),
      identifier,
    ).maybeSingle();

    if (demandError) {
      return NextResponse.json(
        { error: "failed_to_load_demand", detail: demandError.message },
        { status: 500 },
      );
    }
    if (!demand) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const { data: rows, error: historyError } = await supabaseAdmin
      .from("audit_logs")
      .select("id, user_id, action, changed_fields, metadata, created_at")
      .eq("entity_type", "demand")
      .eq("entity_id", demand.id)
      .in("action", [
        "state_change",
        "repair_duplicate_code",
        "repair_duplicate_code_rejected",
      ])
      .order("created_at", { ascending: false })
      .limit(100);

    if (historyError) {
      return NextResponse.json(
        { error: "failed_to_load_demand_history", detail: historyError.message },
        { status: 500 },
      );
    }

    const userIds = new Set<number>();
    for (const row of rows || []) {
      collectUserId(userIds, row.user_id);
      const assigneeChange = readChangedFields(row.changed_fields).assignee_id;
      collectUserId(userIds, assigneeChange?.before);
      collectUserId(userIds, assigneeChange?.after);
    }

    const userNameById: Record<string, string> = {};
    if (userIds.size > 0) {
      const { data: users, error: usersError } = await supabaseAdmin
        .from("users")
        .select("id, name, email")
        .in("id", Array.from(userIds));
      if (usersError) {
        console.error("[api/demands/:id/history] load users error", usersError);
      } else {
        for (const user of users || []) {
          userNameById[String(user.id)] = user.name || user.email || `用户 ${user.id}`;
        }
      }
    }

    const history = (rows || []).map((row) => ({
      id: row.id,
      action: row.action,
      changedFields: readChangedFields(row.changed_fields),
      metadata: row.metadata,
      createdAt: row.created_at,
      actorName:
        (typeof row.user_id === "number" && userNameById[String(row.user_id)]) ||
        (row.user_id ? `用户 ${row.user_id}` : "系统"),
    }));

    return NextResponse.json({ history, userNameById });
  } catch (error: any) {
    console.error("[api/demands/:id/history] unexpected error", error);
    return NextResponse.json(
      { error: "failed_to_load_demand_history", detail: error?.message ?? String(error) },
      { status: 500 },
    );
  }
}
