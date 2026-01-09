import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../lib/serverAuth";

export const runtime = "edge";

// 生成随机 token
function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
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

  // 生成临时 token，有效期 10 分钟
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  try {
    const { error: insertError } = await supabaseAdmin
      .from("wecom_bind_tokens")
      .insert({
        token,
        user_id: userId,
        expires_at: expiresAt,
        used: false,
      });

    if (insertError) {
      console.error("[api/wecom/oauth-url] insert token error", insertError);
      return NextResponse.json(
        { error: "token_generation_failed", detail: "生成绑定凭证失败，请稍后重试" },
        { status: 500 },
      );
    }
  } catch (e) {
    console.error("[api/wecom/oauth-url] insert token unexpected error", e);
    return NextResponse.json(
      { error: "internal_error", detail: "系统异常，请稍后重试" },
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
  wecomUrl.searchParams.set("state", token);

  return NextResponse.json({ url: wecomUrl.toString() });
}
