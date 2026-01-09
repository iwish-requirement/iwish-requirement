import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  try {
    // 可选的安全校验
    const cronSecret = process.env.CRON_SCORE_TASKS_SECRET;
    if (cronSecret) {
      const header = req.headers.get("x-cron-secret");
      if (!header || header !== cronSecret) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
    }

    console.log("[api/wecom/cleanup-tokens] 开始清理过期的企微绑定 token");

    // 删除 1 小时前过期的 token
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { error, count } = await supabaseAdmin
      .from("wecom_bind_tokens")
      .delete()
      .lt("expires_at", oneHourAgo);

    if (error) {
      console.error("[api/wecom/cleanup-tokens] delete error", error);
      return NextResponse.json(
        { error: "cleanup_failed", detail: error.message },
        { status: 500 }
      );
    }

    console.log(`[api/wecom/cleanup-tokens] 清理完成，删除了 ${count || 0} 条过期 token`);

    return NextResponse.json({ ok: true, deletedCount: count || 0 });
  } catch (error: any) {
    console.error("[api/wecom/cleanup-tokens] unexpected error", error);
    return NextResponse.json(
      { error: "internal_error", detail: error?.message ?? String(error) },
      { status: 500 }
    );
  }
}
