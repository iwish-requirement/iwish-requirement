import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../lib/serverAuth";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) return authResult.errorResponse;
    const activeError = ensureActiveUser(authResult.user);
    if (activeError) return activeError;

    const url = new URL(req.url);
    const inputType = (url.searchParams.get("type") || "").trim();
    let query = supabaseAdmin
      .from("user_recent_inputs")
      .select("id, input_type, value, metadata, last_used_at")
      .eq("user_id", authResult.user!.id)
      .order("last_used_at", { ascending: false })
      .limit(50);

    if (inputType) {
      query = query.eq("input_type", inputType);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[api/user-recent-inputs] query error", error);
      return NextResponse.json({ error: "failed_to_load_recent_inputs", detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ items: data || [] });
  } catch (error: any) {
    console.error("[api/user-recent-inputs] unexpected error", error);
    return NextResponse.json({ error: "failed_to_load_recent_inputs", detail: error?.message ?? String(error) }, { status: 500 });
  }
}
