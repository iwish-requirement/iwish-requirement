import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureAdmin } from "../../../../lib/serverAuth";

export const runtime = "edge";

type RawUserRow = {
  id: number;
  auth_user_id?: string | null;
  email: string;
  name: string | null;
  department_id: number | null;
  position: string | null;
  status: string | null;
  role: string | null;
  is_active: boolean | null;
  last_login_at: string | null;
};

type RawDepartmentRow = {
  id: number;
  name: string;
};

type BusinessUserDto = {
  id: number;
  email: string;
  name: string | null;
  departmentId: number | null;
  departmentName: string | null;
  position: string | null;
  status: string;
  role: string;
  lastLoginAt: string | null;
  dbRoleNames: string[];
};


function normalizeRole(raw: string | null | undefined): string {
  const value = (raw || "").toString().toLowerCase();
  if (value === "admin") return "admin";
  if (value === "manager" || value === "dept-admin") return "manager";
  if (value === "viewer" || value === "guest") return "viewer";
  return "user";
}

function normalizeStatus(raw: string | null | undefined): string {
  const value = (raw || "").toString().toLowerCase();
  if (value === "active") return "active";
  if (value === "disabled") return "disabled";
  return "pending";
}

function shapeUser(
  row: RawUserRow,
  deptMap: Map<number, RawDepartmentRow>,
  dbRoleNamesMap?: Map<number, string[]>,
): BusinessUserDto {
  const status = normalizeStatus(row.status);
  const role = normalizeRole(row.role);
  const departmentId = row.department_id ?? null;
  const department =
    departmentId != null ? deptMap.get(departmentId) || null : null;
  const dbRoleNames =
    dbRoleNamesMap && dbRoleNamesMap.has(row.id)
      ? dbRoleNamesMap.get(row.id) || []
      : [];

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    departmentId,
    departmentName: department ? department.name : null,
    position: row.position ?? null,
    status,
    role,
    lastLoginAt: row.last_login_at,
    dbRoleNames,
  };
}


async function loadDepartmentMap(): Promise<Map<number, RawDepartmentRow>> {
  const { data, error } = await supabaseAdmin
    .from("departments")
    .select("id, name");

  const map = new Map<number, RawDepartmentRow>();

  if (error || !data) {
    if (error) {
      console.error("[api/admin/users] load departments error", error);
    }
    return map;
  }

  for (const row of data) {
    map.set(row.id as number, {
      id: row.id as number,
      name: row.name as string,
    });
  }

  return map;
}

async function loadDbRoleNamesForUsers(
  rows: RawUserRow[],
): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>();

  if (!rows.length) {
    return map;
  }

  const userIds = Array.from(
    new Set(
      rows
        .map((row) => row.id)
        .filter(
          (id) => typeof id === "number" && Number.isFinite(id) && id > 0,
        ),
    ),
  );

  if (!userIds.length) {
    return map;
  }

  const { data: userRoleRows, error: userRolesError } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, role_id")
    .in("user_id", userIds);

  if (userRolesError || !userRoleRows) {
    if (userRolesError) {
      console.error(
        "[api/admin/users] load user_roles for list error",
        userRolesError,
      );
    }
    return map;
  }

  const roleIds = Array.from(
    new Set(
      (userRoleRows as { user_id: number; role_id: number | null }[])
        .map((row) => row.role_id)
        .filter(
          (id): id is number =>
            typeof id === "number" && Number.isFinite(id) && id > 0,
        ),
    ),
  );

  if (!roleIds.length) {
    return map;
  }

  const { data: roleRows, error: rolesError } = await supabaseAdmin
    .from("roles")
    .select("id, name")
    .in("id", roleIds);

  if (rolesError || !roleRows) {
    if (rolesError) {
      console.error(
        "[api/admin/users] load roles for dbRoleNames error",
        rolesError,
      );
    }
    return map;
  }

  const roleNameMap = new Map<number, string>();
  for (const row of roleRows as { id: number; name: string }[]) {
    roleNameMap.set(row.id, row.name);
  }

  for (const row of userRoleRows as { user_id: number; role_id: number | null }[]) {
    const userId = row.user_id;
    const roleId = row.role_id;
    if (typeof roleId !== "number" || !Number.isFinite(roleId) || roleId <= 0) {
      continue;
    }
    const roleName = roleNameMap.get(roleId);
    if (!roleName) {
      continue;
    }
    const existing = map.get(userId) || [];
    existing.push(roleName);
    map.set(userId, existing);
  }

  return map;
}

