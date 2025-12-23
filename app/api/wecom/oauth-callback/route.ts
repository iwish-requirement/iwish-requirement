import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../lib/serverAuth";

export const runtime = "nodejs";

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

  if (!code) {
    console.error("[api/wecom/oauth-callback] missing code in query");
    return NextResponse.redirect(new URL("/profile?wecomBindError=missing_code", req.url));
  }

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
  const corpSecret = process.env.WECOM_APP_SECRET;

  if (!corpId || !corpSecret) {
    console.error("[api/wecom/oauth-callback] missing corpId or app secret env");
    return NextResponse.redirect(new URL("/profile?wecomBindError=config", req.url));
  }

  const accessToken = await fetchAccessToken(corpId, corpSecret);
  if (!accessToken) {
    return NextResponse.redirect(new URL("/profile?wecomBindError=token", req.url));
  }

  const wecomUserId = await fetchUserId(accessToken, code);
  if (!wecomUserId) {
    return NextResponse.redirect(new URL("/profile?wecomBindError=userinfo", req.url));
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("users")
    .update({ wecom_user_id: wecomUserId, updated_at: nowIso })
    .eq("id", userId);

  if (error) {
    console.error("[api/wecom/oauth-callback] update wecom_user_id error", error);
    return NextResponse.redirect(new URL("/profile?wecomBindError=db", req.url));
  }

  return NextResponse.redirect(new URL("/profile?wecomBind=success", req.url));
}
