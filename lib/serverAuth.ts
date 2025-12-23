import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "./supabaseAdmin";

export type BusinessUser = {
  id: number;
  email: string;
  name: string | null;
  departmentId: number | null;
  status: "pending" | "active" | "disabled";
  role: "admin" | "manager" | "viewer" | "user";
};

function normalizeRole(raw: string | null | undefined): "admin" | "manager" | "viewer" | "user" {
  const value = (raw || "").toString().toLowerCase();
  if (value === "admin") return "admin";
  if (value === "manager" || value === "dept-admin") return "manager";
  if (value === "viewer" || value === "guest") return "viewer";
  return "user";
}

function normalizeStatus(raw: string | null | undefined): "pending" | "active" | "disabled" {
  const value = (raw || "").toString().toLowerCase();
  if (value === "active") return "active";
  if (value === "disabled") return "disabled";
  return "pending";
}

export async function getBusinessUserFromRequest(req: NextRequest): Promise<{
  user: BusinessUser | null;
  errorResponse?: NextResponse;
}> {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return {
      user: null,
      errorResponse: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return {
      user: null,
      errorResponse: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    console.error("[serverAuth] getUser error", authError);
    return {
      user: null,
      errorResponse: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  const email = (authData.user.email || "").toLowerCase();
  if (!email) {
    return {
      user: null,
      errorResponse: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }

  const { data: row, error: userError } = await supabaseAdmin
    .from("users")
    .select("id, email, name, department_id, status, role")
    .eq("email", email)
    .maybeSingle();

  if (userError) {
    console.error("[serverAuth] load business user error", userError);
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "failed to load user", detail: userError.message },
        { status: 500 },
      ),
    };
  }

  if (!row) {
    return {
      user: null,
      errorResponse: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }

  const user: BusinessUser = {
    id: row.id as number,
    email: row.email as string,
    name: (row.name as string | null) ?? null,
    departmentId: (row.department_id as number | null) ?? null,
    status: normalizeStatus(row.status as string | null | undefined),
    role: normalizeRole(row.role as string | null | undefined),
  };

  return { user };
}

export function ensureActiveUser(user: BusinessUser | null): NextResponse | null {
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (user.status !== "active") {
    return NextResponse.json(
      { error: "forbidden", detail: "账号状态异常，无法执行该操作" },
      { status: 403 },
    );
  }

  return null;
}

export function ensureAdmin(user: BusinessUser | null): NextResponse | null {
  const statusError = ensureActiveUser(user);
  if (statusError) {
    return statusError;
  }

  if (!user || user.role !== "admin") {
    return NextResponse.json(
      { error: "forbidden", detail: "仅管理员可以执行此操作" },
      { status: 403 },
    );
  }

  return null;
}
