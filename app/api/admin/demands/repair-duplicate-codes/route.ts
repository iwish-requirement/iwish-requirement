import { NextRequest, NextResponse } from "next/server";
import { writeAuditLog } from "../../../../../lib/audit";
import { isCopiedDemandTitle, makeDemandCode } from "../../../../../lib/demandCode";
import { ensureAdmin, getBusinessUserFromRequest } from "../../../../../lib/serverAuth";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const runtime = "edge";

type DemandCodeRow = {
  id: number;
  title: string | null;
  status: string | null;
  assignee_id: number | null;
  assigned_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  closed_at: string | null;
  delayed_at: string | null;
  fields: Record<string, unknown> | null;
};

function hasUnexpectedStateChange(before: DemandCodeRow, after: DemandCodeRow): boolean {
  return (
    before.status !== after.status ||
    before.assignee_id !== after.assignee_id ||
    before.assigned_at !== after.assigned_at ||
    before.started_at !== after.started_at ||
    before.finished_at !== after.finished_at ||
    before.closed_at !== after.closed_at ||
    before.delayed_at !== after.delayed_at
  );
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) return authResult.errorResponse;
    const adminError = ensureAdmin(authResult.user);
    if (adminError) return adminError;

    const rows: DemandCodeRow[] = [];
    const batchSize = 1000;
    for (let from = 0; ; from += batchSize) {
      const { data, error } = await supabaseAdmin
        .from("demands")
        .select("id, title, status, assignee_id, assigned_at, started_at, finished_at, closed_at, delayed_at, fields")
        .order("id", { ascending: true })
        .range(from, from + batchSize - 1);

      if (error) {
        return NextResponse.json(
          { error: "failed_to_load_demands", detail: error.message },
          { status: 500 },
        );
      }

      const batch = (data || []) as DemandCodeRow[];
      rows.push(...batch);
      if (batch.length < batchSize) break;
    }

    const rowsByCode = new Map<string, DemandCodeRow[]>();
    const existingCodes = new Set<string>();
    for (const row of rows) {
      const code = String(row.fields?.code || "").trim();
      if (!code) continue;
      existingCodes.add(code);
      const group = rowsByCode.get(code) || [];
      group.push(row);
      rowsByCode.set(code, group);
    }

    const repairs: { demandId: number; title: string | null; previousCode: string; code: string }[] = [];
    for (const [previousCode, group] of rowsByCode.entries()) {
      if (group.length < 2) continue;

      group.sort((left, right) => {
        const copiedDifference = Number(isCopiedDemandTitle(left.title)) - Number(isCopiedDemandTitle(right.title));
        return copiedDifference || left.id - right.id;
      });

      for (const row of group.slice(1)) {
        let code = makeDemandCode();
        while (existingCodes.has(code)) {
          code = makeDemandCode();
        }
        existingCodes.add(code);

        const fields = { ...(row.fields || {}), code };
        const { data: updatedRow, error: updateError } = await supabaseAdmin
          .from("demands")
          .update({ fields })
          .eq("id", row.id)
          .select("id, title, status, assignee_id, assigned_at, started_at, finished_at, closed_at, delayed_at, fields")
          .maybeSingle();

        if (updateError || !updatedRow) {
          return NextResponse.json(
            {
              error: "failed_to_repair_demand_code",
              detail: updateError?.message || "updated demand could not be verified",
              demandId: row.id,
            },
            { status: 500 },
          );
        }

        if (hasUnexpectedStateChange(row, updatedRow as DemandCodeRow)) {
          const { error: rollbackError } = await supabaseAdmin
            .from("demands")
            .update({
              fields: row.fields || {},
              status: row.status,
              assignee_id: row.assignee_id,
              assigned_at: row.assigned_at,
              started_at: row.started_at,
              finished_at: row.finished_at,
              closed_at: row.closed_at,
              delayed_at: row.delayed_at,
            })
            .eq("id", row.id);

          await writeAuditLog({
            userId: authResult.user?.id,
            entityType: "demand",
            entityId: row.id,
            action: "repair_duplicate_code_rejected",
            changedFields: {
              status: { before: row.status, after: updatedRow.status },
              assignee_id: { before: row.assignee_id, after: updatedRow.assignee_id },
              assigned_at: { before: row.assigned_at, after: updatedRow.assigned_at },
              started_at: { before: row.started_at, after: updatedRow.started_at },
              finished_at: { before: row.finished_at, after: updatedRow.finished_at },
              closed_at: { before: row.closed_at, after: updatedRow.closed_at },
              delayed_at: { before: row.delayed_at, after: updatedRow.delayed_at },
            },
            metadata: { previousCode, attemptedCode: code, rollbackError: rollbackError?.message || null },
          });

          return NextResponse.json(
            {
              error: "demand_state_changed_during_code_repair",
              detail: rollbackError
                ? `code repair was rejected and rollback failed: ${rollbackError.message}`
                : "code repair was rejected and rolled back because demand state changed",
              demandId: row.id,
            },
            { status: 500 },
          );
        }

        await writeAuditLog({
          userId: authResult.user?.id,
          entityType: "demand",
          entityId: row.id,
          action: "repair_duplicate_code",
          changedFields: { code: { before: previousCode, after: code } },
          metadata: { title: row.title },
        });

        repairs.push({ demandId: row.id, title: row.title, previousCode, code });
      }
    }

    return NextResponse.json({ repairedCount: repairs.length, repairs });
  } catch (error: any) {
    console.error("[api/admin/demands/repair-duplicate-codes] unexpected error", error);
    return NextResponse.json(
      { error: "failed_to_repair_duplicate_codes", detail: error?.message ?? String(error) },
      { status: 500 },
    );
  }
}
