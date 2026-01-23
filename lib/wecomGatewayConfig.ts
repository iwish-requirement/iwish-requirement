export type WecomGatewaySystemConfig = {
  systemKey: string;
  systemToken: string;
  baseUrl: string;
  bindCallbackPath: string;
  bindCallbackToken: string;
  corpId: string;
  agentId: string;
  appSecret: string;
};

function normalizeBaseUrl(input: string): string {
  const trimmed = (input || "").trim();
  return trimmed.replace(/\/+$/, "");
}

function safeParseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadWecomGatewaySystems(): Map<string, WecomGatewaySystemConfig> {
  const map = new Map<string, WecomGatewaySystemConfig>();

  const jsonRaw = process.env.WECOM_GATEWAY_SYSTEMS_JSON;
  if (jsonRaw && jsonRaw.trim()) {
    const parsed = safeParseJson<any[]>(jsonRaw.trim());
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        const systemKey = (item?.systemKey ?? item?.key ?? "").toString().trim();
        if (!systemKey) continue;

        const cfg: WecomGatewaySystemConfig = {
          systemKey,
          systemToken: (item?.systemToken ?? item?.token ?? "").toString().trim(),
          baseUrl: normalizeBaseUrl(item?.baseUrl ?? ""),
          bindCallbackPath: (item?.bindCallbackPath ?? "/api/wecom/bind-callback").toString().trim() || "/api/wecom/bind-callback",
          bindCallbackToken: (item?.bindCallbackToken ?? "").toString().trim(),
          corpId: (item?.corpId ?? process.env.WECOM_CORP_ID ?? "").toString().trim(),
          agentId: (item?.agentId ?? process.env.WECOM_AGENT_ID ?? "").toString().trim(),
          appSecret: (item?.appSecret ?? process.env.WECOM_APP_SECRET ?? "").toString().trim(),
        };

        if (!cfg.systemToken || !cfg.baseUrl || !cfg.bindCallbackToken || !cfg.corpId || !cfg.agentId || !cfg.appSecret) {
          // 配置不完整就跳过，避免把半残配置写进 map
          continue;
        }

        map.set(systemKey, cfg);
      }
    }
  }

  // 兜底：允许单系统模式（主要用于当前系统先跑起来）
  if (map.size === 0) {
    const systemKey = (process.env.WECOM_GATEWAY_DEFAULT_SYSTEM_KEY || "requirement").trim();
    const cfg: WecomGatewaySystemConfig = {
      systemKey,
      systemToken: (process.env.WECOM_GATEWAY_DEFAULT_SYSTEM_TOKEN || "").trim(),
      baseUrl: normalizeBaseUrl(process.env.APP_PUBLIC_URL || ""),
      bindCallbackPath: (process.env.WECOM_GATEWAY_DEFAULT_BIND_CALLBACK_PATH || "/api/wecom/bind-callback").trim(),
      bindCallbackToken: (process.env.WECOM_GATEWAY_DEFAULT_BIND_CALLBACK_TOKEN || "").trim(),
      corpId: (process.env.WECOM_CORP_ID || "").trim(),
      agentId: (process.env.WECOM_AGENT_ID || "").trim(),
      appSecret: (process.env.WECOM_APP_SECRET || "").trim(),
    };

    if (cfg.systemToken && cfg.baseUrl && cfg.bindCallbackToken && cfg.corpId && cfg.agentId && cfg.appSecret) {
      map.set(systemKey, cfg);
    }
  }

  return map;
}

export function getWecomGatewayStateSecret(): string | null {
  const v = (process.env.WECOM_GATEWAY_STATE_SECRET || "").trim();
  return v ? v : null;
}

export function getWecomGatewayCallbackUrl(cfg: WecomGatewaySystemConfig): string {
  const base = normalizeBaseUrl(cfg.baseUrl);
  const path = (cfg.bindCallbackPath || "/api/wecom/bind-callback").trim();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
