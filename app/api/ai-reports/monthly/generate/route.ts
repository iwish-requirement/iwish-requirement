import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../../lib/serverAuth";
import { AiMonthlyReport, AiReportChapter, AiReportMetric } from "../../../../../types";
import { extractLegacyCustomerProject } from "../../../../../lib/legacyDemandFields";

export const runtime = "edge";

function getPeriodRange(period: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  const now = new Date();
  const year = match ? Number.parseInt(match[1], 10) : now.getUTCFullYear();
  const monthIndex = match ? Number.parseInt(match[2], 10) - 1 : now.getUTCMonth();
  return {
    from: new Date(Date.UTC(year, monthIndex, 1)).toISOString(),
    to: new Date(Date.UTC(year, monthIndex + 1, 1)).toISOString(),
  };
}

function normalizePeriod(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;
  const now = new Date();
  const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
}

function metric(id: string, label: string, value: number, unit?: string): AiReportMetric {
  return { id, label, value, unit };
}

async function buildSummary(departmentId: number, period: string, config?: Record<string, any>) {
  const { from, to } = getPeriodRange(period);
  const [departmentResult, demandsResult, scoresResult, tasksResult] = await Promise.all([
    supabaseAdmin.from("departments").select("id, name").eq("id", departmentId).maybeSingle(),
    supabaseAdmin
      .from("demands")
      .select("id, status, priority, created_at, assigned_at, started_at, finished_at, delayed_at, customer_id, project_id, demand_type_id, fields")
      .eq("department_id", departmentId)
      .gte("created_at", from)
      .lt("created_at", to),
    supabaseAdmin.from("score_records").select("scores").eq("department_id", departmentId).eq("period", period),
    supabaseAdmin.from("score_tasks").select("status").eq("department_id", departmentId).eq("period", period),
  ]);

  if (demandsResult.error) throw demandsResult.error;

  const demands = (demandsResult.data || []) as any[];
  const scores = (scoresResult.data || []) as any[];
  const tasks = (tasksResult.data || []) as any[];
  const completed = demands.filter((row) => ["done", "closed"].includes(((row.status as string) || "").toLowerCase()));
  const delayed = demands.filter((row) => row.delayed_at || ((row.status as string) || "").toLowerCase() === "delayed");

  let totalCycleDays = 0;
  let cycleCount = 0;
  let totalResponseHours = 0;
  let responseCount = 0;
  let totalProcessingHours = 0;
  let processingCount = 0;
  for (const row of completed) {
    const createdAt = row.created_at ? new Date(row.created_at).getTime() : NaN;
    const startedAt = row.started_at ? new Date(row.started_at).getTime() : NaN;
    const finishedAt = row.finished_at ? new Date(row.finished_at).getTime() : NaN;
    if (Number.isFinite(createdAt) && Number.isFinite(finishedAt) && finishedAt >= createdAt) {
      totalCycleDays += (finishedAt - createdAt) / (1000 * 60 * 60 * 24);
      cycleCount += 1;
    }
    if (Number.isFinite(createdAt) && Number.isFinite(startedAt) && startedAt >= createdAt) {
      totalResponseHours += (startedAt - createdAt) / (1000 * 60 * 60);
      responseCount += 1;
    }
    if (Number.isFinite(startedAt) && Number.isFinite(finishedAt) && finishedAt >= startedAt) {
      totalProcessingHours += (finishedAt - startedAt) / (1000 * 60 * 60);
      processingCount += 1;
    }
  }

  let scoreTotal = 0;
  let scoreCount = 0;
  for (const row of scores) {
    const values = Object.values((row.scores || {}) as Record<string, unknown>)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
    if (values.length) {
      scoreTotal += values.reduce((sum, value) => sum + value, 0) / values.length;
      scoreCount += 1;
    }
  }

  const completedTasks = tasks.filter((task) => ((task.status as string) || "").toLowerCase() === "completed").length;
  const legacyCustomerCounts = new Map<string, number>();
  const legacyProjectCounts = new Map<string, number>();
  for (const row of demands) {
    const { legacyCustomerName, legacyProjectName } = extractLegacyCustomerProject((row.fields || {}) as Record<string, unknown>);
    if (legacyCustomerName) legacyCustomerCounts.set(legacyCustomerName, (legacyCustomerCounts.get(legacyCustomerName) || 0) + 1);
    if (legacyProjectName) legacyProjectCounts.set(legacyProjectName, (legacyProjectCounts.get(legacyProjectName) || 0) + 1);
  }

  return {
    departmentName: ((departmentResult.data as any)?.name as string | undefined) || "部门",
    totalDemands: demands.length,
    completedDemands: completed.length,
    delayedDemands: delayed.length,
    completionRate: demands.length ? completed.length / demands.length : 0,
    delayRate: demands.length ? delayed.length / demands.length : 0,
    avgCycleDays: cycleCount ? totalCycleDays / cycleCount : 0,
    avgResponseHours: responseCount ? totalResponseHours / responseCount : 0,
    avgProcessingHours: processingCount ? totalProcessingHours / processingCount : 0,
    scoreAvg: scoreCount ? scoreTotal / scoreCount : 0,
    scoreCoverageRate: tasks.length ? completedTasks / tasks.length : 0,
    topLegacyCustomers: Array.from(legacyCustomerCounts.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10),
    topLegacyProjects: Array.from(legacyProjectCounts.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10),
    reportConfig: {
      tone: config?.tone || "neutral",
      length: config?.length || "standard",
      allowSensitiveFields: config?.allowSensitiveFields === true,
    },
  };
}

