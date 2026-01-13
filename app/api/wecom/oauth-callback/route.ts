import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../lib/serverAuth";

export const runtime = "edge";

async function fetchUserIdFromProxy(code: string) {
  const proxyUrl = process.env.WECOM_USERINFO_PROXY_URL;
  const proxyToken = process.env.WECOM_USERINFO_PROXY_TOKEN;

  if (!proxyUrl || !proxyToken) {
    console.error("[api/wecom/oauth-callback] missing proxy url or token env");
    return { ok: false as const, error: "config" as const };
  }

  const url = new URL(proxyUrl);
  url.searchParams.set("code", code);

  console.log("[api/wecom/oauth-callback] 请求企微用户信息代理", {
    url: url.toString().substring(0, 200),
  });

  const res = await fetch(url.toString(), {
    headers: {
      "X-Internal-Token": proxyToken,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[api/wecom/oauth-callback] proxy HTTP error", res.status, res.statusText, text);
    return { ok: false as const, error: "userinfo" as const };
  }

  const json = (await res.json()) as
    | { ok: true; userId: string }
    | { ok: false; error: string; errcode?: number; errmsg?: string; detail?: string };

  console.log("[api/wecom/oauth-callback] proxy response", JSON.stringify(json));

  if (!json.ok) {
    console.error("[api/wecom/oauth-callback] proxy returned error", json);
    return { ok: false as const, error: "userinfo" as const };
  }

  if (!json.userId) {
    console.error("[api/wecom/oauth-callback] proxy response missing userId", json);
    return { ok: false as const, error: "userinfo" as const };
  }

  return { ok: true as const, userId: json.userId };
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

  console.log("[api/wecom/oauth-callback] 开始通过代理获取企微用户信息");
  const proxyResult = await fetchUserIdFromProxy(code);

  if (!proxyResult.ok) {
    console.error("[api/wecom/oauth-callback] 通过代理获取企微用户信息失败", proxyResult);
    return NextResponse.redirect(new URL(`/profile?wecomBindError=${proxyResult.error}`, req.url));
  }

  const wecomUserId = proxyResult.userId;
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

