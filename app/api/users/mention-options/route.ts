import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../lib/serverAuth";

export const runtime = "edge";

interface UserRow {
  id: number;
  name: string | null;
  email: string | null;
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const activeError = ensureActiveUser(authResult.user);
    if (activeError) {
      return activeError;
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, name, email")
      .eq("status", "active")
      .order("id", { ascending: true })
      .limit(100);

    if (error) {
      console.error("[api/users/mention-options] query users error", error);
      return NextResponse.json(
        { error: "failed to load mention users", detail: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { items: ((data || []) as UserRow[]) },
      {
        headers: {
          "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (error: any) {
    console.error("[api/users/mention-options] GET error", error);
    return NextResponse.json(
      {
        error: "failed to load mention users",
        detail: error?.message ?? String(error),
      },
      { status: 500 },
    );
  }
}
