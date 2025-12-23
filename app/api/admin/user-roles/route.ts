import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest } from "../../../../lib/serverAuth";
import { ensureHasPermission } from "../../../../lib/serverPermissions";
import { PERMISSIONS, type PermissionKey } from "../../../../lib/permissions";

export const runtime = "nodejs";

type RoleRow = {
  id: number;
  name: string;
  description: string | null;
  permissions: unknown;
};

type RoleDto = {
  id: number;
  name: string;
  description: string | null;
  permissions: PermissionKey[];
};

type UserRoleRow = {
  role_id: number | null;
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
    name: row.name,
    description: row.description ?? null,
    permissions: normalizePermissions(row.permissions),
  };
}

export async function GET(req: NextRequest) {
  const authResult = await getBusinessUserFromRequest(req);
  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }

  const permError = await ensureHasPermission(authResult.user, "admin.user_manage");
  if (permError) {
    return permError;
  }

  const url = new URL(req.url);
  const userIdParam = url.searchParams.get("userId");
  const userId = userIdParam != null && userIdParam !== "" ? Number(userIdParam) : NaN;

  if (!userId || Number.isNaN(userId) || userId <= 0) {
    return NextResponse.json({ error: "invalid_user_id" }, { status: 400 });
  }

  const { data: roleRows, error: rolesError } = await supabaseAdmin
    .from("roles")
    .select("id, name, description, permissions")
    .order("id", { ascending: true });

  if (rolesError) {
    console.error("[api/admin/user-roles] load roles error", rolesError);
    return NextResponse.json(
      { error: "failed_to_load_roles", detail: rolesError.message },
      { status: 500 },
    );
  }

  const { data: userRoleRows, error: userRolesError } = await supabaseAdmin
    .from("user_roles")
    .select("role_id")
    .eq("user_id", userId);

  if (userRolesError) {
    console.error("[api/admin/user-roles] load user_roles error", userRolesError);
    return NextResponse.json(
      { error: "failed_to_load_user_roles", detail: userRolesError.message },
      { status: 500 },
    );
  }

  const roles = ((roleRows || []) as RoleRow[]).map((row) => shapeRole(row));
  const assignedRoleIds = ((userRoleRows || []) as UserRoleRow[])
    .map((row) => (typeof row.role_id === "number" ? row.role_id : null))
    .filter((id): id is number => id !== null && Number.isFinite(id));

  return NextResponse.json({ roles, assignedRoleIds });
}

export async function POST(req: NextRequest) {
  const authResult = await getBusinessUserFromRequest(req);
  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }

  const permError = await ensureHasPermission(authResult.user, "admin.user_manage");
  if (permError) {
    return permError;
  }

  const body = await req.json();
  const rawUserId = body.userId as number | string | null | undefined;
  const rawRoleIds = body.roleIds as unknown;

  const userId = rawUserId != null && rawUserId !== "" ? Number(rawUserId) : NaN;
  if (!userId || Number.isNaN(userId) || userId <= 0) {
    return NextResponse.json({ error: "invalid_user_id" }, { status: 400 });
  }

  const rawList = Array.isArray(rawRoleIds) ? rawRoleIds : [];
  const roleIds = Array.from(
    new Set(
      rawList
        .map((value) => {
          const num = typeof value === "number" ? value : Number(value);
          return Number.isFinite(num) ? num : null;
        })
        .filter((value): value is number => value !== null && value > 0),
    ),
  );

  if (!roleIds.length) {
    const { error: deleteError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      console.error("[api/admin/user-roles] clear user_roles error", deleteError);
      return NextResponse.json(
        { error: "failed_to_update_user_roles", detail: deleteError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ userId, roleIds: [] });
  }

  const { data: existingRoles, error: rolesError } = await supabaseAdmin
    .from("roles")
    .select("id")
    .in("id", roleIds);

  if (rolesError) {
    console.error("[api/admin/user-roles] validate roles error", rolesError);
    return NextResponse.json(
      { error: "failed_to_validate_roles", detail: rolesError.message },
      { status: 500 },
    );
  }

  const validRoleIds = new Set<number>(
    ((existingRoles || []) as { id: number }[]).map((row) => row.id),
  );
  const filteredRoleIds = roleIds.filter((id) => validRoleIds.has(id));

  const { error: deleteError } = await supabaseAdmin
    .from("user_roles")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    console.error("[api/admin/user-roles] clear user_roles error", deleteError);
    return NextResponse.json(
      { error: "failed_to_update_user_roles", detail: deleteError.message },
      { status: 500 },
    );
  }

  if (!filteredRoleIds.length) {
    return NextResponse.json({ userId, roleIds: [] });
  }

  const rowsToInsert = filteredRoleIds.map((roleId) => ({
    user_id: userId,
    role_id: roleId,
  }));

  const { error: insertError } = await supabaseAdmin
    .from("user_roles")
    .insert(rowsToInsert);

  if (insertError) {
    console.error("[api/admin/user-roles] insert user_roles error", insertError);
    return NextResponse.json(
      { error: "failed_to_update_user_roles", detail: insertError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ userId, roleIds: filteredRoleIds });
}
