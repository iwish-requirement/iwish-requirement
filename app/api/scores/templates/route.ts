import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../lib/serverAuth";

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
    const currentUser = authResult.user!;

    const url = new URL(req.url);
    const deptParam = url.searchParams.get("departmentId");

    let departmentId: number | null = currentUser.departmentId;
    if (deptParam) {
      const parsed = Number.parseInt(deptParam, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        departmentId = parsed;
      }
    }

    if (!departmentId) {
      return NextResponse.json(
        { error: "no_department", detail: "当前账号未绑定部门，无法加载评分模板" },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("score_templates")
      .select("id, department_id, name, items, is_active")
      .eq("department_id", departmentId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<RawTemplateRow>();

    if (error) {
      console.error("[api/scores/templates] query error", error);
      return NextResponse.json(
        { error: "failed_to_load_template", detail: error.message },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "not_found", detail: "当前部门暂无启用的评分模板，请联系管理员配置" },
        { status: 404 },
      );
    }

    const items = normalizeItems(data.items);

    if (!items.length) {
      return NextResponse.json(
        { error: "empty_template", detail: "当前评分模板未配置任何评分项，请联系管理员配置" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      template: {
        id: data.id,
        departmentId: data.department_id,
        name: data.name ?? "默认评分模板",
        items,
      },
    });
  } catch (error: any) {
    console.error("[api/scores/templates] unexpected error", error);
    return NextResponse.json(
      {
        error: "failed_to_load_template",
        detail: error?.message ?? String(error),
      },
      { status: 500 },
    );
  }
}
