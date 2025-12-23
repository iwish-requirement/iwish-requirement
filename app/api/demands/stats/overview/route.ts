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
    const startDate = new Date(year, monthIndex, 1);
    const endDate = new Date(year, monthIndex + 1, 1);
    return { start: startDate.toISOString(), end: endDate.toISOString() };
  }

  const year = Number.parseInt(match[1], 10);
  const monthIndex = Number.parseInt(match[2], 10) - 1;
  const startDate = new Date(year, monthIndex, 1);
  const endDate = new Date(year, monthIndex + 1, 1);
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
    const date = new Date(baseYear, baseMonthIndex - i, 1);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    months.push(`${year}-${month}`);
  }
  return months;
}

function formatMonthLabel(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) {
    return period;
  }
  const month = match[2].replace(/^0/, "");
  return `${month}月`;
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
    const scope: "company" | "department" = departmentIdParam && departmentIdParam !== "all" ? "department" : "company";

    let departmentId: number | null = null;
    if (scope === "department" && departmentIdParam) {
      const parsed = Number.parseInt(departmentIdParam, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        departmentId = parsed;
      }
    }

    const baseDemandsQuery = supabaseAdmin
      .from("demands")
      .select("id, department_id, status, created_at, finished_at", { count: "exact" })
      .gte("created_at", start)
      .lt("created_at", end);

    const demandsQuery = departmentId ? baseDemandsQuery.eq("department_id", departmentId) : baseDemandsQuery;

    const [demandsResult, departmentsResult, scoreRecordsResult, scoreTasksResult] = await Promise.all([
      demandsQuery,
      supabaseAdmin
        .from("departments")
        .select("id, name"),
      supabaseAdmin
        .from("score_records")
        .select("scores, department_id, period")
        .eq("period", period),
      supabaseAdmin
        .from("score_tasks")
        .select("id, status, department_id, period")
        .eq("period", period),
    ] as const);

    const { data: demandsRows, error: demandsError, count: demandsCount } = demandsResult;

    if (demandsError) {
      console.error("[api/demands/stats/overview] demands query error", demandsError);
      return NextResponse.json(
        { error: "failed_to_load_demands", detail: demandsError.message },
        { status: 500 },
      );
    }

    const demandsData = (demandsRows || []) as {
      id: number;
      department_id: number | null;
      status: string;
      created_at: string | null;
      finished_at: string | null;
    }[];

    const scopeDemands = scope === "department" && departmentId
      ? demandsData.filter((row) => row.department_id === departmentId)
      : demandsData;

    const demandsCreated = demandsCount ?? scopeDemands.length;
    let demandsCompleted = 0;
    let demandsInProgress = 0;
    let demandsDelayed = 0;

    const cycleDurations: number[] = [];

    for (const row of scopeDemands) {
      const status = (row.status || "").toLowerCase();
      if (status === "done" || status === "closed") {
        demandsCompleted += 1;
      } else if (status === "delayed") {
        demandsDelayed += 1;
      } else if (status === "pending" || status === "in_progress" || status === "review") {
        demandsInProgress += 1;
      }

      if (row.created_at && row.finished_at) {
        const createdAt = new Date(row.created_at).getTime();
        const finishedAt = new Date(row.finished_at).getTime();
        if (Number.isFinite(createdAt) && Number.isFinite(finishedAt) && finishedAt >= createdAt) {
          const days = (finishedAt - createdAt) / (1000 * 60 * 60 * 24);
          cycleDurations.push(days);
        }
      }
    }

    const avgCycleDays = cycleDurations.length
      ? cycleDurations.reduce((sum, v) => sum + v, 0) / cycleDurations.length
      : 0;

    const deptRows = (departmentsResult.data || []) as { id: number; name: string | null }[];
    const deptMap = new Map<number, string>();
    for (const dept of deptRows) {
      if (typeof dept.id === "number") {
        const name = (dept.name || "未命名部门").toString();
        deptMap.set(dept.id, name);
      }
    }

    const departmentAggregate = new Map<number, number>();
    for (const row of demandsData) {
      if (!row.department_id) continue;
      if (scope === "department" && departmentId && row.department_id !== departmentId) {
        continue;
      }
      const current = departmentAggregate.get(row.department_id) || 0;
      departmentAggregate.set(row.department_id, current + 1);
    }

    const departmentShare: DepartmentShareItem[] = Array.from(departmentAggregate.entries())
      .map(([deptId, count]) => ({
        departmentId: deptId,
        departmentName: deptMap.get(deptId) || "未命名部门",
        value: count,
      }))
      .sort((a, b) => b.value - a.value);

    const trendMonths = getTrendMonths(period, 6);
    const trendIndexMap = new Map<string, { demands: number; completed: number }>();
    for (const month of trendMonths) {
      trendIndexMap.set(month, { demands: 0, completed: 0 });
    }

    for (const row of demandsData) {
      const createdAtRaw = row.created_at;
      if (!createdAtRaw) {
        continue;
      }
      const createdAtPeriod = createdAtRaw.slice(0, 7);
      const bucket = trendIndexMap.get(createdAtPeriod);
      if (!bucket) {
        continue;
      }
      if (scope === "department" && departmentId && row.department_id !== departmentId) {
        continue;
      }
      bucket.demands += 1;
      const status = (row.status || "").toLowerCase();
      if (status === "done" || status === "closed") {
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

    const scoreRecordsRows = (scoreRecordsResult.data || []) as {
      scores: any;
      department_id: number | null;
      period: string;
    }[];

    const scoreTasksRows = (scoreTasksResult.data || []) as {
      id: number;
      status: string;
      department_id: number | null;
      period: string;
    }[];

    let scoreValues: number[] = [];
    for (const record of scoreRecordsRows) {
      if (scope === "department" && departmentId && record.department_id && record.department_id !== departmentId) {
        continue;
      }
      const payload = record.scores as any;
      if (!payload || typeof payload !== "object") {
        continue;
      }
      for (const value of Object.values(payload)) {
        const num = typeof value === "number" ? value : Number(value);
        if (Number.isFinite(num)) {
          scoreValues.push(num);
        }
      }
    }

    const scoreAvg = scoreValues.length
      ? scoreValues.reduce((sum, v) => sum + v, 0) / scoreValues.length
      : 0;

    const scopedTasks = scoreTasksRows.filter((task) => {
      if (task.period !== period) {
        return false;
      }
      if (scope === "department" && departmentId && task.department_id && task.department_id !== departmentId) {
        return false;
      }
      return true;
    });

    const totalTasks = scopedTasks.length;
    const completedTasks = scopedTasks.filter((task) => {
      const status = (task.status || "").toLowerCase();
      return status === "completed";
    }).length;

    const scoreCoverageRate = totalTasks > 0 ? completedTasks / totalTasks : 0;

    const metrics: OverviewMetrics = {
      demandsCreated,
      demandsCompleted,
      demandsInProgress,
      demandsDelayed,
      avgCycleDays,
      scoreAvg,
      scoreCoverageRate,
    };

    const deptName = scope === "department" && departmentId ? deptMap.get(departmentId) || null : null;

    const responseBody: OverviewResponseBody = {
      scope,
      period,
      departmentId: departmentId || null,
      departmentName: deptName,
      metrics,
      departmentShare,
      trend,
    };

    return NextResponse.json(responseBody);
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
