'use client'

import { ReactNode } from 'react'
import { usePermissions } from '@/hooks/usePermissions'

interface PermissionWrapperProps {
  children: ReactNode
  permission?: string
  permissions?: string[]
  requireAll?: boolean
  fallback?: ReactNode
  loading?: ReactNode
}

/**
 * 权限包装组件 - 根据用户权限控制内容显示
 * 完全基于动态权限系统，不依赖硬编码角色
 */
export function PermissionWrapper({
  children,
  permission,
  permissions,
  requireAll = false,
  fallback = null,
  loading: loadingComponent = null
}: PermissionWrapperProps) {
  const { 
    hasPermission, 
    hasAnyPermission, 
    hasAllPermissions, 
    loading 
  } = usePermissions()

  // 显示加载状态
  if (loading) {
    return loadingComponent || (
      <div className="animate-pulse bg-gray-200 h-4 w-full rounded"></div>
    )
  }

  // 检查权限
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

/**
 * 页面级权限检查组件
 * 用于保护整个页面或大块内容区域
 */
export function PagePermissionGuard({
  children,
  permission,
  permissions,
  requireAll = false,
  unauthorizedMessage = "您没有权限访问此页面"
}: {
  children: ReactNode
  permission?: string
  permissions?: string[]
  requireAll?: boolean
  unauthorizedMessage?: string
}) {
  return (
    <PermissionWrapper
      permission={permission}
      permissions={permissions}
      requireAll={requireAll}
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              访问受限
            </h2>
            <p className="text-gray-500">
              {unauthorizedMessage}
            </p>
          </div>
        </div>
      }
    >
      {children}
    </PermissionWrapper>
  )
}

/**
 * 按钮权限包装组件
 * 当没有权限时禁用按钮而不是隐藏
 */
export function ButtonPermissionWrapper({
  children,
  permission,
  permissions,
  requireAll = false,
  disabledTooltip = "您没有执行此操作的权限"
}: {
  children: ReactNode
  permission?: string
  permissions?: string[]
  requireAll?: boolean
  disabledTooltip?: string
}) {
  const { 
    hasPermission, 
    hasAnyPermission, 
    hasAllPermissions, 
    loading 
  } = usePermissions()

  if (loading) {
    return (
      <div className="animate-pulse bg-gray-200 h-8 w-20 rounded"></div>
    )
  }

  // 检查权限
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

  if (!hasAccess) {
    return (
      <div title={disabledTooltip} className="inline-block">
        <div className="opacity-50 cursor-not-allowed pointer-events-none">
          {children}
        </div>
      </div>
    )
  }

  return <>{children}</>
}