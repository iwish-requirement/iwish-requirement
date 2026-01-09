import { supabaseAdmin } from "./supabaseAdmin";

type DemandRow = {
  id: number;
  creator_id: number | null;
  assignee_id: number | null;
  department_id: number | null;
};

type TemplateRow = {
  id: number;
  department_id: number;
};

type ScorePeriodConfigRow = {
  period: string;
  score_window_start: string | null;
  score_window_end: string | null;
  status: string | null;
};

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
      console.error("[scoreTasksUtils] load score_periods error", error);
    }

    if (data && data.period) {
      windowStart = data.score_window_start;
      windowEnd = data.score_window_end;
    }
  } catch (error) {
    console.error("[scoreTasksUtils] load score_periods unexpected error", error);
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
    console.error("[scoreTasksUtils] override phase by status error", error);
  }

  return {
    period: normalizedPeriod,
    windowStart,
    windowEnd,
    phase,
  };
}

function getPeriodRange(period: string): { from: string; to: string } {
  const match = /^(\d{4})-(\d{2})$/.exec(period.trim());
  if (!match) {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, "0");
    const from = `${year}-${month}-01T00:00:00.000Z`;
    const nextMonth = new Date(Date.UTC(year, now.getMonth() + 1, 1));
    const to = nextMonth.toISOString();
    return { from, to };
  }

  const year = Number.parseInt(match[1], 10);
  const monthIndex = Number.parseInt(match[2], 10) - 1;
  const fromDate = new Date(Date.UTC(year, monthIndex, 1));
  const toDate = new Date(Date.UTC(year, monthIndex + 1, 1));
  return {
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
  };
}

