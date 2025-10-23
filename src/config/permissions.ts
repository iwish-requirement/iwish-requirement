/**
 * 系统权限配置
 * 定义所有权限代码和分类，确保权限管理的一致性
 */

export const PERMISSION_CATEGORIES = {
  REQUIREMENT: 'requirement',
  USER: 'user',
  ROLE: 'role',
  PERMISSION: 'permission',
  SYSTEM: 'system',
  ANALYTICS: 'analytics',
  DATA: 'data',
  COMMENT: 'comment',
  FORM: 'form',
  NAVIGATION: 'navigation'
} as const

export const PERMISSIONS = {
  // 需求管理权限
  REQUIREMENT: {
    CREATE: 'requirement.create',
    VIEW_ALL: 'requirement.view_all',
    VIEW_OWN: 'requirement.view_own',
    EDIT: 'requirement.edit',
    EDIT_OWN: 'requirement.edit_own',
    EDIT_ALL: 'requirement.edit_all',
    DELETE: 'requirement.delete',
    DELETE_OWN: 'requirement.delete_own',
    DELETE_ALL: 'requirement.delete_all',
    ASSIGN: 'requirement.assign',
    STATUS_UPDATE: 'requirement.status_update',
    STATUS_UPDATE_OWN: 'requirement.status_update_own',
    MANAGE_ALL: 'requirement.manage_all'
  },

  // 用户管理权限
  USER: {
    VIEW: 'user.view',
    CREATE: 'user.create',
    EDIT: 'user.edit',
    DELETE: 'user.delete',
    MANAGE: 'user.manage',
    MANAGE_ROLES: 'user.manage_roles'
  },

  // 角色管理权限
  ROLE: {
    VIEW: 'role.view',
    CREATE: 'role.create',
    EDIT: 'role.edit',
    DELETE: 'role.delete',
    MANAGE: 'role.manage',
    ASSIGN: 'role.assign'
  },

  // 权限管理权限
  PERMISSION: {
    VIEW: 'permission.view',
    MANAGE: 'permission.manage'
  },

  // 系统管理权限
  SYSTEM: {
    MANAGE: 'system.manage',
    CONFIG: 'system.config',
    BACKUP: 'system.backup',
    RESTORE: 'system.restore'
  },

  // 分析统计权限
  ANALYTICS: {
    VIEW: 'analytics.view',
    EXPORT: 'analytics.export'
  },

  // 数据管理权限
  DATA: {
    EXPORT: 'data.export',
    IMPORT: 'data.import',
    BACKUP: 'data.backup'
  },

  // 评论权限
  COMMENT: {
    CREATE: 'comment.create',
    EDIT: 'comment.edit',
    DELETE: 'comment.delete',
    DELETE_ALL: 'comment.delete_all'
  },

  // 表单管理权限
  FORM: {
    VIEW: 'form.view',
    CREATE: 'form.create',
    EDIT: 'form.edit',
    DELETE: 'form.delete',
    MANAGE: 'form.manage'
  },

  // 导航管理权限
  NAVIGATION: {
    VIEW: 'navigation.view',
    EDIT: 'navigation.edit',
    MANAGE: 'navigation.manage'
  }
} as const

