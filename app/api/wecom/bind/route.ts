import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../lib/serverAuth";

export const runtime = "edge";

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

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("wecom_user_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[api/wecom/bind] load wecom_user_id error", error);
    return NextResponse.json(
      { error: "failed_to_load_wecom_binding", detail: error.message },
      { status: 500 },
    );
  }

  const wecomUserId = (data?.wecom_user_id as string | null) ?? null;
  return NextResponse.json({ wecomUserId });
}

export async function POST(req: NextRequest) {
  const authResult = await getBusinessUserFromRequest(req);
  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }
  const activeError = ensureActiveUser(authResult.user);
  if (activeError) {
    return activeError;
  }

  const body = await req.json();
  const rawWecomUserId = body.wecomUserId as string | null | undefined;
  const userId = authResult.user!.id;

  const trimmed = rawWecomUserId == null ? "" : rawWecomUserId.toString().trim();
  const nextWecomUserId = trimmed || null;

  const nowIso = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("users")
    .update({
      wecom_user_id: nextWecomUserId,
      updated_at: nowIso,
    })
    .eq("id", userId);

  if (error) {
    console.error("[api/wecom/bind] update wecom_user_id error", error);
    return NextResponse.json(
      { error: "failed_to_update_wecom_binding", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ wecomUserId: nextWecomUserId });
}
