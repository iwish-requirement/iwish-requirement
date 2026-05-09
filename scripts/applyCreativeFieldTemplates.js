const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnvValue(key) {
  const envPath = path.join(process.cwd(), ".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const match = env.match(new RegExp(`^${key}=(.+)$`, "m"));
  return match ? match[1].trim() : "";
}

const supabase = createClient(
  loadEnvValue("NEXT_PUBLIC_SUPABASE_URL"),
  loadEnvValue("SUPABASE_SERVICE_ROLE_KEY"),
);

const commonWebsiteField = {
  key: "website_name",
  label: "网站名称/客户品牌",
  type: "text",
  required: true,
  filterable: true,
  orderIndex: 10,
  config: { placeholder: "例如 Flowtica / 客户公司名 / 品牌名" },
};

const templates = [
  {
    code: "ui_design",
    name: "创意部 - UI 设计字段模板",
    version: 2026050901,
    fields: [
      commonWebsiteField,
      {
        key: "customer_type",
        label: "客户类型",
        type: "select",
        filterable: true,
        orderIndex: 20,
        config: { options: ["流量运营服务", "全案深度服务", "SEO服务", "SEM服务", "其他"] },
      },
      {
        key: "website_url",
        label: "需支持的客户网址",
        type: "url",
        filterable: true,
        orderIndex: 30,
        config: { placeholder: "客户官网或站点链接" },
      },
      {
        key: "page_links",
        label: "具体需要修改的页面链接",
        type: "multiline",
        filterable: true,
        orderIndex: 40,
        config: { placeholder: "多条链接可换行填写" },
      },
      {
        key: "ui_request_type",
        label: "设计类型",
        type: "select",
        required: true,
        filterable: true,
        orderIndex: 50,
        config: {
          options: [
            "新站UI设计",
            "老站UI升级",
            "落地页UI设计",
            "页面局部调整",
            "仅UI设计",
            "UI+建站",
            "其他",
          ],
        },
      },
      {
        key: "page_type",
        label: "页面类型",
        type: "multi_select",
        filterable: true,
        orderIndex: 60,
        config: {
          options: ["首页", "产品页", "活动页", "落地页", "分类页", "About Us", "Contact", "Blog/News", "其他"],
        },
      },
      { key: "page_count", label: "页面数量", type: "number", filterable: true, orderIndex: 70 },
      {
        key: "support_content",
        label: "需要支持解决的内容",
        type: "multiline",
        required: true,
        orderIndex: 80,
      },
      {
        key: "detail_requirements",
        label: "细节要求",
        type: "multiline",
        orderIndex: 90,
        config: { placeholder: "页面清单、版块说明、交互/视觉要求等" },
      },
      { key: "competitor_links", label: "参考网站/竞品链接", type: "multiline", orderIndex: 100 },
      { key: "ad_launch_date", label: "广告上线时间", type: "date", filterable: true, orderIndex: 110 },
      { key: "remarks", label: "备注", type: "multiline", orderIndex: 120 },
    ],
  },
  {
    code: "graphic",
    extraCodes: ["campaign_visual"],
    name: "创意部 - 美工素材字段模板",
    version: 2026050902,
    fields: [
      commonWebsiteField,
      {
        key: "website_url",
        label: "网址/产品详情页",
        type: "url",
        filterable: true,
        orderIndex: 20,
        config: { placeholder: "官网、产品详情页或投放页面" },
      },
      {
        key: "material_type",
        label: "素材类型",
        type: "multi_select",
        required: true,
        filterable: true,
        orderIndex: 30,
        config: {
          options: ["Meta素材", "Google素材", "Google广告图", "网站banner", "网站产品素材", "社媒素材", "Criteo素材", "网页设计", "其他"],
        },
      },
      {
        key: "material_size",
        label: "素材尺寸",
        type: "text",
        required: true,
        filterable: true,
        orderIndex: 40,
        config: { placeholder: "例如 1200*1200, 720*1280, 1200*628" },
      },
      {
        key: "layout_style",
        label: "设计版式",
        type: "text",
        filterable: true,
        orderIndex: 50,
        config: { placeholder: "例如 1 / 2 / 3 / 4 或具体版式说明" },
      },
      { key: "style_number", label: "选择风格编号", type: "text", filterable: true, orderIndex: 60 },
      { key: "material_count", label: "素材数量", type: "number", required: true, filterable: true, orderIndex: 70 },
      { key: "material_copy", label: "素材文案内容", type: "multiline", orderIndex: 80 },
      {
        key: "style_requirements",
        label: "风格要求",
        type: "multiline",
        orderIndex: 90,
        config: { placeholder: "场景、元素、颜色、浅/深色调等" },
      },
      {
        key: "source_materials",
        label: "原素材路径/素材包",
        type: "multiline",
        orderIndex: 100,
        config: { placeholder: "共享盘路径或素材包说明，不建议只填网站链接" },
      },
      {
        key: "reference_cases",
        label: "参考案例",
        type: "multiline",
        orderIndex: 110,
        config: { placeholder: "建议至少 2 个参考案例或链接" },
      },
      { key: "ad_launch_date", label: "广告上线时间", type: "date", filterable: true, orderIndex: 120 },
      { key: "remarks", label: "备注", type: "multiline", orderIndex: 130 },
    ],
  },
  {
    code: "video_editing",
    name: "创意部 - 视频剪辑字段模板",
    version: 2026050903,
    fields: [
      commonWebsiteField,
      { key: "website_url", label: "网址/产品详情页", type: "url", filterable: true, orderIndex: 20 },
      {
        key: "ad_channel",
        label: "广告渠道",
        type: "multi_select",
        required: true,
        filterable: true,
        orderIndex: 30,
        config: { options: ["FB", "GG", "Criteo", "拍摄", "YouTube", "TikTok", "其他"] },
      },
      {
        key: "video_size",
        label: "视频尺寸/比例",
        type: "multi_select",
        required: true,
        filterable: true,
        orderIndex: 40,
        config: { options: ["竖版", "方版", "横版", "16:9", "9:16", "1:1", "原尺寸", "其他"] },
      },
      {
        key: "video_duration",
        label: "视频时长",
        type: "text",
        filterable: true,
        orderIndex: 50,
        config: { placeholder: "例如 15s / 30s / 60s" },
      },
      { key: "video_count", label: "视频数量", type: "number", required: true, filterable: true, orderIndex: 60 },
      { key: "video_copy", label: "视频文案内容", type: "multiline", orderIndex: 70 },
      { key: "video_key_points", label: "视频重点要求", type: "multiline", required: true, orderIndex: 80 },
      {
        key: "video_assets",
        label: "视频素材包",
        type: "multiline",
        required: true,
        orderIndex: 90,
        config: { placeholder: "共享盘路径、素材包说明或附件说明" },
      },
      { key: "original_video_links", label: "原视频链接", type: "multiline", orderIndex: 100 },
      { key: "reference_cases", label: "参考案例", type: "multiline", orderIndex: 110 },
      { key: "ad_launch_date", label: "广告上线时间", type: "date", filterable: true, orderIndex: 120 },
      { key: "other_notes", label: "其它", type: "multiline", orderIndex: 130 },
    ],
  },
];

async function unwrap(query, label) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function ensureTemplate(departmentId, template) {
  const existing = await unwrap(
    supabase
      .from("department_field_templates")
      .select("id")
      .eq("department_id", departmentId)
      .eq("version", template.version)
      .order("id", { ascending: false })
      .limit(1),
    `load template ${template.code}`,
  );

  let templateId = existing?.[0]?.id;
  if (!templateId) {
    const inserted = await unwrap(
      supabase
        .from("department_field_templates")
        .insert({
          department_id: departmentId,
          version: template.version,
          name: template.name,
          is_active: false,
        })
        .select("id")
        .single(),
      `create template ${template.code}`,
    );
    templateId = inserted.id;
  } else {
    await unwrap(
      supabase
        .from("department_field_templates")
        .update({ name: template.name, is_active: false })
        .eq("id", templateId),
      `update template ${template.code}`,
    );
  }

  await unwrap(
    supabase
      .from("department_fields")
      .delete()
      .eq("department_id", departmentId)
      .eq("template_id", templateId),
    `clear fields ${template.code}`,
  );

  const rows = template.fields.map((field) => ({
    department_id: departmentId,
    template_id: templateId,
    key: field.key,
    label: field.label,
    type: field.type,
    required: !!field.required,
    filterable: !!field.filterable,
    exportable: field.exportable === false ? false : true,
    order_index: field.orderIndex,
    config: field.config || {},
  }));

  await unwrap(supabase.from("department_fields").insert(rows), `insert fields ${template.code}`);
  return templateId;
}

async function main() {
  const departments = await unwrap(
    supabase.from("departments").select("id,name,slug").or("slug.eq.design,name.eq.创意部").order("id").limit(1),
    "load creative department",
  );
  const department = departments?.[0];
  if (!department) throw new Error("Creative department not found");

  const templateIdByCode = {};
  for (const template of templates) {
    templateIdByCode[template.code] = await ensureTemplate(department.id, template);
  }

  for (const template of templates) {
    const codes = [template.code, ...(template.extraCodes || [])];
    await unwrap(
      supabase
        .from("demand_types")
        .update({
          field_template_id: templateIdByCode[template.code],
          updated_at: new Date().toISOString(),
        })
        .eq("department_id", department.id)
        .in("code", codes),
      `bind demand types ${codes.join(",")}`,
    );
  }

  const demandTypes = await unwrap(
    supabase
      .from("demand_types")
      .select("id,name,code,field_template_id,order_index")
      .eq("department_id", department.id)
      .order("order_index", { ascending: true })
      .order("id", { ascending: true }),
    "load demand type summary",
  );
  const fields = await unwrap(
    supabase.from("department_fields").select("template_id").eq("department_id", department.id),
    "load field summary",
  );
  const counts = fields.reduce((acc, field) => {
    acc[field.template_id] = (acc[field.template_id] || 0) + 1;
    return acc;
  }, {});

  console.log(
    JSON.stringify(
      demandTypes.map((type) => ({
        name: type.name,
        code: type.code,
        fieldTemplateId: type.field_template_id,
        fieldCount: counts[type.field_template_id] || 0,
      })),
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
