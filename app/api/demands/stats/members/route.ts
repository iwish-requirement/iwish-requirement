import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest } from "../../../../../lib/serverAuth";
import { ensureHasPermission } from "../../../../../lib/serverPermissions";
import { buildDemandStatusGroups } from "../../../../../lib/demandStatusGroups";
import { inferDemandDeliveryCounts } from "../../../../../lib/demandDeliveryStats";
import { resolveStatsScopeForUser } from "../../../../../lib/statScope";


export const runtime = "edge";

interface DepartmentMemberStat {
  userId: number;
  userName: string;
  userEmail: string | null;
  role: string | null;
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
    const period = getPeriodFromQuery(url);
    const { start, end } = getPeriodRange(period);

    const scopeResult = resolveStatsScopeForUser(authResult.user, url.searchParams.get("departmentId"), {
      requireDepartment: true,
    });
    if (scopeResult.errorResponse) {
      return scopeResult.errorResponse;
    }
    const departmentId = scopeResult.scope!.departmentId!;

    const [demandsResult, usersResult, scoreRecordsResult, departmentResult] = await Promise.all([
      supabaseAdmin
        .from("demands")
        .select("id, assignee_id, status, created_at, finished_at, fields")
        .eq("department_id", departmentId)
        .gte("created_at", start)
        .lt("created_at", end),
      supabaseAdmin
        .from("users")
        .select("id, name, email, role")
        .eq("department_id", departmentId),
      supabaseAdmin
        .from("score_records")
        .select("target_user_id, scores, period, department_id")
        .eq("period", period)
        .eq("department_id", departmentId),
      supabaseAdmin
        .from("departments")
        .select("status_config")
        .eq("id", departmentId)
        .maybeSingle(),
    ] as const);

    if (demandsResult.error) {
      console.error("[api/demands/stats/members] demands query error", demandsResult.error);
      return NextResponse.json(
        { error: "failed_to_load_demands", detail: demandsResult.error.message },
        { status: 500 },
      );
    }

    if (usersResult.error) {
      console.error("[api/demands/stats/members] users query error", usersResult.error);
      return NextResponse.json(
        { error: "failed_to_load_users", detail: usersResult.error.message },
        { status: 500 },
      );
    }

    if (scoreRecordsResult.error) {
      console.error("[api/demands/stats/members] score_records query error", scoreRecordsResult.error);
      return NextResponse.json(
        { error: "failed_to_load_scores", detail: scoreRecordsResult.error.message },
        { status: 500 },
      );
    }

    if (departmentResult.error) {
      console.error("[api/demands/stats/members] department query error", departmentResult.error);
      return NextResponse.json(
        { error: "failed_to_load_department", detail: departmentResult.error.message },
        { status: 500 },
      );
    }

    const demandRows = (demandsResult.data || []) as {
      id: number;
      assignee_id: number | null;
      status: string;
      created_at: string | null;
      finished_at: string | null;
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
        console.error("[api/demands/stats/members] attachments query error", attachmentError);
        return NextResponse.json(
          { error: "failed_to_load_attachments", detail: attachmentError.message },
          { status: 500 },
        );
      }

