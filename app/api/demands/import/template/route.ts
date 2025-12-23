import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../../lib/serverAuth";

export const runtime = "nodejs";

function escapeCsvCell(value: string): string {
  const needsQuote =
    value.includes(",") ||
    value.includes("\n") ||
    value.includes("\"") ||
    value.startsWith(" ") ||
    value.endsWith(" ");
  if (!needsQuote) return value;
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
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
    const departmentIdParam = url.searchParams.get("departmentId");

    if (!departmentIdParam) {
      return NextResponse.json(
        { error: "departmentId is required" },
        { status: 400 },
      );
    }

    let departmentIdNumber: number | null = null;
    const trimmed = departmentIdParam.trim();
    if (trimmed && /^\d+$/.test(trimmed)) {
      const parsed = Number.parseInt(trimmed, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        departmentIdNumber = parsed;
      }
    }

    if (!departmentIdNumber) {
      return NextResponse.json(
        { error: "invalid departmentId" },
        { status: 400 },
      );
    }

    const [deptResult, activeTemplateResult] = await Promise.all([
      supabaseAdmin
        .from("departments")
        .select("id, name")
        .eq("id", departmentIdNumber)
        .maybeSingle(),
      supabaseAdmin
        .from("department_field_templates")
        .select("id")
        .eq("department_id", departmentIdNumber)
        .eq("is_active", true)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ] as const);

    const { data: dept, error: deptError } = deptResult;
    const { data: activeTemplate, error: tplError } = activeTemplateResult;

    if (deptError || !dept) {
      console.error("[api/demands/import/template] dept error", deptError);
      return NextResponse.json(
        { error: "department not found", detail: deptError?.message },
        { status: 400 },
      );
    }

    let dynamicColumns: { label: string; type: string }[] = [];

    if (tplError) {
      console.error("[api/demands/import/template] active template error", tplError);
    }

    if (activeTemplate) {
      const { data: fields, error: fieldsError } = await supabaseAdmin
        .from("department_fields")
        .select("label, type, exportable")
        .eq("department_id", departmentIdNumber)
        .eq("template_id", activeTemplate.id)
        .order("order_index", { ascending: true });

      if (fieldsError) {
        console.error("[api/demands/import/template] load fields error", fieldsError);
      } else if (fields) {
        dynamicColumns = (fields as any[])
          .filter((field) =>
            field.exportable === undefined || field.exportable === null
              ? true
              : Boolean(field.exportable),
          )
          .map((field) => ({
            label: String(field.label),
            type: String(field.type || "text"),
          }));
      }
    }

    const headers = [
      "标题",
      "描述",
      "提交人邮箱",
      "执行人邮箱",
      "状态",
      "优先级",
      "截止日期",
      ...dynamicColumns.map((column) => column.label),
    ];

    const headerLine = headers.map((cell) => escapeCsvCell(cell)).join(",");

    const sampleRow: string[] = [];
    sampleRow.push("【示例】技术需求：会员中心改版");
    sampleRow.push("示例：简要描述业务背景和主要改动点。");
    sampleRow.push("creator@example.com");
    sampleRow.push("assignee@example.com");
    sampleRow.push("待处理");
    sampleRow.push("中");
    sampleRow.push("2025-12-31");

    for (const column of dynamicColumns) {
      let value = "";
      if (column.type === "number") {
        value = "123";
      } else if (column.type === "boolean") {
        value = "是 / 否（二选一，填写其一）";
      } else if (column.type === "date") {
        value = "2025-12-31";
      } else if (column.type === "multi_select") {
        value = "选项A,选项B";
      } else {
        value = "示例值";
      }
      sampleRow.push(value);
    }

    const sampleLine = sampleRow.map((cell) => escapeCsvCell(cell)).join(",");
    const csv = `\uFEFF${headerLine}\n${sampleLine}\n`;

    const departmentName = (dept.name as string | null) || "department";
    const safeDeptName = departmentName.replace(/[^A-Za-z0-9_-]+/g, "");
    const fileName = safeDeptName
      ? `demands-import-template-${safeDeptName}.csv`
      : `demands-import-template-${departmentIdNumber}.csv`;

    const response = new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });

    return response;
  } catch (error: any) {
    console.error("[api/demands/import/template] error", error);
    return NextResponse.json(
      {
        error: "failed to generate import template",
        detail: error?.message ?? String(error),
      },
      { status: 500 },
    );
  }
}
