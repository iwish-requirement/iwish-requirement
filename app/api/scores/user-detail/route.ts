import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest } from "../../../../lib/serverAuth";
import { ensureHasPermission } from "../../../../lib/serverPermissions";


export const runtime = "edge";

type RawScoreRecordRow = {
  id: number;
  task_id: number;
  scorer_id: number;
  target_user_id: number;
  department_id: number | null;
  period: string;
  scores: any;
  comment: string | null;
  created_at: string | null;
};

type UserRow = {
  id: number;
  name: string | null;
  email: string | null;
};

type DepartmentRow = {
  id: number;
  name: string | null;
};

type ScoreDetailItem = {
  id: number;
  taskId: number;
  scorerId: number;
  scorerName: string;
  scorerEmail: string | null;
  departmentName: string | null;
  period: string;
  scores: Record<string, number>;
  avgScore: number;
  comment: string;
  createdAt: string | null;
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
    const targetUserIdParam = url.searchParams.get("targetUserId");
    const periodParam = url.searchParams.get("period");

    const targetUserId = targetUserIdParam ? Number.parseInt(targetUserIdParam, 10) : Number.NaN;
    if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
      return NextResponse.json(
        { error: "invalid_target_user_id", detail: "被评分人ID不合法" },
        { status: 400 },
      );
    }

    let query = supabaseAdmin
      .from("score_records")
      .select("id, task_id, scorer_id, target_user_id, department_id, period, scores, comment, created_at")
      .eq("target_user_id", targetUserId)
      .order("created_at", { ascending: false });

    if (periodParam && periodParam.trim()) {
      query = query.eq("period", periodParam.trim());
    }

    const { data: rows, error } = await query.returns<RawScoreRecordRow[]>();

    if (error) {
      console.error("[api/scores/user-detail] load records error", error);
      return NextResponse.json(
        { error: "failed_to_load_records", detail: error.message },
        { status: 500 },
      );
    }

    const records = rows ?? [];
    if (!records.length) {
      return NextResponse.json({ items: [] as ScoreDetailItem[] });
    }

    const scorerIds = Array.from(
      new Set(
        records
          .map((r) => r.scorer_id)
          .filter((id): id is number => typeof id === "number" && id > 0),
      ),
    );

    const departmentIds = Array.from(
      new Set(
        records
          .map((r) => r.department_id)
          .filter((id): id is number => typeof id === "number" && id > 0),
      ),
    );

    const [usersResult, departmentsResult] = await Promise.all([
      scorerIds.length
        ? supabaseAdmin
            .from("users")
            .select("id, name, email")
            .in("id", scorerIds)
            .returns<UserRow[]>()
        : Promise.resolve({ data: [] as UserRow[], error: null }),
      departmentIds.length
        ? supabaseAdmin
            .from("departments")
            .select("id, name")
            .in("id", departmentIds)
            .returns<DepartmentRow[]>()
        : Promise.resolve({ data: [] as DepartmentRow[], error: null }),
    ]);

    if (usersResult.error) {
      console.error("[api/scores/user-detail] load users error", usersResult.error);
      return NextResponse.json(
        { error: "failed_to_load_records", detail: usersResult.error.message },
        { status: 500 },
      );
    }

    if (departmentsResult.error) {
      console.error("[api/scores/user-detail] load departments error", departmentsResult.error);
      return NextResponse.json(
        { error: "failed_to_load_records", detail: departmentsResult.error.message },
        { status: 500 },
      );
    }

    const userMap = new Map<number, UserRow>();
    for (const user of usersResult.data ?? []) {
      if (typeof user.id === "number") {
        userMap.set(user.id, user);
      }
    }

    const deptMap = new Map<number, DepartmentRow>();
    for (const dept of departmentsResult.data ?? []) {
      if (typeof dept.id === "number") {
        deptMap.set(dept.id, dept);
      }
    }

    const items: ScoreDetailItem[] = [];

    for (const record of records) {
      const user = record.scorer_id ? userMap.get(record.scorer_id) ?? null : null;
      const dept = record.department_id ? deptMap.get(record.department_id) ?? null : null;

      const scoresPayload = record.scores as any;
      const scores: Record<string, number> = {};
      const values: number[] = [];

      if (scoresPayload && typeof scoresPayload === "object") {
        for (const [label, value] of Object.entries(scoresPayload)) {
          const num = typeof value === "number" ? value : Number(value);
          if (!Number.isFinite(num)) {
            continue;
          }
          scores[label] = num;
          values.push(num);
        }
      }

      const avgScore = values.length
        ? values.reduce((sum, v) => sum + v, 0) / Math.max(values.length, 1)
        : 0;

      const scorerNameCandidate =
        (user?.name ?? "").toString().trim() ||
        (user?.email ?? "").toString().trim() ||
        "未命名用户";

      items.push({
        id: record.id,
        taskId: record.task_id,
        scorerId: record.scorer_id,
        scorerName: scorerNameCandidate,
        scorerEmail: (user?.email ?? null) as string | null,
        departmentName: (dept?.name ?? null) as string | null,
        period: record.period,
        scores,
        avgScore,
        comment: record.comment ?? "",
        createdAt: record.created_at,
      });
    }

    return NextResponse.json({ items });
  } catch (error: any) {
    console.error("[api/scores/user-detail] unexpected error", error);
    return NextResponse.json(
      {
        error: "failed_to_load_records",
        detail: error?.message ?? String(error),
      },
      { status: 500 },
    );
  }
}
