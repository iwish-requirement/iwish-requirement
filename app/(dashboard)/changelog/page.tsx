"use client";

import React from "react";
import {
  CheckCircle2,
  ClipboardList,
  Filter,
  LineChart,
  MessageSquareText,
  MousePointerClick,
  PanelRightOpen,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCog,
} from "lucide-react";

interface ReleaseItem {
  title: string;
  description: string;
  impact: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface ReleaseNote {
  date: string;
  title: string;
  summary: string;
  audience: string[];
  items: ReleaseItem[];
}

const releases: ReleaseNote[] = [
  {
    date: "2026-05-14",
    title: "需求列表接单面板与岗位配置优化",
    summary:
      "这次更新把需求列表升级为更适合执行人接收任务的工作入口。点击需求会先打开右侧接单面板，快速看到核心内容、重要字段、素材线索和处理动作，同时岗位视图改为后台可配置。",
    audience: ["创意部", "技术部", "执行人", "管理员"],
    items: [
      {
        title: "点击需求先打开接单面板",
        description:
          "需求列表不再默认直接跳详情页，而是先展示右侧面板，保留当前筛选和列表位置。",
        impact: "执行人可以连续查看多条需求，不用反复进入详情再返回列表。",
        icon: PanelRightOpen,
      },
      {
        title: "核心内容和重要字段前置",
        description:
          "面板优先展示需求描述、文案、尺寸、设计版式、素材数量、参考图、原素材、品牌/客户和链接等关键信息。",
        impact: "减少执行人理解需求的路径，快速判断材料是否齐全、能不能开始处理。",
        icon: MousePointerClick,
      },
      {
        title: "处理动作更靠近工作现场",
        description:
          "面板内提供进入详情、复制需求、删除需求、上一条/下一条，并前置“整理为 PSD”入口。",
        impact: "高频动作不用再进入完整详情页查找，创意部处理需求的节奏更顺。",
        icon: ClipboardList,
      },
      {
        title: "岗位视图支持后台配置",
        description:
          "管理员可以在用户管理中按部门维护岗位名称、编码和可见需求类型，并按部门筛选用户后批量维护岗位。",
        impact: "创意部可灵活区分设计、视频剪辑等岗位，后续其他部门也能复用同一套配置方式。",
        icon: UserCog,
      },
    ],
  },
  {
    date: "2026-05-09",
    title: "权限与统计口径体验修复",
    summary:
      "这次更新重点修复普通用户看不到自己提交需求、工作台数据不准确、完成率统计不符合自定义状态的问题，同时补齐了“删除自己提交需求”的日常维护能力。",
    audience: ["运营/销售/客服", "技术部", "创意部", "部门负责人"],
    items: [
      {
        title: "普通用户可以删除自己提交的需求",
        description:
          "误提交、重复提交或内容明显填错时，提交人可以自行删除；没有删除权限的用户仍不能删除他人的需求。",
        impact: "减少管理员代删，让需求列表更干净，也保留了删除他人需求的权限边界。",
        icon: Trash2,
      },
      {
        title: "自己提交的跨部门需求可正常查看",
        description:
          "普通用户提交给技术部、创意部等其他部门的需求，会稳定出现在个人视角和工作台最近需求里。",
        impact: "提交人可以持续追踪处理进度，不会因为自己所属部门不同而看不到记录。",
        icon: ShieldCheck,
      },
      {
        title: "工作台按权限展示统计模块",
        description:
          "没有统计总览权限的账号，不再看到会触发无权限提示的部门概览模块。",
        impact: "不同权限账号看到的首页更贴合实际可用能力，减少误解和无效入口。",
        icon: ClipboardList,
      },
      {
        title: "完成率兼容部门自定义状态",
        description:
          "技术部的“已完成”、创意部的“已完成”等自定义状态，会被正确识别为完成状态。",
        impact: "完成量、完成率、趋势图、成员完成量和工作台数量更接近真实业务情况。",
        icon: LineChart,
      },
    ],
  },
  {
    date: "2026-05-08",
    title: "公司级运营需求中台优化",
    summary:
      "系统从技术部/创意部的需求统计工具，升级为更适合全公司协作的运营需求中台。核心方向是降低提交成本、保留动态字段灵活性，并继续沉淀交付部门的统计和评分数据。",
    audience: ["全体提交人", "运营团队", "技术部", "创意部", "管理员"],
    items: [
      {
        title: "需求提交更快",
        description:
          "支持按目标部门和需求类型进入对应表单，也支持复制历史需求、保存常用模板、从表格粘贴生成草稿。",
        impact: "重复性需求不用从零填写，批量录入可以先预览再确认，降低提交负担。",
        icon: Sparkles,
      },
      {
        title: "客户/品牌回到动态字段体系",
        description:
          "客户、品牌、公司名、站点、链接等信息继续通过部门自定义字段记录，不强制运营维护客户档案。",
        impact: "保留原来的高级筛选习惯，避免为了提交需求额外录入客户主数据。",
        icon: Filter,
      },
      {
        title: "部门需求类型更清晰",
        description:
          "技术部可按 Bug、功能、页面调整等类型管理；创意部可按 UI、美工、视频剪辑、Banner 等类型管理。",
        impact: "统计时能看到不同类型需求的分布，也方便部门内部判断工作量结构。",
        icon: ClipboardList,
      },
      {
        title: "AI 月报进入产品入口",
        description:
          "月度报告支持基于需求、统计和评分数据生成部门分析，并保留规则报告作为失败兜底。",
        impact: "部门复盘不只看数字，也能快速获得关键问题、风险和下月关注点。",
        icon: Sparkles,
      },
      {
        title: "企业微信创建需求进入第一阶段",
        description:
          "支持通过企业微信文本解析需求草稿，确认后再创建正式需求；缺少必要信息时只提示补充。",
        impact: "后续可把常见提交动作前移到聊天场景，但不会绕过确认流程直接落正式需求。",
        icon: MessageSquareText,
      },
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-blue-600">产品更新</p>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
          最近更新了什么
        </h1>
        <p className="max-w-3xl text-sm md:text-base text-slate-600 leading-relaxed">
          这里只记录会影响日常使用的产品变化，帮助提交人、处理部门和管理员快速理解新能力、规则调整和数据口径变化。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="border border-slate-200 bg-white px-4 py-4">
          <div className="text-xs font-semibold text-slate-500">当前重点</div>
          <div className="mt-2 text-lg font-bold text-slate-900">权限和统计更准确</div>
          <p className="mt-1 text-sm text-slate-600">
            普通用户能看见并维护自己的需求，部门数据按真实状态口径统计。
          </p>
        </div>
        <div className="border border-slate-200 bg-white px-4 py-4">
          <div className="text-xs font-semibold text-slate-500">提交体验</div>
          <div className="mt-2 text-lg font-bold text-slate-900">减少重复录入</div>
          <p className="mt-1 text-sm text-slate-600">
            复制需求、模板、最近填写和粘贴草稿，让高频需求提交更轻。
          </p>
        </div>
        <div className="border border-slate-200 bg-white px-4 py-4">
          <div className="text-xs font-semibold text-slate-500">数据方向</div>
          <div className="mt-2 text-lg font-bold text-slate-900">保留动态字段灵活性</div>
          <p className="mt-1 text-sm text-slate-600">
            客户、品牌、公司名继续通过字段筛选和统计，不强制维护客户档案。
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {releases.map((release) => (
          <section key={release.date} className="border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4 md:px-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-500">{release.date}</div>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">{release.title}</h2>
                  <p className="mt-2 max-w-4xl text-sm text-slate-600 leading-relaxed">
                    {release.summary}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  {release.audience.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {release.items.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="grid gap-3 px-5 py-4 md:grid-cols-[220px_1fr] md:px-6">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center bg-blue-50 text-blue-600">
                        <Icon className="h-4 w-4" />
                      </span>
                      <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-slate-700 leading-relaxed">{item.description}</p>
                      <div className="flex items-start gap-2 text-sm text-emerald-700">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{item.impact}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
