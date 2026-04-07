import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../lib/serverAuth";
import { loadEffectivePermissionsForUser } from "../../../lib/serverPermissions";



export const runtime = "edge";

const DEPT_KEY_TO_SLUG: Record<string, string> = {
  d1: "tech",
  d2: "design",
  d3: "marketing",
  d4: "sales",
};

type AllowedFieldType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "multiline"
  | "boolean"
  | "multi_select"
  | "url"
  | "email"
  | "phone";

function mapRowToField(row: any) {
  const config = (row.config || {}) as any;
  const options = Array.isArray(config.options) ? config.options : undefined;
  const placeholder = typeof config.placeholder === "string" ? config.placeholder : undefined;

  return {
    id: row.key as string,
    label: row.label as string,
    type: (row.type as string) as AllowedFieldType,
    required: !!row.required,
    options,
    placeholder,
    filterable: !!row.filterable,
    exportable:
      row.exportable === null || row.exportable === undefined
        ? true
        : !!row.exportable,
  };
}

async function resolveDepartmentIdFromKey(departmentKey: string | null) {
  if (!departmentKey) {
    return {
      departmentId: null,
      errorBody: { error: "departmentId or departmentKey is required" },
      status: 400,
    } as const;
  }

  const slug = DEPT_KEY_TO_SLUG[departmentKey];
  if (!slug) {
    return {
      departmentId: null,
      errorBody: { error: "unknown departmentKey" },
      status: 400,
    } as const;
  }

  const { data: dept, error: deptError } = await supabaseAdmin
    .from("departments")
    .select("id")
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();

  if (deptError) {
    console.error("[api/department-fields] find department by key error", deptError);
    return {
      departmentId: null,
      errorBody: { error: "failed to resolve department", detail: deptError.message },
      status: 500,
    } as const;
  }

  if (!dept) {
    return {
      departmentId: null,
      errorBody: { error: "department not found for given key" },
      status: 400,
    } as const;
  }

  return { departmentId: dept.id as number } as const;
}

async function getActiveTemplateId(departmentId: number) {
  const { data: template, error: tplError } = await supabaseAdmin
    .from("department_field_templates")
    .select("id")
    .eq("department_id", departmentId)
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (tplError) {
    console.error("[api/department-fields] template error", tplError);
    return {
      templateId: null,
      errorBody: { error: "failed to load active template", detail: tplError.message },
      status: 500,
    } as const;
  }

  if (!template) {
    return { templateId: null } as const;
  }

  return { templateId: template.id as number } as const;
}





