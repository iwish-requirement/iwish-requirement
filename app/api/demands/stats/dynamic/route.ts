import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest } from "../../../../../lib/serverAuth";
import { ensureHasPermission } from "../../../../../lib/serverPermissions";

import { DepartmentDynamicFieldStats, FieldDefinition } from "../../../../../types";

export const runtime = "nodejs";

const DEPT_KEY_TO_SLUG: Record<string, string> = {
  d1: "tech",
  d2: "design",
  d3: "marketing",
  d4: "sales",
};

function normalizeDepartmentId(
  departmentIdParam: string | null,
  departmentKeyParam: string | null,
): { departmentId: number | null; errorResponse?: NextResponse } {
  if (departmentIdParam) {
    const parsed = Number.parseInt(departmentIdParam, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return { departmentId: parsed };
    }
  }

  if (departmentKeyParam) {
    const slug = DEPT_KEY_TO_SLUG[departmentKeyParam];
    if (!slug) {
      return {
        departmentId: null,
        errorResponse: NextResponse.json(
          { error: "invalid departmentKey" },
          { status: 400 },
        ),
      };
    }

    return { departmentId: null };
  }

  return {
    departmentId: null,
    errorResponse: NextResponse.json(
      { error: "departmentId or departmentKey is required" },
      { status: 400 },
    ),
  };
}

