import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest } from "../../../../lib/serverAuth";
import { ensureHasPermission } from "../../../../lib/serverPermissions";


export const runtime = "nodejs";

export async function PUT(
  req: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const permError = await ensureHasPermission(authResult.user, "settings.departments.manage");
    if (permError) {
      return permError;
    }


    const rawId = context.params.id;
    if (!rawId) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const id = Number.parseInt(rawId, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "id must be a positive integer" }, { status: 400 });
    }

    const body = await req.json();
    const rawName = (body.name as string | undefined) ?? "";
    const rawSlug = (body.slug as string | undefined) ?? "";

    const name = rawName.trim();
    const slugInput = rawSlug.trim();

    if (!name && !slugInput) {
      return NextResponse.json(
        { error: "name or slug is required" },
        { status: 400 },
      );
    }

    const updates: Record<string, any> = {};

    if (name) {
      updates.name = name;
    }

    if (slugInput) {
      const normalizedSlug = slugInput
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      updates.slug = normalizedSlug || null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "no valid fields to update" },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("departments")
      .update(updates)
      .eq("id", id)
      .select("id, name, slug")
      .maybeSingle();

    if (error || !data) {
      console.error("[api/departments/:id] update error", error);
      return NextResponse.json(
        {
          error: "failed to update department",
          detail: error?.message ?? "update failed",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      department: {
        id: data.id,
        name: data.name as string,
        slug: (data.slug as string | null) || null,
      },
    });
  } catch (error: any) {
    console.error("[api/departments/:id] update error", error);
    return NextResponse.json(
      {
        error: "failed to update department",
        detail: error?.message ?? String(error),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const permError = await ensureHasPermission(authResult.user, "settings.departments.manage");
    if (permError) {
      return permError;
    }


    const rawId = context.params.id;
    if (!rawId) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const id = Number.parseInt(rawId, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "id must be a positive integer" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("departments")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[api/departments/:id] delete error", error);
      return NextResponse.json(
        {
          error: "failed to delete department",
          detail: error.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[api/departments/:id] delete error", error);
    return NextResponse.json(
      {
        error: "failed to delete department",
        detail: error?.message ?? String(error),
      },
      { status: 500 },
    );
  }
}
