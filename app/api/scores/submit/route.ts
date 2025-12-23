import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../lib/serverAuth";

export const runtime = "edge";

type RawScoreTaskRow = {
  id: number;
  period: string;
  scorer_id: number;
  target_user_id: number;
  department_id: number;
  template_id: number;
  status: string;
};

type RawTemplateRow = {
  id: number;
  department_id: number;
  name: string | null;
  items: any;
};

type ScoreOption = {
  value: number;
  label: string;
};

type TemplateItem = {
  label: string;
  max: number;
  required: boolean;
  options?: ScoreOption[];
};

type ScorePayload = Record<string, number>;

type ScoreWindowPhase = "not_started" | "open" | "closed" | "unknown";

type ScorePeriodConfigRow = {
  period: string;
  score_window_start: string | null;
  score_window_end: string | null;
  status: string | null;
};

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

async function getWindowPhaseForTaskPeriod(period: string): Promise<{
  windowStart: string | null;
  windowEnd: string | null;
  phase: ScoreWindowPhase;
}> {
  const normalized = /^\d{4}-\d{2}$/.test(period.trim()) ? period.trim() : "";
  if (!normalized) {
    return {
      windowStart: null,
      windowEnd: null,
      phase: "unknown",
    };
  }

  const now = new Date();

  let windowStart: string | null = null;
  let windowEnd: string | null = null;

  const { data, error } = await supabaseAdmin
    .from("score_periods")
    .select("period, score_window_start, score_window_end, status")
    .eq("period", normalized)
    .maybeSingle<ScorePeriodConfigRow>();

  if (error) {
    console.error("[api/scores/submit] load score_periods error", error);
  }

  if (data && data.period) {
    windowStart = data.score_window_start;
    windowEnd = data.score_window_end;
  }

  if (!windowStart || !windowEnd) {
    const fallbackWindow = computeDefaultWindowForPeriod(normalized);
    if (fallbackWindow) {
      windowStart = fallbackWindow.start;
      windowEnd = fallbackWindow.end;
    }
  }

  let phase: ScoreWindowPhase = "unknown";

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

  if (data && typeof data.status === "string") {
    const normalizedStatus = data.status.toLowerCase();
    if (normalizedStatus === "closed") {
      phase = "closed";
    }
  }

  return {
    windowStart,
    windowEnd,
    phase,
  };
}


function normalizeItems(raw: any): TemplateItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const items: TemplateItem[] = [];

  for (const entry of raw) {
    const label = (entry?.label ?? "").toString().trim();
    if (!label) {
      continue;
    }

    const maxRaw = entry?.max;
    const maxNumber = typeof maxRaw === "number" && Number.isFinite(maxRaw) ? maxRaw : 5;
    const max = maxNumber > 0 ? maxNumber : 5;
    const required = Boolean(entry?.required);

    let options: ScoreOption[] | undefined;
    const optionsRaw = (entry as any)?.options;
    if (Array.isArray(optionsRaw)) {
      const parsed: ScoreOption[] = [];
      for (const opt of optionsRaw) {
        const valueRaw = (opt as any)?.value;
        const valueNum =
          typeof valueRaw === "number" && Number.isFinite(valueRaw)
            ? valueRaw
            : Number(valueRaw);
        const optionLabel = ((opt as any)?.label ?? "").toString().trim();
        if (!Number.isFinite(valueNum) || !optionLabel) {
          continue;
        }
        parsed.push({ value: valueNum, label: optionLabel });
      }
      if (parsed.length > 0) {
        options = parsed;
      }
    }

    items.push({ label, max, required, options });
  }

  return items;
}

function sanitizeScores(templateItems: TemplateItem[], payload: any): {
  valid: boolean;
  scores?: ScorePayload;
  message?: string;
} {
  if (!payload || typeof payload !== "object") {
    return { valid: false, message: "评分数据格式不正确" };
  }

  const scores: ScorePayload = {};

  for (const item of templateItems) {
    const rawValue = (payload as any)[item.label];

    if (rawValue === undefined || rawValue === null || rawValue === "") {
      if (item.required) {
        return { valid: false, message: `请先完成"${item.label}"的评分` };
      }
      continue;
    }

    const num = typeof rawValue === "number" ? rawValue : Number(rawValue);
    if (!Number.isFinite(num)) {
      return { valid: false, message: `"${item.label}"的评分必须为数字` };
    }

    if (item.options && item.options.length > 0) {
      const allowedValues = item.options.map((opt) => opt.value);
      if (!allowedValues.includes(num)) {
        return {
          valid: false,
          message: `"${item.label}"的评分必须从预设选项中选择`,
        };
      }
    } else if (num < 1 || num > item.max) {
      return {
        valid: false,
        message: `"${item.label}"的评分必须在 1-${item.max} 之间`,
      };
    }

    scores[item.label] = num;
  }

  return { valid: true, scores };
}

