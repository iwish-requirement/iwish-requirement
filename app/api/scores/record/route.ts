import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../lib/serverAuth";

export const runtime = "nodejs";

type RawScoreRecordRow = {
  id: number;
  task_id: number;
  scorer_id: number;
  scores: any;
  comment: string | null;
  created_at: string | null;
};

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
    const taskIdParam = url.searchParams.get("taskId");

    const taskId = taskIdParam ? Number.parseInt(taskIdParam, 10) : NaN;
    if (!Number.isFinite(taskId) || taskId <= 0) {
      return NextResponse.json(
        { error: "invalid_task_id", detail: "评分任务ID不合法" },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("score_records")
      .select("id, task_id, scorer_id, scores, comment, created_at")
      .eq("task_id", taskId)
      .eq("scorer_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<RawScoreRecordRow>();

    if (error) {
      console.error("[api/scores/record] load record error", error);
      return NextResponse.json(
        { error: "failed_to_load_record", detail: error.message },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "not_found", detail: "暂无该评分任务的记录" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      record: {
        id: data.id,
        taskId: data.task_id,
        scores: data.scores,
        comment: data.comment ?? "",
        createdAt: data.created_at,
      },
    });
  } catch (error: any) {
    console.error("[api/scores/record] unexpected error", error);
    return NextResponse.json(
      {
        error: "failed_to_load_record",
        detail: error?.message ?? String(error),
      },
      { status: 500 },
    );
  }
}
