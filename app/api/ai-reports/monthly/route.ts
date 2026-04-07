import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../lib/serverAuth";
import {
  AiMonthlyReport,
  AiReportChapter,
  AiReportMetric,
} from "../../../../types";

export const runtime = "edge";

type DemandRow = {
  id: number;
  created_at: string | null;
  finished_at: string | null;
};

type ScoreTaskRow = {
  id: number;
  status: string | null;
};

type ScoreRecordRow = {
  id: number;
  scores: any;
};

type DepartmentRow = {
  id: number;
  name: string | null;
};

function getPreviousMonthPeriod(now: Date): string {
  const year = now.getFullYear();
  const monthIndex = now.getMonth() - 1;
  const previous = new Date(year, monthIndex, 1);
  const y = previous.getFullYear();
  const m = `${previous.getMonth() + 1}`.padStart(2, "0");
  return `${y}-${m}`;
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

function formatPeriodLabel(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period.trim());
  if (!match) {
    return period;
  }
  const year = match[1];
  const month = match[2].replace(/^0/, "");
  return `${year}年${month}月`;
}

async function buildRuleBasedMonthlyReport(
  departmentId: number,
  period: string,
): Promise<AiMonthlyReport> {
  const { from, to } = getPeriodRange(period);
  const now = new Date();
  const generatedAt = now.toISOString();

  const [demandsResult, tasksResult, recordsResult, departmentResult] = await Promise.all([
    supabaseAdmin
      .from("demands")
      .select("id, created_at, finished_at")
      .eq("department_id", departmentId)
      .gte("created_at", from)
      .lt("created_at", to)
      .returns<DemandRow[]>(),
    supabaseAdmin
      .from("score_tasks")
      .select("id, status")
      .eq("department_id", departmentId)
      .eq("period", period)
      .returns<ScoreTaskRow[]>(),
    supabaseAdmin
      .from("score_records")
      .select("id, scores")
      .eq("department_id", departmentId)
      .eq("period", period)
      .returns<ScoreRecordRow[]>(),
    supabaseAdmin
      .from("departments")
      .select("id, name")
      .eq("id", departmentId)
      .maybeSingle<DepartmentRow>(),
  ]);

  if (demandsResult.error) {
    console.error("[api/ai-reports/monthly] load demands error", demandsResult.error);
  }
  if (tasksResult.error) {
    console.error("[api/ai-reports/monthly] load score_tasks error", tasksResult.error);
  }
  if (recordsResult.error) {
    console.error("[api/ai-reports/monthly] load score_records error", recordsResult.error);
  }
  if (departmentResult.error) {
    console.error("[api/ai-reports/monthly] load department error", departmentResult.error);
  }

  const demands: DemandRow[] = Array.isArray(demandsResult.data) ? demandsResult.data : [];
  const tasks: ScoreTaskRow[] = Array.isArray(tasksResult.data) ? tasksResult.data : [];
  const records: ScoreRecordRow[] = Array.isArray(recordsResult.data) ? recordsResult.data : [];
  const department: DepartmentRow | null = (departmentResult.data as DepartmentRow | null) ?? null;

  const totalDemands = demands.length;
  const closedDemands = demands.filter((row) => {
    if (!row.finished_at) {
      return false;
    }
    const finishedAt = row.finished_at;
    return finishedAt >= from && finishedAt < to;
  }).length;

  const demandDeliveryRate = totalDemands > 0
    ? Math.round((closedDemands / totalDemands) * 100)
    : 0;

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => {
    const status = (task.status ?? "").toString().toLowerCase();
    return status === "completed";
  }).length;
  const scoringCompletionRate = totalTasks > 0
    ? Math.round((completedTasks / totalTasks) * 100)
    : 0;

  let totalCycleDays = 0;
  let cycleCount = 0;

  for (const demand of demands) {
    if (!demand.created_at || !demand.finished_at) {
      continue;
    }
    const finishedAtRaw = demand.finished_at;
    if (finishedAtRaw < from || finishedAtRaw >= to) {
      continue;
    }
    const createdAt = new Date(demand.created_at);
    const finishedAt = new Date(finishedAtRaw);
    if (Number.isNaN(createdAt.getTime()) || Number.isNaN(finishedAt.getTime())) {
      continue;
    }
    const diffMs = finishedAt.getTime() - createdAt.getTime();
    if (!Number.isFinite(diffMs) || diffMs <= 0) {
      continue;
    }
    const days = diffMs / (1000 * 60 * 60 * 24);
    totalCycleDays += days;
    cycleCount += 1;
  }

  const avgCycleDays = cycleCount > 0 ? totalCycleDays / cycleCount : 0;
  const avgCycleDaysRounded = avgCycleDays > 0 ? Math.round(avgCycleDays * 10) / 10 : 0;

  let scoreSum = 0;
  let scoreCount = 0;

  for (const record of records) {
    const scores = record.scores as Record<string, unknown> | null;
    if (!scores || typeof scores !== "object") {
      continue;
    }
    for (const value of Object.values(scores)) {
      const num = typeof value === "number" ? value : Number(value);
      if (Number.isFinite(num)) {
        scoreSum += num;
        scoreCount += 1;
      }
    }
  }

  const avgScore = scoreCount > 0 ? scoreSum / scoreCount : 0;
  const satisfaction = scoreCount > 0 ? Math.round(avgScore * 10) / 10 : 0;

  const scoreRecordsCount = records.length;
  const scoringCoverageRate = totalTasks > 0
    ? Math.round((scoreRecordsCount / totalTasks) * 100)
    : 0;

  const metrics: Record<string, AiReportMetric> = {
    satisfaction: {
      id: "satisfaction",
      label: "整体满意度",
      value: satisfaction,
      unit: "/5",
    },
    ontime_rate: {
      id: "ontime_rate",
      label: "按期交付率",
      value: demandDeliveryRate,
      unit: "%",
    },
    scoring_completion: {
      id: "scoring_completion",
      label: "评分完成率",
      value: scoringCompletionRate,
      unit: "%",
    },
    scoring_coverage: {
      id: "scoring_coverage",
      label: "评分覆盖率",
      value: scoringCoverageRate,
      unit: "%",
    },
    avg_cycle_days: {
      id: "avg_cycle_days",
      label: "平均处理周期",
      value: avgCycleDaysRounded,
      unit: "天",
    },
    demands_closed: {
      id: "demands_closed",
      label: "本月关闭需求数",
      value: closedDemands,
    },
  };


  const summaryKeywordsSet = new Set<string>();

  if (satisfaction >= 4.5) {
    summaryKeywordsSet.add("满意度表现优秀");
  } else if (satisfaction >= 4) {
    summaryKeywordsSet.add("整体满意度良好");
  } else if (satisfaction > 0) {
    summaryKeywordsSet.add("满意度有提升空间");
  }

  if (demandDeliveryRate >= 90) {
    summaryKeywordsSet.add("交付节奏健康");
  } else if (demandDeliveryRate > 0) {
    summaryKeywordsSet.add("按期交付有波动");
  }

  if (scoringCompletionRate >= 90) {
    summaryKeywordsSet.add("评分执行较为充分");
  } else if (scoringCompletionRate > 0) {
    summaryKeywordsSet.add("评分完成率偏低");
  }

  if (scoringCoverageRate >= 80) {
    summaryKeywordsSet.add("评分覆盖率较高");
  } else if (scoringCoverageRate > 0 && scoringCoverageRate < 60) {
    summaryKeywordsSet.add("评分覆盖率偏低");
  }

  if (avgCycleDaysRounded > 0) {
    if (avgCycleDaysRounded <= 3) {
      summaryKeywordsSet.add("交付效率较高");
    } else if (avgCycleDaysRounded <= 7) {
      summaryKeywordsSet.add("交付周期适中");
    } else {
      summaryKeywordsSet.add("交付周期偏长");
    }
  }

  if (closedDemands >= 30) {
    summaryKeywordsSet.add("需求交付量较高");
  } else if (closedDemands > 0) {
    summaryKeywordsSet.add("需求交付较为平稳");
  }

  const summaryKeywords = Array.from(summaryKeywordsSet);


  const periodLabel = formatPeriodLabel(period);

  const overviewTextParts: string[] = [];
  overviewTextParts.push(
    `${periodLabel}（服务月），部门整体运行${
      satisfaction >= 4 ? "整体表现良好" : satisfaction > 0 ? "相对平稳" : "较为平稳"
    }。`,
  );


  if (totalDemands > 0) {
    overviewTextParts.push(
      `本月共受理需求 ${totalDemands} 项，其中已关闭 ${closedDemands} 项，按期交付率约为 ${demandDeliveryRate}% 。`,
    );
  } else {
    overviewTextParts.push("本月暂未录入新的需求，建议结合业务节奏评估是否存在漏报情况。");
  }

  if (satisfaction > 0) {
    overviewTextParts.push(`综合满意度约为 ${satisfaction.toFixed(1)} 分（满分 5 分）。`);
  }

  if (avgCycleDaysRounded > 0) {
    overviewTextParts.push(
      `在交付节奏上，已完成需求的平均处理周期约为 ${avgCycleDaysRounded.toFixed(1)} 天。`,
    );
  }


  const overviewParagraphText = overviewTextParts.join("");

  let scoringText: string;
  if (totalTasks > 0) {
    scoringText = `本月共生成 ${totalTasks} 条评分任务，已完成 ${completedTasks} 条，评分完成率约为 ${scoringCompletionRate}% ，评分覆盖率约为 ${scoringCoverageRate}% 。`;
    if (scoringCompletionRate >= 90 && scoringCoverageRate >= 80) {
      scoringText += "评分执行较为及时，整体反馈节奏健康。";
    } else if (scoringCompletionRate >= 70) {
      scoringText += "部分评分任务存在尾部滞后，建议后续加强提醒与跟进。";
    } else {
      scoringText += "评分完成率偏低，建议梳理评分对象与窗口安排，避免影响整体评价质量。";
    }
  } else {
    scoringText = "本月尚未生成评分任务，可能与需求量或评分规则配置有关，建议在下一周期启动前完成配置确认。";
  }


  let deliveryText: string;
  if (closedDemands > 0) {
    const shareText = totalDemands > 0 ? `约占录入需求的 ${demandDeliveryRate}%` : "";
    deliveryText = `在交付与质量方面，本月关闭需求 ${closedDemands} 项，${shareText}`;
    if (avgCycleDaysRounded > 0) {
      deliveryText += `，平均处理周期约为 ${avgCycleDaysRounded.toFixed(1)} 天。`;
    } else {
      deliveryText += "。";
    }
    deliveryText += "整体交付节奏基本可控，建议在保持效率的同时关注需求拆分与排期，避免月底集中交付带来的风险。";
  } else {
    deliveryText = "本月暂无已关闭的需求记录，建议尽快梳理在途事项并明确预期完结时间，以降低长期拖延对业务的影响。";
  }


  const chapters: AiReportChapter[] = [
    {
      id: "overview",
      title: "一、本月整体概览",
      paragraphs: [
        {
          id: "overview-1",
          text: overviewParagraphText,
          highlightMetricIds: ["satisfaction", "ontime_rate", "avg_cycle_days"],
        },
      ],
    },

    {
      id: "scoring",
      title: "二、评分执行情况",
      paragraphs: [
        {
          id: "scoring-1",
          text: scoringText,
          highlightMetricIds: ["scoring_completion", "scoring_coverage"],
        },
      ],
    },

    {
      id: "delivery",
      title: "三、交付与质量",
      paragraphs: [
        {
          id: "delivery-1",
          text: deliveryText,
          highlightMetricIds: ["demands_closed", "avg_cycle_days"],
        },
      ],
    },

  ];

  const departmentName = (department?.name ?? "").toString().trim() || "部门";

  const report: AiMonthlyReport = {
    departmentId: String(departmentId),
    departmentName,
    period,
    reportType: "部门月度绩效总结",
    mode: "rule",
    generatedAt,
    summaryKeywords,
    chapters,
    metrics,
  };

  return report;
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
    const deptParam = url.searchParams.get("departmentId");

    let departmentId: number | null = (currentUser.departmentId as number | null) ?? null;
    let requestedDepartmentId: number | null = null;

    if (deptParam && deptParam.trim()) {
      const parsed = Number.parseInt(deptParam.trim(), 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        requestedDepartmentId = parsed;
      }
    }

    if (requestedDepartmentId !== null) {
      if (currentUser.role === "admin") {
        departmentId = requestedDepartmentId;
      } else if (!departmentId || requestedDepartmentId !== departmentId) {
        return NextResponse.json(
          {
            error: "forbidden",
            detail: "您没有权限查看其他部门的 AI 月度报告",
          },
          { status: 403 },
        );
      }
    }

    if (!departmentId) {

      return NextResponse.json(
        {
          error: "no_department",
          detail: "当前账号未绑定部门，无法加载部门 AI 月度报告",
        },
        { status: 400 },
      );
    }

    const now = new Date();
    const normalizedPeriod =
      periodParam && /^\d{4}-\d{2}$/.test(periodParam.trim())
        ? periodParam.trim()
        : getPreviousMonthPeriod(now);

    const canSwitchDepartment = currentUser.role === "admin";

    let departmentOptions: { id: number; name: string }[] = [];

    if (canSwitchDepartment) {
      try {
        const { data: deptData, error: deptError } = await supabaseAdmin
          .from("departments")
          .select("id, name")
          .order("id", { ascending: true });

        if (deptError) {
          console.error("[api/ai-reports/monthly] load departments for admin error", deptError);
        } else if (Array.isArray(deptData)) {
          departmentOptions = deptData.map((row) => ({
            id: row.id as number,
            name: ((row.name as string | null) ?? "").toString() || "未命名部门",
          }));
        }
      } catch (loadDeptError) {
        console.error("[api/ai-reports/monthly] unexpected load departments error", loadDeptError);
      }
    }

    const reportType = "部门月度绩效总结";


    let existingReport: AiMonthlyReport | null = null;

    try {
      const { data, error } = await supabaseAdmin
        .from("ai_reports")
        .select("id, content, report_type")
        .eq("department_id", departmentId)
        .eq("period", normalizedPeriod)
        .eq("report_type", reportType)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ id: number; content: string; report_type: string }>();

      if (error) {
        console.error("[api/ai-reports/monthly] load ai_reports error", error);
      }

      if (data && typeof data.content === "string") {
        try {
          existingReport = JSON.parse(data.content) as AiMonthlyReport;
        } catch (parseError) {
          console.error("[api/ai-reports/monthly] parse existing content error", parseError);
        }
      }
    } catch (error) {
      console.error("[api/ai-reports/monthly] load ai_reports unexpected error", error);
    }

    let report: AiMonthlyReport;

    if (existingReport) {
      report = existingReport;
    } else {
      report = await buildRuleBasedMonthlyReport(departmentId, normalizedPeriod);

      try {
        const insertResult = await supabaseAdmin.from("ai_reports").insert({
          department_id: departmentId,
          period: normalizedPeriod,
          report_type: reportType,
          content: JSON.stringify(report),
        });

        if (insertResult.error) {
          console.error("[api/ai-reports/monthly] insert ai_reports error", insertResult.error);
        }
      } catch (error) {
        console.error("[api/ai-reports/monthly] insert ai_reports unexpected error", error);
      }
    }

    return NextResponse.json(
      {
        report,
        meta: {
          period: normalizedPeriod,
          departmentId,
          canSwitchDepartment,
          departments: departmentOptions,
        },
      },
      {
        headers: {
          "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
        },
      },
    );

  } catch (error: any) {
    console.error("[api/ai-reports/monthly] GET unexpected error", error);
    return NextResponse.json(
      {
        error: "failed_to_load_ai_monthly_report",
        detail: error?.message ?? String(error),
      },
      { status: 500 },
    );
  }
}