async function ensureCanManageDepartmentFields(user: any, departmentId: number) {
  const permissions = await loadEffectivePermissionsForUser(user);
  const hasGlobalManage = permissions.includes("settings.fields.manage");
  const hasDeptManage = permissions.includes("department.fields_manage");

  if (hasGlobalManage) {
    return null;
  }

  const userDeptId = user?.departmentId ?? null;
  if (!hasDeptManage || !userDeptId || userDeptId !== departmentId) {
    return NextResponse.json(
      { error: "forbidden", detail: "您没有权限管理该部门的字段模板" },
      { status: 403 },
    );
  }

  return null;
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

    const { searchParams } = new URL(req.url);
    const departmentIdRaw = searchParams.get("departmentId");
    const departmentKey = searchParams.get("departmentKey");

    let departmentId: number | null = null;

    if (departmentIdRaw) {
      const parsed = Number.parseInt(departmentIdRaw, 10);
      if (Number.isNaN(parsed)) {
        return NextResponse.json(
          { error: "departmentId must be a number" },
          { status: 400 },
        );
      }
      departmentId = parsed;
    } else {
      const resolved = await resolveDepartmentIdFromKey(departmentKey);
      if (!("departmentId" in resolved) || resolved.departmentId === null) {
        return NextResponse.json(resolved.errorBody, { status: resolved.status });
      }
      departmentId = resolved.departmentId;
    }

    if (!departmentId) {
      return NextResponse.json(
        { error: "departmentId or departmentKey is required" },
        { status: 400 },
      );
    }

    const tplResult = await getActiveTemplateId(departmentId);
    if (!tplResult.templateId && tplResult.templateId !== 0) {
      if ("errorBody" in tplResult) {
        return NextResponse.json(tplResult.errorBody, { status: tplResult.status });
      }
      return NextResponse.json(
        { items: [], templateId: null },
        {
          headers: {
            "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
          },
        },
      );
    }

    const templateId = tplResult.templateId as number;

    const { data, error } = await supabaseAdmin
      .from("department_fields")
      .select("key, label, type, required, filterable, exportable, config")
      .eq("department_id", departmentId)
      .eq("template_id", templateId)
      .order("order_index", { ascending: true });

    if (error) {
      console.error("[api/department-fields] query error", error);
      return NextResponse.json(
        { error: "failed to load department fields", detail: error.message },
        { status: 500 },
      );
    }

    const items = (data || []).map(mapRowToField);

    return NextResponse.json(
      { items, templateId },
      {
        headers: {
          "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (error: any) {
    console.error("[api/department-fields] error", error);
    return NextResponse.json(
      {
        error: "failed to load department fields",
        detail: error?.message ?? String(error),
      },
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

    const body = await req.json();

    const departmentKey = (body.departmentKey as string | undefined) || null;
    const departmentIdRaw = body.departmentId as number | string | undefined;
    const field = body.field as
      | {
          id?: string;
          label?: string;
          type?: string;
          required?: boolean;
          placeholder?: string | null;
          options?: string[] | string | null;
          filterable?: boolean;
          exportable?: boolean;
        }
      | undefined;

    if (!field || !field.label) {
      return NextResponse.json(
        { error: "field.label is required" },
        { status: 400 },
      );
    }

    let departmentId: number | null = null;

    if (typeof departmentIdRaw === "number") {
      departmentId = departmentIdRaw;
    } else if (typeof departmentIdRaw === "string" && departmentIdRaw.trim()) {
      const parsed = Number.parseInt(departmentIdRaw, 10);
      if (!Number.isNaN(parsed)) {
        departmentId = parsed;
      }
    }

    if (!departmentId) {
      const resolved = await resolveDepartmentIdFromKey(departmentKey);
      if (!("departmentId" in resolved) || resolved.departmentId === null) {
        return NextResponse.json(resolved.errorBody, { status: resolved.status });
      }
      departmentId = resolved.departmentId as number;
    }

    const permError = await ensureCanManageDepartmentFields(authResult.user, departmentId);
    if (permError) {
      return permError;
    }

    let tplResult = await getActiveTemplateId(departmentId);

    let templateId = tplResult.templateId;

    if (!templateId && !("errorBody" in tplResult)) {
      const { data: createdTpl, error: createTplError } = await supabaseAdmin
        .from("department_field_templates")
        .insert({
          department_id: departmentId,
          version: 1,
          name: "默认字段模板",
          is_active: true,
        })
        .select("id")
        .maybeSingle();

      if (createTplError || !createdTpl) {
        console.error("[api/department-fields] create template error", createTplError);
        return NextResponse.json(
          {
            error: "failed to create template",
            detail: createTplError?.message ?? "insert template failed",
          },
          { status: 500 },
        );
      }

      templateId = createdTpl.id as number;
    } else if (!templateId && "errorBody" in tplResult) {
      return NextResponse.json(tplResult.errorBody, { status: tplResult.status });
    }

    const fieldKey = (field.id || "").toString().trim() || `f${Date.now()}`;
    const rawType = (field.type || "text").toString();
    const allowedTypes: AllowedFieldType[] = [
      "text",
      "number",
      "date",
      "select",
      "multiline",
      "boolean",
      "multi_select",
      "url",
      "email",
      "phone",
    ];
    const fieldType = (allowedTypes.includes(rawType as AllowedFieldType)
      ? rawType
      : "text") as AllowedFieldType;

    let options: string[] | undefined;
    if (Array.isArray(field.options)) {
      options = field.options;
    } else if (typeof field.options === "string") {
      options = field.options
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    const placeholder = field.placeholder ? String(field.placeholder) : undefined;

    const config: Record<string, any> = {};
    if (options && options.length > 0) {
      config.options = options;
    }
    if (placeholder) {
      config.placeholder = placeholder;
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("department_fields")
      .select("id")
      .eq("department_id", departmentId)
      .eq("template_id", templateId as number)
      .eq("key", fieldKey)
      .limit(1)
      .maybeSingle();

    if (existingError && existingError.code !== "PGRST116") {
      console.error("[api/department-fields] select field error", existingError);
      return NextResponse.json(
        { error: "failed to save field", detail: existingError.message },
        { status: 500 },
      );
    }

    if (existing) {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("department_fields")
        .update({
          label: field.label,
          type: fieldType,
          required: !!field.required,
          filterable: !!field.filterable,
          exportable: field.exportable === false ? false : true,
          config,
        })
        .eq("id", existing.id)
        .select("key, label, type, required, filterable, exportable, config")
        .maybeSingle();

      if (updateError || !updated) {
        console.error("[api/department-fields] update field error", updateError);
        return NextResponse.json(
          {
            error: "failed to save field",
            detail: updateError?.message ?? "update failed",
          },
          { status: 500 },
        );
      }

      return NextResponse.json({ field: mapRowToField(updated) });
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("department_fields")
      .insert({
        department_id: departmentId,
        template_id: templateId as number,
        key: fieldKey,
        label: field.label,
        type: fieldType,
        required: !!field.required,
        filterable: !!field.filterable,
        exportable: field.exportable === false ? false : true,
        config,
      })
      .select("key, label, type, required, filterable, exportable, config")
      .maybeSingle();

    if (insertError || !inserted) {
      console.error("[api/department-fields] insert field error", insertError);
      return NextResponse.json(
        {
          error: "failed to save field",
          detail: insertError?.message ?? "insert failed",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ field: mapRowToField(inserted) });
  } catch (error: any) {
    console.error("[api/department-fields] save error", error);
    return NextResponse.json(
      {
        error: "failed to save field",
        detail: error?.message ?? String(error),
      },
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

    const body = await req.json();

    const departmentKey = (body.departmentKey as string | undefined) || null;
    const departmentIdRaw = body.departmentId as number | string | undefined;
    const orderedKeysRaw = body.orderedKeys as unknown;

    if (!Array.isArray(orderedKeysRaw)) {
      return NextResponse.json(
        { error: "orderedKeys must be an array" },
        { status: 400 },
      );
    }

    const orderedKeys = (orderedKeysRaw as unknown[])
      .map((k) => (typeof k === "string" ? k.trim() : ""))
      .filter((k) => k.length > 0);

    if (orderedKeys.length === 0) {
      return NextResponse.json(
        { error: "orderedKeys is empty" },
        { status: 400 },
      );
    }

    let departmentId: number | null = null;

    if (typeof departmentIdRaw === "number") {
      departmentId = departmentIdRaw;
    } else if (typeof departmentIdRaw === "string" && departmentIdRaw.trim()) {
      const parsed = Number.parseInt(departmentIdRaw, 10);
      if (!Number.isNaN(parsed)) {
        departmentId = parsed;
      }
    }

    if (!departmentId) {
      const resolved = await resolveDepartmentIdFromKey(departmentKey);
      if (!("departmentId" in resolved) || resolved.departmentId === null) {
        return NextResponse.json(resolved.errorBody, { status: resolved.status });
      }
      departmentId = resolved.departmentId as number;
    }

    const permError = await ensureCanManageDepartmentFields(authResult.user, departmentId);
    if (permError) {
      return permError;
    }

    const tplResult = await getActiveTemplateId(departmentId);

    if (!tplResult.templateId && tplResult.templateId !== 0) {
      if ("errorBody" in tplResult) {
        return NextResponse.json(tplResult.errorBody, { status: tplResult.status });
      }
      return NextResponse.json({ success: true });
    }

    const templateId = tplResult.templateId as number;

    const updates = orderedKeys.map((fieldKey, index) => ({
      fieldKey,
      orderIndex: index + 1,
    }));

    for (const update of updates) {
      const { error } = await supabaseAdmin
        .from("department_fields")
        .update({ order_index: update.orderIndex })
        .eq("department_id", departmentId)
        .eq("template_id", templateId)
        .eq("key", update.fieldKey);

      if (error) {
        console.error("[api/department-fields] update order_index error", error);
        return NextResponse.json(
          { error: "failed to update field order", detail: error.message },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[api/department-fields] patch error", error);
    return NextResponse.json(
      {
        error: "failed to update field order",
        detail: error?.message ?? String(error),
      },
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

    const body = await req.json();

    const departmentKey = (body.departmentKey as string | undefined) || null;
    const departmentIdRaw = body.departmentId as number | string | undefined;
    const fieldKey = (body.fieldKey as string | undefined)?.trim();

    if (!fieldKey) {
      return NextResponse.json(
        { error: "fieldKey is required" },
        { status: 400 },
      );
    }

    let departmentId: number | null = null;

    if (typeof departmentIdRaw === "number") {
      departmentId = departmentIdRaw;
    } else if (typeof departmentIdRaw === "string" && departmentIdRaw.trim()) {
      const parsed = Number.parseInt(departmentIdRaw, 10);
      if (!Number.isNaN(parsed)) {
        departmentId = parsed;
      }
    }

    if (!departmentId) {
      const resolved = await resolveDepartmentIdFromKey(departmentKey);
      if (!("departmentId" in resolved) || resolved.departmentId === null) {
        return NextResponse.json(resolved.errorBody, { status: resolved.status });
      }
      departmentId = resolved.departmentId as number;
    }

    const permError = await ensureCanManageDepartmentFields(authResult.user, departmentId);
    if (permError) {
      return permError;
    }

    const tplResult = await getActiveTemplateId(departmentId);

    if (!tplResult.templateId && tplResult.templateId !== 0) {
      if ("errorBody" in tplResult) {
        return NextResponse.json(tplResult.errorBody, { status: tplResult.status });
      }
      return NextResponse.json({ success: true });
    }

    const templateId = tplResult.templateId as number;

    const { error } = await supabaseAdmin
      .from("department_fields")
      .delete()
      .eq("department_id", departmentId)
      .eq("template_id", templateId)
      .eq("key", fieldKey);

    if (error) {
      console.error("[api/department-fields] delete field error", error);
      return NextResponse.json(
        { error: "failed to delete field", detail: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[api/department-fields] delete error", error);
    return NextResponse.json(
      {
        error: "failed to delete field",
        detail: error?.message ?? String(error),
      },
      { status: 500 },
    );
  }
}
