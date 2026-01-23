export type WecomGatewayStatePayload = {
  systemKey: string;
  bindToken: string;
  returnTo?: string; // path on target system, e.g. "/profile"
  ts: number;
};

function base64Encode(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let bin = "";
  for (const b of bytes) {
    bin += String.fromCharCode(b);
  }
  // @ts-ignore
  return btoa(bin);
}

function base64DecodeToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }
  // @ts-ignore
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  return base64Encode(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecodeToBytes(input: string): Uint8Array {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (b64.length % 4)) % 4;
  const padded = b64 + "=".repeat(padLen);
  return base64DecodeToBytes(padded);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

async function hmacSha256Base64Url(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return base64UrlEncodeBytes(new Uint8Array(sigBuf));
}

export async function signWecomGatewayState(
  secret: string,
  payload: Omit<WecomGatewayStatePayload, "ts"> & { ts?: number },
): Promise<string> {
  const fullPayload: WecomGatewayStatePayload = {
    systemKey: payload.systemKey,
    bindToken: payload.bindToken,
    returnTo: payload.returnTo,
    ts: typeof payload.ts === "number" ? payload.ts : Date.now(),
  };

  const raw = JSON.stringify(fullPayload);
  const encoded = base64UrlEncodeBytes(new TextEncoder().encode(raw));
  const sig = await hmacSha256Base64Url(secret, encoded);
  return `${encoded}.${sig}`;
}

export async function verifyWecomGatewayState(params: {
  secret: string;
  state: string;
  maxAgeMs?: number;
}): Promise<{ ok: true; payload: WecomGatewayStatePayload } | { ok: false; error: string }> {
  const { secret, state, maxAgeMs } = params;

  const trimmed = (state || "").trim();
  const parts = trimmed.split(".");
  if (parts.length !== 2) {
    return { ok: false, error: "invalid_state_format" };
  }

  const [encoded, sig] = parts;
  if (!encoded || !sig) {
    return { ok: false, error: "invalid_state_format" };
  }

  const expected = await hmacSha256Base64Url(secret, encoded);
  const a = new TextEncoder().encode(expected);
  const b = new TextEncoder().encode(sig);
  if (!timingSafeEqual(a, b)) {
    return { ok: false, error: "invalid_state_signature" };
  }

  try {
    const buf = base64UrlDecodeToBytes(encoded);
    const payload = JSON.parse(new TextDecoder().decode(buf)) as WecomGatewayStatePayload;

    if (!payload?.systemKey || !payload.bindToken || typeof payload.ts !== "number") {
      return { ok: false, error: "invalid_state_payload" };
    }

    if (maxAgeMs && maxAgeMs > 0) {
      const age = Date.now() - payload.ts;
      if (age < 0 || age > maxAgeMs) {
        return { ok: false, error: "state_expired" };
      }
    }

    return { ok: true, payload };
  } catch {
    return { ok: false, error: "invalid_state_payload" };
  }
}
