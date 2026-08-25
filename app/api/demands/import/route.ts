import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../lib/serverAuth";
import { DemandStatus, Priority } from "../../../../types";
import {
  findInvalidPositiveIntegerDemandFields,
  findMissingRequiredDemandFields,
} from "../../../../lib/demandRequiredFieldUtils";
import { makeDemandCode } from "../../../../lib/demandCode";
import { isDepartmentDemandTypeRequired } from "../../../../lib/demandTypeRules";
import {
  findDemandTypeImportColumn,
  resolveImportDemandType,
  type ImportDemandType,
} from "../../../../lib/demandImportRules";

export const runtime = "edge";

function normalizePriority(raw: any): Priority {
  const value = (raw ?? "").toString();
  if (value.includes("紧急")) return Priority.CRITICAL;
  if (value.includes("高")) return Priority.HIGH;
  if (value.includes("中")) return Priority.MEDIUM;
  if (value.includes("低")) return Priority.LOW;
  return Priority.MEDIUM;
}

function mapStatusLabelToEnum(label: string | null): DemandStatus | null {
  if (!label) return null;
  const value = label.toString().trim();
  const entries = Object.entries(DemandStatus) as [string, string][];
  for (const [, cn] of entries) {
    if (cn === value) {
      return value as DemandStatus;
    }
  }
  return null;
}