function normalizeValueToStrings(rawValue: any, fieldType: string): string[] {
  if (rawValue === undefined || rawValue === null) {
    return [];
  }

  if (fieldType === "multi_select") {
    if (Array.isArray(rawValue)) {
      return rawValue
        .map((item) => (item === undefined || item === null ? "" : String(item)))
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }
    const text = String(rawValue).trim();
    if (!text) {
      return [];
    }
    return text
      .split(/[，,;]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  if (fieldType === "boolean") {
    if (rawValue === true || rawValue === "true" || rawValue === "1") {
      return ["是"];
    }
    if (rawValue === false || rawValue === "false" || rawValue === "0") {
      return ["否"];
    }
  }

  const text = String(rawValue).trim();
  if (!text) {
    return [];
  }

  return [text];
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const permError = await ensureHasPermission(authResult.user, "stats.dynamic_fields");
    if (permError) {
      return permError;
    }


    const url = new URL(req.url);
    const departmentIdParam = url.searchParams.get("departmentId");
    const departmentKeyParam = url.searchParams.get("departmentKey");
    const statusParam = url.searchParams.get("status");
    const createdFrom = url.searchParams.get("createdFrom");
    const createdTo = url.searchParams.get("createdTo");
    const dueFrom = url.searchParams.get("dueFrom");
    const dueTo = url.searchParams.get("dueTo");

    const result = normalizeDepartmentId(departmentIdParam, departmentKeyParam);
    if (result.errorResponse) {
      return result.errorResponse;
    }

    const departmentId = result.departmentId as number;

    const [deptResult, tplResult, fieldsResult] = await Promise.all([
      supabaseAdmin
        .from("departments")
        .select("id, name")
        .eq("id", departmentId)
        .maybeSingle(),
      supabaseAdmin
        .from("department_field_templates")
        .select("id")
        .eq("department_id", departmentId)
        .eq("is_active", true)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("department_fields")
        .select("key, label, type, filterable, exportable")
        .eq("department_id", departmentId)
        .order("order_index", { ascending: true }),
    ] as const);

    const { data: dept, error: deptError } = deptResult;
    const { data: activeTemplate, error: tplError } = tplResult;
    const { data: fieldsRaw, error: fieldsError } = fieldsResult;

    if (deptError || !dept) {
      console.error("[api/demands/stats/dynamic] load department error", deptError);
      return NextResponse.json(
        { error: "department not found", detail: deptError?.message },
        { status: 400 },
      );
    }

    if (tplError) {
      console.error("[api/demands/stats/dynamic] load active template error", tplError);
    }

    if (!activeTemplate) {
      const empty: DepartmentDynamicFieldStats = {
        departmentId: dept.id as number,
        departmentName: (dept.name as string) || undefined,
        totalDemands: 0,
        fields: [],
      };
      return NextResponse.json(empty);
    }

    if (fieldsError) {
      console.error("[api/demands/stats/dynamic] load fields error", fieldsError);
      return NextResponse.json(
        { error: "failed to load department fields", detail: fieldsError.message },
        { status: 500 },
      );
    }

    const allFields = ((fieldsRaw || []) as any[]).filter((field) => {
      const exportable = field.exportable;
      if (exportable === undefined || exportable === null) {
        return true;
      }
      return Boolean(exportable);
    }) as {
      key: string;
      label: string;
      type: string;
      filterable: boolean | null;
      exportable: boolean | null;
    }[];

    const fieldDefsByKey = new Map<string, { label: string; type: string }>();
    for (const field of allFields) {
      const fieldKey = String(field.key);
      const label = String(field.label || "");
      if (!fieldKey || !label) {
        continue;
      }
      fieldDefsByKey.set(fieldKey, {
        label,
        type: String(field.type || "text"),
      });
    }

    if (fieldDefsByKey.size === 0) {
      const empty: DepartmentDynamicFieldStats = {
        departmentId: dept.id as number,
        departmentName: (dept.name as string) || undefined,
        totalDemands: 0,
        fields: [],
      };
      return NextResponse.json(empty);
    }

    const customFieldFilters: { key: string; value: string }[] = [];
    for (const [key, value] of url.searchParams.entries()) {
      if (!key.startsWith("cf_")) continue;
      const fieldKey = key.slice(3);
      if (!fieldKey || !value) continue;
      if (!fieldDefsByKey.has(fieldKey)) continue;
      customFieldFilters.push({ key: fieldKey, value });
    }

    let query = supabaseAdmin
      .from("demands")
      .select("id, department_id, fields, status, created_at", { count: "exact" })
      .eq("department_id", departmentId);

    if (statusParam) {
      const normalized = (statusParam || "").toString().toLowerCase();
      const allowedStatus = [
        "pending",
        "in_progress",
        "review",
        "done",
        "closed",
        "delayed",
        "ignored",
      ];
      if (allowedStatus.includes(normalized)) {
        query = query.eq("status", normalized);
      }
    }

    if (createdFrom) {
      query = query.gte("created_at", createdFrom);
    }

    if (createdTo) {
      query = query.lte("created_at", createdTo);
    }

    if (dueFrom) {
      query = query.gte("fields->>dueDate", dueFrom);
    }

    if (dueTo) {
      query = query.lte("fields->>dueDate", dueTo);
    }

    if (customFieldFilters.length > 0) {
      for (const filter of customFieldFilters) {
        query = query.eq(`fields->>${filter.key}` as any, filter.value);
      }
    }

    const MAX_ROWS = 5000;
    const { data, error, count } = await query.limit(MAX_ROWS);

    if (error) {
      console.error("[api/demands/stats/dynamic] query error", error);
      return NextResponse.json(
        { error: "failed to load demands for stats", detail: error.message },
        { status: 500 },
      );
    }

    const rows = (data || []) as any[];

    type Accumulator = {
      label: string;
      type: string;
      total: number;
      values: Map<string, number>;
    };

    const statsMap = new Map<string, Accumulator>();

    for (const row of rows) {
      const fields = (row.fields || {}) as Record<string, any>;
      if (!fields || typeof fields !== "object") {
        continue;
      }

      for (const [fieldKey, fieldDef] of fieldDefsByKey.entries()) {
        const rawValue = (fields as any)[fieldKey];
        const valueStrings = normalizeValueToStrings(rawValue, fieldDef.type);
        if (valueStrings.length === 0) {
          continue;
        }

        let acc = statsMap.get(fieldKey);
        if (!acc) {
          acc = {
            label: fieldDef.label,
            type: fieldDef.type,
            total: 0,
            values: new Map<string, number>(),
          };
          statsMap.set(fieldKey, acc);
        }

        for (const value of valueStrings) {
          acc.total += 1;
          const current = acc.values.get(value) || 0;
          acc.values.set(value, current + 1);
        }
      }
    }

    const fieldsStats = Array.from(statsMap.entries()).map(([fieldKey, acc]) => {
      const valuesArray = Array.from(acc.values.entries())
        .map(([value, valueCount]) => ({ value, count: valueCount }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 50);

      return {
        fieldId: fieldKey,
        fieldLabel: acc.label,
        total: acc.total,
        values: valuesArray,
      };
    });

    const responseBody: DepartmentDynamicFieldStats = {
      departmentId: dept.id as number,
      departmentName: (dept.name as string) || undefined,
      totalDemands: count ?? rows.length,
      fields: fieldsStats,
    };

    return NextResponse.json(responseBody);
  } catch (error: any) {
    console.error("[api/demands/stats/dynamic] error", error);
    return NextResponse.json(
      {
        error: "failed to load dynamic field stats",
        detail: error?.message ?? String(error),
      },
      { status: 500 },
    );
  }
}
