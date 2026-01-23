import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../../lib/serverAuth";

export const runtime = "edge";


function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 48; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export async function GET(req: NextRequest) {
  const authResult = await getBusinessUserFromRequest(req);
  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }
  const activeError = ensureActiveUser(authResult.user);
  if (activeError) {
    return activeError;
  }

  const userId = authResult.user!.id;

  const systemKey = (process.env.WECOM_GATEWAY_DEFAULT_SYSTEM_KEY || "requirement").trim();
  if (!process.env.WECOM_GATEWAY_STATE_SECRET || !process.env.WECOM_GATEWAY_STATE_SECRET.trim()) {
    return NextResponse.json(
      { error: "wecom_gateway_config_missing", detail: "缺少 WECOM_GATEWAY_STATE_SECRET，请联系管理员。" },
      { status: 500 },
    );
  }


  // 生成临时 bindToken，有效期 10 分钟
  const bindToken = generateToken();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error: insertError } = await supabaseAdmin
    .from("wecom_bind_tokens")
    .insert({ token: bindToken, user_id: userId, expires_at: expiresAt, used: false });

  if (insertError) {
    console.error("[api/wecom/bind/start] insert token error", insertError);
    return NextResponse.json(
      { error: "token_generation_failed", detail: "生成绑定凭证失败，请稍后重试" },
      { status: 500 },
    );
  }

  const urlObj = new URL(req.url);
  const origin = `${urlObj.protocol}//${urlObj.host}`;

  // 让网关负责拼 state/redirect_uri，并统一回调到 /api/wecom-gateway/bind/callback
  const gatewayStartUrl = new URL(`${origin}/api/wecom-gateway/bind/start`);
  gatewayStartUrl.searchParams.set("systemKey", systemKey);
  gatewayStartUrl.searchParams.set("bindToken", bindToken);
  gatewayStartUrl.searchParams.set("returnTo", "/profile");

  // 网关 start 返回 {url}
  const res = await fetch(gatewayStartUrl.toString());
  if (!res.ok) {
    console.error("[api/wecom/bind/start] gateway start http error", res.status, res.statusText, await res.text());
    return NextResponse.json(
      { error: "gateway_failed", detail: "无法发起企微扫码绑定，请稍后重试" },
      { status: 502 },
    );
  }

  const json = (await res.json()) as any;
  const url = (json?.url || "").toString();
  if (!url) {
    return NextResponse.json(
      { error: "gateway_failed", detail: "企微扫码绑定配置异常，请联系管理员检查网关配置" },
      { status: 500 },
    );
  }

  return NextResponse.json({ url });
}
