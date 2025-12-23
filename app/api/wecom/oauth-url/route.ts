import { NextRequest, NextResponse } from "next/server";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../lib/serverAuth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const authResult = await getBusinessUserFromRequest(req);
  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }
  const activeError = ensureActiveUser(authResult.user);
  if (activeError) {
    return activeError;
  }

  const corpId = process.env.WECOM_CORP_ID;
  const agentId = process.env.WECOM_AGENT_ID;
  const redirectUriEnv = process.env.WECOM_OAUTH_REDIRECT_URI;

  if (!corpId || !agentId) {
    console.error("[api/wecom/oauth-url] missing corpId or agentId env");
    return NextResponse.json(
      { error: "wecom_config_missing", detail: "缺少企业微信企业与应用配置，请联系管理员。" },
      { status: 500 },
    );
  }

  const urlObj = new URL(req.url);
  const origin = `${urlObj.protocol}//${urlObj.host}`;
  const redirectUri =
    redirectUriEnv && redirectUriEnv.trim()
      ? redirectUriEnv.trim()
      : `${origin}/api/wecom/oauth-callback`;

  const wecomUrl = new URL("https://open.work.weixin.qq.com/wwopen/sso/qrConnect");
  wecomUrl.searchParams.set("appid", corpId);
  wecomUrl.searchParams.set("agentid", agentId);
  wecomUrl.searchParams.set("redirect_uri", redirectUri);
  wecomUrl.searchParams.set("state", "iwish_wecom_bind");

  return NextResponse.json({ url: wecomUrl.toString() });
}
