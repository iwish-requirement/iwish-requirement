import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest } from "../../../../lib/serverAuth";
import { ensureHasAnyPermission, ensureHasPermission } from "../../../../lib/serverPermissions";

import { PERMISSIONS, type PermissionKey } from "../../../../lib/permissions";

export const runtime = "edge";

type RoleRow = {
  id: number;
  code: string | null;
  name: string;
  description: string | null;
  permissions: unknown;
  is_builtin: boolean | null;
};

type RoleDto = {
  id: number;
  code: string | null;
  name: string;
  description: string | null;
  permissions: PermissionKey[];
  isBuiltin: boolean;
};


function normalizePermissions(raw: unknown): PermissionKey[] {
  const list = Array.isArray(raw) ? raw : [];
  const validKeys = new Set<PermissionKey>(Object.keys(PERMISSIONS) as PermissionKey[]);
  const result: PermissionKey[] = [];

  for (const item of list) {
    if (typeof item !== "string") {
      continue;
    }
    if (validKeys.has(item as PermissionKey)) {
      result.push(item as PermissionKey);
    }
  }

  if (!result.length) {
    return [];
  }

  const deduplicated = Array.from(new Set(result));
  return deduplicated;
}

function shapeRole(row: RoleRow): RoleDto {
  return {
    id: row.id,
    code: row.code ?? null,
    name: row.name,
    description: row.description ?? null,
    permissions: normalizePermissions(row.permissions),
    isBuiltin: !!row.is_builtin,
  };
}


export async function GET(req: NextRequest) {
  const authResult = await getBusinessUserFromRequest(req);
  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }

  const permError = await ensureHasAnyPermission(authResult.user, [
    "settings.roles.view",
    "settings.roles.manage",
  ]);
  if (permError) {
    return permError;
  }




  const { data, error } = await supabaseAdmin
    .from("roles")
    .select("id, code, name, description, permissions, is_builtin")
    .order("id", { ascending: true });


  if (error) {
    console.error("[api/admin/roles] list roles error", error);
    return NextResponse.json(
      { error: "failed_to_load_roles", detail: error.message },
      { status: 500 },
    );
  }

  const rows = (data || []) as RoleRow[];
  const items = rows.map((row) => shapeRole(row));

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const authResult = await getBusinessUserFromRequest(req);
  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }

  const permError = await ensureHasPermission(authResult.user, "settings.roles.manage");
  if (permError) {
    return permError;
  }



  const body = await req.json();
  const rawId = body.id as number | string | null | undefined;
  const rawName = body.name as string | null | undefined;
  const rawDescription = body.description as string | null | undefined;
  const rawPermissions = body.permissions as unknown;

  const name = (rawName ?? "").toString().trim();
  if (!name) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }

  const description =
    rawDescription === null || rawDescription === undefined
      ? null
      : rawDescription.toString();
  const permissions = normalizePermissions(rawPermissions);

  const idNumber = rawId != null && rawId !== "" ? Number(rawId) : null;
  const nowPayload = {
    name,
    description,
    permissions,
  };

  if (idNumber != null && !Number.isNaN(idNumber) && idNumber > 0) {
    const { data, error } = await supabaseAdmin
      .from("roles")
      .update(nowPayload)
      .eq("id", idNumber)
      .select("id, name, description, permissions")
      .maybeSingle<RoleRow>();

    if (error || !data) {
      console.error("[api/admin/roles] update role error", error);
      return NextResponse.json(
        {
          error: "failed_to_update_role",
          detail: error?.message ?? "update failed",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ role: shapeRole(data) });
  }

  const { data, error } = await supabaseAdmin
    .from("roles")
    .insert({
      name,
      description,
      permissions,
    })
    .select("id, code, name, description, permissions, is_builtin")
    .maybeSingle<RoleRow>();


  if (error || !data) {
    console.error("[api/admin/roles] create role error", error);
    return NextResponse.json(
      {
        error: "failed_to_create_role",
        detail: error?.message ?? "insert failed",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ role: shapeRole(data) });
}

export async function DELETE(req: NextRequest) {
  const authResult = await getBusinessUserFromRequest(req);
  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }

  const permError = await ensureHasPermission(authResult.user, "settings.roles.manage");
  if (permError) {
    return permError;
  }



  const body = await req.json();
  const rawId = body.id as number | string | null | undefined;
  const id = rawId != null && rawId !== "" ? Number(rawId) : NaN;

  if (!id || Number.isNaN(id) || id <= 0) {
    return NextResponse.json({ error: "invalid_role_id" }, { status: 400 });
  }

  const { data: relationRows, error: relationError } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("role_id", id)
    .limit(1);

  if (relationError) {
    console.error("[api/admin/roles] check user_roles error", relationError);
    return NextResponse.json(
      {
        error: "failed_to_check_role_relations",
        detail: relationError.message,
      },
      { status: 500 },
    );
  }

  if (relationRows && relationRows.length > 0) {
    return NextResponse.json(
      {
        error: "role_in_use",
        detail: "该角色已绑定用户，请先在用户管理中取消绑定后再删除。",
      },
      { status: 400 },
    );
  }

  const { error } = await supabaseAdmin
    .from("roles")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[api/admin/roles] delete role error", error);
    return NextResponse.json(
      { error: "failed_to_delete_role", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
