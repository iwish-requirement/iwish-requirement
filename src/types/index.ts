// =====================================================
// iWish Requirement - 可配置SaaS平台核心类型定义
// =====================================================

// 基础枚举类型
export type UserRole = 'super_admin' | 'admin' | 'employee'
export type RequirementStatus = 'not_started' | 'in_progress' | 'completed' | 'delayed' | 'cancelled'
export type RequirementPriority = 'high' | 'medium' | 'low' | 'urgent'
export type DepartmentType = 'tech' | 'creative' | 'marketing' | 'sales' | 'other'

// 用户相关类型
export interface User {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  department: string // 部门中文名称（用于显示）
  position: string // 岗位中文名称（用于显示）
  department_code?: string // 部门代码（用于程序处理和表单匹配）
  position_code?: string // 岗位代码（用于程序处理和表单匹配）
  wecom_user_id?: string // 企业微信 UserID（用于精准消息推送）
  role: UserRole
  phone?: string
  active: boolean
  created_at: string
  updated_at: string
  last_login?: string
}

// 权限相关类型 - 动态权限系统
export interface Permission {
  id: string
  name: string
  code: string // 权限代码，如 'requirement.create', 'user.manage'
  display_name: string // 显示名称
  description?: string
  category: string // 权限分类，如 'requirement', 'user', 'system'
  icon?: string // 图标名称
  color?: string // 颜色
  is_system: boolean // 是否为系统权限
  parent_id?: string // 父权限ID（用于权限分组）
  sort_order: number // 排序
  created_at: string
  updated_at: string
  children?: Permission[] // 子权限
}

// 动态权限类型 - 用于权限管理
export interface DynamicPermission {
  id: string
  code: string
  name: string
  description?: string
  category: string
  resource: string
  action: string
  conditions?: Record<string, any>
  is_system: boolean
  is_active: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

export interface Role {
  id: string
  name: string
  description?: string
  permissions: Permission[]
  is_active: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

// 页面配置类型 - 动态页面系统
export interface PageConfig {
  id: string
  name: string
  path: string
  component: string
  icon?: string
  description?: string
  required_permissions: string[] // 需要的权限代码
  form_schema_id?: string // 关联的表单配置
  is_active: boolean
  sort_order: number
  created_by?: string
  created_at: string
  updated_at: string
}







// 导出配置类型
export interface ExportConfig {
  id: string
  name: string
  description?: string
  export_type: 'excel' | 'csv' | 'pdf' | 'json'
  template_config: Record<string, any> // 导出模板配置
  filter_config: Record<string, any> // 过滤条件配置
  is_active: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

// 导出历史
export interface ExportHistory {
  id: string
  config_id: string
  file_name: string
  file_url: string
  file_size: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error_message?: string
  exported_by: string
  created_at: string
  completed_at?: string
}

export interface UserPermissions {
  // 需求权限
  can_create_requirement: boolean
  can_view_all_requirements: boolean
  can_view_own_requirements: boolean
  can_edit_own_requirements: boolean
  can_edit_all_requirements: boolean
  can_delete_own_requirements: boolean
  can_delete_all_requirements: boolean
  can_assign_requirements: boolean
  
  // 用户管理权限
  can_manage_users: boolean
  can_view_users: boolean
  can_create_users: boolean
  can_edit_users: boolean
  can_delete_users: boolean
  
  // 系统配置权限
  can_manage_forms: boolean
  can_manage_permissions: boolean
  can_manage_navigation: boolean
  can_view_analytics: boolean
  can_export_data: boolean
  
  // 评论权限
  can_comment: boolean
  can_delete_comments: boolean
}

// 表单配置相关类型
export interface FormField {
  id: string
  name: string
  label: string
  type: FormFieldType
  required: boolean
  placeholder?: string
  description?: string
  options?: string[] // 用于 select, radio, checkbox
  validation?: FormFieldValidation
  conditional_logic?: ConditionalLogic
  order: number
  created_at: string
  updated_at: string
}

export type FormFieldType = 
  | 'text' 
  | 'textarea' 
  | 'number' 
  | 'email' 
  | 'url' 
  | 'tel' 
  | 'date' 
  | 'datetime' 
  | 'time'
  | 'select' 
  | 'radio' 
  | 'checkbox' 
  | 'switch' 
  | 'file' 
  | 'image'
  | 'rich_text'
  | 'json'

export interface FormFieldValidation {
  min_length?: number
  max_length?: number
  min_value?: number
  max_value?: number
  pattern?: string // 正则表达式
  custom_message?: string
}

export interface ConditionalLogic {
  show_when: {
    field: string
    operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than'
    value: any
  }[]
  logic: 'and' | 'or'
}

export interface FormSchema {
  id: string
  name: string
  description?: string
  department: string
  position: string // 针对哪个岗位的表单
  fields: FormField[]
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

// 需求相关类型 - 匹配实际数据库表结构
export interface Requirement {
  id: string
  title: string
  description: string
  status: RequirementStatus
  priority: RequirementPriority
  
