import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const expectedToken = (process.env.WECOM_GATEWAY_DEFAULT_BIND_CALLBACK_TOKEN || "").trim();
  const token = (req.headers.get("x-wecom-gateway-token") || "").trim();

  if (!expectedToken || token !== expectedToken) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const bindToken = (body?.bindToken || "").toString().trim();
  const wecomUserId = (body?.wecomUserId || "").toString().trim();

  if (!bindToken || !wecomUserId) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  try {
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from("wecom_bind_tokens")
      .select("user_id, expires_at, used")
      .eq("token", bindToken)
      .maybeSingle();

    if (tokenError || !tokenData) {
      return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 400 });
    }

    if ((tokenData as any).used) {
      return NextResponse.json({ ok: false, error: "token_used" }, { status: 400 });
    }

    const expiresAt = new Date((tokenData as any).expires_at as string);
    if (expiresAt < new Date()) {
      return NextResponse.json({ ok: false, error: "token_expired" }, { status: 400 });
    }

    const userId = (tokenData as any).user_id as number;
    const nowIso = new Date().toISOString();

    const { error: updateUserError } = await supabaseAdmin
      .from("users")
      .update({ wecom_user_id: wecomUserId, updated_at: nowIso })
      .eq("id", userId);

    if (updateUserError) {
      return NextResponse.json({ ok: false, error: "db" }, { status: 500 });
    }

    await supabaseAdmin.from("wecom_bind_tokens").update({ used: true }).eq("token", bindToken);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[api/wecom/bind-callback] error", e);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
