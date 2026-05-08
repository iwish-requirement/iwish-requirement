import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

function extractText(body: Record<string, any>) {
  return String(body.text || body.Content || body.content || body.message || "").trim();
}

function extractWecomUserId(body: Record<string, any>) {
  return String(body.wecomUserId || body.FromUserName || body.fromUserName || body.userId || "").trim();
}

function extractConfirmDraftId(text: string) {
  const match = /(?:确认|创建|confirm)\s*(?:需求|草稿)?\s*#?\s*(\d+)/i.exec(text);
  return match ? Number.parseInt(match[1], 10) : null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const text = extractText(body);
    const wecomUserId = extractWecomUserId(body);
    if (!text || !wecomUserId) {
      return NextResponse.json({ error: "text and wecomUserId are required" }, { status: 400 });
    }

    const confirmDraftId = extractConfirmDraftId(text);
    const target = new URL(
      confirmDraftId ? "/api/wecom-gateway/demands/confirm" : "/api/wecom-gateway/demands/parse",
      req.url,
    );
    const upstream = await fetch(target.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(confirmDraftId ? { draftId: confirmDraftId, wecomUserId } : { text, wecomUserId }),
    });
    const json = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      const hint = json.error === "draft missing department"
        ? "草稿缺少部门，请在系统内补齐后再确认。"
        : json.error === "draft missing demand type"
        ? "草稿缺少需求类型，请在系统内补齐后再确认。"
        : json.error === "wecom user is not bound"
        ? "当前企微账号尚未绑定系统用户，无法提交需求。"
        : json.detail || json.error || "处理失败";
      return NextResponse.json({ ...json, replyText: hint }, { status: upstream.status });
    }

    const replyText = confirmDraftId
      ? json.message || "需求已创建。"
      : `${json.message || "已生成需求草稿。"}\n确认创建请回复：确认需求 ${json.draft?.id}`;
    return NextResponse.json({ ...json, replyText }, { status: upstream.status });
  } catch (error: any) {
    console.error("[api/wecom-gateway/message/receive] unexpected error", error);
    return NextResponse.json({ error: "failed_to_handle_wecom_message", detail: error?.message ?? String(error) }, { status: 500 });
  }
}
