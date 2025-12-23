import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest } from "../../../lib/serverAuth";
import { ensureHasAnyPermission, ensureHasPermission } from "../../../lib/serverPermissions";


export const runtime = "edge";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeStats = searchParams.get("withStats") === "true";

    if (includeStats) {
      const authResult = await getBusinessUserFromRequest(req);
      if (authResult.errorResponse) {
        return authResult.errorResponse;
      }
      const permError = await ensureHasAnyPermission(authResult.user, [
        "settings.departments.view",
        "settings.departments.manage",
      ]);
      if (permError) {
        return permError;
      }

    }

    const { data, error } = await supabaseAdmin
      .from("departments")
      .select("id, name, slug")
      .order("id", { ascending: true });

    if (error) {
      console.error("[api/departments] query error", error);
      return NextResponse.json(
        { error: "failed to load departments", detail: error.message },
        { status: 500 },
      );
    }

    const items = (data || []).map((row) => ({
      id: row.id,
      name: row.name as string,
      slug: (row.slug as string | null) || null,
    }));

    return NextResponse.json({ items });
  } catch (error: any) {
    console.error("[api/departments] error", error);
    return NextResponse.json(
      {
        error: "failed to load departments",
        detail: error?.message ?? String(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const permError = await ensureHasPermission(authResult.user, "settings.departments.manage");
    if (permError) {
      return permError;
    }


    const body = await req.json();
    const rawName = (body.name as string | undefined) ?? "";
    const rawSlug = (body.slug as string | undefined) ?? "";

    const name = rawName.trim();
    let slug = rawSlug.trim();

    if (!name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 },
      );
    }

    if (!slug) {
      slug = name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
    }

    const { data, error } = await supabaseAdmin
      .from("departments")
      .insert({
        name,
        slug: slug || null,
      })
      .select("id, name, slug")
      .maybeSingle();

    if (error || !data) {
      console.error("[api/departments] insert error", error);
      return NextResponse.json(
        {
          error: "failed to create department",
          detail: error?.message ?? "insert failed",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        department: {
          id: data.id,
          name: data.name as string,
          slug: (data.slug as string | null) || null,
        },
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("[api/departments] create error", error);
    return NextResponse.json(
      {
        error: "failed to create department",
        detail: error?.message ?? String(error),
      },
      { status: 500 },
    );
  }
}