export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const taskIdRaw = body?.taskId;
    const rawScores = body?.scores;
    const rawComment = (body?.comment ?? "") as string;

    const taskId = typeof taskIdRaw === "number" ? taskIdRaw : Number(taskIdRaw);
    if (!Number.isFinite(taskId) || taskId <= 0) {
      return NextResponse.json(
        { error: "invalid_task_id", detail: "评分任务ID不合法" },
        { status: 400 },
      );
    }

    const { data: task, error: taskError } = await supabaseAdmin
      .from("score_tasks")
      .select("id, period, scorer_id, target_user_id, department_id, template_id, status")
      .eq("id", taskId)
      .maybeSingle<RawScoreTaskRow>();

    if (taskError) {
      console.error("[api/scores/submit] load task error", taskError);
      return NextResponse.json(
        { error: "failed_to_load_task", detail: taskError.message },
        { status: 500 },
      );
    }

    if (!task) {
      return NextResponse.json(
        { error: "not_found", detail: "评分任务不存在或已被删除" },
        { status: 404 },
      );
    }

    if (task.scorer_id !== currentUser.id) {
      return NextResponse.json(
        { error: "forbidden", detail: "您无权提交该评分任务" },
        { status: 403 },
      );
    }

    const statusValue = (task.status ?? "").toString().toLowerCase();
    if (statusValue === "completed") {
      return NextResponse.json(
        { error: "already_completed", detail: "该评分任务已完成，不能重复提交" },
        { status: 400 },
      );
    }

    const windowCheck = await getWindowPhaseForTaskPeriod(task.period);
    if (windowCheck.phase !== "open") {
      if (windowCheck.phase === "not_started") {
        return NextResponse.json(
          { error: "window_not_started", detail: "当前评分窗口尚未开启，请在评分窗口内再提交。" },
          { status: 400 },
        );
      }
      if (windowCheck.phase === "closed") {
        return NextResponse.json(
          { error: "window_closed", detail: "当前评分窗口已结束，如需补录或调整，请联系管理员。" },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: "window_unavailable", detail: "当前暂无有效评分窗口配置，暂不支持提交评分。" },
        { status: 400 },
      );
    }

    const { data: templateRow, error: templateError } = await supabaseAdmin
      .from("score_templates")
      .select("id, department_id, name, items")
      .eq("id", task.template_id)
      .maybeSingle<RawTemplateRow>();

    if (templateError) {
      console.error("[api/scores/submit] load template error", templateError);
      return NextResponse.json(
        { error: "failed_to_load_template", detail: templateError.message },
        { status: 500 },
      );
    }

    if (!templateRow) {
      return NextResponse.json(
        { error: "template_not_found", detail: "评分模板不存在，请联系管理员" },
        { status: 400 },
      );
    }

    const templateItems = normalizeItems(templateRow.items);
    if (!templateItems.length) {
      return NextResponse.json(
        { error: "empty_template", detail: "当前评分模板未配置任何评分项，请联系管理员" },
        { status: 400 },
      );
    }

    const validation = sanitizeScores(templateItems, rawScores);
    if (!validation.valid || !validation.scores) {
      return NextResponse.json(
        { error: "invalid_scores", detail: validation.message ?? "评分数据不合法" },
        { status: 400 },
      );
    }

    const comment = rawComment.trim();
    const finalComment = comment.length > 2000 ? comment.slice(0, 2000) : comment;

    const insertResult = await supabaseAdmin
      .from("score_records")
      .insert({
        task_id: task.id,
        scorer_id: task.scorer_id,
        target_user_id: task.target_user_id,
        department_id: task.department_id,
        period: task.period,
        scores: validation.scores,
        comment: finalComment || null,
      })
      .select("id")
      .maybeSingle<{ id: number }>();

    if (insertResult.error || !insertResult.data) {
      console.error("[api/scores/submit] insert record error", insertResult.error);
      return NextResponse.json(
        {
          error: "failed_to_save_scores",
          detail: insertResult.error?.message ?? "插入评分记录失败",
        },
        { status: 500 },
      );
    }

    const updateResult = await supabaseAdmin
      .from("score_tasks")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", task.id);

    if (updateResult.error) {
      console.error("[api/scores/submit] update task status error", updateResult.error);
      return NextResponse.json(
        {
          error: "failed_to_update_task",
          detail: updateResult.error.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        recordId: insertResult.data.id,
        taskId: task.id,
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("[api/scores/submit] unexpected error", error);
    return NextResponse.json(
      {
        error: "failed_to_save_scores",
        detail: error?.message ?? String(error),
      },
      { status: 500 },
    );
  }
}
