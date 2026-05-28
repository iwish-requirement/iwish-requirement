import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest } from "../../../../lib/serverAuth";
import { ensureHasPermission } from "../../../../lib/serverPermissions";
import { buildDemandStatusGroups } from "../../../../lib/demandStatusGroups";
import { inferDemandDeliveryCounts } from "../../../../lib/demandDeliveryStats";
import { resolveStatsScopeForUser } from "../../../../lib/statScope";


export const runtime = "edge";

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

interface MemberMetrics {
  demandsAssignee: number;
  demandsCompleted: number;
  materialCount: number;
  imageMaterialCount: number;
  videoMaterialCount: number;
  pageCount: number;
  avgCycleDays: number;
  scoreAvg: number;
  scoreCount: number;
}

interface MemberStatRow extends MemberMetrics {
  userId: number;
  userName: string;
  userEmail: string | null;
  role: string | null;
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const permError = await ensureHasPermission(authResult.user, "stats.department_members");
    if (permError) {
      return permError;
    }


    const url = new URL(req.url);
    const periodParam = url.searchParams.get("period");
    const departmentIdParam = url.searchParams.get("departmentId");

    const scopeResult = resolveStatsScopeForUser(authResult.user, departmentIdParam, {
      requireDepartment: true,
    });
    if (scopeResult.errorResponse) {
      return scopeResult.errorResponse;
    }
    const departmentId = scopeResult.scope!.departmentId!;

    const normalizedPeriod = periodParam && /^\d{4}-\d{2}$/.test(periodParam.trim())
      ? periodParam.trim()
      : null;

    const { from, to } = parsePeriodToRange(normalizedPeriod);

    const demandsQuery = supabaseAdmin
      .from("demands")
      .select("id, assignee_id, created_at, finished_at, status, fields")
      .eq("department_id", departmentId)
      .gte("created_at", from)
      .lt("created_at", to);

    const scoresQuery = supabaseAdmin
      .from("score_records")
      .select("target_user_id, department_id, period, scores")
      .eq("department_id", departmentId);

    if (normalizedPeriod) {
      scoresQuery.eq("period", normalizedPeriod);
    }

    const [demandsResult, scoresResult, departmentResult] = await Promise.all([
      demandsQuery,
      scoresQuery,
      supabaseAdmin
        .from("departments")
        .select("status_config")
        .eq("id", departmentId)
        .maybeSingle(),
    ]);

    if (demandsResult.error || scoresResult.error || departmentResult.error) {
      console.error("[api/statistics/department-members] query error", {
        demandsError: demandsResult.error,
        scoresError: scoresResult.error,
        departmentError: departmentResult.error,
      });
      return NextResponse.json(
        { error: "failed_to_load_department_member_stats" },
        { status: 500 },
      );
    }

    const memberMetricsMap = new Map<number, MemberMetrics>();

    const demandRows = (demandsResult.data ?? []) as {
      id: number;
      assignee_id: number | null;
      created_at: string | null;
      finished_at: string | null;
      status: string | null;
      fields: unknown;
    }[];

    const demandIds = demandRows
      .map((row) => row.id)
      .filter((id): id is number => typeof id === "number" && Number.isFinite(id) && id > 0);
    const attachmentCountByDemand = new Map<number, number>();
    if (demandIds.length) {
      const { data: attachmentRows, error: attachmentError } = await supabaseAdmin
        .from("demand_attachments")
        .select("demand_id")
        .in("demand_id", demandIds);

      if (attachmentError) {
        console.error("[api/statistics/department-members] load attachments error", attachmentError);
        return NextResponse.json(
          { error: "failed_to_load_department_member_stats" },
          { status: 500 },
        );
      }

      for (const attachment of (attachmentRows ?? []) as { demand_id: number | null }[]) {
        if (typeof attachment.demand_id !== "number") {
          continue;
        }
        attachmentCountByDemand.set(
          attachment.demand_id,
          (attachmentCountByDemand.get(attachment.demand_id) ?? 0) + 1,
        );
      }
    }

    const statusGroups = buildDemandStatusGroups(
      departmentResult.data ? [departmentResult.data as { status_config?: unknown }] : [],
    );

