import { NextRequest, NextResponse } from "next/server";
import { loadWecomGatewaySystems } from "../../../../../lib/wecomGatewayConfig";
import { wecomSendTextMessage } from "../../../../../lib/wecomClient";

export const runtime = "edge";


function unauthorized(detail?: string) {
  return NextResponse.json(
    { error: "unauthorized", detail: detail || "invalid system key/token" },
    { status: 401 },
  );
}

export async function POST(req: NextRequest) {
  const systemKey = (req.headers.get("x-system-key") || "").trim();
  const systemToken = (req.headers.get("x-system-token") || "").trim();

  if (!systemKey || !systemToken) {
    return unauthorized("missing x-system-key or x-system-token");
  }

  const systems = loadWecomGatewaySystems();
  const cfg = systems.get(systemKey);
  if (!cfg) {
    return unauthorized("unknown systemKey");
  }
  if (cfg.systemToken !== systemToken) {
    return unauthorized("invalid systemToken");
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request", detail: "invalid json" }, { status: 400 });
  }

  const msgType = (body?.msgType || "text").toString();
  if (msgType !== "text") {
    return NextResponse.json({ error: "bad_request", detail: "only msgType=text is supported" }, { status: 400 });
  }

  const toUserIds = Array.isArray(body?.toUserIds) ? (body.toUserIds as any[]) : [];
  const content = (body?.content || "").toString();

  if (!content.trim()) {
    return NextResponse.json({ error: "bad_request", detail: "content is required" }, { status: 400 });
  }

  const r = await wecomSendTextMessage({
    corpId: cfg.corpId,
    appSecret: cfg.appSecret,
    agentId: cfg.agentId,
    toUserIds: toUserIds.map((v) => (v == null ? "" : String(v))),
    content,
  });

  if (r.ok) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { ok: false, errcode: r.errcode, errmsg: r.errmsg, detail: r.detail },
    { status: 502 },
  );
}