function buildRuleReport(departmentId: number, period: string, summary: Awaited<ReturnType<typeof buildSummary>>, fallbackError?: string): AiMonthlyReport {
  const metrics: Record<string, AiReportMetric> = {
    demands: metric("demands", "需求总量", summary.totalDemands),
    completed: metric("completed", "完成量", summary.completedDemands),
    completion_rate: metric("completion_rate", "完成率", Math.round(summary.completionRate * 100), "%"),
    delay_rate: metric("delay_rate", "延期率", Math.round(summary.delayRate * 100), "%"),
    avg_cycle_days: metric("avg_cycle_days", "总交付时长", Math.round(summary.avgCycleDays * 10) / 10, "天"),
    avg_response_hours: metric("avg_response_hours", "响应时长", Math.round(summary.avgResponseHours * 10) / 10, "小时"),
    avg_processing_hours: metric("avg_processing_hours", "处理时长", Math.round(summary.avgProcessingHours * 10) / 10, "小时"),
    score_avg: metric("score_avg", "平均评分", Math.round(summary.scoreAvg * 100) / 100, "分"),
  };
  const chapters: AiReportChapter[] = [
    {
      id: "overview",
      title: "一、本月概览",
      paragraphs: [{
        id: "overview-1",
        text: `${summary.departmentName}在 ${period} 服务月共录入 ${summary.totalDemands} 条需求，完成 ${summary.completedDemands} 条，完成率 ${Math.round(summary.completionRate * 100)}%。`,
        highlightMetricIds: ["demands", "completed", "completion_rate"],
      }],
    },
    {
      id: "efficiency",
      title: "二、交付效率分析",
      paragraphs: [{
        id: "efficiency-1",
        text: `平均响应时长约 ${metrics.avg_response_hours.value} 小时，平均处理时长约 ${metrics.avg_processing_hours.value} 小时，总交付时长约 ${metrics.avg_cycle_days.value} 天。`,
        highlightMetricIds: ["avg_response_hours", "avg_processing_hours", "avg_cycle_days"],
      }],
    },
    {
      id: "suggestions",
      title: "三、风险与改进建议",
      paragraphs: [{
        id: "suggestions-1",
        text: summary.delayRate > 0.2
          ? "延期率偏高，建议优先检查需求拆分、排期确认和跨部门反馈等待时间。"
          : "整体延期风险相对可控，建议继续沉淀高频需求模板，减少重复沟通成本。",
        highlightMetricIds: ["delay_rate"],
      }],
    },
  ];

  return {
    departmentId: String(departmentId),
    departmentName: summary.departmentName,
    scopeType: "department",
    scopeId: String(departmentId),
    period,
    reportType: "部门月度绩效总结",
    mode: "rule",
    status: fallbackError ? "fallback" : "success",
    error: fallbackError || null,
    generatedAt: new Date().toISOString(),
    summaryKeywords: fallbackError ? ["AI 失败已回退", "规则报告"] : ["规则报告"],
    chapters,
    metrics,
  };
}