    for (const row of demandRows) {
      if (typeof row.assignee_id !== "number" || row.assignee_id <= 0) {
        continue;
      }
      const userId = row.assignee_id;
      const existing = memberMetricsMap.get(userId) ?? {
        demandsAssignee: 0,
        demandsCompleted: 0,
        materialCount: 0,
        imageMaterialCount: 0,
        videoMaterialCount: 0,
        pageCount: 0,
        avgCycleDays: 0,
        scoreAvg: 0,
        scoreCount: 0,
      };

      existing.demandsAssignee += 1;
      const deliveryCounts = inferDemandDeliveryCounts(row.fields, attachmentCountByDemand.get(row.id) ?? 0);
      existing.materialCount += deliveryCounts.materialCount;
      existing.imageMaterialCount += deliveryCounts.imageMaterialCount;
      existing.videoMaterialCount += deliveryCounts.videoMaterialCount;
      existing.pageCount += deliveryCounts.pageCount;

      const statusValue = (row.status ?? "").toString().toLowerCase();
      if (statusGroups.completed.includes(statusValue)) {
        existing.demandsCompleted += 1;

        if (row.created_at && row.finished_at) {
          const createdAt = new Date(row.created_at);
          const finishedAt = new Date(row.finished_at);
          if (!Number.isNaN(createdAt.getTime()) && !Number.isNaN(finishedAt.getTime())) {
            const diffMs = finishedAt.getTime() - createdAt.getTime();
            if (Number.isFinite(diffMs) && diffMs > 0) {
              const days = diffMs / (1000 * 60 * 60 * 24);
              const previousTotalDays = existing.avgCycleDays * (existing.demandsCompleted - 1);
              const newTotalDays = previousTotalDays + days;
              existing.avgCycleDays = newTotalDays / existing.demandsCompleted;
            }
          }
        }
      }

      memberMetricsMap.set(userId, existing);
    }

    const scoreRows = (scoresResult.data ?? []) as {
      target_user_id: number | null;
      scores: any;
    }[];

    for (const row of scoreRows) {
      if (typeof row.target_user_id !== "number" || row.target_user_id <= 0) {
        continue;
      }
      const userId = row.target_user_id;
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

      const existing = memberMetricsMap.get(userId) ?? {
        demandsAssignee: 0,
        demandsCompleted: 0,
        materialCount: 0,
        imageMaterialCount: 0,
        videoMaterialCount: 0,
        pageCount: 0,
        avgCycleDays: 0,
        scoreAvg: 0,
        scoreCount: 0,
      };

      const previousTotalScore = existing.scoreAvg * existing.scoreCount;
      const newTotalScore = previousTotalScore + avgRecordScore;
      const newScoreCount = existing.scoreCount + 1;
      existing.scoreAvg = newTotalScore / newScoreCount;
      existing.scoreCount = newScoreCount;

      memberMetricsMap.set(userId, existing);
    }

    if (!memberMetricsMap.size) {
      return NextResponse.json({
        period: normalizedPeriod,
        departmentId,
        members: [],
      });
    }

    const userIds = Array.from(memberMetricsMap.keys());

    const { data: users, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id, name, email, role")
      .in("id", userIds);

    if (usersError) {
      console.error("[api/statistics/department-members] load users error", usersError);
      return NextResponse.json(
        { error: "failed_to_load_department_member_stats" },
        { status: 500 },
      );
    }

    const userMap = new Map<number, { id: number; name: string | null; email: string | null; role: string | null }>();
    for (const user of users ?? []) {
      const id = user.id as number;
      userMap.set(id, {
        id,
        name: (user.name as string | null) ?? null,
        email: (user.email as string | null) ?? null,
        role: (user.role as string | null) ?? null,
      });
    }

    const members: MemberStatRow[] = [];

    for (const [userId, metrics] of memberMetricsMap.entries()) {
      const user = userMap.get(userId) ?? null;
      members.push({
        userId,
        userName: (user?.name || "未命名成员") as string,
        userEmail: (user?.email ?? null) as string | null,
        role: (user?.role ?? null) as string | null,
        demandsAssignee: metrics.demandsAssignee,
        demandsCompleted: metrics.demandsCompleted,
        materialCount: metrics.materialCount,
        imageMaterialCount: metrics.imageMaterialCount,
        videoMaterialCount: metrics.videoMaterialCount,
        pageCount: metrics.pageCount,
        avgCycleDays: metrics.avgCycleDays,
        scoreAvg: metrics.scoreAvg,
        scoreCount: metrics.scoreCount,
      });
    }

    members.sort((a, b) => {
      if (b.demandsCompleted !== a.demandsCompleted) {
        return b.demandsCompleted - a.demandsCompleted;
      }
      if (b.demandsAssignee !== a.demandsAssignee) {
        return b.demandsAssignee - a.demandsAssignee;
      }
      return a.userName.localeCompare(b.userName);
    });

    return NextResponse.json({
      period: normalizedPeriod,
      departmentId,
      members,
    });
  } catch (error: any) {
    console.error("[api/statistics/department-members] unexpected error", error);
    return NextResponse.json(
      {
        error: "failed_to_load_department_member_stats",
        detail: error?.message ?? String(error),
      },
      { status: 500 },
    );
  }
}
