import { NextRequest, NextResponse } from "next/server";
import { writeAuditLog } from "../../../../../lib/audit";
import { isCopiedDemandTitle, makeDemandCode } from "../../../../../lib/demandCode";
import { ensureAdmin, getBusinessUserFromRequest } from "../../../../../lib/serverAuth";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const runtime = "edge";

type DemandCodeRow = {
  id: number;
  title: string | null;
  fields: Record<string, unknown> | null;
};

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
        .select("id, title, fields")
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
        const { error: updateError } = await supabaseAdmin
          .from("demands")
          .update({ fields })
          .eq("id", row.id);

        if (updateError) {
          return NextResponse.json(
            {
              error: "failed_to_repair_demand_code",
              detail: updateError.message,
              demandId: row.id,
            },
            { status: 500 },
          );
        }

        repairs.push({ demandId: row.id, title: row.title, previousCode, code });
      }
    }

    if (repairs.length > 0) {
      await writeAuditLog({
        userId: authResult.user?.id,
        entityType: "demand",
        entityId: repairs[0].demandId,
        action: "repair_duplicate_codes",
        metadata: { repairedCount: repairs.length, demandIds: repairs.map((item) => item.demandId) },
      });
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
