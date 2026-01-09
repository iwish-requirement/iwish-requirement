import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { ensureScoreTasksForUserPeriod } from "../../../../../lib/scoreTasksUtils";

export const runtime = "edge";

function getDefaultPeriodFromDate(now: Date): string {
  const year = now.getFullYear();
  const monthIndex = now.getMonth();
  const month = `${monthIndex + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

export async function GET(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SCORE_TASKS_SECRET;
    if (cronSecret) {
      const header = req.headers.get("x-cron-secret");
      if (!header || header !== cronSecret) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
    }

    const url = new URL(req.url);
    const periodParam = url.searchParams.get("period");

    const now = new Date();
    const period = periodParam && /^\d{4}-\d{2}$/.test(periodParam.trim())
      ? periodParam.trim()
      : getDefaultPeriodFromDate(now);

    const { data: users, error } = await supabaseAdmin
      .from("users")
      .select("id, email, wecom_user_id")
      .not("wecom_user_id", "is", null);

    if (error) {
      console.error("[api/scores/cron/ensure-tasks] load users error", error);
      return NextResponse.json({ error: "failed_to_load_users" }, { status: 500 });
    }

    let processedUsers = 0;

    for (const row of users || []) {
      const id = row.id as number | undefined;
      if (!id || !Number.isFinite(id)) {
        continue;
      }
      const email = (row.email || "").toString();
      const creatorCode = email ? email.split("@")[0]?.toUpperCase() || null : null;
      await ensureScoreTasksForUserPeriod(id, creatorCode, period);
      processedUsers += 1;
    }

    return NextResponse.json({ ok: true, period, processedUsers });
  } catch (error: any) {
    console.error("[api/scores/cron/ensure-tasks] unexpected error", error);
    return NextResponse.json({ error: "internal_error", detail: error?.message ?? String(error) }, { status: 500 });
  }
}