export async function GET(req: NextRequest) {

  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const forbidden = ensureAdmin(authResult.user);
    if (forbidden) {
      return forbidden;
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, email, name, department_id, position, status, role, is_active, last_login_at")
      .order("id", { ascending: true });

    if (error) {
      console.error("[api/admin/users] list users error", error);
      return NextResponse.json(
        { error: "failed to load users", detail: error.message },
        { status: 500 },
      );
    }

    const allRows = (data || []) as RawUserRow[];
    const [deptMap, dbRoleNamesMap] = await Promise.all([
      loadDepartmentMap(),
      loadDbRoleNamesForUsers(allRows),
    ]);

    let shaped = allRows.map((row) => shapeUser(row, deptMap, dbRoleNamesMap));

    if (statusFilter) {
      const normalized = normalizeStatus(statusFilter);
      shaped = shaped.filter((u) => u.status === normalized);
    }

    return NextResponse.json(
      { items: shaped },
      {
        headers: {
          "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
        },
      },
    );

  } catch (error: any) {
    console.error("[api/admin/users] GET error", error);
    return NextResponse.json(
      { error: "failed to list users", detail: error?.message ?? String(error) },
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
    const forbidden = ensureAdmin(authResult.user);
    if (forbidden) {
      return forbidden;
    }

    const body = await req.json();
    const emailRaw = (body.email ?? "").toString();
    const nameRaw = body.name as string | null | undefined;
    const roleRaw = body.role as string | null | undefined;
    const statusRaw = body.status as string | null | undefined;

    const email = emailRaw.trim().toLowerCase();
    if (!email) {
      return NextResponse.json(
        { error: "email is required" },
        { status: 400 },
      );
    }

    const name =
      (nameRaw && nameRaw.toString().trim()) ||
      email.split("@")[0] ||
      email;

    const role = normalizeRole(roleRaw);
    const status = normalizeStatus(statusRaw);
    const nowIso = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("users")
      .insert({
        email,
        name,
        department_id: null,
        position: null,
        is_active: true,
        status,
        role,
        last_login_at: null,
        updated_at: nowIso,
      })
      .select("id, email, name, department_id, position, status, role, is_active, last_login_at")
      .maybeSingle();

    if (error || !data) {
      console.error("[api/admin/users] insert user error", error);
      return NextResponse.json(
        {
          error: "failed to create user",
          detail: error?.message ?? "insert failed",
        },
        { status: 500 },
      );
    }

    const deptMap = await loadDepartmentMap();
    const user = shapeUser(data as RawUserRow, deptMap);

    return NextResponse.json({ user });


  } catch (error: any) {
    console.error("[api/admin/users] POST error", error);
    return NextResponse.json(
      { error: "failed to create user", detail: error?.message ?? String(error) },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const forbidden = ensureAdmin(authResult.user);
    if (forbidden) {
      return forbidden;
    }

    const body = await req.json();
    const idRaw = body.id;
    const statusRaw = body.status as string | null | undefined;
    const roleRaw = body.role as string | null | undefined;
    const positionRaw = body.position as string | null | undefined;
    const departmentIdRaw = body.departmentId as number | string | null | undefined;

    const id = Number(idRaw);
    if (!id || Number.isNaN(id)) {
      return NextResponse.json(
        { error: "valid id is required" },
        { status: 400 },
      );
    }

    const updateData: Record<string, any> = {};
    const nowIso = new Date().toISOString();
    updateData.updated_at = nowIso;

    if (statusRaw != null) {
      updateData.status = normalizeStatus(statusRaw);
    }

    if (roleRaw != null) {
      updateData.role = normalizeRole(roleRaw);
    }

    if (positionRaw !== undefined) {
      const position = (positionRaw || "").toString().trim().toLowerCase();
      updateData.position = position || null;
    }

    if (departmentIdRaw !== undefined) {
      if (departmentIdRaw === null || departmentIdRaw === "") {
        updateData.department_id = null;
      } else {
        const deptIdNum = Number(departmentIdRaw);
        if (!Number.isNaN(deptIdNum)) {
          updateData.department_id = deptIdNum;
        }
      }
    }

    if (Object.keys(updateData).length <= 1) {
      return NextResponse.json(
        { error: "nothing to update" },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .update(updateData)
      .eq("id", id)
      .select("id, email, name, department_id, position, status, role, is_active, last_login_at")
      .maybeSingle();

    if (error || !data) {
      console.error("[api/admin/users] update user error", error);
      return NextResponse.json(
        {
          error: "failed to update user",
          detail: error?.message ?? "update failed",
        },
        { status: 500 },
      );
    }

    const deptMap = await loadDepartmentMap();
    const user = shapeUser(data as RawUserRow, deptMap);

    return NextResponse.json({ user });


  } catch (error: any) {
    console.error("[api/admin/users] PATCH error", error);
    return NextResponse.json(
      { error: "failed to update user", detail: error?.message ?? String(error) },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const forbidden = ensureAdmin(authResult.user);
    if (forbidden) {
      return forbidden;
    }

    const body = await req.json();
    const idRaw = body.id;
    const mode = (body.mode ?? "").toString();
    const id = Number(idRaw);

    if (!id || Number.isNaN(id)) {
      return NextResponse.json(
        { error: "valid id is required" },
        { status: 400 },
      );
    }

    if (mode === "reject_pending") {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("users")
        .select("id, auth_user_id, email, name, department_id, position, status, role, is_active, last_login_at")
        .eq("id", id)
        .maybeSingle();

      if (existingError || !existing) {
        console.error("[api/admin/users] load pending user for reject error", existingError);
        return NextResponse.json(
          {
            error: "failed to load pending user",
            detail: existingError?.message ?? "user not found",
          },
          { status: existingError ? 500 : 404 },
        );
      }

      const existingUser = existing as RawUserRow;
      if (normalizeStatus(existingUser.status) !== "pending") {
        return NextResponse.json(
          { error: "only pending users can be rejected" },
          { status: 400 },
        );
      }

      const authUserId = (existingUser.auth_user_id || "").trim();
      if (authUserId) {
        const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
        if (deleteAuthError) {
          console.error("[api/admin/users] delete auth user for reject error", deleteAuthError);
          return NextResponse.json(
            {
              error: "failed to delete auth user",
              detail: deleteAuthError.message,
            },
            { status: 500 },
          );
        }
      }

      const { error: deleteRolesError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", id);

      if (deleteRolesError) {
        console.error("[api/admin/users] delete pending user roles error", deleteRolesError);
        return NextResponse.json(
          {
            error: "failed to delete user roles",
            detail: deleteRolesError.message,
          },
          { status: 500 },
        );
      }

      const { error: deleteUserError } = await supabaseAdmin
        .from("users")
        .delete()
        .eq("id", id)
        .eq("status", "pending");

      if (deleteUserError) {
        console.error("[api/admin/users] delete pending user error", deleteUserError);
        return NextResponse.json(
          {
            error: "failed to reject pending user",
            detail: deleteUserError.message,
          },
          { status: 500 },
        );
      }

      return NextResponse.json({ deleted: true, id });
    }

    const nowIso = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("users")
      .update({
        is_active: false,
        status: "disabled",
        updated_at: nowIso,
      })
      .eq("id", id)
      .select("id, email, name, department_id, position, status, role, is_active, last_login_at")
      .maybeSingle();

    if (error || !data) {
      console.error("[api/admin/users] delete user error", error);
      return NextResponse.json(
        {
          error: "failed to delete user",
          detail: error?.message ?? "delete failed",
        },
        { status: 500 },
      );
    }

    const deptMap = await loadDepartmentMap();
    const user = shapeUser(data as RawUserRow, deptMap);

    return NextResponse.json({ user });


  } catch (error: any) {
    console.error("[api/admin/users] DELETE error", error);
    return NextResponse.json(
      { error: "failed to delete user", detail: error?.message ?? String(error) },
      { status: 500 },
    );
  }
}
