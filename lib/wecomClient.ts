type WecomTokenResponse = {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
};

type WecomGetUserInfoResponse =
  | { errcode: 0; errmsg: string; UserId?: string; userid?: string; OpenId?: string; openid?: string; DeviceId?: string }
  | { errcode: number; errmsg: string; [k: string]: any };

type WecomSendMessageResponse = { errcode: number; errmsg: string; [k: string]: any };

type TokenCacheEntry = { token: string; expiresAt: number };

function getTokenCache(): Map<string, TokenCacheEntry> {
  const g = globalThis as any;
  if (!g.__wecomTokenCache) {
    g.__wecomTokenCache = new Map<string, TokenCacheEntry>();
  }
  return g.__wecomTokenCache as Map<string, TokenCacheEntry>;
}

function buildTokenCacheKey(corpId: string, appSecret: string): string {
  // 不要直接把 secret 作为 key 输出到日志，这里只作为内存 key 使用
  return `${corpId}::${appSecret}`;
}

export async function getWecomAccessToken(params: {
  corpId: string;
  appSecret: string;
  forceRefresh?: boolean;
}): Promise<string> {
  const { corpId, appSecret, forceRefresh } = params;
  const cacheKey = buildTokenCacheKey(corpId, appSecret);
  const cache = getTokenCache();

  const now = Date.now();
  if (!forceRefresh) {
    const cached = cache.get(cacheKey);
    if (cached && cached.token && cached.expiresAt > now) {
      return cached.token;
    }
  }

  const url = new URL("https://qyapi.weixin.qq.com/cgi-bin/gettoken");
  url.searchParams.set("corpid", corpId);
  url.searchParams.set("corpsecret", appSecret);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`[wecomClient] gettoken http error ${res.status} ${res.statusText}: ${await res.text()}`);
  }

  const json = (await res.json()) as WecomTokenResponse;
  if (!json.access_token) {
    throw new Error(`[wecomClient] gettoken invalid response: ${JSON.stringify(json)}`);
  }

  const expiresIn = typeof json.expires_in === "number" && json.expires_in > 0 ? json.expires_in : 7200;
  // 提前 2 分钟过期，避免边界问题
  const expiresAt = Date.now() + Math.max(60, expiresIn - 120) * 1000;

  cache.set(cacheKey, { token: json.access_token, expiresAt });
  return json.access_token;
}

export async function wecomSendTextMessage(params: {
  corpId: string;
  appSecret: string;
  agentId: string | number;
  toUserIds: string[];
  content: string;
}): Promise<{ ok: true } | { ok: false; errcode: number; errmsg: string; detail?: any }> {
  const { corpId, appSecret, agentId, toUserIds, content } = params;

  const cleaned = Array.from(new Set((toUserIds || []).map((v) => (v || "").toString().trim()).filter(Boolean)));
  if (!cleaned.length) {
    return { ok: true };
  }

  const sendOnce = async (accessToken: string) => {
    const url = new URL("https://qyapi.weixin.qq.com/cgi-bin/message/send");
    url.searchParams.set("access_token", accessToken);

    const body = {
      touser: cleaned.join("|"),
      msgtype: "text",
      agentid: typeof agentId === "string" ? Number.parseInt(agentId, 10) : agentId,
      text: { content },
      safe: 0,
    };

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false as const, errcode: -1, errmsg: "http_error", detail: { status: res.status, statusText: res.statusText, text } };
    }

    const json = (await res.json()) as WecomSendMessageResponse;
    if (json.errcode === 0) {
      return { ok: true as const };
    }

    return { ok: false as const, errcode: json.errcode, errmsg: json.errmsg, detail: json };
  };

  try {
    const token = await getWecomAccessToken({ corpId, appSecret });
    const r1 = await sendOnce(token);

    // access_token 失效/过期，刷新后重试一次
    if (!r1.ok && (r1.errcode === 40014 || r1.errcode === 42001)) {
      const token2 = await getWecomAccessToken({ corpId, appSecret, forceRefresh: true });
      return await sendOnce(token2);
    }

    return r1;
  } catch (e: any) {
    return { ok: false, errcode: -2, errmsg: "exception", detail: e?.message ?? String(e) };
  }
}

export async function wecomGetUserIdByCode(params: {
  corpId: string;
  appSecret: string;
  code: string;
}): Promise<{ ok: true; userId: string } | { ok: false; error: string; detail?: any }> {
  const { corpId, appSecret, code } = params;

  if (!code || !code.trim()) {
    return { ok: false, error: "missing_code" };
  }

  try {
    const token = await getWecomAccessToken({ corpId, appSecret });
    const url = new URL("https://qyapi.weixin.qq.com/cgi-bin/auth/getuserinfo");
    url.searchParams.set("access_token", token);
    url.searchParams.set("code", code.trim());

    const res = await fetch(url.toString());
    if (!res.ok) {
      return { ok: false, error: "http_error", detail: await res.text() };
    }

    const json = (await res.json()) as WecomGetUserInfoResponse;
    if ((json as any).errcode !== 0) {
      return { ok: false, error: "wecom_error", detail: json };
    }

    const userId =
      ((json as any).UserId || (json as any).userid || "").toString().trim();

    if (!userId) {
      return { ok: false, error: "missing_userid", detail: json };
    }

    return { ok: true, userId };
  } catch (e: any) {
    return { ok: false, error: "exception", detail: e?.message ?? String(e) };
  }
}

export async function wecomGetUserIdByCodeViaProxy(code: string): Promise<{ ok: true; userId: string } | { ok: false; error: string; detail?: any }> {
  const proxyUrl = process.env.WECOM_USERINFO_PROXY_URL;
  const proxyToken = process.env.WECOM_USERINFO_PROXY_TOKEN;

  if (!proxyUrl || !proxyToken) {
    return { ok: false, error: "proxy_not_configured" };
  }

  const url = new URL(proxyUrl);
  url.searchParams.set("code", code);

  try {
    const res = await fetch(url.toString(), { headers: { "X-Internal-Token": proxyToken } });
    if (!res.ok) {
      return { ok: false, error: "proxy_http_error", detail: await res.text() };
    }

    const json = (await res.json()) as any;
    if (!json?.ok || !json.userId) {
      return { ok: false, error: "proxy_biz_error", detail: json };
    }

    return { ok: true, userId: String(json.userId).trim() };
  } catch (e: any) {
    return { ok: false, error: "proxy_exception", detail: e?.message ?? String(e) };
  }
}
