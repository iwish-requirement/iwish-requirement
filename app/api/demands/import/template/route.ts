import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../../lib/serverAuth";
import { isDepartmentDemandTypeRequired } from "../../../../../lib/demandTypeRules";

export const runtime = "edge";

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

    const [deptResult, activeTemplateResult, demandTypesResult] = await Promise.all([
      supabaseAdmin
        .from("departments")
        .select("id, name, slug, config")
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
      supabaseAdmin
        .from("demand_types")
        .select("id, name, code, field_template_id, is_active")
        .eq("department_id", departmentIdNumber)
        .order("order_index", { ascending: true }),
    ] as const);

    const { data: dept, error: deptError } = deptResult;
    const { data: activeTemplate, error: tplError } = activeTemplateResult;
    const { data: demandTypes, error: demandTypesError } = demandTypesResult;

    if (deptError || !dept) {
      console.error("[api/demands/import/template] dept error", deptError);
      return NextResponse.json(
        { error: "department not found", detail: deptError?.message },
        { status: 400 },
      );
    }

    if (demandTypesError) {
      console.error("[api/demands/import/template] demand types error", demandTypesError);
      return NextResponse.json(
        { error: "failed_to_load_demand_types", detail: demandTypesError.message },
        { status: 500 },
      );
    }

    let dynamicColumns: { label: string; type: string }[] = [];

    if (tplError) {
      console.error("[api/demands/import/template] active template error", tplError);
    }

    const activeDemandTypes = ((demandTypes || []) as any[]).filter(
      (demandType) => demandType.is_active !== false,
    );
    const templateIds = Array.from(
      new Set(
        [
          activeTemplate?.id,
          ...activeDemandTypes.map((demandType) => demandType.field_template_id),
        ].filter((id): id is number => typeof id === "number" && id > 0),
      ),
    );

    if (templateIds.length > 0) {
      const { data: fields, error: fieldsError } = await supabaseAdmin
        .from("department_fields")
        .select("label, type, exportable")
        .eq("department_id", departmentIdNumber)
        .in("template_id", templateIds)
        .order("order_index", { ascending: true });

      if (fieldsError) {
        console.error("[api/demands/import/template] load fields error", fieldsError);
      } else if (fields) {
        const seenLabels = new Set<string>();
        dynamicColumns = (fields as any[])
          .filter((field) =>
            field.exportable === undefined || field.exportable === null
              ? true
              : Boolean(field.exportable),
          )
          .filter((field) => {
            const label = String(field.label || "").trim();
            if (!label || seenLabels.has(label)) {
              return false;
            }
            seenLabels.add(label);
            return true;
          })
          .map((field) => ({
            label: String(field.label),
            type: String(field.type || "text"),
          }));
      }
    }

    const headers = [
      "标题",
      "描述",
      "需求类型编码",
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
    sampleRow.push(String(activeDemandTypes[0]?.code || ""));
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
    const demandTypeRequired = isDepartmentDemandTypeRequired(
      (dept as any).config,
      (dept as any).slug,
      (dept as any).name,
    );
    const instructionLine = demandTypeRequired
      ? "# 创意部必填：需求类型编码请使用系统中启用的编码，例如 graphic 或 video_editing。"
      : "# 需求类型编码可选；填写时必须使用当前部门已启用的类型编码。";
    const csv = `\uFEFF${headerLine}\n${instructionLine}\n${sampleLine}\n`;

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