// 权限描述映射
export const PERMISSION_DESCRIPTIONS = {
  // 需求管理
  [PERMISSIONS.REQUIREMENT.CREATE]: '创建需求',
  [PERMISSIONS.REQUIREMENT.VIEW_ALL]: '查看所有需求',
  [PERMISSIONS.REQUIREMENT.VIEW_OWN]: '查看自己的需求',
  [PERMISSIONS.REQUIREMENT.EDIT]: '编辑需求',
  [PERMISSIONS.REQUIREMENT.EDIT_OWN]: '编辑自己的需求',
  [PERMISSIONS.REQUIREMENT.EDIT_ALL]: '编辑所有需求',
  [PERMISSIONS.REQUIREMENT.DELETE]: '删除需求',
  [PERMISSIONS.REQUIREMENT.DELETE_OWN]: '删除自己的需求',
  [PERMISSIONS.REQUIREMENT.DELETE_ALL]: '删除所有需求',
  [PERMISSIONS.REQUIREMENT.ASSIGN]: '分配需求',
  [PERMISSIONS.REQUIREMENT.MANAGE_ALL]: '管理所有需求',

  // 用户管理
  [PERMISSIONS.USER.VIEW]: '查看用户',
  [PERMISSIONS.USER.CREATE]: '创建用户',
  [PERMISSIONS.USER.EDIT]: '编辑用户',
  [PERMISSIONS.USER.DELETE]: '删除用户',
  [PERMISSIONS.USER.MANAGE]: '管理用户',
  [PERMISSIONS.USER.MANAGE_ROLES]: '管理用户角色',

  // 角色管理
  [PERMISSIONS.ROLE.VIEW]: '查看角色',
  [PERMISSIONS.ROLE.CREATE]: '创建角色',
  [PERMISSIONS.ROLE.EDIT]: '编辑角色',
  [PERMISSIONS.ROLE.DELETE]: '删除角色',
  [PERMISSIONS.ROLE.MANAGE]: '管理角色',
  [PERMISSIONS.ROLE.ASSIGN]: '分配角色',

  // 权限管理
  [PERMISSIONS.PERMISSION.VIEW]: '查看权限',
  [PERMISSIONS.PERMISSION.MANAGE]: '管理权限',

  // 系统管理
  [PERMISSIONS.SYSTEM.MANAGE]: '系统管理',
  [PERMISSIONS.SYSTEM.CONFIG]: '系统配置',
  [PERMISSIONS.SYSTEM.BACKUP]: '系统备份',
  [PERMISSIONS.SYSTEM.RESTORE]: '系统恢复',

  // 分析统计
  [PERMISSIONS.ANALYTICS.VIEW]: '查看分析报告',
  [PERMISSIONS.ANALYTICS.EXPORT]: '导出分析数据',

  // 数据管理
  [PERMISSIONS.DATA.EXPORT]: '导出数据',
  [PERMISSIONS.DATA.IMPORT]: '导入数据',
  [PERMISSIONS.DATA.BACKUP]: '数据备份',

  // 评论
  [PERMISSIONS.COMMENT.CREATE]: '发表评论',
  [PERMISSIONS.COMMENT.EDIT]: '编辑评论',
  [PERMISSIONS.COMMENT.DELETE]: '删除评论',
  [PERMISSIONS.COMMENT.DELETE_ALL]: '删除所有评论',

  // 表单管理
  [PERMISSIONS.FORM.VIEW]: '查看表单',
  [PERMISSIONS.FORM.CREATE]: '创建表单',
  [PERMISSIONS.FORM.EDIT]: '编辑表单',
  [PERMISSIONS.FORM.DELETE]: '删除表单',
  [PERMISSIONS.FORM.MANAGE]: '管理表单',

  // 导航管理
  [PERMISSIONS.NAVIGATION.VIEW]: '查看导航',
  [PERMISSIONS.NAVIGATION.EDIT]: '编辑导航',
  [PERMISSIONS.NAVIGATION.MANAGE]: '管理导航'
} as const

// 权限分组配置
export const PERMISSION_GROUPS = [
  {
    category: PERMISSION_CATEGORIES.REQUIREMENT,
    name: '需求管理',
    permissions: Object.values(PERMISSIONS.REQUIREMENT)
  },
  {
    category: PERMISSION_CATEGORIES.USER,
    name: '用户管理',
    permissions: Object.values(PERMISSIONS.USER)
  },
  {
    category: PERMISSION_CATEGORIES.ROLE,
    name: '角色管理',
    permissions: Object.values(PERMISSIONS.ROLE)
  },
  {
    category: PERMISSION_CATEGORIES.PERMISSION,
    name: '权限管理',
    permissions: Object.values(PERMISSIONS.PERMISSION)
  },
  {
    category: PERMISSION_CATEGORIES.SYSTEM,
    name: '系统管理',
    permissions: Object.values(PERMISSIONS.SYSTEM)
  },
  {
    category: PERMISSION_CATEGORIES.ANALYTICS,
    name: '分析统计',
    permissions: Object.values(PERMISSIONS.ANALYTICS)
  },
  {
    category: PERMISSION_CATEGORIES.DATA,
    name: '数据管理',
    permissions: Object.values(PERMISSIONS.DATA)
  },
  {
    category: PERMISSION_CATEGORIES.COMMENT,
    name: '评论管理',
    permissions: Object.values(PERMISSIONS.COMMENT)
  },
  {
    category: PERMISSION_CATEGORIES.FORM,
    name: '表单管理',
    permissions: Object.values(PERMISSIONS.FORM)
  },
  {
    category: PERMISSION_CATEGORIES.NAVIGATION,
    name: '导航管理',
    permissions: Object.values(PERMISSIONS.NAVIGATION)
  }
] as const

// 获取权限描述
export function getPermissionDescription(permissionCode: string): string {
  return PERMISSION_DESCRIPTIONS[permissionCode as keyof typeof PERMISSION_DESCRIPTIONS] || permissionCode
}

// 获取权限分类
export function getPermissionCategory(permissionCode: string): string {
  const [category] = permissionCode.split('.')
  return category
}

// 检查权限代码是否有效
export function isValidPermissionCode(permissionCode: string): boolean {
  return Object.values(PERMISSIONS).some(categoryPermissions =>
    Object.values(categoryPermissions).includes(permissionCode as any)
  )
}