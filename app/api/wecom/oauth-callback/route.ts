import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../lib/serverAuth";

export const runtime = "edge";

async function fetchAccessToken(corpId: string, corpSecret: string) {
  const tokenUrl = new URL("https://qyapi.weixin.qq.com/cgi-bin/gettoken");
  tokenUrl.searchParams.set("corpid", corpId);
  tokenUrl.searchParams.set("corpsecret", corpSecret);

  console.log(`[api/wecom/oauth-callback] 请求企微 gettoken API, corpid: ${corpId.substring(0, 8)}...`);

  const res = await fetch(tokenUrl.toString());
  if (!res.ok) {
    const text = await res.text();
    console.error(`[api/wecom/oauth-callback] gettoken HTTP error: ${res.status} ${res.statusText}`, text);
    return null;
  }

  const json = (await res.json()) as { access_token?: string; errcode?: number; errmsg?: string };
  console.log("[api/wecom/oauth-callback] gettoken response:", JSON.stringify(json));

  if (json.errcode && json.errcode !== 0) {
    console.error(`[api/wecom/oauth-callback] gettoken API error: errcode=${json.errcode}, errmsg=${json.errmsg}`);
    return null;
  }

  if (!json.access_token) {
    console.error("[api/wecom/oauth-callback] gettoken response missing access_token", json);
    return null;
  }

  console.log("[api/wecom/oauth-callback] gettoken success");
  return json.access_token as string;
}

async function fetchUserId(accessToken: string, code: string) {
  const url = new URL("https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo");
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("code", code);

  console.log(`[api/wecom/oauth-callback] 请求企微 getuserinfo API, code: ${code.substring(0, 12)}...`);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    console.error(`[api/wecom/oauth-callback] getuserinfo HTTP error: ${res.status} ${res.statusText}`, text);
    return null;
  }

  const json = (await res.json()) as { UserId?: string; errcode?: number; errmsg?: string };
  console.log("[api/wecom/oauth-callback] getuserinfo response:", JSON.stringify(json));

  if (json.errcode && json.errcode !== 0) {
    console.error(`[api/wecom/oauth-callback] getuserinfo API error: errcode=${json.errcode}, errmsg=${json.errmsg}`);
    return null;
  }

  if (!json.UserId) {
    console.error("[api/wecom/oauth-callback] getuserinfo response missing UserId", json);
    return null;
  }

  console.log(`[api/wecom/oauth-callback] getuserinfo success, UserId: ${json.UserId}`);
  return json.UserId as string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  console.log("[api/wecom/oauth-callback] 开始处理回调请求");

  if (!code) {
    console.error("[api/wecom/oauth-callback] missing code in query");
    return NextResponse.redirect(new URL("/profile?wecomBindError=missing_code", req.url));
  }

  if (!state || !state.trim()) {
    console.error("[api/wecom/oauth-callback] missing state (token) in query");
    return NextResponse.redirect(new URL("/profile?wecomBindError=missing_token", req.url));
  }

  const token = state.trim();
  console.log(`[api/wecom/oauth-callback] 获取到 token: ${token.substring(0, 8)}...`);

  // 验证 token
  let userId: number;
  try {
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from("wecom_bind_tokens")
      .select("user_id, expires_at, used")
      .eq("token", token)
      .maybeSingle();

    if (tokenError) {
      console.error("[api/wecom/oauth-callback] query token error", tokenError);
      return NextResponse.redirect(new URL("/profile?wecomBindError=invalid_token", req.url));
    }

    if (!tokenData) {
      console.error("[api/wecom/oauth-callback] token not found");
      return NextResponse.redirect(new URL("/profile?wecomBindError=invalid_token", req.url));
    }

    if (tokenData.used) {
      console.error("[api/wecom/oauth-callback] token already used");
      return NextResponse.redirect(new URL("/profile?wecomBindError=token_used", req.url));
    }

    const expiresAt = new Date(tokenData.expires_at as string);
    if (expiresAt < new Date()) {
      console.error("[api/wecom/oauth-callback] token expired");
      return NextResponse.redirect(new URL("/profile?wecomBindError=token_expired", req.url));
    }

    userId = tokenData.user_id as number;
    console.log(`[api/wecom/oauth-callback] token 验证成功，userId: ${userId}`);

    // 标记 token 为已使用
    await supabaseAdmin
      .from("wecom_bind_tokens")
      .update({ used: true })
      .eq("token", token);
  } catch (e) {
    console.error("[api/wecom/oauth-callback] token validation error", e);
    return NextResponse.redirect(new URL("/profile?wecomBindError=validation_error", req.url));
  }

  const corpId = process.env.WECOM_CORP_ID;
  const corpSecret = process.env.WECOM_APP_SECRET;

  if (!corpId || !corpSecret) {
    console.error("[api/wecom/oauth-callback] missing corpId or app secret env");
    return NextResponse.redirect(new URL("/profile?wecomBindError=config", req.url));
  }

  console.log("[api/wecom/oauth-callback] 开始获取 access_token");
  const accessToken = await fetchAccessToken(corpId, corpSecret);
  if (!accessToken) {
    console.error("[api/wecom/oauth-callback] 获取 access_token 失败");
    return NextResponse.redirect(new URL("/profile?wecomBindError=token", req.url));
  }

  console.log("[api/wecom/oauth-callback] access_token 获取成功，开始获取企微用户信息");
  const wecomUserId = await fetchUserId(accessToken, code);
  if (!wecomUserId) {
    console.error("[api/wecom/oauth-callback] 获取企微用户信息失败");
    return NextResponse.redirect(new URL("/profile?wecomBindError=userinfo", req.url));
  }

  console.log(`[api/wecom/oauth-callback] 企微用户信息获取成功，wecomUserId: ${wecomUserId}`);

  const nowIso = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("users")
    .update({ wecom_user_id: wecomUserId, updated_at: nowIso })
    .eq("id", userId);

  if (error) {
    console.error("[api/wecom/oauth-callback] update wecom_user_id error", error);
    return NextResponse.redirect(new URL("/profile?wecomBindError=db", req.url));
  }

  console.log(`[api/wecom/oauth-callback] 企微绑定成功，userId: ${userId}, wecomUserId: ${wecomUserId}`);
  return NextResponse.redirect(new URL("/profile?wecomBind=success", req.url));
}
