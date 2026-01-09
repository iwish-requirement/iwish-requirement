import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../lib/serverAuth";
import { ensureScoreTasksForUserPeriod } from "../../../../lib/scoreTasksUtils";

export const runtime = "edge";

type RawScoreTaskRow = {
  id: number;
  period: string;
  scorer_id: number;
  target_user_id: number;
  department_id: number;
  template_id: number;
  status: string;
  created_at: string | null;
  completed_at: string | null;
};

type UserRow = {
  id: number;
  name: string | null;
  email: string | null;
  role: string | null;
};

type DepartmentRow = {
  id: number;
  name: string | null;
};

type ScorePeriodConfigRow = {
  period: string;
  score_window_start: string | null;
  score_window_end: string | null;
  status: string | null;
};

type NormalizedStatus = "pending" | "completed" | "missed" | "reminded";

type ScoreWindowPhase = "not_started" | "open" | "closed" | "unknown";

function parsePeriod(period: string): { year: number; monthIndex: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(period.trim());
  if (!match) {
    return null;
  }
  const year = Number.parseInt(match[1], 10);
  const monthIndex = Number.parseInt(match[2], 10) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return null;
  }
  return { year, monthIndex };
}

function computeDefaultWindowForPeriod(period: string): { start: string; end: string } | null {
  const parsed = parsePeriod(period);
  if (!parsed) {
    return null;
  }
  const { year, monthIndex } = parsed;

  const lastDayOfMonth = new Date(Date.UTC(year, monthIndex + 1, 0, 0, 0, 0, 0));
  const defaultStart = lastDayOfMonth;

  const defaultEnd = new Date(Date.UTC(year, monthIndex + 1, 5, 23, 59, 59, 999));

  const startIso = defaultStart.toISOString();
  const endIso = defaultEnd.toISOString();

  return { start: startIso, end: endIso };
}