  // 创建者信息 (兼容历史与数据库字段)
  created_by: string // 历史字段，部分代码仍在使用
  submitter_id: string // 数据库存储与RLS策略使用的字段
  
  // 处理信息 (匹配数据库字段)
  department: string // 处理部门
  assignee_position: string // 执行人岗位
  assignee_id?: string // 指定的执行人ID
  
  // 时间信息
  created_at: string
  updated_at: string
  due_date?: string
  completed_at?: string
  
  // 动态字段数据
  form_data: Record<string, any>
  form_schema_id?: string
  
  // 标签和分类
  tags?: string[] // 需求标签
  
  // 评分信息
  overall_rating?: number
  rating_count?: number
  last_rated_at?: string
  
  // 扩展信息 - 通过关联查询获取
  assignees?: RequirementAssignee[]
  creator?: User // 创建者信息
  assignee?: User // 执行人信息
  attachments?: Attachment[]
}

// 需求执行人类型
export interface RequirementAssignee {
  id: string
  requirement_id: string
  user_id: string
  user_name: string
  user_email: string
  user_department: string
  user_position: string
  role_type: 'primary' | 'secondary' | 'reviewer' // 执行人角色类型
  assigned_at: string
  user?: User // 关联的用户信息
}

export interface Attachment {
  id: string
  requirement_id: string
  file_name: string
  file_url: string
  file_size: number
  file_type: string
  uploaded_by: string
  created_at: string
}

// 评论系统
export interface Comment {
  id: string
  requirement_id: string
  content: string
  author_id: string
  author_name: string
  author_avatar?: string
  created_at: string
  updated_at: string
  attachments?: CommentAttachment[]
}

export interface CommentAttachment {
  id: string
  comment_id: string
  file_name: string
  file_url: string
  file_size: number
  file_type: string
  created_at: string
}

// 导航配置类型
export interface NavigationItem {
  id: string
  label: string
  path?: string
  icon?: string
  order: number
  parent_id?: string
  permissions?: string[] // 需要的权限代码
  is_active: boolean
  children?: NavigationItem[]
}

export interface NavigationConfig {
  id: string
  name: string
  items: NavigationItem[]
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

// 统计分析类型
export interface RequirementStats {
  total: number
  by_status: Record<RequirementStatus, number>
  by_priority: Record<RequirementPriority, number>
  by_department: Record<string, number>
  by_position: Record<string, number>
  by_assignee: Record<string, number>
  avg_completion_time: number // 平均完成时间（小时）
  overdue_count: number
}

export interface UserStats {
  total_users: number
  active_users: number
  by_department: Record<string, number>
  by_position: Record<string, number>
  by_role: Record<UserRole, number>
  recent_logins: number // 最近7天登录用户数
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
    has_next: boolean
    has_prev: boolean
  }
}

// 搜索和过滤类型
export interface SearchFilters {
  search?: string
  status?: RequirementStatus[]
  priority?: RequirementPriority[]
  department?: string[]
  position?: string[]
  assignee_id?: string[]
  submitter_id?: string[]
  date_range?: {
    start: string
    end: string
  }
  tags?: string[]
}

export interface SortOption {
  field: string
  direction: 'asc' | 'desc'
}

// 系统配置类型
export interface SystemConfig {
  id: string
  key: string
  value: any
  description?: string
  category: string
  is_public: boolean // 是否为公开配置（前端可访问）
  created_at: string
  updated_at: string
}

// 活动日志类型
export interface ActivityLog {
  id: string
  user_id: string
  user_name: string
  action: string
  resource_type: string // 'requirement', 'user', 'form', etc.
  resource_id?: string
  old_values?: Record<string, any>
  new_values?: Record<string, any>
  ip_address?: string
  user_agent?: string
  created_at: string
}

// 通知类型
export interface Notification {
  id: string
  user_id: string
  title: string
  content: string
  type: 'info' | 'success' | 'warning' | 'error'
  is_read: boolean
  action_url?: string
  created_at: string
}

// 表单输入类型
export type CreateUserInput = Omit<User, 'id' | 'created_at' | 'updated_at' | 'last_login'>
export type UpdateUserInput = Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>
export type CreateRequirementInput = Omit<
  Requirement,
  'id' | 'created_at' | 'updated_at' | 'creator' | 'assignee' | 'assignees' | 'attachments' | 'submitter_id' | 'created_by'
> & {
  // 由服务端根据当前登录用户填充，前端可不传
  submitter_id?: string
  created_by?: string
  assignee_users?: Array<{
    user_id: string
    role_type: 'primary' | 'secondary' | 'reviewer'
  }>
}
export type UpdateRequirementInput = Partial<Omit<Requirement, 'id' | 'created_at' | 'updated_at'>>
export type CreateFormSchemaInput = Omit<FormSchema, 'id' | 'created_at' | 'updated_at'>
export type UpdateFormSchemaInput = Partial<Omit<FormSchema, 'id' | 'created_at' | 'updated_at'>>

// 动态权限系统输入类型
export type CreatePermissionInput = Omit<Permission, 'id' | 'created_at' | 'updated_at' | 'children'>
export type UpdatePermissionInput = Partial<Omit<Permission, 'id' | 'created_at' | 'updated_at' | 'children'>>
export type CreateRoleInput = Omit<Role, 'id' | 'created_at' | 'updated_at' | 'permissions'> & {
  permission_ids?: string[]
}
export type UpdateRoleInput = Partial<Omit<Role, 'id' | 'created_at' | 'updated_at' | 'permissions'>> & {
  permission_ids?: string[]
}

// 页面配置输入类型
export type CreatePageConfigInput = Omit<PageConfig, 'id' | 'created_at' | 'updated_at'>
export type UpdatePageConfigInput = Partial<Omit<PageConfig, 'id' | 'created_at' | 'updated_at'>>



// 导出配置输入类型
export type CreateExportConfigInput = Omit<ExportConfig, 'id' | 'created_at' | 'updated_at'>
export type UpdateExportConfigInput = Partial<Omit<ExportConfig, 'id' | 'created_at' | 'updated_at'>>

// 实时更新类型
export interface RealtimeEvent {
  type: 'requirement_created' | 'requirement_updated' | 'comment_added' | 'user_updated'
  payload: any
  timestamp: string
  user_id?: string
}

// =====================================================
// 配置驱动架构类型定义
// =====================================================

// 权限配置架构
export interface PermissionSchema {
  id: string
  code: string
  name: string
  description?: string
  category: string
  resource: string
  action: string
  conditions: Record<string, any>
  is_system: boolean
  is_active: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

// 字段类型配置架构
export interface FieldTypeSchema {
  id: string
  type_name: string
  display_name: string
  description?: string
  component_name: string
  default_props: Record<string, any>
  validation_rules: Record<string, any>
  is_system: boolean
  is_active: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

// 工作流配置架构
export interface WorkflowSchema {
  id: string
  name: string
  description?: string
  resource_type: string
  steps: WorkflowStep[]
  conditions: Record<string, any>
  is_active: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

export interface WorkflowStep {
  id: string
  name: string
  description?: string
  type: 'start' | 'approval' | 'assignment' | 'process' | 'end'
  next: string[]
  permissions: string[]
  conditions?: Record<string, any>
}

// 页面配置架构
export interface PageSchema {
  id: string
  name: string
  path: string
  component: string
  layout: string
  meta_config: Record<string, any>
  access_config: Record<string, any>
  is_active: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

// 数据权限配置
export interface DataPermission {
  id: string
  user_id: string
  resource_type: string
  resource_id?: string
  permission_type: 'own' | 'department' | 'all'
  conditions: Record<string, any>
  created_by?: string
  created_at: string
  updated_at: string
}

// 导航配置扩展
export interface NavigationConfigExtended {
  id: string
  name: string
  path: string
  icon?: string
  parent_id?: string
  order_index: number
  required_permissions: string[]
  component?: string
  meta_config: Record<string, any>
  is_active: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

// 配置管理相关类型
export interface ConfigCategory {
  key: string
  name: string
  description: string
  icon: string
  component: string
}

export interface FormFieldConfig {
  id: string
  type: string
  label: string
  name: string
  required: boolean
  placeholder?: string
  options?: string[] | { label: string; value: string }[]
  validation?: Record<string, any>
  conditional_logic?: Record<string, any>
  props?: Record<string, any>
}

// 表单设计器类型
export interface FormDesignerField {
  id: string
  type: string
  label: string
  name: string
  required: boolean
  placeholder?: string
  description?: string
  options?: Array<{ label: string; value: string }>
  validation?: {
    min?: number
    max?: number
    pattern?: string
    message?: string
  }
  conditional_logic?: {
    show_when: Array<{
      field: string
      operator: string
      value: any
    }>
    logic: 'and' | 'or'
  }
  props?: Record<string, any>
  order: number
}

// 权限设计器类型
export interface PermissionDesignerItem {
  id: string
  code: string
  name: string
  description?: string
  category: string
  resource: string
  action: string
  conditions?: Record<string, any>
  is_custom: boolean
}

// 导航设计器类型
export interface NavigationDesignerItem {
  id: string
  name: string
  path: string
  icon?: string
  parent_id?: string
  order_index: number
  required_permissions: string[]
  component?: string
  meta_config?: Record<string, any>
  children?: NavigationDesignerItem[]
}

// 配置管理操作类型
export type ConfigAction = 
  | 'create_permission'
  | 'update_permission'
  | 'delete_permission'
  | 'create_form'
  | 'update_form'
  | 'delete_form'
  | 'create_navigation'
  | 'update_navigation'
  | 'delete_navigation'
  | 'create_workflow'
  | 'update_workflow'
  | 'delete_workflow'

export interface ConfigActionPayload {
  action: ConfigAction
  data: any
  user_id: string
  timestamp: string
}