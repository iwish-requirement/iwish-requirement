import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest } from "../../../../lib/serverAuth";
import { ensureHasAnyPermission, ensureHasPermission } from "../../../../lib/serverPermissions";

export const runtime = "edge";


type ScorePeriodRow = {
  id: number;
  period: string;
  score_window_start: string | null;
  score_window_end: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export async function GET(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const permError = await ensureHasAnyPermission(authResult.user, [
      "settings.score_periods.view",
      "settings.score_periods.manage",
    ]);
    if (permError) {
      return permError;
    }




    const { searchParams } = new URL(req.url);
    const yearParam = searchParams.get("year");

    let query = supabaseAdmin
      .from("score_periods")
      .select("id, period, score_window_start, score_window_end, status, created_at, updated_at")
      .order("period", { ascending: false });

    if (yearParam && yearParam.trim()) {
      const year = yearParam.trim();
      query = (query as any).like("period", `${year}-%`);
    }

    const { data, error } = await query;


    if (error) {
      console.error("[api/admin/score-periods] load error", error);
      return NextResponse.json(
        { error: "failed_to_load_score_periods", detail: error.message },
        { status: 500 },
      );
    }

    const items = (data ?? []).map((row) => ({
      id: row.id,
      period: row.period,
      scoreWindowStart: row.score_window_start,
      scoreWindowEnd: row.score_window_end,
      status: row.status ?? "planned",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json(
      { items },
      {
        headers: {
          "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
        },
      },
    );
  } catch (error: any) {
    console.error("[api/admin/score-periods] GET unexpected error", error);
    return NextResponse.json(
      { error: "failed_to_load_score_periods", detail: error?.message ?? String(error) },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const permError = await ensureHasAnyPermission(authResult.user, [
      "settings.score_periods.view",
      "settings.score_periods.manage",
    ]);
    if (permError) {
      return permError;
    }




    const body = await req.json();
    const rawPeriod = (body?.period as string | undefined) ?? "";
    const rawStart = (body?.scoreWindowStart as string | undefined) ?? "";
    const rawEnd = (body?.scoreWindowEnd as string | undefined) ?? "";
    const rawStatus = (body?.status as string | undefined) ?? "";

    const period = rawPeriod.trim();
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json(
        { error: "invalid_period", detail: "period 必须是 YYYY-MM 格式" },
        { status: 400 },
      );
    }

    const scoreWindowStart = rawStart.trim() || null;
    const scoreWindowEnd = rawEnd.trim() || null;
    const status = (rawStatus.trim() || "planned").toLowerCase();

    const nowIso = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("score_periods")
      .upsert(
        {
          period,
          score_window_start: scoreWindowStart,
          score_window_end: scoreWindowEnd,
          status,
          updated_at: nowIso,
        },
        { onConflict: "period" },
      )
      .select("id, period, score_window_start, score_window_end, status, created_at, updated_at")
      .maybeSingle<ScorePeriodRow>();

    if (error || !data) {
      console.error("[api/admin/score-periods] upsert error", error);
      return NextResponse.json(
        { error: "failed_to_save_score_period", detail: error?.message ?? "upsert failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      period: {
        id: data.id,
        period: data.period,
        scoreWindowStart: data.score_window_start,
        scoreWindowEnd: data.score_window_end,
        status: data.status ?? "planned",
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    });
  } catch (error: any) {
    console.error("[api/admin/score-periods] POST unexpected error", error);
    return NextResponse.json(
      { error: "failed_to_save_score_period", detail: error?.message ?? String(error) },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const permError = await ensureHasAnyPermission(authResult.user, [
      "settings.score_periods.view",
      "settings.score_periods.manage",
    ]);
    if (permError) {
      return permError;
    }




    const body = await req.json();
    const rawPeriod = (body?.period as string | undefined) ?? "";
    const period = rawPeriod.trim();

    if (!period) {
      return NextResponse.json(
        { error: "invalid_period", detail: "period 是必填参数" },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from("score_periods")
      .delete()
      .eq("period", period);

    if (error) {
      console.error("[api/admin/score-periods] delete error", error);
      return NextResponse.json(
        { error: "failed_to_delete_score_period", detail: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[api/admin/score-periods] DELETE unexpected error", error);
    return NextResponse.json(
      { error: "failed_to_delete_score_period", detail: error?.message ?? String(error) },
      { status: 500 },
    );
  }
}
