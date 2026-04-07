import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest } from "../../../../lib/serverAuth";
import { ensureHasPermission } from "../../../../lib/serverPermissions";


export const runtime = "edge";

type ScoreRecordRow = {
  target_user_id: number;
  department_id: number;
  period: string;
  scores: any;
};

type UserRow = {
  id: number;
  name: string | null;
  email: string | null;
  department_id: number | null;
};

type DepartmentRow = {
  id: number;
  name: string | null;
};

type ScoreUserStat = {
  targetUserId: number;
  targetUserName: string;
  targetUserEmail: string | null;
  departmentName: string | null;
  avgScore: number;
  recordsCount: number;
};

export async function GET(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const permError = await ensureHasPermission(authResult.user, "stats.scores");
    if (permError) {
      return permError;
    }


    const url = new URL(req.url);
    const periodParam = url.searchParams.get("period");

    let query = supabaseAdmin
      .from("score_records")
      .select("target_user_id, department_id, period, scores");

    if (periodParam && periodParam.trim()) {
      query = query.eq("period", periodParam.trim());
    }

    const { data: records, error } = await query.returns<ScoreRecordRow[]>();

    if (error) {
      console.error("[api/scores/statistics] load records error", error);
      return NextResponse.json(
        { error: "failed_to_load_scores", detail: error.message },
        { status: 500 },
      );
    }

    const rows = records ?? [];
    if (!rows.length) {
      return NextResponse.json({ items: [] as ScoreUserStat[] });
    }

    const aggregate = new Map<
      number,
      { totalScore: number; recordCount: number; departmentId: number | null }
    >();

    for (const record of rows) {
      if (!record.target_user_id) {
        continue;
      }

      const scoresPayload = record.scores as any;
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

      const recordAvg =
        values.reduce((sum, v) => sum + v, 0) / Math.max(values.length, 1);

      const existing = aggregate.get(record.target_user_id) ?? {
        totalScore: 0,
        recordCount: 0,
        departmentId: null as number | null,
      };

      existing.totalScore += recordAvg;
      existing.recordCount += 1;
      if (!existing.departmentId && record.department_id) {
        existing.departmentId = record.department_id;
      }

      aggregate.set(record.target_user_id, existing);
    }

    if (!aggregate.size) {
      return NextResponse.json({ items: [] as ScoreUserStat[] });
    }

    const targetUserIds = Array.from(aggregate.keys());

    const { data: users, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id, name, email, department_id")
      .in("id", targetUserIds)
      .returns<UserRow[]>();

    if (usersError) {
      console.error("[api/scores/statistics] load users error", usersError);
      return NextResponse.json(
        { error: "failed_to_load_scores", detail: usersError.message },
        { status: 500 },
      );
    }

    const userMap = new Map<number, UserRow>();
    for (const user of users ?? []) {
      if (typeof user.id === "number") {
        userMap.set(user.id, user);
      }
    }

    const departmentIds = Array.from(
      new Set(
        (users ?? [])
          .map((u) => u.department_id)
          .filter((id): id is number => typeof id === "number" && id > 0),
      ),
    );

    const departmentsResult = departmentIds.length
      ? await supabaseAdmin
          .from("departments")
          .select("id, name")
          .in("id", departmentIds)
          .returns<DepartmentRow[]>()
      : { data: [] as DepartmentRow[], error: null };

    if (departmentsResult.error) {
      console.error(
        "[api/scores/statistics] load departments error",
        departmentsResult.error,
      );
      return NextResponse.json(
        { error: "failed_to_load_scores", detail: departmentsResult.error.message },
        { status: 500 },
      );
    }

    const deptMap = new Map<number, DepartmentRow>();
    for (const dept of departmentsResult.data ?? []) {
      if (typeof dept.id === "number") {
        deptMap.set(dept.id, dept);
      }
    }

    const items: ScoreUserStat[] = [];

    for (const [userId, agg] of aggregate.entries()) {
      const user = userMap.get(userId) ?? null;
      const dept = agg.departmentId ? deptMap.get(agg.departmentId) ?? null : null;

      if (!agg.recordCount) {
        continue;
      }

      const avgScore = agg.totalScore / agg.recordCount;

      const nameCandidate =
        (user?.name ?? "").toString().trim() ||
        (user?.email ?? "").toString().trim() ||
        "未命名用户";

      items.push({
        targetUserId: userId,
        targetUserName: nameCandidate,
        targetUserEmail: (user?.email ?? null) as string | null,
        departmentName: (dept?.name ?? null) as string | null,
        avgScore,
        recordsCount: agg.recordCount,
      });
    }

    items.sort((a, b) => b.avgScore - a.avgScore);

    return NextResponse.json(
      { items },
      {
        headers: {
          "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
        },
      },
    );
  } catch (error: any) {
    console.error("[api/scores/statistics] unexpected error", error);
    return NextResponse.json(
      {
        error: "failed_to_load_scores",
        detail: error?.message ?? String(error),
      },
      { status: 500 },
    );
  }
}
