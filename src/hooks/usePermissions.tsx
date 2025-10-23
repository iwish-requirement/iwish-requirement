'use client'

import { useState, useEffect, useContext, createContext, ReactNode } from 'react'
import { authService } from '@/services/auth'
import { permissionService } from '@/services/permission'
import type { User } from '@/types'

// 与 permissionService.getUserRoles 返回结构保持一致的类型（从服务内部定义对齐）
// 为兼容不同查询结构，放宽本地角色记录类型定义
interface UserRoleRecord {
  id: string
  user_id: string
  role_id: string
  role?: {
    id?: string
    name?: string
    description?: string
    // 两种可能的权限嵌套结构均兼容
    permissions?: Array<{ id?: string; code?: string; name?: string }>
    role_permissions?: Array<{ permission?: { id?: string; code?: string; name?: string } }>
  }
  is_active?: boolean
  assigned_by?: string
  created_at?: string
}

interface UserPermissions {
  permissions: string[]
  roles: Array<{
    code: string
    name: string
    department_code?: string
    position_code?: string
    is_primary: boolean
  }>
}

interface PermissionContextType {
  user: User | null
  userPermissions: UserPermissions | null
  loading: boolean
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  hasAllPermissions: (permissions: string[]) => boolean
  canEditRequirement: (requirement: any) => boolean
  canUpdateRequirementStatus: (requirement: any) => boolean
  canDeleteRequirement: (requirement: any) => boolean
  canManageUsers: boolean
  canManageSystem: boolean
  canViewAllRequirements: boolean
  canManageAllRequirements: boolean
  isAdmin: boolean
  isSuperAdmin: boolean
  refreshPermissions: () => Promise<void>
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined)

export function PermissionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null)
  const [loading, setLoading] = useState(true)

  const loadUserAndPermissions = async () => {
    try {
      setLoading(true)
      const currentUser = await authService.getCurrentUser()
      
      if (currentUser) {
        setUser(currentUser)
        
        // 获取用户的角色和权限（使用标准角色权限系统）
        try {
          // 获取用户角色
          const userRoles = await permissionService.getUserRoles(currentUser.id) as unknown as UserRoleRecord[]
          // 获取用户权限
          const userPermissions = await permissionService.getUserPermissions(currentUser.id)
          
          // 提取所有权限代码
          const allPermissions = userPermissions.map(perm => perm.code)
          
          // 提取角色信息
          const roles = userRoles.map((userRole: UserRoleRecord) => ({
            code: userRole.role?.name || '',
            name: userRole.role?.name || '',
            is_primary: true
          }))
          
          setUserPermissions({
            permissions: allPermissions,
            roles
          })
        } catch (error) {
          console.error('获取用户权限失败:', error)
          // 降级处理：基于用户角色设置基础权限
          const basicPermissions = getBasicPermissionsByRole(currentUser.role)
          setUserPermissions({
            permissions: basicPermissions,
            roles: [{
              code: currentUser.role,
              name: getRoleDisplayName(currentUser.role),
              is_primary: true
            }]
          })
        }
      } else {
        setUser(null)
        setUserPermissions(null)
      }
    } catch (error) {
      console.error('加载用户权限失败:', error)
      setUser(null)
      setUserPermissions(null)
    } finally {
      setLoading(false)
    }
  }

  // 降级处理：基于角色的基础权限
  const getBasicPermissionsByRole = (role: string): string[] => {
    switch (role) {
      case 'super_admin':
        return [
          'requirement.create', 'requirement.view', 'requirement.view_all', 'requirement.edit',
          'requirement.delete', 'requirement.assign', 'requirement.status_update',
          'user.manage', 'system.admin', 'analytics.view', 'data.export'
        ]
      case 'admin':
        return [
          'requirement.create', 'requirement.view', 'requirement.view_all', 'requirement.edit',
          'requirement.assign', 'requirement.status_update', 'user.view', 'user.create',
          'user.edit', 'analytics.view', 'data.export'
        ]
      case 'employee':
      default:
        return [
          'requirement.create', 'requirement.view', 'requirement.view_own',
          'requirement.edit_own', 'requirement.status_update_own', 'comment.create'
        ]
    }
  }

  const getRoleDisplayName = (role: string): string => {
    switch (role) {
      case 'super_admin': return '超级管理员'
      case 'admin': return '管理员'
      case 'employee': return '员工'
      default: return role
    }
  }

  useEffect(() => {
    loadUserAndPermissions()

    // 动态权限更新事件监听（无需重新登录即可刷新）
    const handlePermissionUpdated = () => {
      loadUserAndPermissions()
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('permission:updated', handlePermissionUpdated as EventListener)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('permission:updated', handlePermissionUpdated as EventListener)
      }
    }
  }, [])

  const hasPermission = (permissionCode: string): boolean => {
    if (!user || !userPermissions) return false
    // 检查用户是否拥有指定权限
    return userPermissions.permissions.includes(permissionCode)
  }

  const hasAnyPermission = (permissionCodes: string[]): boolean => {
    if (!user || !userPermissions) return false
    return permissionCodes.some(permissionCode => hasPermission(permissionCode))
  }

  const hasAllPermissions = (permissionCodes: string[]): boolean => {
    if (!user || !userPermissions) return false
    return permissionCodes.every(permissionCode => hasPermission(permissionCode))
  }

  // 检查是否可以编辑需求
  const canEditRequirement = (requirement: any): boolean => {
    if (!user || !requirement) return false
    
    // 有编辑所有需求权限
    if (hasPermission('requirement.edit_all')) return true
    
    // 创建者可以编辑自己的需求（兼容历史 created_by）
    if ((requirement.submitter_id === user.id || requirement.created_by === user.id) && hasPermission('requirement.edit_own')) return true
    
    return false
  }

  // 检查是否可以更新需求状态
  const canUpdateRequirementStatus = (requirement: any): boolean => {
    if (!user || !requirement) return false

    // 全局状态更新权限 或 编辑所有需求权限（作为等效放行）
    if (hasPermission('requirement.status_update') || hasPermission('requirement.edit_all')) return true

    // 自己的单据（创建者/执行人）拥有“状态更新-自己的”权限即可（兼容历史 created_by）
    if ((requirement.submitter_id === user.id || requirement.created_by === user.id) && hasPermission('requirement.status_update_own')) return true
    if (requirement.assignee_id === user.id && hasPermission('requirement.status_update_own')) return true

    return false
  }

  // 检查是否可以删除需求
  const canDeleteRequirement = (requirement: any): boolean => {
    if (!user || !requirement) return false
    
    // 有删除所有需求权限
    if (hasPermission('requirement.delete_all')) return true
    
    // 创建者可以删除自己的需求（兼容历史 created_by）
    if ((requirement.submitter_id === user.id || requirement.created_by === user.id) && hasPermission('requirement.delete_own')) return true
    
    return false
  }

  // 基于权限的功能检查
  const canManageUsers = userPermissions ? userPermissions.permissions.includes('user.manage') : false
  const canManageSystem = userPermissions ? userPermissions.permissions.includes('system.admin') : false
  const canViewAllRequirements = userPermissions ? (userPermissions.permissions.includes('requirement.view_all') || userPermissions.permissions.includes('requirement.view')) : false
  const canManageAllRequirements = userPermissions ? (userPermissions.permissions.includes('requirement.edit_all') && userPermissions.permissions.includes('requirement.delete_all')) : false
  const isAdmin = userPermissions ? userPermissions.permissions.includes('system.admin') : false
  const isSuperAdmin = user ? user.role === 'super_admin' : false



  const refreshPermissions = async () => {
    await loadUserAndPermissions()
  }

  const contextValue: PermissionContextType = {
    user,
    userPermissions,
    loading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canEditRequirement,
    canUpdateRequirementStatus,
    canDeleteRequirement,
    canManageUsers,
    canManageSystem,
    canViewAllRequirements,
    canManageAllRequirements,
    isAdmin,
    isSuperAdmin,
    refreshPermissions
  }

  return (
    <PermissionContext.Provider value={contextValue}>
      {children}
    </PermissionContext.Provider>
  )
}

