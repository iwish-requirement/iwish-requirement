import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../lib/serverAuth";

export const runtime = "nodejs";

const DEPT_SLUG_MAP: Record<string, string> = {
  d1: "tech",
  d2: "design",
  d3: "marketing",
  d4: "sales",
};

interface UserRow {
  id: number;
  name: string | null;
  email: string | null;
  department_id: number | null;
  status: string | null;
}

interface UserOptionDto {
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

    const url = new URL(req.url);
    const departmentKey = url.searchParams.get("departmentKey");
    const departmentIdParam = url.searchParams.get("departmentId");

    let deptIdToUse: number | null = null;

    if (departmentIdParam) {
      const parsed = Number.parseInt(departmentIdParam, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        deptIdToUse = parsed;
      }
    }

    if (!deptIdToUse) {
      if (!departmentKey) {
        return NextResponse.json(
          { error: "departmentId or departmentKey is required" },
          { status: 400 },
        );
      }

      const deptSlug = DEPT_SLUG_MAP[departmentKey];
      if (!deptSlug) {
        return NextResponse.json(
          { error: "invalid departmentKey" },
          { status: 400 },
        );
      }

      const { data: dept, error: deptError } = await supabaseAdmin
        .from("departments")
        .select("id")
        .eq("slug", deptSlug)
        .maybeSingle();

      if (deptError) {
        console.error("[api/users/by-department] load department error", deptError);
        return NextResponse.json(
          { error: "failed to load department", detail: deptError.message },
          { status: 500 },
        );
      }

      if (!dept) {
        return NextResponse.json(
          { error: "department not found" },
          { status: 404 },
        );
      }

      deptIdToUse = dept.id as number;
    }

    if (!deptIdToUse) {
      return NextResponse.json(
        { error: "department not found" },
        { status: 404 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, name, email, department_id, status")
      .eq("department_id", deptIdToUse)
      .eq("status", "active")
      .order("id", { ascending: true });

    if (error) {
      console.error("[api/users/by-department] query users error", error);
      return NextResponse.json(
        { error: "failed to load users", detail: error.message },
        { status: 500 },
      );
    }

    const rows: UserRow[] = (data || []) as UserRow[];

    const items: UserOptionDto[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
    }));

    return NextResponse.json({ items });
  } catch (error: any) {
    console.error("[api/users/by-department] GET error", error);
    return NextResponse.json(
      {
        error: "failed to load users",
        detail: error?.message ?? String(error),
      },
      { status: 500 },
    );
  }
}
