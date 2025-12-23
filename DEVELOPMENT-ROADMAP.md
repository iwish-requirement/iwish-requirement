# 项目迭代规划 Roadmap

本 Roadmap 用于指导本项目在不着急上线的前提下，按 PRD 要求逐步完整实现各模块功能，并默认遵循移动端优先（mobile-first）设计。

## 阶段 1：需求系统（PRD 第 6 章）

目标：把需求管理从“能用”升级为完全按 PRD 实现的版本，并且以移动端优先改造。

重点事项：
- 实现部门管理界面：增删改部门、配置 slug。
- 实现动态字段模板管理：字段 key/名称/类型/必填/筛选/导出/排序及 config。
- 将需求创建/编辑/详情切换为由字段模板驱动渲染。
- 为需求列表增加高级筛选（部门、状态、提交人、时间、filterable 字段）。
- 实现需求状态列表配置（按部门可配置），前端按配置渲染。（当前版本暂缓实现，仅作为后续候选需求保留）
- 实现需求导出和导入流程（CSV/Excel 模板下载、上传校验、错误文件返回）。

## 阶段 2：评分系统（PRD 第 7 章）

目标：完成评分周期、任务生成、评分提交、漏评补评与基础统计的闭环。

重点事项：
- 实现评分周期与评分窗口配置（period + 可评分时间段）。
- 按规则生成 score_tasks，控制 pending/completed/missed 状态。
- 实现补评与提醒逻辑（last_reminder_at）。
- 实现评分模板管理界面（创建/编辑/启用/禁用）。
- 增加基础评分统计接口和页面（按部门/个人/公司维度）。

## 阶段 3：角色与权限系统（PRD 第 5 章、9.8、10.5）

目标：按照“功能点 + 部门 + 多角色”的模型，完成角色与权限矩阵的前后端闭环。

重点事项：
- 实现角色管理页（角色增删改）。
- 实现权限点矩阵或树形勾选 UI，按模块分组配置权限点。
- 在用户编辑界面支持为用户分配多个角色。
- 在关键接口中统一通过权限点校验访问（如 demand.view_*、score.view_*、stats.* 等）。

## 阶段 4：统计系统与 Dashboard（PRD 第 8 章、9.2、9.7）

目标：提供公司级/部门级/个人级统计大盘，以及包含关键指标的首页仪表盘。

重点事项：
- 实现需求统计视图：需求数量、完成率、平均耗时、状态分布、趋势图。
- 实现评分统计视图：平均分、评分完成率、按维度拆分的统计。
- 搭建 Dashboard 首页：关键指标卡片 + 当前评分周期状态 + 快捷入口。

## 阶段 5：AI 月度报告（PRD 第 13 章）

目标：实现 AI 自动生成部门月度总结报告 v1。

重点事项：
- 实现 AI 报告生成接口，按部门 + period 汇总数据并调用模型生成摘要。
- 将生成结果写入 ai_reports 表，并提供查询接口。
- 实现 AI 月度报告页面，可按部门与月份切换查看报告内容。

## 阶段 6：Webhook / 企业微信集成与审计中心（PRD 第 10.7–10.8、12 章）

目标：实现与外部系统的集成能力，并提供可靠的审计与监控视图。

重点事项：
- 实现 webhook_subscriptions / webhook_events 相关接口和管理页面。
- 实现企业微信集成配置页面（先支持群机器人 Webhook，预留个人绑定能力）。
- 实现审计日志查询页面，支持按时间、用户、模块筛选查看关键操作记录。

---

## 阶段 1 详细拆分（实现策略）

为避免频繁改动已稳定功能，阶段 1 建议按以下顺序落地：

1）先实现“真正的部门管理”
- 后端：在 `/api/departments` 增加 `POST` 创建部门；新增 `/api/departments/[id]` 的 `DELETE`（后续可扩展 `PUT` 编辑）。
- 前端：只改设置页中的部门管理 Tab，使其改为读取和操作数据库中的部门，并使用项目内弹窗组件做删除确认，不再使用 `window.confirm`。
- 兼容性：暂时不改需求列表/新建页的部门选择逻辑，避免一次性重构。

2）补齐字段模板管理到 PRD 要求
- 在现有字段模板 Tab 基础上，增加 `filterable` / `exportable` 等开关，并写入 `department_fields` 表。
- 为后续“高级筛选”和“导出字段选择”打好标记，不改变当前需求创建/展示的主流程。

3）最后再改需求页 + 导出/导入
- 在部门和字段模板稳定后，再逐步将需求列表、新建、详情切换为完全由模板驱动渲染，并接入真实的部门 ID。
- 同一阶段内实现导出/导入接口及前端入口：
  - 导出：按当前筛选导出 Excel。
  - 导入：提供模板下载、上传校验与错误文件返回。

---

## 已完成里程碑（截至 2025-12-23）

### 阶段 1：需求系统