async function tryGenerateAiText(summary: Awaited<ReturnType<typeof buildSummary>>, period: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const toneMap: Record<string, string> = {
    neutral: "客观中性",
    direct: "直接指出问题和风险",
    encouraging: "鼓励改进，语气积极",
  };
  const lengthMap: Record<string, string> = {
    short: "简短，控制在 600 字以内",
    standard: "标准，控制在 1000 字以内",
    detailed: "详细，允许展开到 1600 字以内",
  };
  const prompt = `请基于以下结构化数据生成中文部门月报分析。语气：${toneMap[summary.reportConfig.tone] || toneMap.neutral}；长度：${lengthMap[summary.reportConfig.length] || lengthMap.standard}；敏感字段策略：${summary.reportConfig.allowSensitiveFields ? "可使用摘要中的字段值" : "不要展开敏感明细，只使用聚合摘要"}。必须包含：本月概览、关键指标解读、需求类型分析、客户/项目分析、交付效率分析、评分与满意度分析、异常与风险、改进建议、下月关注事项。旧字段客户/项目仅作为历史字段展示，不视为正式客户主数据。数据：${JSON.stringify({ period, summary })}`;
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_REPORT_MODEL || "gpt-4.1-mini",
      input: prompt,
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI request failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  const output = (json.output_text as string | undefined)
    || (Array.isArray(json.output) ? json.output.flatMap((item: any) => item.content || []).map((c: any) => c.text || "").join("\n") : "");
  if (!output.trim()) {
    throw new Error("OpenAI response is empty");
  }
  return output.trim();
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) return authResult.errorResponse;
    const activeError = ensureActiveUser(authResult.user);
    if (activeError) return activeError;

    const body = await req.json().catch(() => ({}));
    const config = body.config && typeof body.config === "object" ? (body.config as Record<string, any>) : {};
    const requestedDepartmentId = Number.parseInt(String(body.departmentId || authResult.user?.departmentId || ""), 10);
    if (Number.isNaN(requestedDepartmentId) || requestedDepartmentId <= 0) {
      return NextResponse.json({ error: "departmentId is required" }, { status: 400 });
    }
    if (authResult.user?.role !== "admin" && authResult.user?.departmentId !== requestedDepartmentId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const period = normalizePeriod(body.period);
    const summary = await buildSummary(requestedDepartmentId, period, config);
    let report = buildRuleReport(requestedDepartmentId, period, summary);

    if (body.mode !== "rule" && config.aiEnabled !== false) {
      try {
        const aiText = await tryGenerateAiText(summary, period);
        report = {
          ...report,
          mode: "llm",
          status: "success",
          error: null,
          summaryKeywords: ["AI 分析", "月度复盘"],
          chapters: [{
            id: "ai-analysis",
            title: "AI 月度分析",
            paragraphs: [{
              id: "ai-analysis-1",
              text: aiText,
              highlightMetricIds: ["demands", "completion_rate", "avg_response_hours", "score_avg"],
            }],
          }],
        };
      } catch (aiError: any) {
        report = buildRuleReport(requestedDepartmentId, period, summary, aiError?.message ?? String(aiError));
      }
    }

    await supabaseAdmin.from("ai_reports").insert({
      department_id: requestedDepartmentId,
      scope_type: "department",
      scope_id: requestedDepartmentId,
      period,
      report_type: report.reportType,
      mode: report.mode,
      status: report.status || "success",
      error: report.error || null,
      generated_by_user_id: authResult.user!.id,
      generated_at: report.generatedAt,
      content: JSON.stringify(report),
    });

    return NextResponse.json({ report });
  } catch (error: any) {
    console.error("[api/ai-reports/monthly/generate] unexpected error", error);
    return NextResponse.json({ error: "failed_to_generate_ai_report", detail: error?.message ?? String(error) }, { status: 500 });
  }
}
