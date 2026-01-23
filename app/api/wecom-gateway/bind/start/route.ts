import { NextRequest, NextResponse } from "next/server";
import { loadWecomGatewaySystems, getWecomGatewayStateSecret } from "../../../../../lib/wecomGatewayConfig";
import { signWecomGatewayState } from "../../../../../lib/wecomGatewayState";

export const runtime = "edge";


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const systemKey = (searchParams.get("systemKey") || "").trim();
  const bindToken = (searchParams.get("bindToken") || "").trim();
  const returnToRaw = (searchParams.get("returnTo") || "").trim();

  if (!systemKey || !bindToken) {
    return NextResponse.json(
      { error: "bad_request", detail: "systemKey and bindToken are required" },
      { status: 400 },
    );
  }

  const systems = loadWecomGatewaySystems();
  const cfg = systems.get(systemKey);
  if (!cfg) {
    return NextResponse.json({ error: "bad_request", detail: "unknown systemKey" }, { status: 400 });
  }

  const stateSecret = getWecomGatewayStateSecret();
  if (!stateSecret) {
    return NextResponse.json(
      { error: "server_config_missing", detail: "missing WECOM_GATEWAY_STATE_SECRET" },
      { status: 500 },
    );
  }

  // 只允许 path（防止 open redirect）；空则默认 /profile
  const returnTo = returnToRaw && returnToRaw.startsWith("/") ? returnToRaw : "/profile";

  const state = await signWecomGatewayState(stateSecret, {
    systemKey,
    bindToken,
    returnTo,
  });


  const redirectUriEnv = (process.env.WECOM_GATEWAY_OAUTH_REDIRECT_URI || "").trim();
  const urlObj = new URL(req.url);
  const origin = `${urlObj.protocol}//${urlObj.host}`;
  const redirectUri = redirectUriEnv || `${origin}/api/wecom-gateway/bind/callback`;

  const wecomUrl = new URL("https://open.work.weixin.qq.com/wwopen/sso/qrConnect");
  wecomUrl.searchParams.set("appid", cfg.corpId);
  wecomUrl.searchParams.set("agentid", cfg.agentId);
  wecomUrl.searchParams.set("redirect_uri", redirectUri);
  wecomUrl.searchParams.set("state", state);

  return NextResponse.json({ url: wecomUrl.toString() });
}
