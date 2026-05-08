import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { loadEffectivePermissionsForUser } from "../../../../../lib/serverPermissions";

export const runtime = "edge";

const DEPARTMENT_ALIASES: Record<string, string[]> = {
  tech: ["技术", "技术部", "开发", "系统"],
  design: ["创意", "创意部", "设计", "美工", "视频", "剪辑", "ui", "UI"],
};

function parseKeyValues(text: string) {
  const payload: Record<string, string> = {};
  const regex = /([\u4e00-\u9fa5A-Za-z_]+)\s*=\s*([^\s]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    const key = match[1].trim();
    const value = match[2].trim();
    if (!key || !value) continue;
    const normalized = key
      .replace("客户", "customerName")
      .replace("项目", "projectName")
      .replace("类型", "demandTypeName")
      .replace("标题", "title")
      .replace("截止", "dueDate")
      .replace("说明", "description")
      .replace("素材", "assetUrl")
      .replace("链接", "url");
    payload[normalized] = value;
  }
  return payload;
}

async function resolveDepartmentId(text: string) {
  const { data } = await supabaseAdmin.from("departments").select("id, slug, name");
  const departments = data || [];
  for (const dept of departments as any[]) {
    const slug = ((dept.slug as string | null) || "").toLowerCase();
    const name = ((dept.name as string | null) || "").toLowerCase();
    const aliases = DEPARTMENT_ALIASES[slug] || [name, slug].filter(Boolean);
    if (aliases.some((alias) => alias && text.toLowerCase().includes(alias.toLowerCase()))) {
      return dept.id as number;
    }
  }
  return (departments[0] as any)?.id as number | undefined;
}

async function resolveDemandTypeId(departmentId: number | undefined, text: string, demandTypeName?: string) {
  if (!departmentId) return null;
  const { data } = await supabaseAdmin
    .from("demand_types")
    .select("id, name")
    .eq("department_id", departmentId)
    .eq("is_active", true);
  const target = (demandTypeName || text).toLowerCase();
  const matched = (data || []).find((row: any) => {
    const name = ((row.name as string) || "").toLowerCase();
    return name && target.includes(name);
  });
  return matched ? (matched.id as number) : null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = ((body.text as string | undefined) || "").trim();
    const wecomUserId = ((body.wecomUserId as string | undefined) || (body.FromUserName as string | undefined) || "").trim();
    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const { data: user, error: userError } = wecomUserId
      ? await supabaseAdmin
          .from("users")
          .select("id, email, name, role, department_id, status")
          .eq("wecom_user_id", wecomUserId)
          .maybeSingle()
      : { data: null, error: null } as any;

    if (userError) {
      console.error("[api/wecom-gateway/demands/parse] user lookup error", userError);
    }
    if (!user) {
      return NextResponse.json({ error: "wecom user is not bound" }, { status: 403 });
    }
    const permissions = await loadEffectivePermissionsForUser({
      id: user.id as number,
      email: user.email as string,
      name: (user as any).name || null,
      role: (user as any).role || "user",
      departmentId: (user as any).department_id || null,
      status: (user as any).status || "active",
    } as any);
    if (!permissions.includes("demand.create" as any)) {
      return NextResponse.json({ error: "forbidden", detail: "当前账号无权通过企微提交需求" }, { status: 403 });
    }

    const parsed = parseKeyValues(text);
    const departmentId = await resolveDepartmentId(text);
    const demandTypeId = await resolveDemandTypeId(departmentId, text, parsed.demandTypeName);
    const title = parsed.title || text.replace(/^提交\S*需求\s*/, "").slice(0, 80) || "企业微信需求";
    const payload = {
      rawText: text,
      title,
      description: parsed.description || text,
      dueDate: parsed.dueDate || "",
      customerName: parsed.customerName || "",
      projectName: parsed.projectName || "",
      demandTypeName: parsed.demandTypeName || "",
      customFields: parsed,
    };

    const { data: draft, error: draftError } = await supabaseAdmin
      .from("demand_drafts")
      .insert({
        creator_id: user.id,
        source: "wecom",
        department_id: departmentId || null,
        demand_type_id: demandTypeId,
        title,
        payload,
        status: "parsed",
        updated_at: new Date().toISOString(),
      })
      .select("id, department_id, demand_type_id, title, payload, status")
      .maybeSingle();

    if (draftError || !draft) {
      console.error("[api/wecom-gateway/demands/parse] draft insert error", draftError);
      return NextResponse.json({ error: "failed_to_create_draft", detail: draftError?.message }, { status: 500 });
    }

    return NextResponse.json({
      draft,
      message: `已解析为需求草稿 #${draft.id}：${title}。确认创建请调用确认接口。`,
    }, { status: 201 });
  } catch (error: any) {
    console.error("[api/wecom-gateway/demands/parse] unexpected error", error);
    return NextResponse.json({ error: "failed_to_parse_wecom_demand", detail: error?.message ?? String(error) }, { status: 500 });
  }
}
