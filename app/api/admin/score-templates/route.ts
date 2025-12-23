import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest } from "../../../../lib/serverAuth";
import { ensureHasAnyPermission, ensureHasPermission } from "../../../../lib/serverPermissions";

export const runtime = "nodejs";


type RawTemplateRow = {
  id: number;
  department_id: number;
  name: string | null;
  items: any;
  is_active: boolean | null;
};

type ScoreOption = {
  value: number;
  label: string;
};

type TemplateItem = {
  label: string;
  max: number;
  required: boolean;
  options?: ScoreOption[];
};

type TemplateDto = {
  id: number;
  departmentId: number;
  name: string;
  isActive: boolean;
  items: TemplateItem[];
};

function normalizeItems(raw: any): TemplateItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const items: TemplateItem[] = [];

  for (const entry of raw) {
    const label = (entry?.label ?? "").toString().trim();
    if (!label) {
      continue;
    }

    const maxRaw = entry?.max;
    const maxNumber = typeof maxRaw === "number" && Number.isFinite(maxRaw) ? maxRaw : 5;
    const max = maxNumber > 0 ? maxNumber : 5;
    const required = Boolean(entry?.required);

    let options: ScoreOption[] | undefined;
    const optionsRaw = (entry as any)?.options;
    if (Array.isArray(optionsRaw)) {
      const parsed: ScoreOption[] = [];
      for (const opt of optionsRaw) {
        const valueRaw = (opt as any)?.value;
        const valueNum =
          typeof valueRaw === "number" && Number.isFinite(valueRaw)
            ? valueRaw
            : Number(valueRaw);
        const optionLabel = ((opt as any)?.label ?? "").toString().trim();
        if (!Number.isFinite(valueNum) || !optionLabel) {
          continue;
        }
        parsed.push({ value: valueNum, label: optionLabel });
      }
      if (parsed.length > 0) {
        options = parsed;
      }
    }

    items.push({ label, max, required, options });
  }

  return items;
}

function shapeTemplate(row: RawTemplateRow): TemplateDto {
  return {
    id: row.id,
    departmentId: row.department_id,
    name: (row.name ?? "默认评分模板").toString(),
    isActive: Boolean(row.is_active),
    items: normalizeItems(row.items),
  };
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const permError = await ensureHasAnyPermission(authResult.user, [
      "settings.scoring.view",
      "settings.scoring.manage",
    ]);
    if (permError) {
      return permError;
    }




    const url = new URL(req.url);
    const deptParam = url.searchParams.get("departmentId");

    let query = supabaseAdmin
      .from("score_templates")
      .select("id, department_id, name, items, is_active")
      .order("department_id", { ascending: true })
      .order("created_at", { ascending: false });

    if (deptParam) {
      const deptId = Number.parseInt(deptParam, 10);
      if (!Number.isNaN(deptId) && deptId > 0) {
        query = query.eq("department_id", deptId);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error("[api/admin/score-templates] query error", error);
      return NextResponse.json(
        { error: "failed_to_load_score_templates", detail: error.message },
        { status: 500 },
      );
    }

    const rows = (data || []) as RawTemplateRow[];

    const templates: TemplateDto[] = [];
    const seen = new Set<number>();

    for (const row of rows) {
      const deptId = row.department_id;
      if (seen.has(deptId)) {
        continue;
      }
      seen.add(deptId);
      templates.push(shapeTemplate(row));
    }

    return NextResponse.json({ items: templates });
  } catch (error: any) {
    console.error("[api/admin/score-templates] GET error", error);
    return NextResponse.json(
      { error: "failed_to_load_score_templates", detail: error?.message ?? String(error) },
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

    const permError = await ensureHasAnyPermission(authResult.user, [
      "settings.scoring.view",
      "settings.scoring.manage",
    ]);
    if (permError) {
      return permError;
    }




    const body = await req.json();
    const deptIdRaw = body.departmentId;
    const nameRaw = body.name as string | null | undefined;
    const isActiveRaw = body.isActive as boolean | null | undefined;
    const itemsRaw = body.items;

    const departmentId = Number(deptIdRaw);
    if (!departmentId || Number.isNaN(departmentId)) {
      return NextResponse.json(
        { error: "invalid_department_id", detail: "departmentId is required" },
        { status: 400 },
      );
    }

    const items = normalizeItems(itemsRaw);
    if (!items.length) {
      return NextResponse.json(
        { error: "empty_items", detail: "评分项不能为空" },
        { status: 400 },
      );
    }

    const name = (nameRaw ?? "默认评分模板").toString().trim() || "默认评分模板";
    const isActive = Boolean(isActiveRaw);

    const { data: existingRows, error: loadError } = await supabaseAdmin
      .from("score_templates")
      .select("id, department_id, name, items, is_active")
      .eq("department_id", departmentId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (loadError) {
      console.error("[api/admin/score-templates] load existing error", loadError);
      return NextResponse.json(
        { error: "failed_to_load_existing_template", detail: loadError.message },
        { status: 500 },
      );
    }

    if (existingRows && existingRows.length > 0) {
      const existing = existingRows[0] as RawTemplateRow;

      const { data, error } = await supabaseAdmin
        .from("score_templates")
        .update({
          name,
          items,
          is_active: isActive,
        })
        .eq("id", existing.id)
        .select("id, department_id, name, items, is_active")
        .maybeSingle<RawTemplateRow>();

      if (error || !data) {
        console.error("[api/admin/score-templates] update error", error);
        return NextResponse.json(
          { error: "failed_to_update_template", detail: error?.message ?? "update failed" },
          { status: 500 },
        );
      }

      const template = shapeTemplate(data);
      return NextResponse.json({ template });
    }

    const { data, error } = await supabaseAdmin
      .from("score_templates")
      .insert({
        department_id: departmentId,
        name,
        items,
        is_active: isActive,
      })
      .select("id, department_id, name, items, is_active")
      .maybeSingle<RawTemplateRow>();

    if (error || !data) {
      console.error("[api/admin/score-templates] insert error", error);
      return NextResponse.json(
        { error: "failed_to_create_template", detail: error?.message ?? "insert failed" },
        { status: 500 },
      );
    }

    const template = shapeTemplate(data);
    return NextResponse.json({ template });
  } catch (error: any) {
    console.error("[api/admin/score-templates] POST error", error);
    return NextResponse.json(
      { error: "failed_to_save_template", detail: error?.message ?? String(error) },
      { status: 500 },
    );
  }
}