function toDbStatus(status: DemandStatus | undefined | null): string | undefined {
  if (!status) return undefined;
  switch (status) {
    case DemandStatus.PENDING:
      return "pending";
    case DemandStatus.IN_PROGRESS:
      return "in_progress";
    case DemandStatus.REVIEW:
      return "review";
    case DemandStatus.DONE:
      return "done";
    case DemandStatus.CLOSED:
      return "closed";
    case DemandStatus.DELAYED:
      return "delayed";
    case DemandStatus.IGNORED:
      return "ignored";
    default:
      return undefined;
  }
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (inQuotes) {
      if (char === "\"") {
        const next = line[i + 1];
        if (next === "\"") {
          current += "\"";
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === ",") {
      result.push(current);
      current = "";
    } else if (char === "\"") {
      inQuotes = true;
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function parseCsv(text: string): string[][] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  const rows: string[][] = [];
  for (const line of lines) {
    rows.push(parseCsvLine(line));
  }
  return rows;
}

interface ImportRowResult {
  rowNumber: number;
  success: boolean;
  message?: string;
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const activeError = ensureActiveUser(authResult.user);
    if (activeError) {
      return activeError;
    }

    const body = await req.json();
    const departmentIdRaw = body.departmentId as string | number | undefined;
    const csv = (body.csv as string | undefined) || "";

    if (!departmentIdRaw) {
      return NextResponse.json(
        { error: "departmentId is required" },
        { status: 400 },
      );
    }

    if (!csv.trim()) {
      return NextResponse.json(
        { error: "csv content is required" },
        { status: 400 },
      );
    }

    let departmentIdNumber: number | null = null;

    if (typeof departmentIdRaw === "number") {
      if (Number.isFinite(departmentIdRaw) && departmentIdRaw > 0) {
        departmentIdNumber = departmentIdRaw;
      }
    } else if (typeof departmentIdRaw === "string") {
      const trimmed = departmentIdRaw.trim();
      if (trimmed && /^\d+$/.test(trimmed)) {
        const parsed = Number.parseInt(trimmed, 10);
        if (!Number.isNaN(parsed) && parsed > 0) {
          departmentIdNumber = parsed;
        }
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
        .select("id, code, name, field_template_id, is_active")
        .eq("department_id", departmentIdNumber)
        .order("order_index", { ascending: true }),
    ] as const);

    const { data: dept, error: deptError } = deptResult;
    const { data: activeTemplate, error: tplError } = activeTemplateResult;
    const { data: demandTypeRows, error: demandTypesError } = demandTypesResult;

    if (deptError || !dept) {
      console.error("[api/demands/import] dept error", deptError);
      return NextResponse.json(
        { error: "department not found", detail: deptError?.message },
        { status: 400 },
      );
    }

    if (demandTypesError) {
      console.error("[api/demands/import] demand types error", demandTypesError);
      return NextResponse.json(
        { error: "failed_to_load_demand_types", detail: demandTypesError.message },
        { status: 500 },
      );
    }

    const activeFieldTemplateId: number | null = activeTemplate ? (activeTemplate.id as number) : null;
    const demandTypes: ImportDemandType[] = (demandTypeRows || []).map((row: any) => ({
      id: row.id as number,
      code: (row.code as string | null) ?? null,
      name: (row.name as string | null) ?? null,
      fieldTemplateId: (row.field_template_id as number | null) ?? null,
      isActive: row.is_active !== false,
    }));
    const demandTypeRequired = isDepartmentDemandTypeRequired(
      (dept as any).config,
      (dept as any).slug,
      (dept as any).name,
    );

    if (tplError) {
      console.error("[api/demands/import] active template error", tplError);
    }

    type ImportField = { key: string; label: string; type: string; required: boolean };
    const fieldsByTemplate = new Map<number, Map<string, ImportField>>();
    const templateIds = Array.from(
      new Set(
        [activeFieldTemplateId, ...demandTypes.map((demandType) => demandType.fieldTemplateId)]
          .filter((id): id is number => typeof id === "number" && id > 0),
      ),
    );

    if (templateIds.length > 0) {
      const { data: fields, error: fieldsError } = await supabaseAdmin
        .from("department_fields")
        .select("template_id, key, label, type, required, exportable")
        .eq("department_id", departmentIdNumber)
        .in("template_id", templateIds)
        .order("order_index", { ascending: true });

      if (fieldsError) {
        console.error("[api/demands/import] load fields error", fieldsError);
        return NextResponse.json(
          { error: "failed_to_load_department_fields", detail: fieldsError.message },
          { status: 500 },
        );
      } else if (fields) {
        for (const field of fields as any[]) {
          if (field.exportable !== undefined && field.exportable !== null && !Boolean(field.exportable)) {
            continue;
          }
          const label = String(field.label || "").trim();
          if (!label) continue;
          const templateId = Number(field.template_id);
          const templateFieldMap = fieldsByTemplate.get(templateId) || new Map<string, ImportField>();
          templateFieldMap.set(label, {
            key: String(field.key),
            label,
            type: String(field.type || "text"),
            required: !!field.required,
          });
          fieldsByTemplate.set(templateId, templateFieldMap);
        }
      }
    }

    const rows = parseCsv(csv);
    if (rows.length <= 1) {
      return NextResponse.json(
        { error: "csv must contain header and at least one data row" },
        { status: 400 },
      );
    }

    const header = rows[0].map((cell) => cell.replace(/^\uFEFF/, "").trim());

    const headerJoined = header.join("");
    if (headerJoined && headerJoined.includes("�") && !headerJoined.includes("标题")) {
      return NextResponse.json(
        {
          error:
            "CSV 文件编码不是 UTF-8，请在 Excel/WPS 中另存为“CSV UTF-8（逗号分隔）”格式后再导入",
        },
        { status: 400 },
      );
    }

    const headerIndex: Record<string, number> = {};
    header.forEach((name, index) => {
      if (!name) return;
      headerIndex[name] = index;
    });

    const titleCol = headerIndex["标题"];
    const descriptionCol = headerIndex["描述"];
    const creatorEmailCol = headerIndex["提交人邮箱"];
    const assigneeEmailCol = headerIndex["执行人邮箱"];
    const statusCol = headerIndex["状态"];
    const priorityCol = headerIndex["优先级"];
    const dueDateCol = headerIndex["截止日期"];
    const demandTypeCol = findDemandTypeImportColumn(headerIndex);

    if (
      titleCol === undefined ||
      creatorEmailCol === undefined ||
      assigneeEmailCol === undefined
    ) {
      return NextResponse.json(
        {
          error:
            "csv header must contain at least: 标题, 提交人邮箱, 执行人邮箱",
        },
        { status: 400 },
      );
    }

    const creatorEmails = new Set<string>();
    const assigneeEmails = new Set<string>();

    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i];
      const creatorEmailRaw = row[creatorEmailCol] ?? "";
      const assigneeEmailRaw = row[assigneeEmailCol] ?? "";
      const creatorEmail = creatorEmailRaw.trim();
      const assigneeEmail = assigneeEmailRaw.trim();
      if (creatorEmail) creatorEmails.add(creatorEmail.toLowerCase());
      if (assigneeEmail) assigneeEmails.add(assigneeEmail.toLowerCase());
    }

    const allEmails = Array.from(new Set([...creatorEmails, ...assigneeEmails]));

    const userMap = new Map<string, { id: number; departmentId: number | null }>();

    if (allEmails.length > 0) {
      const { data: users, error: usersError } = await supabaseAdmin
        .from("users")
        .select("id, email, department_id")
        .in("email", allEmails);

      if (usersError) {
        console.error("[api/demands/import] load users error", usersError);
      } else if (users) {
        for (const u of users as any[]) {
          const email = (u.email as string | null) || "";
          if (!email) continue;
          userMap.set(email.toLowerCase(), {
            id: u.id as number,
            departmentId: (u.department_id as number | null) ?? null,
          });
        }
      }
    }

    const departmentKeyForFields = ((dept.slug as string | null) || undefined) ?? undefined;

    const results: ImportRowResult[] = [];
    let successCount = 0;

    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i];
      const rowNumber = i + 1;

      const title = (row[titleCol] ?? "").trim();

      if (title.startsWith("【示例】") || title.startsWith("#")) {
        continue;
      }
      const description = descriptionCol !== undefined ? (row[descriptionCol] ?? "").trim() : "";
      const creatorEmailRaw = row[creatorEmailCol] ?? "";
      const assigneeEmailRaw = row[assigneeEmailCol] ?? "";
      const statusLabelRaw = statusCol !== undefined ? row[statusCol] ?? "" : "";
      const priorityRaw = priorityCol !== undefined ? row[priorityCol] ?? "" : "";
      const dueDateRaw = dueDateCol !== undefined ? row[dueDateCol] ?? "" : "";
      const demandTypeRaw = demandTypeCol !== undefined ? row[demandTypeCol] ?? "" : "";

      const creatorEmail = creatorEmailRaw.trim();
      const assigneeEmail = assigneeEmailRaw.trim();

      if (!title) {
        results.push({ rowNumber, success: false, message: "标题不能为空" });
        continue;
      }

      if (!creatorEmail) {
        results.push({ rowNumber, success: false, message: "提交人邮箱不能为空" });
        continue;
      }

      if (!assigneeEmail) {
        results.push({ rowNumber, success: false, message: "执行人邮箱不能为空" });
        continue;
      }

      const creatorUser = userMap.get(creatorEmail.toLowerCase());
      const assigneeUser = userMap.get(assigneeEmail.toLowerCase());

      if (!creatorUser) {
        results.push({ rowNumber, success: false, message: "提交人邮箱在系统中不存在" });
        continue;
      }

      if (!assigneeUser) {
        results.push({ rowNumber, success: false, message: "执行人邮箱在系统中不存在" });
        continue;
      }

      const statusEnum = mapStatusLabelToEnum(statusLabelRaw ? String(statusLabelRaw) : null);
      const dbStatus = statusEnum ? toDbStatus(statusEnum) : "pending";
      const priority = normalizePriority(priorityRaw);
      const dueDate = dueDateRaw ? String(dueDateRaw).trim() : "";
      const demandTypeToken = String(demandTypeRaw || "").trim();
      const demandType = resolveImportDemandType(demandTypeToken, demandTypes);

      if (demandTypeToken && !demandType) {
        results.push({
          rowNumber,
          success: false,
          message: `需求类型不存在或已停用：${demandTypeToken}`,
        });
        continue;
      }

      if (demandTypeRequired && !demandType) {
        results.push({
          rowNumber,
          success: false,
          message: "创意部需求必须填写有效的需求类型编码",
        });
        continue;
      }

      const fieldTemplateId = demandType?.fieldTemplateId ?? activeFieldTemplateId;
      const dynamicFieldMap = fieldTemplateId
        ? fieldsByTemplate.get(fieldTemplateId) || new Map<string, ImportField>()
        : new Map<string, ImportField>();

      const customFields: Record<string, any> = {};

      for (let colIndex = 0; colIndex < header.length; colIndex += 1) {
        const colName = header[colIndex];
        if (!colName) continue;
        if (
          colName === "标题" ||
          colName === "描述" ||
          colName === "提交人邮箱" ||
          colName === "执行人邮箱" ||
          colName === "状态" ||
          colName === "优先级" ||
          colName === "截止日期" ||
          (demandTypeCol !== undefined && colIndex === demandTypeCol)
        ) {
          continue;
        }

        const fieldMeta = dynamicFieldMap.get(colName);
        if (!fieldMeta) continue;

        const rawValue = row[colIndex] ?? "";
        const textValue = String(rawValue).trim();
        if (!textValue) continue;

        let parsedValue: any = textValue;
        const fieldType = fieldMeta.type;

        if (fieldType === "number") {
          const num = Number(textValue);
          if (Number.isFinite(num)) {
            parsedValue = num;
          }
        } else if (fieldType === "boolean") {
          if (textValue === "是" || textValue === "true" || textValue === "1") {
            parsedValue = true;
          } else if (textValue === "否" || textValue === "false" || textValue === "0") {
            parsedValue = false;
          }
        } else if (fieldType === "multi_select") {
          parsedValue = textValue
            .split(/[，,;]/)
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
        }

        customFields[fieldMeta.key] = parsedValue;
      }

      const importFields = Array.from(dynamicFieldMap.values());
      const missingRequiredFields = findMissingRequiredDemandFields(importFields, customFields);
      if (missingRequiredFields.length > 0) {
        results.push({
          rowNumber,
          success: false,
          message: `请填写必填字段：${missingRequiredFields.join("、")}`,
        });
        continue;
      }

      const invalidQuantityFields = findInvalidPositiveIntegerDemandFields(importFields, customFields);
      if (invalidQuantityFields.length > 0) {
        results.push({
          rowNumber,
          success: false,
          message: `数量字段必须填写大于或等于 1 的整数：${invalidQuantityFields.join("、")}`,
        });
        continue;
      }

      const code = makeDemandCode();

      const creatorCode = creatorEmail.split("@")[0]?.toUpperCase();
      const assigneeCode = assigneeEmail.split("@")[0]?.toUpperCase();

      const fields = {
        code,
        description,
        priority,
        dueDate,
        departmentKey: departmentKeyForFields,
        creatorCode,
        assigneeCode,
        assigneeEmail,
        ...customFields,
      };

      const { error: insertError } = await supabaseAdmin.from("demands").insert({
        department_id: departmentIdNumber,
        creator_id: creatorUser.id,
        assignee_id: assigneeUser.id,
        demand_type_id: demandType?.id ?? null,
        title,
        status: dbStatus || "pending",
        field_template_id: fieldTemplateId,
        fields,
      });

      if (insertError) {
        console.error("[api/demands/import] insert demand error", insertError);
        results.push({
          rowNumber,
          success: false,
          message: insertError.message || "写入数据库失败",
        });
        continue;
      }

      successCount += 1;
      results.push({ rowNumber, success: true });
    }

    const failCount = results.length - successCount;

    return NextResponse.json({
      successCount,
      failCount,
      results,
    });
  } catch (error: any) {
    console.error("[api/demands/import] error", error);
    return NextResponse.json(
      {
        error: "failed to import demands",
        detail: error?.message ?? String(error),
      },
      { status: 500 },
    );
  }
}