export function usePermissions() {
  const context = useContext(PermissionContext)
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionProvider')
  }
  return context
}

// 权限检查组件 - 基于角色权限系统
export function PermissionGuard({ 
  permission, 
  permissions, 
  requireAll = false,
  fallback = null,
  children 
}: {
  permission?: string
  permissions?: string[]
  requireAll?: boolean // 是否需要所有权限
  fallback?: ReactNode
  children: ReactNode
}) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, loading } = usePermissions()

  if (loading) {
    return <div className="animate-pulse bg-gray-200 h-4 w-full rounded"></div>
  }

  let hasAccess = true

  if (permission && !hasPermission(permission)) {
    hasAccess = false
  }

  if (permissions) {
    if (requireAll) {
      hasAccess = hasAllPermissions(permissions)
    } else {
      hasAccess = hasAnyPermission(permissions)
    }
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>
}

// 权限检查 Hook - 用于条件渲染
export function usePermissionCheck() {
  const { 
    hasPermission, 
    hasAnyPermission, 
    hasAllPermissions,
    canEditRequirement,
    canUpdateRequirementStatus,
    canDeleteRequirement
  } = usePermissions()

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canEditRequirement,
    canUpdateRequirementStatus,
    canDeleteRequirement,
    // 常用权限检查的便捷方法
    get canCreateRequirement() { return hasPermission('requirement.create') },
    get canViewAllRequirements() { return hasPermission('requirement.view_all') || hasPermission('requirement.view') },
    get canEditAnyRequirement() { return hasPermission('requirement.edit') },
    get canDeleteAnyRequirement() { return hasPermission('requirement.delete') },
    get canAssignRequirement() { return hasPermission('requirement.assign') },
    get canManageUsers() { return hasPermission('user.manage') },
    get canManageRoles() { return hasPermission('role.manage') },
    get canManagePermissions() { return hasPermission('permission.manage') },
    get canManageSystem() { return hasPermission('system.admin') || hasPermission('system.manage') },
    get canViewAnalytics() { return hasPermission('analytics.view') },
    get canExportData() { return hasPermission('data.export') },
    // 新评分系统权限
    get canManageRatingForms() { return hasPermission('rating.form.manage') },
    get canSubmitMonthlyRatings() { return hasPermission('rating.submit_monthly') },
    get canViewOwnRatingStats() { return hasPermission('rating.view_own_stats') },
    get canViewAllRatingStats() { return hasPermission('rating.view_all_stats') },
    // 动态权限创建相关
    get canCreatePermissions() { return hasPermission('permission.manage') },
    get canEditPermissions() { return hasPermission('permission.manage') },
    get canDeletePermissions() { return hasPermission('permission.manage') },
    get canManageRolePermissions() { return hasPermission('permission.manage') || hasPermission('user.manage_roles') }
  }
}