      for (const attachment of (attachmentRows || []) as { demand_id: number | null }[]) {
        if (typeof attachment.demand_id !== "number") {
          continue;
        }
        attachmentCountByDemand.set(
          attachment.demand_id,
          (attachmentCountByDemand.get(attachment.demand_id) || 0) + 1,
        );
      }
    }

    const userRows = (usersResult.data || []) as {
      id: number;
      name: string | null;
      email: string | null;
      role: string | null;
    }[];

    const scoreRows = (scoreRecordsResult.data || []) as {
      target_user_id: number;
      scores: any;
      period: string;
      department_id: number | null;
    }[];
    const statusGroups = buildDemandStatusGroups(
      departmentResult.data ? [departmentResult.data as { status_config?: unknown }] : [],
    );

    type MemberAccumulator = {
      demandsAssignee: number;
      demandsCompleted: number;
      materialCount: number;
      imageMaterialCount: number;
      videoMaterialCount: number;
      pageCount: number;
      cycleDurations: number[];
      scoreValues: number[];
    };

    const acc = new Map<number, MemberAccumulator>();

    for (const row of demandRows) {
      if (!row.assignee_id) continue;
      const userId = row.assignee_id;
      let bucket = acc.get(userId);
      if (!bucket) {
        bucket = {
          demandsAssignee: 0,
          demandsCompleted: 0,
          materialCount: 0,
          imageMaterialCount: 0,
          videoMaterialCount: 0,
          pageCount: 0,
          cycleDurations: [],
          scoreValues: [],
        };
        acc.set(userId, bucket);
      }

      bucket.demandsAssignee += 1;
      const deliveryCounts = inferDemandDeliveryCounts(row.fields, attachmentCountByDemand.get(row.id) ?? 0);
      bucket.materialCount += deliveryCounts.materialCount;
      bucket.imageMaterialCount += deliveryCounts.imageMaterialCount;
      bucket.videoMaterialCount += deliveryCounts.videoMaterialCount;
      bucket.pageCount += deliveryCounts.pageCount;

      const status = (row.status || "").toLowerCase();
      if (statusGroups.completed.includes(status)) {
        bucket.demandsCompleted += 1;
      }

      if (row.created_at && row.finished_at) {
        const createdAt = new Date(row.created_at).getTime();
        const finishedAt = new Date(row.finished_at).getTime();
        if (Number.isFinite(createdAt) && Number.isFinite(finishedAt) && finishedAt >= createdAt) {
          const days = (finishedAt - createdAt) / (1000 * 60 * 60 * 24);
          bucket.cycleDurations.push(days);
        }
      }
    }

    for (const record of scoreRows) {
      const userId = record.target_user_id;
      let bucket = acc.get(userId);
      if (!bucket) {
        bucket = {
          demandsAssignee: 0,
          demandsCompleted: 0,
          materialCount: 0,
          imageMaterialCount: 0,
          videoMaterialCount: 0,
          pageCount: 0,
          cycleDurations: [],
          scoreValues: [],
        };
        acc.set(userId, bucket);
      }

      const payload = record.scores as any;
      if (!payload || typeof payload !== "object") {
        continue;
      }
      for (const value of Object.values(payload)) {
        const num = typeof value === "number" ? value : Number(value);
        if (Number.isFinite(num)) {
          bucket.scoreValues.push(num);
        }
      }
    }

    const userMap = new Map<number, { id: number; name: string | null; email: string | null; role: string | null }>();
    for (const user of userRows) {
      if (typeof user.id === "number") {
        userMap.set(user.id, user);
      }
    }

    const items: DepartmentMemberStat[] = [];

    for (const [userId, bucket] of acc.entries()) {
      const user = userMap.get(userId) ?? null;
      const avgCycleDays = bucket.cycleDurations.length
        ? bucket.cycleDurations.reduce((sum, v) => sum + v, 0) / bucket.cycleDurations.length
        : 0;
      const scoreAvg = bucket.scoreValues.length
        ? bucket.scoreValues.reduce((sum, v) => sum + v, 0) / bucket.scoreValues.length
        : 0;

      const userName = (user?.name || user?.email || "未命名用户").toString();

      items.push({
        userId,
        userName,
        userEmail: (user?.email ?? null) as string | null,
        role: (user?.role ?? null) as string | null,
        demandsAssignee: bucket.demandsAssignee,
        demandsCompleted: bucket.demandsCompleted,
        materialCount: bucket.materialCount,
        imageMaterialCount: bucket.imageMaterialCount,
        videoMaterialCount: bucket.videoMaterialCount,
        pageCount: bucket.pageCount,
        avgCycleDays,
        scoreAvg,
        scoreCount: bucket.scoreValues.length,
      });
    }

    items.sort((a, b) => b.demandsCompleted - a.demandsCompleted);

    return NextResponse.json({ items });
  } catch (error: any) {
    console.error("[api/demands/stats/members] unexpected error", error);
    return NextResponse.json(
      {
        error: "failed_to_load_member_stats",
        detail: error?.message ?? String(error),
      },
      { status: 500 },
    );
  }
}
