import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import type { BusinessUser } from "../../../../lib/serverAuth";
import { loadEffectivePermissionsForUser } from "../../../../lib/serverPermissions";


export const runtime = "nodejs";

interface SyncBody {
  authUserId?: string;
  email?: string;
  fullName?: string | null;
  name?: string | null;
  departmentId?: number | string | null;
}

function normalizeRole(raw: string | null | undefined): BusinessUser["role"] {
  const value = (raw || "").toString().toLowerCase();
  if (value === "admin") return "admin";
  if (value === "manager" || value === "dept-admin") return "manager";
  if (value === "viewer" || value === "guest") return "viewer";
  return "user";
}

function normalizeStatus(raw: string | null | undefined): BusinessUser["status"] {
  const value = (raw || "").toString().toLowerCase();
  if (value === "active") return "active";
  if (value === "disabled") return "disabled";
  return "pending";
}


export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SyncBody;
    const authUserIdRaw = body.authUserId || "";
    const emailRaw = body.email || "";
    const fullNameRaw = body.fullName ?? body.name ?? null;
    const departmentIdRaw = body.departmentId;

    const authUserId = authUserIdRaw.toString().trim();
    const email = emailRaw.toString().trim().toLowerCase();

    if (!authUserId || !email) {
      return NextResponse.json(
        { error: "authUserId and email are required" },
        { status: 400 },
      );
    }

    const fullName = fullNameRaw && fullNameRaw.toString().trim().length > 0
      ? fullNameRaw.toString().trim()
      : email.split("@")[0] || email;

    let departmentIdForInsert: number | null = null;
    if (departmentIdRaw !== undefined && departmentIdRaw !== null && departmentIdRaw !== "") {
      const deptIdNum = Number(departmentIdRaw);
      if (!Number.isNaN(deptIdNum)) {
        departmentIdForInsert = deptIdNum;
      }
    }

    const nowIso = new Date().toISOString();

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("users")
      .select("id, email, name, department_id, status, role, auth_user_id, last_login_at")
      .eq("email", email)
      .maybeSingle();

    if (existingError && existingError.code !== "PGRST116") {
      console.error("[api/auth/sync] load business user error", existingError);
      return NextResponse.json(
        { error: "failed to load business user", detail: existingError.message },
        { status: 500 },
      );
    }

    let businessUser: {
      id: number;
      email: string;
      name: string | null;
      department_id: number | null;
      status: string;
      role: string;
      last_login_at: string | null;
    } | null = null;

    if (existing) {
      const nextRole = normalizeRole(existing.role);
      const nextStatus = normalizeStatus(existing.status);

      const { data: updated, error: updateError } = await supabaseAdmin
        .from("users")
        .update({
          name: existing.name || fullName,
          auth_user_id: existing.auth_user_id || authUserId,
          last_login_at: nowIso,
          updated_at: nowIso,
          status: nextStatus,
          role: nextRole,
        })
        .eq("id", existing.id)
        .select("id, email, name, department_id, status, role, last_login_at")
        .maybeSingle();

      if (updateError || !updated) {
        console.error("[api/auth/sync] update business user error", updateError);
        return NextResponse.json(
          {
            error: "failed to update business user",
            detail: updateError?.message ?? "update failed",
          },
          { status: 500 },
        );
      }

      businessUser = {
        id: updated.id as number,
        email: updated.email as string,
        name: (updated.name as string) || null,
        department_id: (updated.department_id as number | null) ?? null,
        status: normalizeStatus(updated.status as string | null | undefined),
        role: normalizeRole(updated.role as string | null | undefined),
        last_login_at: (updated.last_login_at as string | null) ?? null,
      };
    } else {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("users")
        .insert({
          email,
          name: fullName,
          department_id: departmentIdForInsert,
          is_active: true,
          auth_user_id: authUserId,
          status: "pending",
          role: "user",
          last_login_at: nowIso,
        })
        .select("id, email, name, department_id, status, role, last_login_at")
        .maybeSingle();

      if (insertError || !inserted) {
        console.error("[api/auth/sync] insert business user error", insertError);
        return NextResponse.json(
          {
            error: "failed to create business user",
            detail: insertError?.message ?? "insert failed",
          },
          { status: 500 },
        );
      }

      businessUser = {
        id: inserted.id as number,
        email: inserted.email as string,
        name: (inserted.name as string) || null,
        department_id: (inserted.department_id as number | null) ?? null,
        status: normalizeStatus(inserted.status as string | null | undefined),
        role: normalizeRole(inserted.role as string | null | undefined),
        last_login_at: (inserted.last_login_at as string | null) ?? null,
      };
    }

    let departmentName: string | null = null;

    if (businessUser.department_id != null) {
      const { data: dept, error: deptError } = await supabaseAdmin
        .from("departments")
        .select("name")
        .eq("id", businessUser.department_id)
        .maybeSingle();

      if (deptError) {
        console.error("[api/auth/sync] load department for user error", deptError);
      } else if (dept) {
        departmentName = (dept.name as string) || null;
      }
    }

    let permissions: string[] = [];
    if (businessUser) {
      const effectiveUser: BusinessUser = {
        id: businessUser.id,
        email: businessUser.email,
        name: businessUser.name,
        departmentId: businessUser.department_id,
        status: normalizeStatus(businessUser.status),
        role: normalizeRole(businessUser.role),
      };
      const effectivePermissions = await loadEffectivePermissionsForUser(effectiveUser);
      permissions = effectivePermissions;
    }

    return NextResponse.json({
      user: {
        id: businessUser.id,
        email: businessUser.email,
        name: businessUser.name,
        departmentId: businessUser.department_id,
        departmentName,
        status: businessUser.status,
        role: businessUser.role,
        lastLoginAt: businessUser.last_login_at,
        permissions,
      },
    });

  } catch (error: any) {
    console.error("[api/auth/sync] error", error);
    return NextResponse.json(
      {
        error: "failed to sync auth user",
        detail: error?.message ?? String(error),
      },
      { status: 500 },
    );
  }
}
