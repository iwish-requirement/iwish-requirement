import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../../lib/serverAuth";
import { sendWecomAppTextMessage } from "../../../../../lib/wecomApp";
import { writeAuditLog } from "../../../../../lib/audit";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) return authResult.errorResponse;
    const activeError = ensureActiveUser(authResult.user);
    if (activeError) return activeError;

    const body = await req.json().catch(() => ({}));
    const departmentId = Number.parseInt(String(body.departmentId || authResult.user?.departmentId || ""), 10);
    const period = ((body.period as string | undefined) || "").trim();
    if (Number.isNaN(departmentId) || departmentId <= 0 || !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json({ error: "departmentId and period are required" }, { status: 400 });
    }
    if (authResult.user?.role !== "admin" && authResult.user?.departmentId !== departmentId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { data: reportRow, error: reportError } = await supabaseAdmin
      .from("ai_reports")
      .select("id, content, report_type")
      .eq("department_id", departmentId)
      .eq("period", period)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (reportError || !reportRow) {
      return NextResponse.json({ error: "report not found", detail: reportError?.message }, { status: 404 });
    }

    const { data: users, error: usersError } = await supabaseAdmin
      .from("users")
      .select("wecom_user_id")
      .eq("department_id", departmentId)
      .eq("status", "active")
      .not("wecom_user_id", "is", null);
    if (usersError) {
      return NextResponse.json({ error: "failed_to_load_wecom_users", detail: usersError.message }, { status: 500 });
    }

    const toUserIds = Array.from(
      new Set((users || []).map((row: any) => ((row.wecom_user_id as string | null) || "").trim()).filter(Boolean)),
    );
    if (!toUserIds.length) {
      return NextResponse.json({ error: "no bound wecom users" }, { status: 400 });
    }

    let report: any = null;
    try {
      report = JSON.parse((reportRow.content as string) || "{}");
    } catch {
      report = null;
    }
    const baseUrlEnv = process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.VITE_PUBLIC_URL || "";
    const baseUrl = baseUrlEnv.replace(/\/+$/, "");
    const link = baseUrl ? `${baseUrl}/reports/monthly` : "";
    const keywords = Array.isArray(report?.summaryKeywords) ? report.summaryKeywords.slice(0, 4).join("、") : "";
    let content = `【需求系统】${period} 月度报告已生成`;
    if (report?.departmentName) content += `\n部门：${report.departmentName}`;
    if (keywords) content += `\n关键词：${keywords}`;
    if (link) content += `\n查看报告：${link}`;

    await sendWecomAppTextMessage(toUserIds, content);
    await writeAuditLog({
      userId: authResult.user?.id,
      entityType: "ai_report",
      entityId: reportRow.id as number,
      action: "send_wecom",
      metadata: { departmentId, period, recipients: toUserIds.length },
    });

    return NextResponse.json({ success: true, sentCount: toUserIds.length });
  } catch (error: any) {
    console.error("[api/ai-reports/monthly/send-wecom] unexpected error", error);
    return NextResponse.json({ error: "failed_to_send_ai_report", detail: error?.message ?? String(error) }, { status: 500 });
  }
}