- **部门管理**：
  - 已实现基于 Supabase 的部门表 `departments` 及 `/api/departments`、`/api/departments/[id]` 的增删改查接口。
  - 在系统设置「部门管理」Tab 中完成部门创建、编辑、删除 UI，并接入真实接口与权限校验。
- **动态字段模板管理**：
  - 基于 `department_field_templates` 与 `department_fields` 实现字段模板版本化管理，支持字段 `key/label/type/required/placeholder/options` 编辑。
  - 落地 `filterable` / `exportable` 标记，用于统一驱动需求列表高级筛选、导出字段选择以及动态字段统计。
- **需求创建/编辑/详情与高级筛选**：
  - 需求表 `demands` 已接入 App Router 页面（列表、新建、详情），表单渲染完全由部门字段模板驱动。
  - 列表页支持按部门、状态、提交人、执行人、时间范围以及所有 `filterable = true` 的动态字段进行高级筛选。
- **导入/导出与动态字段统计**：
  - `/api/demands/export`：按当前筛选导出 CSV，导出列由 `exportable = true` 的字段集驱动。
  - `/api/demands/import` + `/api/demands/import/template`：支持按部门下载导入模板、上传 CSV 校验并写入 `demands`，错误行返回详细提示。
  - `/api/demands/stats/overview`、`/api/demands/stats/members`、`/api/demands/stats/dynamic` 以及 `/statistics` 看板已实现公司/部门/个人及动态字段维度的统计视图。

### 阶段 2：评分系统

- **评分周期与评分窗口**：
  - 已实现 `score_periods` 表及 `/api/admin/score-periods` 管理接口，在系统设置「评分周期」Tab 中支持按年配置服务月 `period`、评分窗口起止时间与状态（planned/open/closed）。
- **评分模板管理**：
  - `score_templates` 表及 `/api/admin/score-templates` 接口已完成，实现按部门配置评分模板、评分项、满分与档位表达式，并在前端提供可视化编辑 UI。
- **评分任务生成与补齐**：
  - 基于 `demands` 在接口 `/api/scores/my-tasks` 中按服务月聚合「评分人 – 被评分人 – 部门」生成 `score_tasks`，避免重复任务，并在访问时自动补齐缺失任务。
- **评分提交与记录**：
  - `/api/scores/submit` 接口完成评分窗口阶段校验（结合 `score_periods`），按模板校验分值并写入 `score_records`，同时更新任务状态与完成时间。
  - App Router 下的 `/scoring` 列表与 `/scoring/[id]` 详情页已接入真实任务与模板，取代旧 mock 评分页面。
- **评分统计**：
  - 已实现 `/api/scores/statistics`、`/api/scores/user-detail` 等接口，并在 `/statistics` 页展示评分覆盖率、部门/个人评分概览及明细视图。

### 阶段 3：角色与权限系统

- **权限点模型与元数据**：
  - 在 `lib/permissions.ts` 中定义了覆盖需求、统计、系统设置、评分与管理后台的 PermissionKey 集合，并为每个权限点提供 label 与文案描述，用于前后端统一校验与展示。
- **角色与用户-角色绑定**：
  - 建立 `roles` 与 `user_roles` 表，并通过 `/api/admin/roles`、`/api/admin/user-roles` 完成角色增删改查与用户多角色绑定接口。
  - 系统设置中的「权限管理」Tab 提供按模块分组的权限点勾选树，以及角色创建、编辑、删除 UI。
  - 「用户管理」Tab 支持查看用户部门/状态、启用/禁用/审核用户，并为用户分配基础角色标签与数据库角色集合。
- **权限校验与导航控制**：
  - `lib/serverPermissions.ts` 中实现从 `user_roles` + `roles.permissions` 聚合有效权限点，并在关键接口（需求、统计、系统设置、评分配置等）通过 `ensureHasPermission` / `ensureHasAnyPermission` 做访问控制。
  - 布局组件 `app/(dashboard)/layout.tsx`、`components/Header.tsx`、`components/Sidebar.tsx` 根据当前用户权限动态控制导航入口与页面访问，确保无权限用户无法访问统计和系统设置模块。

### 其他基础工作

- **系统设置 – 全局配置**：
  - `/api/settings/global` + 设置页「全局配置」Tab 已实现系统名称、开放注册等开关的读取与修改逻辑，配置存储在 `app_settings` 表中。
- **统计看板与 AI 报告基础表**：
  - 完成 `ai_reports`、`audit_logs` 等表结构定义并对齐 PRD，统计看板已将需求与评分数据整合展示，为后续 AI 月报与审计视图预留数据基础。
- **遗留 mock 清理与技术栈统一**：
  - 移除旧版 React Router SPA 入口及 `pages/*` mock 页面和 `MOCK_*` 数据，仅保留 Next App Router + Supabase 的真实实现，避免后续重复开发与配置混淆。
