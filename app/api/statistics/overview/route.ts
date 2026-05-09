import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest } from "../../../../lib/serverAuth";
import { ensureHasPermission } from "../../../../lib/serverPermissions";
import { buildDemandStatusGroups } from "../../../../lib/demandStatusGroups";


export const runtime = "edge";

type OverviewScope = "company" | "department";

interface DateRange {
  from: string;
  to: string;
}

function parsePeriodToRange(period: string | null): DateRange {
  if (!period || !/^\d{4}-\d{2}$/.test(period.trim())) {
    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = now.getMonth();
    const fromDate = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
    const toDate = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0));
    return { from: fromDate.toISOString(), to: toDate.toISOString() };
  }

  const trimmed = period.trim();
  const [yearStr, monthStr] = trimmed.split("-");
  const year = Number.parseInt(yearStr, 10);
  const monthIndex = Number.parseInt(monthStr, 10) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    const now = new Date();
    const fallbackYear = now.getFullYear();
    const fallbackMonthIndex = now.getMonth();
    const fromDate = new Date(Date.UTC(fallbackYear, fallbackMonthIndex, 1, 0, 0, 0, 0));
    const toDate = new Date(Date.UTC(fallbackYear, fallbackMonthIndex + 1, 1, 0, 0, 0, 0));
    return { from: fromDate.toISOString(), to: toDate.toISOString() };
  }

  const fromDate = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const toDate = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0));
  return { from: fromDate.toISOString(), to: toDate.toISOString() };
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const permError = await ensureHasPermission(authResult.user, "stats.overview");
    if (permError) {
      return permError;
    }


    const url = new URL(req.url);
    const periodParam = url.searchParams.get("period");
    const departmentIdParam = url.searchParams.get("departmentId");

    const normalizedPeriod = periodParam && /^\d{4}-\d{2}$/.test(periodParam.trim())
      ? periodParam.trim()
      : null;

    const { from, to } = parsePeriodToRange(normalizedPeriod);

    let scope: OverviewScope = "company";
    let departmentId: number | null = null;

    if (departmentIdParam && departmentIdParam.trim() && departmentIdParam.trim() !== "all") {
      const parsed = Number.parseInt(departmentIdParam.trim(), 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        scope = "department";
        departmentId = parsed;
      }
    }

    const { data: departmentRows, error: departmentError } = await supabaseAdmin
      .from("departments")
      .select("status_config");
    if (departmentError) {
      console.error("[api/statistics/overview] department status config error", departmentError);
      return NextResponse.json(
        { error: "failed_to_load_demands_stats" },
        { status: 500 },
      );
    }
    const statusGroups = buildDemandStatusGroups((departmentRows || []) as { status_config?: unknown }[]);

    const demandsCreatedQuery = supabaseAdmin
      .from("demands")
      .select("id", { count: "exact", head: true })
      .gte("created_at", from)
      .lt("created_at", to);

    const demandsCompletedQuery = supabaseAdmin
      .from("demands")
      .select("id, created_at, finished_at", { count: "exact" })
      .in("status", statusGroups.completed)
      .gte("created_at", from)
      .lt("created_at", to);

    const demandsStatusQuery = supabaseAdmin
      .from("demands")
      .select("id, status", { count: "exact" })
      .gte("created_at", from)
      .lt("created_at", to);

    if (departmentId !== null) {
      demandsCreatedQuery.eq("department_id", departmentId);
      demandsCompletedQuery.eq("department_id", departmentId);
      demandsStatusQuery.eq("department_id", departmentId);
    }

    const [createdResult, completedResult, statusResult] = await Promise.all([
      demandsCreatedQuery,
      demandsCompletedQuery,
      demandsStatusQuery,
    ]);

    if (createdResult.error || completedResult.error || statusResult.error) {
      console.error("[api/statistics/overview] demands error", {
        createdError: createdResult.error,
        completedError: completedResult.error,
        statusError: statusResult.error,
      });
      return NextResponse.json(
        { error: "failed_to_load_demands_stats" },
        { status: 500 },
      );
    }

    const demandsCreated = createdResult.count ?? 0;
    const demandsCompleted = completedResult.count ?? 0;

    const statusRows = (statusResult.data ?? []) as { id: number; status: string | null }[];
    let demandsInProgress = 0;
    let demandsDelayed = 0;

    for (const row of statusRows) {
      const value = (row.status ?? "").toString().toLowerCase();
      if (statusGroups.active.includes(value) && !statusGroups.pending.includes(value)) {
        demandsInProgress += 1;
      } else if (statusGroups.delayed.includes(value)) {
        demandsDelayed += 1;
      }
    }

    let avgCycleDays = 0;

    if (completedResult.data && completedResult.data.length > 0) {
      let totalDays = 0;
      let validCount = 0;

      for (const row of completedResult.data as { created_at: string | null; finished_at: string | null }[]) {
        if (!row.created_at || !row.finished_at) {
          continue;
        }
        const createdAt = new Date(row.created_at);
        const finishedAt = new Date(row.finished_at);
        if (Number.isNaN(createdAt.getTime()) || Number.isNaN(finishedAt.getTime())) {
          continue;
        }
        const diffMs = finishedAt.getTime() - createdAt.getTime();
        if (!Number.isFinite(diffMs) || diffMs <= 0) {
          continue;
        }
        const days = diffMs / (1000 * 60 * 60 * 24);
        totalDays += days;
        validCount += 1;
      }

      if (validCount > 0) {
        avgCycleDays = totalDays / validCount;
      }
    }

    const scoresQuery = supabaseAdmin
      .from("score_records")
      .select("target_user_id, department_id, period, scores");

    const demandsForExecutorsQuery = supabaseAdmin
      .from("demands")
      .select("assignee_id, department_id, created_at");

    if (normalizedPeriod) {
      scoresQuery.eq("period", normalizedPeriod);
    }

    if (departmentId !== null) {
      scoresQuery.eq("department_id", departmentId);
      demandsForExecutorsQuery.eq("department_id", departmentId);
    }

    demandsForExecutorsQuery.gte("created_at", from).lt("created_at", to);

    const [scoresResult, executorsResult] = await Promise.all([
      scoresQuery,
      demandsForExecutorsQuery,
    ]);

    if (scoresResult.error || executorsResult.error) {
      console.error("[api/statistics/overview] scores error", {
        scoresError: scoresResult.error,
        executorsError: executorsResult.error,
      });
      return NextResponse.json(
        { error: "failed_to_load_scores_stats" },
        { status: 500 },
      );
    }

    let scoreAvg = 0;
    let scoreCoverageRate = 0;

    const scoreRows = (scoresResult.data ?? []) as { target_user_id: number | null; scores: any }[];
    if (scoreRows.length > 0) {
      let totalScore = 0;
      let recordCount = 0;

      for (const row of scoreRows) {
        const scoresPayload = row.scores as any;
        if (!scoresPayload || typeof scoresPayload !== "object") {
          continue;
        }
        const values: number[] = [];
        for (const value of Object.values(scoresPayload)) {
          const num = typeof value === "number" ? value : Number(value);
          if (Number.isFinite(num)) {
            values.push(num);
          }
        }
        if (!values.length) {
          continue;
        }
        const avgRecordScore = values.reduce((sum, v) => sum + v, 0) / values.length;
        totalScore += avgRecordScore;
        recordCount += 1;
      }

      if (recordCount > 0) {
        scoreAvg = totalScore / recordCount;
      }
    }

    const executorRows = (executorsResult.data ?? []) as { assignee_id: number | null }[];
    const executorsSet = new Set<number>();
    for (const row of executorRows) {
      if (typeof row.assignee_id === "number" && row.assignee_id > 0) {
        executorsSet.add(row.assignee_id);
      }
    }

    const scoredUserSet = new Set<number>();
    for (const row of scoreRows) {
      if (typeof row.target_user_id === "number" && row.target_user_id > 0) {
        scoredUserSet.add(row.target_user_id);
      }
    }

    const executorsCount = executorsSet.size;
    if (executorsCount > 0) {
      let covered = 0;
      for (const userId of executorsSet) {
        if (scoredUserSet.has(userId)) {
          covered += 1;
        }
      }
      scoreCoverageRate = covered / executorsCount;
    }

    return NextResponse.json(
      {
        period: normalizedPeriod,
        scope,
        departmentId,
        metrics: {
          demandsCreated,
          demandsCompleted,
          demandsInProgress,
          demandsDelayed,
          avgCycleDays,
          scoreAvg,
          scoreCoverageRate,
        },
      },
      {
        headers: {
          "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
        },
      },
    );
  } catch (error: any) {
    console.error("[api/statistics/overview] unexpected error", error);
    return NextResponse.json(
      {
        error: "failed_to_load_overview_stats",
        detail: error?.message ?? String(error),
      },
      { status: 500 },
    );
  }
}
