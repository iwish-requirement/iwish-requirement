import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../lib/serverAuth";

export const runtime = "edge";

async function fetchAccessToken(corpId: string, corpSecret: string) {
  const tokenUrl = new URL("https://qyapi.weixin.qq.com/cgi-bin/gettoken");
  tokenUrl.searchParams.set("corpid", corpId);
  tokenUrl.searchParams.set("corpsecret", corpSecret);

  const res = await fetch(tokenUrl.toString());
  if (!res.ok) {
    console.error("[api/wecom/oauth-callback] gettoken error", await res.text());
    return null;
  }

  const json = (await res.json()) as { access_token?: string; errcode?: number; errmsg?: string };
  if (!json.access_token) {
    console.error("[api/wecom/oauth-callback] gettoken response invalid", json);
    return null;
  }

  return json.access_token as string;
}

async function fetchUserId(accessToken: string, code: string) {
  const url = new URL("https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo");
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("code", code);

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.error("[api/wecom/oauth-callback] getuserinfo error", await res.text());
    return null;
  }

  const json = (await res.json()) as { UserId?: string; errcode?: number; errmsg?: string };
  if (!json.UserId) {
    console.error("[api/wecom/oauth-callback] getuserinfo response invalid", json);
    return null;
  }

  return json.UserId as string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  console.log("[api/wecom/oauth-callback] 开始处理回调请求");

  if (!code) {
    console.error("[api/wecom/oauth-callback] missing code in query");
    return NextResponse.redirect(new URL("/profile?wecomBindError=missing_code", req.url));
  }

  console.log("[api/wecom/oauth-callback] 获取到 code，开始验证用户登录状态");

  const authResult = await getBusinessUserFromRequest(req);
  if (authResult.errorResponse) {
    console.error("[api/wecom/oauth-callback] 用户未登录或登录已过期");
    // 用户未登录，重定向到登录页面，并带上提示信息
    return NextResponse.redirect(new URL("/login?redirect=/profile&message=wecom_auth_expired", req.url));
  }
  const activeError = ensureActiveUser(authResult.user);
  if (activeError) {
    console.error("[api/wecom/oauth-callback] 用户账号状态异常");
    return NextResponse.redirect(new URL("/profile?wecomBindError=account_inactive", req.url));
  }

  const userId = authResult.user!.id;
  console.log(`[api/wecom/oauth-callback] 用户验证成功，userId: ${userId}`);

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
