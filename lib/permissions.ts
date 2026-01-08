

export type PermissionKey =
  | "demand.view_all"
  | "demand.view_department"
  | "demand.view_personal"
  | "demand.create"
  | "demand.edit"
  | "demand.delete"
  | "stats.view"
  | "stats.overview"
  | "stats.department_members"
  | "stats.dynamic_fields"
  | "stats.scores"
  | "settings.access_shell"
  | "settings.global.view"
  | "settings.global.manage"
  | "settings.departments.view"
  | "settings.departments.manage"
  | "settings.fields.view"
  | "settings.fields.manage"
  | "settings.scoring.view"
  | "settings.scoring.manage"
  | "settings.score_periods.view"
  | "settings.score_periods.manage"
  | "settings.workflow.view"
  | "settings.workflow.manage"
  | "settings.roles.view"
  | "settings.roles.manage"
  | "settings.webhooks.view"
  | "settings.webhooks.manage"
  | "settings.wecom.view"
  | "settings.wecom.manage"
  | "admin.user_manage"
  | "department.fields_manage";





export interface PermissionMeta {
  key: PermissionKey;
  label: string;
  description: string;
}

export const PERMISSIONS: Record<PermissionKey, PermissionMeta> = {
  "demand.view_all": {
    key: "demand.view_all",
    label: "查看全公司需求",
    description: "可以查看所有部门的需求列表与详情。",
  },
  "demand.view_department": {
    key: "demand.view_department",
    label: "查看本部门需求",
    description: "可以查看当前所属部门的需求列表与详情。",
  },
  "demand.view_personal": {
    key: "demand.view_personal",
    label: "查看本人提交的需求",
    description: "可以查看自己提交的需求记录。",
  },
  "demand.create": {
    key: "demand.create",
    label: "创建需求",
    description: "可以在系统中提交新需求。",
  },
  "demand.edit": {
    key: "demand.edit",
    label: "编辑需求",
    description: "可以编辑已有需求的字段与状态（在权限范围内）。",
  },
  "demand.delete": {
    key: "demand.delete",
    label: "删除需求",
    description: "可以删除（或关闭）需求记录。",
  },
  "stats.view": {
    key: "stats.view",
    label: "访问统计模块入口",
    description: "可以在导航栏中看到并进入数据统计页面的框架壳。",
  },
  "stats.overview": {
    key: "stats.overview",
    label: "查看需求总览统计",
    description: "可以查看需求创建量、完成量、在途状态和周期等概览统计。",
  },
  "stats.department_members": {
    key: "stats.department_members",
    label: "查看部门成员统计",
    description: "可以查看部门成员在需求处理和评分表现方面的统计数据。",
  },
  "stats.dynamic_fields": {
    key: "stats.dynamic_fields",
    label: "查看动态字段统计",
    description: "可以按部门自定义字段维度分析需求分布与结构。",
  },
  "stats.scores": {
    key: "stats.scores",
    label: "查看评分统计与明细",
    description: "可以查看员工评分排名、评分概览及评分明细报表。",
  },
  "settings.access_shell": {
    key: "settings.access_shell",
    label: "访问系统设置入口",
    description: "可以在导航栏中看到并进入系统设置页面的框架壳。",
  },

  "settings.global.view": {
    key: "settings.global.view",
    label: "查看全局系统配置",
    description: "可以查看系统名称、开放注册等全局配置项，但不能修改。",
  },

  "settings.global.manage": {
    key: "settings.global.manage",
    label: "管理全局系统配置",
    description: "可以修改系统名称、开放注册等全局配置项。",
  },

  "settings.departments.view": {
    key: "settings.departments.view",
    label: "查看部门管理与配置",
    description: "可以在系统设置中查看部门列表及其基础信息。",
  },

  "settings.departments.manage": {
    key: "settings.departments.manage",
    label: "管理部门及基础配置",
    description: "可以新增、编辑、删除部门等基础配置。",
  },

  "settings.fields.view": {
    key: "settings.fields.view",
    label: "查看动态字段模板",
    description: "可以查看各部门的需求动态字段模板与排序。",
  },

  "settings.fields.manage": {
    key: "settings.fields.manage",
    label: "管理动态字段模板",
    description: "可以新增、编辑、删除以及排序动态字段模板。",
  },

  "settings.scoring.view": {
    key: "settings.scoring.view",
    label: "查看评分模板配置",
    description: "可以查看按部门配置的评分模板及评分项。",
  },

  "settings.scoring.manage": {
    key: "settings.scoring.manage",
    label: "管理评分模板配置",
    description: "可以新增、编辑、保存部门评分模板及评分项。",
  },

  "settings.score_periods.view": {
    key: "settings.score_periods.view",
    label: "查看评分周期配置",
    description: "可以查看各服务月的评分周期配置与评分窗口。",
  },

  "settings.score_periods.manage": {
    key: "settings.score_periods.manage",
    label: "管理评分周期配置",
    description: "可以新增、编辑、删除评分周期及其评分窗口。",
  },

  "settings.workflow.view": {
    key: "settings.workflow.view",
    label: "查看工作流配置",
    description: "可以查看各部门的需求优先级与状态工作流配置。",
  },

  "settings.workflow.manage": {
    key: "settings.workflow.manage",
    label: "管理工作流配置",
    description: "可以新增、编辑、保存各部门的需求优先级与状态工作流配置。",
  },

  "settings.roles.view": {
    key: "settings.roles.view",
    label: "查看角色与权限配置",
    description: "可以查看角色列表及各角色勾选的权限点。",
  },


  "settings.roles.manage": {
    key: "settings.roles.manage",
    label: "管理角色与权限配置",
    description: "可以新增、编辑、删除角色，并为角色勾选权限点。",
  },

  "settings.webhooks.view": {
    key: "settings.webhooks.view",
    label: "查看 Webhook 配置",
    description: "可以查看已配置的 Webhook 订阅和事件发送日志。",
  },

  "settings.webhooks.manage": {
    key: "settings.webhooks.manage",
    label: "管理 Webhook 配置",
    description: "可以新增、编辑、删除 Webhook 订阅，并触发重试等操作。",
  },

  "settings.wecom.view": {
    key: "settings.wecom.view",
    label: "查看企业微信集成配置",
    description: "可以查看企业微信应用与机器人等集成配置。",
  },

  "settings.wecom.manage": {
    key: "settings.wecom.manage",
    label: "管理企业微信集成配置",
    description: "可以配置企业微信应用参数、机器人 Webhook 等集成信息。",
  },

  "admin.user_manage": {
    key: "admin.user_manage",
    label: "管理用户与角色",
    description: "可以管理用户列表、审批账号、分配角色与权限。",
  },
  "department.fields_manage": {
    key: "department.fields_manage",
    label: "管理部门字段模板",
    description: "可以为本部门维护需求字段模板与排序。",
  },
};


export function hasPermission(
  _rawRole: string | null | undefined,
  permission: PermissionKey,
  effectivePermissions?: PermissionKey[] | null,
): boolean {
  const permissions = Array.isArray(effectivePermissions) ? effectivePermissions : [];
  return permissions.includes(permission);
}


