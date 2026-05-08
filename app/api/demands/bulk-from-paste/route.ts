import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../lib/serverAuth";
import { ensureHasPermission } from "../../../../lib/serverPermissions";

export const runtime = "edge";

function parsePastedRows(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const splitLine = (line: string) => line.split(/\t|,/).map((v) => v.trim());
  const header = splitLine(lines[0]);
  const hasHeader = header.some((v) => /标题|需求标题|title|客户|品牌|公司|customer|brand|company|说明|描述|description|项目|站点|project|site|截止|due/i.test(v));
  const rows = hasHeader ? lines.slice(1) : lines;
  const columns = hasHeader ? header : ["title", "description", "dueDate", "customerName", "projectName"];

  return rows.map((line) => {
    const values = splitLine(line);
    const payload: Record<string, any> = {};
    const customFields: Record<string, string> = {};
    columns.forEach((column, index) => {
      const normalized = column
        .replace(/需求标题|标题|title/i, "title")
        .replace(/需求描述|描述|说明|description/i, "description")
        .replace(/客户名称|客户名|客户|品牌名|品牌|公司名称|公司名|公司|customer|brand|company/i, "customerName")
        .replace(/项目名称|项目|站点|店铺|链接|网址|project|site|url/i, "projectName")
        .replace(/截止时间|截止日期|截止|dueDate|due/i, "dueDate");
      const value = values[index] || "";
      payload[normalized] = value;
      if (!["title", "description", "dueDate"].includes(normalized) && value) {
        customFields[column] = value;
      }
    });
    payload.rawText = line;
    if (payload.customerName) customFields["客户"] = payload.customerName;
    if (payload.projectName) customFields["项目"] = payload.projectName;
    (payload as any).customFields = customFields;
    return payload;
  }).filter((row) => row.title || row.description);
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) return authResult.errorResponse;
    const activeError = ensureActiveUser(authResult.user);
    if (activeError) return activeError;
    const permError = await ensureHasPermission(authResult.user, "demand.create");
    if (permError) return permError;

    const body = await req.json();
    const text = ((body.text as string | undefined) || "").trim();
    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const rows = parsePastedRows(text);
    if (!rows.length) {
      return NextResponse.json({ error: "no rows parsed" }, { status: 400 });
    }

    const departmentId = Number.parseInt(String(body.departmentId || ""), 10);
    const demandTypeId = Number.parseInt(String(body.demandTypeId || ""), 10);
    const toInsert = rows.map((payload) => ({
      creator_id: authResult.user!.id,
      source: "paste",
      department_id: Number.isNaN(departmentId) ? null : departmentId,
      demand_type_id: Number.isNaN(demandTypeId) ? null : demandTypeId,
      title: payload.title || payload.description || "未命名需求",
      payload,
      status: "draft",
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await supabaseAdmin
      .from("demand_drafts")
      .insert(toInsert)
      .select("id, payload, title, status");

    if (error) {
      console.error("[api/demands/bulk-from-paste] insert error", error);
      return NextResponse.json({ error: "failed_to_create_drafts", detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ items: data || [], parsedCount: rows.length }, { status: 201 });
  } catch (error: any) {
    console.error("[api/demands/bulk-from-paste] unexpected error", error);
    return NextResponse.json({ error: "failed_to_parse_paste", detail: error?.message ?? String(error) }, { status: 500 });
  }
}
