import { NextResponse } from "next/server";
import type { BusinessUser } from "./serverAuth";

export type StatsScope = {
  scope: "company" | "department";
  departmentId: number | null;
};

type ResolveStatsScopeOptions = {
  requireDepartment?: boolean;
};

function parseDepartmentId(raw: string | null): {
  value: number | null;
  requestedCompany: boolean;
  invalid: boolean;
} {
  if (!raw || !raw.trim() || raw.trim() === "all") {
    return { value: null, requestedCompany: true, invalid: false };
  }

  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { value: null, requestedCompany: false, invalid: true };
  }

  return { value: parsed, requestedCompany: false, invalid: false };
}

export function resolveStatsScopeForUser(
  user: BusinessUser | null,
  departmentIdParam: string | null,
  options: ResolveStatsScopeOptions = {},
): { scope?: StatsScope; errorResponse?: NextResponse } {
  if (!user) {
    return { errorResponse: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }

  const parsed = parseDepartmentId(departmentIdParam);
  if (parsed.invalid) {
    return {
      errorResponse: NextResponse.json(
        { error: "invalid_department_id", detail: "departmentId 必须是正整数" },
        { status: 400 },
      ),
    };
  }

  if (user.role === "admin") {
    if (parsed.value !== null) {
      return { scope: { scope: "department", departmentId: parsed.value } };
    }
    if (options.requireDepartment) {
      return {
        errorResponse: NextResponse.json(
          { error: "invalid_department_id", detail: "departmentId 是必填参数" },
          { status: 400 },
        ),
      };
    }
    return { scope: { scope: "company", departmentId: null } };
  }

  if (!user.departmentId) {
    return {
      errorResponse: NextResponse.json(
        { error: "forbidden", detail: "当前账号未绑定部门，无法查看部门统计" },
        { status: 403 },
      ),
    };
  }

  if (parsed.value !== null && parsed.value !== user.departmentId) {
    return {
      errorResponse: NextResponse.json(
        { error: "forbidden", detail: "部门管理员只能查看自己部门的数据统计" },
        { status: 403 },
      ),
    };
  }

  return { scope: { scope: "department", departmentId: user.departmentId } };
}