export async function ensureScoreTasksForUserPeriod(userId: number, creatorCode: string | null, period: string): Promise<void> {
  try {
    const { from, to } = getPeriodRange(period);

    const { data: demandsByCreator, error: demandsByCreatorError } = await supabaseAdmin
      .from("demands")
      .select("id, creator_id, assignee_id, department_id")
      .eq("creator_id", userId)
      .not("assignee_id", "is", null)
      .gte("created_at", from)
      .lt("created_at", to)
      .returns<DemandRow[]>();

    if (demandsByCreatorError) {
      console.error("[scoreTasksUtils] load demands by creator for tasks error", demandsByCreatorError);
      return;
    }

    let rows: DemandRow[] = demandsByCreator ?? [];

    if (creatorCode) {
      const { data: demandsByCode, error: demandsByCodeError } = await supabaseAdmin
        .from("demands")
        .select("id, creator_id, assignee_id, department_id")
        .eq("fields->>creatorCode", creatorCode)
        .not("assignee_id", "is", null)
        .gte("created_at", from)
        .lt("created_at", to)
        .returns<DemandRow[]>();

      if (demandsByCodeError) {
        console.error("[scoreTasksUtils] load demands by creatorCode for tasks error", demandsByCodeError);
      } else if (demandsByCode && demandsByCode.length) {
        const merged = new Map<number, DemandRow>();
        for (const row of rows) {
          if (typeof row.id === "number") {
            merged.set(row.id, row);
          }
        }
        for (const row of demandsByCode) {
          if (typeof row.id === "number") {
            merged.set(row.id, row);
          }
        }
        rows = Array.from(merged.values());
      }
    }

    if (!rows.length) {
      return;
    }

    type ComboKey = string;
    type ComboValue = { scorerId: number; targetUserId: number; departmentId: number };

    const combos = new Map<ComboKey, ComboValue>();

    for (const row of rows) {
      if (!row.creator_id || !row.assignee_id || !row.department_id) {
        continue;
      }

      const key = `${row.assignee_id}-${row.department_id}`;
      if (!combos.has(key)) {
        combos.set(key, {
          scorerId: row.creator_id,
          targetUserId: row.assignee_id,
          departmentId: row.department_id,
        });
      }
    }

    if (!combos.size) {
      return;
    }

    const departmentIds = Array.from(new Set(Array.from(combos.values()).map((c) => c.departmentId)));

    const { data: templates, error: templatesError } = await supabaseAdmin
      .from("score_templates")
      .select("id, department_id")
      .in("department_id", departmentIds)
      .eq("is_active", true)
      .returns<TemplateRow[]>();

    if (templatesError) {
      console.error("[scoreTasksUtils] load templates for tasks error", templatesError);
      return;
    }

    const templateMap = new Map<number, number>();
    for (const tpl of templates ?? []) {
      if (typeof tpl.department_id === "number" && typeof tpl.id === "number") {
        if (!templateMap.has(tpl.department_id)) {
          templateMap.set(tpl.department_id, tpl.id);
        }
      }
    }

    if (!templateMap.size) {
      return;
    }

    const comboList: ComboValue[] = [];
    for (const combo of combos.values()) {
      if (templateMap.has(combo.departmentId)) {
        comboList.push(combo);
      }
    }

    if (!comboList.length) {
      return;
    }

    const targetUserIds = Array.from(new Set(comboList.map((c) => c.targetUserId)));

    const { data: existingTasks, error: existingError } = await supabaseAdmin
      .from("score_tasks")
      .select("scorer_id, target_user_id, department_id")
      .eq("scorer_id", userId)
      .eq("period", period)
      .in("target_user_id", targetUserIds)
      .returns<Pick<{ scorer_id: number; target_user_id: number; department_id: number }, "scorer_id" | "target_user_id" | "department_id">[]>();

    if (existingError) {
      console.error("[scoreTasksUtils] load existing score_tasks error", existingError);
      return;
    }

    const existingSet = new Set<string>();
    for (const row of existingTasks ?? []) {
      if (!row.scorer_id || !row.target_user_id || !row.department_id) {
        continue;
      }
      existingSet.add(`${row.scorer_id}-${row.target_user_id}-${row.department_id}`);
    }

    const toInsert: {
      period: string;
      scorer_id: number;
      target_user_id: number;
      department_id: number;
      template_id: number;
      status: string;
    }[] = [];

    for (const combo of comboList) {
      const key = `${combo.scorerId}-${combo.targetUserId}-${combo.departmentId}`;
      if (existingSet.has(key)) {
        continue;
      }
      const templateId = templateMap.get(combo.departmentId);
      if (!templateId) {
        continue;
      }
      toInsert.push({
        period,
        scorer_id: combo.scorerId,
        target_user_id: combo.targetUserId,
        department_id: combo.departmentId,
        template_id: templateId,
        status: "pending",
      });
    }

    if (!toInsert.length) {
      return;
    }

    const { error: insertError } = await supabaseAdmin
      .from("score_tasks")
      .insert(toInsert);

    if (insertError) {
      console.error("[scoreTasksUtils] insert score_tasks error", insertError);
      return;
    }

    if (toInsert.length > 0) {
      const currentConfig = await getCurrentPeriodFromConfigOrDefault(period);
      if (currentConfig.phase === "open") {
        import("./wecomApp").then((mod) => {
          mod
            .loadWecomUserIdsForDemandParticipants(userId, null)
            .then((toUserIds) => {
              const uniqueIds = toUserIds.filter((v, idx, arr) => v && arr.indexOf(v) === idx);
              if (!uniqueIds.length) {
                return;
              }

              const baseUrlEnv =
                process.env.APP_PUBLIC_URL ||
                process.env.NEXT_PUBLIC_APP_URL ||
                process.env.VITE_PUBLIC_URL ||
                "";
              const baseUrl = baseUrlEnv.replace(/\/+$/, "");
              const link = baseUrl
                ? `${baseUrl}/scoring?period=${encodeURIComponent(currentConfig.period)}`
                : "";

              let content = `你有 ${toInsert.length} 条新的评分任务需要完成`;
              content += `\n评分周期：${currentConfig.period}`;

              if (link) {
                content += `\n前往评分：${link}`;
              }

              mod
                .sendWecomAppTextMessage(uniqueIds, content)
                .catch((e: any) => {
                  console.error("[scoreTasksUtils] send wecom app message error", e);
                });
            })
            .catch((e: any) => {
              console.error("[scoreTasksUtils] load wecom_user_id for scorer error", e);
            });
        });
      }
    }
  } catch (error) {
    console.error("[scoreTasksUtils] ensureScoreTasksForUserPeriod error", error);
  }
}
