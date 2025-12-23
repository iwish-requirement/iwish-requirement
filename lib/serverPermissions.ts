import { NextResponse } from "next/server";
import { supabaseAdmin } from "./supabaseAdmin";
import type { BusinessUser } from "./serverAuth";
import { PERMISSIONS, type PermissionKey } from "./permissions";

import { ensureActiveUser } from "./serverAuth";

async function loadDbPermissionsForUser(userId: number): Promise<PermissionKey[]> {
  const { data: userRoleRows, error: userRoleError } = await supabaseAdmin
    .from("user_roles")
    .select("role_id")
    .eq("user_id", userId);

  if (userRoleError) {
    console.error("[serverPermissions] load user_roles error", userRoleError);
    return [];
  }

  const roleIds = (userRoleRows || [])
    .map((row: { role_id?: number | null }) => row.role_id)
    .filter((id): id is number => typeof id === "number" && Number.isFinite(id));

  if (!roleIds.length) {
    return [];
  }

  const { data: roleRows, error: roleError } = await supabaseAdmin
    .from("roles")
    .select("id, permissions")
    .in("id", roleIds);

  if (roleError) {
    console.error("[serverPermissions] load roles error", roleError);
    return [];
  }

  const collected = new Set<PermissionKey>();

  const rows = (roleRows || []) as { permissions?: unknown }[];
  rows.forEach((row) => {
    const rawPermissions = Array.isArray(row.permissions) ? row.permissions : [];
    rawPermissions.forEach((key) => {
      if (typeof key !== "string") {
        return;
      }

      const mapped: string[] = (() => {
        if (key === "settings.manage") {
          return ["settings.global.view", "settings.global.manage"];
        }
        if (key === "settings.access_shell") {
          return ["settings.access_shell"];
        }
        if (key === "department.fields_manage") {
          return ["settings.fields.view", "department.fields_manage"];
        }

        if (key === "admin.user_manage") {
          return [
            "admin.user_manage",
            "settings.roles.view",
            "settings.roles.manage",
            "settings.scoring.view",
            "settings.scoring.manage",
            "settings.score_periods.view",
            "settings.score_periods.manage",
          ];
        }
        return [key];
      })();

      mapped.forEach((perm) => {
        if (Object.prototype.hasOwnProperty.call(PERMISSIONS, perm)) {
          collected.add(perm as PermissionKey);
        }
      });
    });
  });


  return Array.from(collected);
}

export async function loadEffectivePermissionsForUser(user: BusinessUser): Promise<PermissionKey[]> {
  const dbPermissions = await loadDbPermissionsForUser(user.id);
  return dbPermissions;
}



export async function ensureHasPermission(
  user: BusinessUser | null,
  permission: PermissionKey,
): Promise<NextResponse | null> {
  const statusError = ensureActiveUser(user);
  if (statusError) {
    return statusError;
  }

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const permissions = await loadEffectivePermissionsForUser(user);
  if (!permissions.includes(permission)) {
    return NextResponse.json(
      { error: "forbidden", detail: "当前账号未被授予执行该操作的权限" },
      { status: 403 },
    );
  }

  return null;
}

export async function ensureHasAnyPermission(
  user: BusinessUser | null,
  permissionsToCheck: PermissionKey[],
): Promise<NextResponse | null> {
  const statusError = ensureActiveUser(user);
  if (statusError) {
    return statusError;
  }

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const permissions = await loadEffectivePermissionsForUser(user);
  const allowed = permissionsToCheck.some((key) => permissions.includes(key));
  if (!allowed) {
    return NextResponse.json(
      { error: "forbidden", detail: "当前账号未被授予执行该操作的权限" },
      { status: 403 },
    );
  }

  return null;
}

