import { NextRequest, NextResponse } from "next/server";
import {
  loadWecomGatewaySystems,
  getWecomGatewayStateSecret,
  getWecomGatewayCallbackUrl,
} from "../../../../../lib/wecomGatewayConfig";
import { verifyWecomGatewayState } from "../../../../../lib/wecomGatewayState";
import { wecomGetUserIdByCode, wecomGetUserIdByCodeViaProxy } from "../../../../../lib/wecomClient";

export const runtime = "edge";


function appendQuery(url: string, key: string, value: string): string {
  const u = new URL(url);
  u.searchParams.set(key, value);
  return u.toString();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = (searchParams.get("code") || "").trim();
  const state = (searchParams.get("state") || "").trim();

  const stateSecret = getWecomGatewayStateSecret();
  if (!stateSecret) {
    return NextResponse.json(
      { error: "server_config_missing", detail: "missing WECOM_GATEWAY_STATE_SECRET" },
      { status: 500 },
    );
  }

  const verified = await verifyWecomGatewayState({ secret: stateSecret, state, maxAgeMs: 15 * 60 * 1000 });
  if (!verified.ok) {
    return NextResponse.json({ error: "invalid_state", detail: verified.error }, { status: 400 });
  }

  const { systemKey, bindToken, returnTo } = verified.payload;

  const systems = loadWecomGatewaySystems();
  const cfg = systems.get(systemKey);

  if (!cfg) {
    return NextResponse.json({ error: "unknown_system", detail: systemKey }, { status: 400 });
  }

  const baseUrl = cfg.baseUrl;
  const fallbackReturnTo = returnTo && returnTo.startsWith("/") ? returnTo : "/profile";
  const successUrl = appendQuery(`${baseUrl}${fallbackReturnTo}`, "wecomBind", "success");
  const errorUrl = (err: string) => appendQuery(`${baseUrl}${fallbackReturnTo}`, "wecomBindError", err);

  if (!code) {
    return NextResponse.redirect(errorUrl("missing_code"));
  }

  // 1) 优先走直连企微接口；失败再 fallback 到你们现有的 proxy
  let userIdResult = await wecomGetUserIdByCode({ corpId: cfg.corpId, appSecret: cfg.appSecret, code });
  if (!userIdResult.ok) {
    const proxyResult = await wecomGetUserIdByCodeViaProxy(code);
    if (proxyResult.ok) {
      userIdResult = proxyResult;
    }
  }

  if (!userIdResult.ok) {
    console.error("[wecom-gateway] get userId failed", userIdResult);
    return NextResponse.redirect(errorUrl("userinfo"));
  }

  const wecomUserId = userIdResult.userId;

  // 2) 回调业务系统落库（由业务系统自己校验 bindToken）
  const callbackUrl = getWecomGatewayCallbackUrl(cfg);
  try {
    const res = await fetch(callbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Wecom-Gateway-Token": cfg.bindCallbackToken,
      },
      body: JSON.stringify({ bindToken, wecomUserId }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[wecom-gateway] callback system http error", res.status, res.statusText, text);
      return NextResponse.redirect(errorUrl("db"));
    }

    const json = (await res.json()) as any;
    if (!json?.ok) {
      console.error("[wecom-gateway] callback system biz error", json);
      return NextResponse.redirect(errorUrl("db"));
    }
  } catch (e) {
    console.error("[wecom-gateway] callback system exception", e);
    return NextResponse.redirect(errorUrl("db"));
  }

  return NextResponse.redirect(successUrl);
}
