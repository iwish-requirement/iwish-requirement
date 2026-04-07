import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest } from "../../../../../lib/serverAuth";
import { ensureHasPermission } from "../../../../../lib/serverPermissions";

export const runtime = "edge";

interface OverviewMetrics {
  demandsCreated: number;
  demandsCompleted: number;
  demandsInProgress: number;
  demandsDelayed: number;
  avgCycleDays: number;
  scoreAvg: number;
  scoreCoverageRate: number;
}

interface DepartmentShareItem {
  departmentId: number;
  departmentName: string;
  value: number;
}

interface TrendPoint {
  name: string;
  demands: number;
  completed: number;
}

interface OverviewResponseBody {
  scope: "company" | "department";
  period: string;
  departmentId: number | null;
  departmentName?: string | null;
  metrics: OverviewMetrics;
  departmentShare: DepartmentShareItem[];
  trend: TrendPoint[];
}

function getPeriodFromQuery(url: URL): string {
  const periodParam = url.searchParams.get("period");
  if (periodParam && /^\d{4}-\d{2}$/.test(periodParam.trim())) {
    return periodParam.trim();
  }
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

function getPeriodRange(period: string): { start: string; end: string } {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) {
    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = now.getMonth();
    const startDate = new Date(Date.UTC(year, monthIndex, 1));
    const endDate = new Date(Date.UTC(year, monthIndex + 1, 1));
    return { start: startDate.toISOString(), end: endDate.toISOString() };
  }

  const year = Number.parseInt(match[1], 10);
  const monthIndex = Number.parseInt(match[2], 10) - 1;
  const startDate = new Date(Date.UTC(year, monthIndex, 1));
  const endDate = new Date(Date.UTC(year, monthIndex + 1, 1));
  return { start: startDate.toISOString(), end: endDate.toISOString() };
}

function getTrendMonths(currentPeriod: string, count: number): string[] {
  const match = /^(\d{4})-(\d{2})$/.exec(currentPeriod);
  if (!match) {
    return [];
  }

  const baseYear = Number.parseInt(match[1], 10);
  const baseMonthIndex = Number.parseInt(match[2], 10) - 1;

  const months: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(Date.UTC(baseYear, baseMonthIndex - i, 1));
    const year = date.getUTCFullYear();
    const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
    months.push(`${year}-${month}`);
  }
  return months;
}

function formatMonthLabel(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) {
    return period;
  }
  return `${match[2].replace(/^0/, "")}月`;
}

