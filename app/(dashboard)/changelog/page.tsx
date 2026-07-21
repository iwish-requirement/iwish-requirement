"use client";

import React from "react";
import {
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  Filter,
  LineChart,
  MessageSquareText,
  MousePointerClick,
  PanelRightOpen,
  RefreshCcw,
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
    date: "2026-07-21",
    title: "\u7b5b\u9009\u7a33\u5b9a\u6027\u3001\u6570\u91cf\u6821\u9a8c\u4e0e\u521b\u610f\u90e8\u7edf\u8ba1\u53e3\u5f84\u7edf\u4e00",
    summary:
      "\u4fee\u590d\u9700\u6c42\u5217\u8868\u5feb\u901f\u5207\u6362\u90e8\u95e8\u65f6\u7684\u7b5b\u9009\u9519\u4e71\uff0c\u6570\u91cf\u5b57\u6bb5\u7edf\u4e00\u9650\u5236\u4e3a\u81f3\u5c11 1 \u7684\u6574\u6570\uff0c\u5e76\u62c6\u5206\u521b\u610f\u90e8\u7d20\u6750\u4e0e\u89c6\u9891\u7684\u9700\u6c42\u91cf\u548c\u5b8c\u6210\u91cf\u3002",
    audience: ["\u521b\u610f\u90e8", "\u9700\u6c42\u63d0\u4ea4\u4eba", "\u90e8\u95e8\u8d1f\u8d23\u4eba", "\u9700\u6c42\u7ba1\u7406\u5458"],
    items: [
      {
        title: "\u90e8\u95e8\u7b5b\u9009\u5207\u6362\u66f4\u7a33\u5b9a",
        description:
          "\u5207\u6362\u90e8\u95e8\u65f6\u4f1a\u6e05\u7406\u65e7\u90e8\u95e8\u7684\u72b6\u6001\u3001\u4f18\u5148\u7ea7\u3001\u9700\u6c42\u7c7b\u578b\u3001\u6267\u884c\u4eba\u548c\u52a8\u6001\u5b57\u6bb5\u6761\u4ef6\uff0c\u5e76\u963b\u6b62\u8fc7\u671f\u8bf7\u6c42\u8986\u76d6\u5f53\u524d\u6570\u636e\u3002",
        impact: "\u8fde\u7eed\u5feb\u901f\u5207\u6362\u90e8\u95e8\u65f6\uff0c\u5217\u8868\u548c\u53ef\u9009\u7b5b\u9009\u9879\u4f1a\u4e0e\u5f53\u524d\u90e8\u95e8\u4fdd\u6301\u4e00\u81f4\u3002",
        icon: Filter,
      },
      {
        title: "\u6570\u91cf\u5b57\u6bb5\u81f3\u5c11\u4e3a 1",
        description:
          "\u7d20\u6750\u6570\u91cf\u3001\u89c6\u9891\u6570\u91cf\u7b49\u6570\u91cf\u5b57\u6bb5\u5fc5\u987b\u662f\u5927\u4e8e\u6216\u7b49\u4e8e 1 \u7684\u6574\u6570\uff0c\u65b0\u5efa\u3001\u7f16\u8f91\u3001\u8349\u7a3f\u786e\u8ba4\u548c CSV \u5bfc\u5165\u5747\u4f1a\u6821\u9a8c\u3002",
        impact: "0\u3001\u8d1f\u6570\u3001\u5c0f\u6570\u548c\u975e\u6570\u5b57\u5185\u5bb9\u4e0d\u518d\u80fd\u5199\u5165\uff0c\u7edf\u8ba1\u7684\u6570\u91cf\u57fa\u7840\u6570\u636e\u66f4\u53ef\u9760\u3002",
        icon: ShieldCheck,
      },
      {
        title: "\u521b\u610f\u90e8\u6210\u5458\u7edf\u8ba1\u5b57\u6bb5\u7edf\u4e00",
        description:
          "\u521b\u610f\u90e8\u6240\u6709\u5c97\u4f4d\u7edf\u4e00\u5c55\u793a\u8d1f\u8d23\u9700\u6c42\u6570\u3001\u5df2\u5b8c\u6210\u9700\u6c42\u6570\u3001\u7d20\u6750\u9700\u6c42\u6570\u91cf\u3001\u5df2\u5b8c\u6210\u7d20\u6750\u6570\u91cf\u3001\u89c6\u9891\u9700\u6c42\u6570\u91cf\u548c\u5df2\u5b8c\u6210\u89c6\u9891\u6570\u91cf\u3002",
        impact: "\u5404\u5c97\u4f4d\u53ef\u6309\u540c\u4e00\u53e3\u5f84\u5bf9\u6bd4\u7d20\u6750\u548c\u89c6\u9891\u5de5\u4f5c\u91cf\uff0c\u65e0\u9700\u6c42\u7684\u6210\u5458\u4e5f\u4f1a\u4ee5 0 \u663e\u793a\u3002",
        icon: LineChart,
      },
    ],
  },
  {
    date: "2026-07-08",
    title: "\u521b\u610f\u90e8\u9700\u6c42\u89c6\u56fe\u8c03\u6574",
    summary:
      "\u521b\u610f\u90e8\u4e0d\u518d\u6309\u5c97\u4f4d\u533a\u5206\u5e73\u9762\u548c\u89c6\u9891\u9700\u6c42\u89c6\u56fe\uff0c\u5168\u5458\u53ef\u5904\u7406\u5404\u7c7b\u521b\u610f\u9700\u6c42\uff0c\u586b\u5199\u5185\u5bb9\u7531\u9700\u6c42\u7c7b\u578b\u548c\u5b57\u6bb5\u6a21\u677f\u51b3\u5b9a\u3002",
    audience: ["\u521b\u610f\u90e8", "\u90e8\u95e8\u8d1f\u8d23\u4eba", "\u9700\u6c42\u7ba1\u7406\u5458"],
    items: [
      {
        title: "\u4e0d\u518d\u6309\u5c97\u4f4d\u9650\u5236\u9700\u6c42\u7c7b\u578b",
        description:
          "\u9700\u6c42\u5217\u8868\u79fb\u9664\u521b\u610f\u90e8\u5c97\u4f4d\u89c6\u56fe\u8fc7\u6ee4\uff0c\u521b\u610f\u90e8\u6210\u5458\u53ef\u770b\u5230\u90e8\u95e8\u5185\u6240\u6709\u5e73\u9762\u3001\u56fe\u7247\u548c\u89c6\u9891\u7c7b\u9700\u6c42\u3002",
        impact: "\u4eba\u5458\u4e0d\u9700\u518d\u901a\u8fc7\u5c97\u4f4d\u51b3\u5b9a\u80fd\u5904\u7406\u54ea\u4e9b\u9700\u6c42\uff1b\u53ef\u4ee5\u76f4\u63a5\u7528\u9700\u6c42\u7c7b\u578b\u7b5b\u9009\u548c\u5904\u7406\u4e0d\u540c\u5de5\u4f5c\u5185\u5bb9\u3002",
        icon: Filter,
      },
      {
        title: "\u4ecd\u6309\u9700\u6c42\u7c7b\u578b\u5448\u73b0\u8868\u5355\u5185\u5bb9",
        description:
          "\u89c6\u9891\u3001\u56fe\u7247\u3001\u5e73\u9762\u7b49\u4e0d\u540c\u9700\u6c42\u7684\u586b\u5199\u5b57\u6bb5\u7ee7\u7eed\u7531\u9700\u6c42\u7c7b\u578b\u7ed1\u5b9a\u7684\u5b57\u6bb5\u6a21\u677f\u63a7\u5236\u3002",
        impact: "\u521b\u5efa\u6216\u67e5\u770b\u9700\u6c42\u65f6\uff0c\u9009\u62e9\u4e0d\u540c\u9700\u6c42\u7c7b\u578b\u4f1a\u5448\u73b0\u5bf9\u5e94\u586b\u5199\u5185\u5bb9\uff0c\u800c\u4e0d\u518d\u4f9d\u8d56\u4eba\u5458\u5c97\u4f4d\u3002",
        icon: ClipboardList,
      },
    ],
  },
  {
    date: "2026-07-02",
    title: "\u52a8\u6001\u5fc5\u586b\u5b57\u6bb5\u6821\u9a8c\u4fee\u590d",
    summary:
      "\u90e8\u95e8\u8868\u5355\u7684\u5fc5\u586b\u5b57\u6bb5\u73b0\u5728\u4f1a\u5728\u65b0\u5efa\u3001\u8be6\u60c5\u4fdd\u5b58\u548c\u8349\u7a3f\u786e\u8ba4\u65f6\u7edf\u4e00\u6821\u9a8c\u3002",
    audience: ["\u9700\u6c42\u63d0\u4ea4\u4eba", "\u521b\u610f\u90e8", "\u90e8\u95e8\u8d1f\u8d23\u4eba", "\u7ba1\u7406\u5458"],
    items: [
      {
        title: "\u7d20\u6750\u6570\u91cf\u4e0d\u518d\u53ef\u7559\u7a7a\u4fdd\u5b58",
        description:
          "\u5bf9\u5f53\u524d\u90e8\u95e8\u548c\u9700\u6c42\u7c7b\u578b\u5bf9\u5e94\u7684\u5b57\u6bb5\u6a21\u677f\u8fdb\u884c\u6821\u9a8c\uff0c\u5982\u679c\u7d20\u6750\u6570\u91cf\u7b49\u5fc5\u586b\u5b57\u6bb5\u672a\u586b\u5199\uff0c\u4fdd\u5b58\u4f1a\u88ab\u963b\u6b62\u5e76\u63d0\u793a\u7f3a\u5931\u5b57\u6bb5\u3002",
        impact: "\u9002\u7528\u4e8e\u65b0\u5efa\u9700\u6c42\u3001\u8be6\u60c5\u9875\u7f16\u8f91\u4fdd\u5b58\u548c\u8349\u7a3f\u786e\u8ba4\u521b\u5efa\u9700\u6c42\uff1b\u6570\u5b57 0 \u4f1a\u6309\u6709\u6548\u586b\u5199\u5904\u7406\u3002",
        icon: ShieldCheck,
      },
    ],
  },
  {
    date: "2026-07-02",
    title: "导出字段与统计维度补齐",
    summary:
      "需求导出补齐客户/品牌、提交人部门和真实状态标签，数据统计补充部门与提交人维度。",
    audience: ["管理者", "部门负责人", "数据分析", "需求管理员"],
    items: [
      {
        title: "\u5bfc\u51fa\u8868\u5934\u8986\u76d6\u90e8\u95e8\u5168\u91cf\u8868\u5355\u5b57\u6bb5",
        description:
          "\u9700\u6c42\u5bfc\u51fa\u7684\u52a8\u6001\u5b57\u6bb5\u6539\u4e3a\u6309\u5bfc\u51fa\u7ed3\u679c\u6d89\u53ca\u90e8\u95e8\u7684\u63d0\u4ea4\u8868\u5355\u5b57\u6bb5\u5168\u96c6\u751f\u6210\uff0c\u4e0d\u518d\u53ea\u53d6\u5f53\u524d\u6fc0\u6d3b\u6a21\u677f\u5b57\u6bb5\u3002",
        impact: "\u5bfc\u51fa\u521b\u610f\u90e8\u6216\u8de8\u90e8\u95e8\u9700\u6c42\u65f6\uff0c\u5386\u53f2\u6a21\u677f\u3001\u65b0\u6a21\u677f\u4e2d\u7684\u8868\u5355\u5b57\u6bb5\u90fd\u4f1a\u8fdb\u5165\u8868\u5934\uff1b\u540c\u4e00\u4e1a\u52a1\u542b\u4e49\u7684\u5b57\u6bb5\u4f1a\u5408\u5e76\u5230\u540c\u4e00\u5217\u5e76\u517c\u5bb9\u591a\u4e2a key\u3002",
        icon: FileSpreadsheet,
      },
      {
        title: "\u5bfc\u51fa\u7f51\u7ad9\u540d\u79f0\u517c\u5bb9\u5386\u53f2\u6a21\u677f",
        description:
          "\u521b\u610f\u90e8\u5bfc\u51fa\u52a8\u6001\u5b57\u6bb5\u65f6\uff0c\u4f1a\u6309\u540c\u90e8\u95e8\u5386\u53f2\u6a21\u677f\u7684\u540c\u4e49\u5b57\u6bb5 key \u56de\u586b\u7f51\u7ad9\u540d\u79f0\u3001\u5ba2\u6237\u54c1\u724c\u548c\u7f51\u5740\u7b49\u4fe1\u606f\u3002",
        impact: "\u65e7\u6a21\u677f\u5bfc\u51fa\u7684\u300c\u7f51\u7ad9\u540d\u79f0\u300d\u5217\u4e0d\u4f1a\u518d\u56e0\u4e3a\u65b0\u9700\u6c42\u4f7f\u7528 website_name / website_url \u800c\u7559\u7a7a\uff0c\u56fa\u5b9a\u300c\u5ba2\u6237/\u54c1\u724c\u300d\u5217\u4e5f\u4f1a\u4f18\u5148\u56de\u586b\u7ed3\u6784\u5316\u7f51\u7ad9\u540d\u79f0\u3002",
        icon: FileSpreadsheet,
      },
      {
        title: "导出字段更完整",
        description:
          "需求导出新增客户/品牌和提交人部门，并按需求所属部门的工作流配置导出状态和优先级标签。",
        impact: "导出的状态不会再因为自定义流程被统一显示为待处理，跨部门分析时也能看到提交人所属部门。",
        icon: ClipboardList,
      },
      {
        title: "统计维度补充",
        description:
          "数据统计新增部门需求排行和提交人需求排行，与客户排行、需求类型分布一起展示。",
        impact: "可以从客户、部门、提交人和需求类型多个维度判断需求来源与承载情况。",
        icon: LineChart,
      },
      {
        title: "提交人筛选范围调整",
        description:
          "需求列表的提交人筛选改为全公司活跃用户，执行人筛选仍按当前需求部门成员过滤。",
        impact: "可以查询某个提交人提交到不同部门的需求，不再被当前需求部门限制。",
        icon: Filter,
      },
    ],
  },
  {
    date: "2026-07-01",
    title: "创意部需求同步飞书表格",
    summary:
      "创意部全部需求支持通过飞书 OpenAPI 全量刷新到普通电子表格，便于其他工具和 AI 流程读取最新需求清单。",
    audience: ["创意部", "设计团队", "AI 制作流程", "管理员"],
    items: [
      {
        title: "同步到普通 Sheets",
        description:
          "系统会把创意部全部需求整理成飞书电子表格，包含编号、标题、状态、优先级、执行人、排期、素材数量、客户和详情链接等字段。",
        impact: "其他工具可以直接读取同一张表获取当前需求，不需要从系统页面手动复制整理。",
        icon: FileSpreadsheet,
      },
      {
        title: "按创意部变更自动刷新",
        description:
          "创意部需求创建、保存、状态变化或排期变化后，会异步触发表格全量刷新；同步失败不会影响需求正常保存。",
        impact: "飞书表格会尽量保持和需求系统一致，同时不会因为飞书接口异常阻塞业务操作。",
        icon: Sparkles,
      },
      {
        title: "支持首次自动建表",
        description:
          "配置飞书自建应用后，首次手动同步可在云文档根目录创建“创意部需求同步表”，并返回需要回填的表格 token 和 sheet id。",
        impact: "管理员无需提前手动建表，完成授权和环境变量配置后即可初始化同步。",
        icon: CheckCircle2,
      },
      {
        title: "新增手动同步入口",
        description:
          "系统设置新增“飞书同步”入口，管理员可以一键触发创意部需求全量刷新，并复制 Cloudflare 需要回填的表格变量。",
        impact: "首次初始化和后续排查同步问题时，不需要打开控制台或手动调用接口。",
        icon: RefreshCcw,
      },
    ],
  },
  {
    date: "2026-07-01",
    title: "创意部已完成素材统计与日期口径修复",
    summary:
      "数据统计页的部门成员统计新增已完成素材口径，并修复创建日期筛选和本月统计的日期边界问题。",
    audience: ["创意部", "设计团队", "管理者", "部门负责人"],
    items: [
      {
        title: "新增已完成素材列",
        description:
          "部门成员统计现在会展示已完成素材数量，只累加状态属于已完成的需求里的素材数量。",
        impact: "可以同时看到成员负责的素材总量和实际已完成的素材量，避免把未完成排期也当成交付量。",
        icon: ClipboardList,
      },
      {
        title: "修复当天和本月统计边界",
        description:
          "需求列表创建日期筛选改为覆盖完整业务日，数据统计的本月口径统一按北京时间自然月计算。",
        impact: "选择 7 月 1 日能查到 7 月 1 日当天提交的需求，本月统计也会正确纳入当天数据。",
        icon: Filter,
      },
      {
        title: "修复复制需求后的保存失败",
        description:
          "复制需求时不再带入内部排期等执行字段，详情页普通保存也不会提交隐藏内部字段。",
        impact: "复制出来的新需求可以直接进入详情页编辑并保存，不再因为内部字段权限导致保存失败。",
        icon: ClipboardList,
      },
    ],
  },
  {
    date: "2026-06-02",
    title: "统计月份归属与部门字段口径优化",
    summary:
      "数据统计页现在区分提交月份、完成月份和部门工作量归属。创意/设计部门支持按排期开始日期统计成员工作量，同时兼容没有排期日期的历史需求。",
    audience: ["创意部", "设计团队", "管理者", "部门负责人"],
    items: [
      {
        title: "新增与完成使用不同月份口径",
        description:
          "新增需求数继续按提交月份统计，已完成需求数和完成趋势改为按完成月份统计。",
        impact: "5 月提交、6 月完成的需求会同时体现在 5 月流入和 6 月交付里，数据含义更清楚。",
        icon: LineChart,
      },
      {
        title: "创意部支持排期月份统计工作量",
        description:
          "创意/设计部门可在需求详情页和需求列表接单面板维护内部排期开始日期，成员统计可按排期月份归属需求和素材工作量。",
        impact: "5 月提交但 6 月才制作的需求，可以归入 6 月工作量，更符合排队和排期场景。",
        icon: ClipboardList,
      },
      {
        title: "历史需求兼容",
        description:
          "没有排期日期的旧需求会回退到提交月份，未启用排期字段的部门也继续使用提交月份。",
        impact: "新增口径不会让旧数据从历史统计中消失，其他部门也不会被强制套用创意部的排期规则。",
        icon: Filter,
      },
    ],
  },
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
          "面板内提供进入详情、分配执行人、修改流转状态、复制需求、删除需求、上一条/下一条，并前置“整理为 PSD”入口。",
        impact: "执行人接收、分配和推进需求不用再进入完整详情页查找，处理节奏更顺。",
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