function getDefaultPeriodFromDate(now: Date): string {
  const year = now.getFullYear();
  const monthIndex = now.getMonth();
  const month = `${monthIndex + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

async function getCurrentPeriodFromConfigOrDefault(periodFromQuery: string | null): Promise<{ period: string; windowStart: string | null; windowEnd: string | null; phase: ScoreWindowPhase }> {
  const now = new Date();

  const normalizedPeriod =
    periodFromQuery && /^\d{4}-\d{2}$/.test(periodFromQuery.trim())
      ? periodFromQuery.trim()
      : getDefaultPeriodFromDate(now);

  let windowStart: string | null = null;
  let windowEnd: string | null = null;
  let phase: ScoreWindowPhase = "unknown";

  try {
    const { data, error } = await supabaseAdmin
      .from("score_periods")
      .select("period, score_window_start, score_window_end, status")
      .eq("period", normalizedPeriod)
      .maybeSingle<ScorePeriodConfigRow>();

    if (error) {
      console.error("[api/scores/my-tasks] load score_periods error", error);
    }

    if (data && data.period) {
      windowStart = data.score_window_start;
      windowEnd = data.score_window_end;
    }
  } catch (error) {
    console.error("[api/scores/my-tasks] load score_periods unexpected error", error);
  }

  if (!windowStart || !windowEnd) {
    const fallbackWindow = computeDefaultWindowForPeriod(normalizedPeriod);
    if (fallbackWindow) {
      windowStart = fallbackWindow.start;
      windowEnd = fallbackWindow.end;
    }
  }

  if (windowStart && windowEnd) {
    const startTime = new Date(windowStart);
    const endTime = new Date(windowEnd);
    if (!Number.isNaN(startTime.getTime()) && !Number.isNaN(endTime.getTime())) {
      if (now < startTime) {
        phase = "not_started";
      } else if (now > endTime) {
        phase = "closed";
      } else {
        phase = "open";
      }
    }
  }

  try {
    const { data } = await supabaseAdmin
      .from("score_periods")
      .select("status")
      .eq("period", normalizedPeriod)
      .maybeSingle<Pick<ScorePeriodConfigRow, "status">>();

    if (data && typeof data.status === "string") {
      const normalizedStatus = data.status.toLowerCase();
      if (normalizedStatus === "closed") {
        phase = "closed";
      }
    }
  } catch (error) {
    console.error("[api/scores/my-tasks] override phase by status error", error);
  }

  return {
    period: normalizedPeriod,
    windowStart,
    windowEnd,
    phase,
  };
}

function normalizeStatus(raw: string | null | undefined): NormalizedStatus {
  const value = (raw ?? "").toString().toLowerCase();
  if (value === "completed") return "completed";
  if (value === "missed") return "missed";
  if (value === "reminded") return "reminded";
  return "pending";
}


export async function GET(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const activeError = ensureActiveUser(authResult.user);
    if (activeError) {
      return activeError;
    }
    const currentUser = authResult.user!;

    const url = new URL(req.url);
    const periodParam = url.searchParams.get("period");
    const taskIdParam = url.searchParams.get("taskId");

    const periodFromQuery = periodParam && periodParam.trim() ? periodParam.trim() : null;

    let currentConfig = await getCurrentPeriodFromConfigOrDefault(periodFromQuery);
    let period = currentConfig.period;



    const email = (currentUser.email || "").toString();
    const creatorCode = email ? email.split("@")[0]?.toUpperCase() || null : null;

    if (!taskIdParam) {
      await ensureScoreTasksForUserPeriod(currentUser.id, creatorCode, period);
    }

    let tasks: RawScoreTaskRow[] = [];

    if (taskIdParam) {
      const taskId = Number.parseInt(taskIdParam, 10);
      if (Number.isNaN(taskId) || taskId <= 0) {
        return NextResponse.json(
          { error: "invalid_task_id", detail: "评分任务ID不合法" },
          { status: 400 },
        );
      }

      const { data, error } = await supabaseAdmin
        .from("score_tasks")
        .select("id, period, scorer_id, target_user_id, department_id, template_id, status, created_at, completed_at")
        .eq("id", taskId)
        .maybeSingle<RawScoreTaskRow>();

      if (error) {
        console.error("[api/scores/my-tasks] load single task error", error);
        return NextResponse.json(
          { error: "failed_to_load_task", detail: error.message },
          { status: 500 },
        );
      }

      if (!data) {
        return NextResponse.json(
          { error: "not_found", detail: "评分任务不存在或已被删除" },
          { status: 404 },
        );
      }

      if (data.scorer_id !== currentUser.id) {
        return NextResponse.json(
          { error: "forbidden", detail: "您无权访问该评分任务" },
          { status: 403 },
        );
      }

      tasks = [data];
      currentConfig = await getCurrentPeriodFromConfigOrDefault(data.period);
      period = currentConfig.period;
    } else {

      const { data, error } = await supabaseAdmin
        .from("score_tasks")
        .select("id, period, scorer_id, target_user_id, department_id, template_id, status, created_at, completed_at")
        .eq("scorer_id", currentUser.id)
        .eq("period", period)
        .order("created_at", { ascending: true })
        .returns<RawScoreTaskRow[]>();

      if (error) {
        console.error("[api/scores/my-tasks] query error", error);
        return NextResponse.json(
          { error: "failed_to_load_tasks", detail: error.message },
          { status: 500 },
        );
      }

      tasks = data ?? [];
    }

    if (!tasks.length) {
      return NextResponse.json({
        period,
        scoringWindow: {
          start: currentConfig.windowStart,
          end: currentConfig.windowEnd,
          phase: currentConfig.phase,
        },
        items: [],
      });
    }


    const departmentIds = Array.from(
      new Set(
        tasks
          .map((t) => t.department_id)
          .filter((id) => typeof id === "number" && id > 0),
      ),
    );
    const targetUserIds = Array.from(
      new Set(
        tasks
          .map((t) => t.target_user_id)
          .filter((id) => typeof id === "number" && id > 0),
      ),
    );

    const [departmentsResult, usersResult] = await Promise.all([
      departmentIds.length
        ? supabaseAdmin
            .from("departments")
            .select("id, name")
            .in("id", departmentIds)
            .returns<DepartmentRow[]>()
        : Promise.resolve({ data: [] as DepartmentRow[], error: null }),
      targetUserIds.length
        ? supabaseAdmin
            .from("users")
            .select("id, name, email, role")
            .in("id", targetUserIds)
            .returns<UserRow[]>()
        : Promise.resolve({ data: [] as UserRow[], error: null }),
    ]);

    if (departmentsResult.error) {
      console.error("[api/scores/my-tasks] load departments error", departmentsResult.error);
      return NextResponse.json(
        { error: "failed_to_load_tasks", detail: departmentsResult.error.message },
        { status: 500 },
      );
    }

    if (usersResult.error) {
      console.error("[api/scores/my-tasks] load users error", usersResult.error);
      return NextResponse.json(
        { error: "failed_to_load_tasks", detail: usersResult.error.message },
        { status: 500 },
      );
    }

    const deptMap = new Map<number, DepartmentRow>();
    for (const dept of departmentsResult.data ?? []) {
      if (typeof dept.id === "number") {
        deptMap.set(dept.id, dept);
      }
    }

    const userMap = new Map<number, UserRow>();
    for (const user of usersResult.data ?? []) {
      if (typeof user.id === "number") {
        userMap.set(user.id, user);
      }
    }

    const items = tasks.map((task) => {
      const department = deptMap.get(task.department_id);
      const targetUser = userMap.get(task.target_user_id);
      const status = normalizeStatus(task.status);

      const targetName =
        (targetUser?.name ?? "").trim() || (targetUser?.email ?? "").trim() || "未命名用户";

      return {
        id: task.id,
        period: task.period,
        status,
        departmentId: task.department_id,
        departmentName: department?.name ?? null,
        targetUserId: task.target_user_id,
        targetUserName: targetName,
        targetUserEmail: targetUser?.email ?? null,
        targetUserRole: targetUser?.role ?? null,
        templateId: task.template_id,
        createdAt: task.created_at,
        completedAt: task.completed_at,
      };
    });

    return NextResponse.json({
      period,
      scoringWindow: {
        start: currentConfig.windowStart,
        end: currentConfig.windowEnd,
        phase: currentConfig.phase,
      },
      items,
    });

  } catch (error: any) {
    console.error("[api/scores/my-tasks] unexpected error", error);
    return NextResponse.json(
      {
        error: "failed_to_load_tasks",
        detail: error?.message ?? String(error),
      },
      { status: 500 },
    );
  }
}