function applyDepartmentFilter(query: any, departmentId: number | null) {
  return departmentId ? query.eq("department_id", departmentId) : query;
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
    const period = getPeriodFromQuery(url);
    const { start, end } = getPeriodRange(period);

    const departmentIdParam = url.searchParams.get("departmentId");
    const scope: "company" | "department" =
      departmentIdParam && departmentIdParam !== "all" ? "department" : "company";

    let departmentId: number | null = null;
    if (scope === "department" && departmentIdParam) {
      const parsed = Number.parseInt(departmentIdParam, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        departmentId = parsed;
      }
    }

    const trendMonths = getTrendMonths(period, 6);
    const trendStart = trendMonths.length > 0 ? `${trendMonths[0]}-01T00:00:00.000Z` : start;

    const demandsCreatedQuery = applyDepartmentFilter(
      supabaseAdmin
        .from("demands")
        .select("id", { head: true, count: "exact" })
        .gte("created_at", start)
        .lt("created_at", end),
      departmentId,
    );

    const demandsCompletedQuery = applyDepartmentFilter(
      supabaseAdmin
        .from("demands")
        .select("created_at, finished_at", { count: "exact" })
        .in("status", ["done", "closed"])
        .gte("created_at", start)
        .lt("created_at", end),
      departmentId,
    );

    const demandsInProgressQuery = applyDepartmentFilter(
      supabaseAdmin
        .from("demands")
        .select("id", { head: true, count: "exact" })
        .in("status", ["pending", "in_progress", "review"])
        .gte("created_at", start)
        .lt("created_at", end),
      departmentId,
    );

    const demandsDelayedQuery = applyDepartmentFilter(
      supabaseAdmin
        .from("demands")
        .select("id", { head: true, count: "exact" })
        .eq("status", "delayed")
        .gte("created_at", start)
        .lt("created_at", end),
      departmentId,
    );

    const departmentShareQuery = applyDepartmentFilter(
      supabaseAdmin
        .from("demands")
        .select("department_id")
        .gte("created_at", start)
        .lt("created_at", end),
      departmentId,
    );

    const trendQuery = applyDepartmentFilter(
      supabaseAdmin
        .from("demands")
        .select("created_at, status")
        .gte("created_at", trendStart)
        .lt("created_at", end),
      departmentId,
    );

    const scoreRecordsQuery = applyDepartmentFilter(
      supabaseAdmin
        .from("score_records")
        .select("scores, target_user_id")
        .eq("period", period),
      departmentId,
    );

    const scoreTasksQuery = applyDepartmentFilter(
      supabaseAdmin
        .from("score_tasks")
        .select("status")
        .eq("period", period),
      departmentId,
    );

    const departmentsQuery = supabaseAdmin.from("departments").select("id, name");

    const [
      demandsCreatedResult,
      demandsCompletedResult,
      demandsInProgressResult,
      demandsDelayedResult,
      departmentShareResult,
      trendResult,
      scoreRecordsResult,
      scoreTasksResult,
      departmentsResult,
    ] = await Promise.all([
      demandsCreatedQuery,
      demandsCompletedQuery,
      demandsInProgressQuery,
      demandsDelayedQuery,
      departmentShareQuery,
      trendQuery,
      scoreRecordsQuery,
      scoreTasksQuery,
      departmentsQuery,
    ] as const);

    const errors = [
      demandsCreatedResult.error,
      demandsCompletedResult.error,
      demandsInProgressResult.error,
      demandsDelayedResult.error,
      departmentShareResult.error,
      trendResult.error,
      scoreRecordsResult.error,
      scoreTasksResult.error,
      departmentsResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      console.error("[api/demands/stats/overview] query error", errors);
      return NextResponse.json(
        { error: "failed_to_load_overview_stats" },
        { status: 500 },
      );
    }

    const demandsCreated = demandsCreatedResult.count ?? 0;
    const demandsCompleted = demandsCompletedResult.count ?? 0;
    const demandsInProgress = demandsInProgressResult.count ?? 0;
    const demandsDelayed = demandsDelayedResult.count ?? 0;

    let avgCycleDays = 0;
    const completedRows = (demandsCompletedResult.data || []) as {
      created_at: string | null;
      finished_at: string | null;
    }[];
    if (completedRows.length > 0) {
      let totalDays = 0;
      let validCount = 0;

      for (const row of completedRows) {
        if (!row.created_at || !row.finished_at) {
          continue;
        }
        const createdAt = new Date(row.created_at).getTime();
        const finishedAt = new Date(row.finished_at).getTime();
        if (!Number.isFinite(createdAt) || !Number.isFinite(finishedAt) || finishedAt < createdAt) {
          continue;
        }
        totalDays += (finishedAt - createdAt) / (1000 * 60 * 60 * 24);
        validCount += 1;
      }

      if (validCount > 0) {
        avgCycleDays = totalDays / validCount;
      }
    }

    const deptRows = (departmentsResult.data || []) as { id: number; name: string | null }[];
    const deptMap = new Map<number, string>();
    for (const dept of deptRows) {
      deptMap.set(dept.id, (dept.name || "未命名部门").toString());
    }

    const departmentAggregate = new Map<number, number>();
    const departmentRows = (departmentShareResult.data || []) as { department_id: number | null }[];
    for (const row of departmentRows) {
      if (!row.department_id) {
        continue;
      }
      departmentAggregate.set(row.department_id, (departmentAggregate.get(row.department_id) || 0) + 1);
    }

    const departmentShare: DepartmentShareItem[] = Array.from(departmentAggregate.entries())
      .map(([deptId, value]) => ({
        departmentId: deptId,
        departmentName: deptMap.get(deptId) || "未命名部门",
        value,
      }))
      .sort((a, b) => b.value - a.value);

    const trendIndexMap = new Map<string, { demands: number; completed: number }>();
    for (const month of trendMonths) {
      trendIndexMap.set(month, { demands: 0, completed: 0 });
    }

    const trendRows = (trendResult.data || []) as { created_at: string | null; status: string | null }[];
    for (const row of trendRows) {
      if (!row.created_at) {
        continue;
      }
      const monthKey = row.created_at.slice(0, 7);
      const bucket = trendIndexMap.get(monthKey);
      if (!bucket) {
        continue;
      }
      bucket.demands += 1;
      const normalizedStatus = (row.status || "").toLowerCase();
      if (normalizedStatus === "done" || normalizedStatus === "closed") {
        bucket.completed += 1;
      }
    }

    const trend: TrendPoint[] = trendMonths.map((month) => {
      const bucket = trendIndexMap.get(month) || { demands: 0, completed: 0 };
      return {
        name: formatMonthLabel(month),
        demands: bucket.demands,
        completed: bucket.completed,
      };
    });

    const scoreRows = (scoreRecordsResult.data || []) as {
      scores: Record<string, number | string> | null;
      target_user_id: number | null;
    }[];

    let scoreAvg = 0;
    if (scoreRows.length > 0) {
      let totalScore = 0;
      let scoreCount = 0;

      for (const row of scoreRows) {
        const payload = row.scores;
        if (!payload || typeof payload !== "object") {
          continue;
        }

        const values = Object.values(payload)
          .map((value) => (typeof value === "number" ? value : Number(value)))
          .filter((value) => Number.isFinite(value));

        if (values.length === 0) {
          continue;
        }

        totalScore += values.reduce((sum, value) => sum + value, 0) / values.length;
        scoreCount += 1;
      }

      if (scoreCount > 0) {
        scoreAvg = totalScore / scoreCount;
      }
    }

    const totalTasks = ((scoreTasksResult.data || []) as { status: string | null }[]).length;
    const completedTasks = ((scoreTasksResult.data || []) as { status: string | null }[]).filter((task) => {
      return (task.status || "").toLowerCase() === "completed";
    }).length;
    const scoreCoverageRate = totalTasks > 0 ? completedTasks / totalTasks : 0;

    const deptName = scope === "department" && departmentId ? deptMap.get(departmentId) || null : null;

    const responseBody: OverviewResponseBody = {
      scope,
      period,
      departmentId,
      departmentName: deptName,
      metrics: {
        demandsCreated,
        demandsCompleted,
        demandsInProgress,
        demandsDelayed,
        avgCycleDays,
        scoreAvg,
        scoreCoverageRate,
      },
      departmentShare,
      trend,
    };

    return NextResponse.json(responseBody, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
      },
    });
  } catch (error: any) {
    console.error("[api/demands/stats/overview] unexpected error", error);
    return NextResponse.json(
      {
        error: "failed_to_load_overview_stats",
        detail: error?.message ?? String(error),
      },
      { status: 500 },
    );
  }
}
