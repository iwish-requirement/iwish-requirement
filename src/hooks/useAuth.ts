import { useState, useEffect } from 'react'
import { authService } from '@/services/auth'
import { permissionService } from '@/services/permission'
import type { User, Permission } from '@/types'

interface AuthHook {
  user: User | null
  permissions: Permission[]
  loading: boolean
  hasPermission: (permissionCode: string) => boolean
  hasAnyPermission: (permissionCodes: string[]) => boolean
  hasAllPermissions: (permissionCodes: string[]) => boolean
  refreshPermissions: () => Promise<void>
  signIn: (email: string, password: string) => Promise<any>
  signOut: () => Promise<void>
}

export function useAuth(): AuthHook {
  const [user, setUser] = useState<User | null>(null)
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)

  // 获取用户权限
  const refreshPermissions = async () => {
    if (!user) {
      setPermissions([])
      return
    }

    try {
      const userPermissions = await permissionService.getUserPermissions(user.id)
      setPermissions(userPermissions)
    } catch (error) {
      console.error('获取用户权限失败:', error)
      setPermissions([])
    }
  }

  // 检查单个权限
  const hasPermission = (permissionCode: string): boolean => {
    if (!user) return false
    return permissions.some(permission => permission.code === permissionCode)
  }

  // 检查是否拥有任一权限
  const hasAnyPermission = (permissionCodes: string[]): boolean => {
    if (!user) return false
    return permissionCodes.some(code => hasPermission(code))
  }

  // 检查是否拥有所有权限
  const hasAllPermissions = (permissionCodes: string[]): boolean => {
    if (!user) return false
    return permissionCodes.every(code => hasPermission(code))
  }

  // 登录
  const signIn = async (email: string, password: string) => {
    try {
      const result = await authService.signIn(email, password)
      if (result.success) {
        const currentUser = await authService.getCurrentUser()
        setUser(currentUser)
      }
      return result
    } catch (error) {
      console.error('登录失败:', error)
      return { success: false, error: '登录失败' }
    }
  }

  // 登出
  const signOut = async () => {
    try {
      await authService.signOut()
      setUser(null)
      setPermissions([])
    } catch (error) {
      console.error('登出失败:', error)
    }
  }

  // 初始化用户状态
  useEffect(() => {
    const initAuth = async () => {
      try {
        const currentUser = await authService.getCurrentUser()
        setUser(currentUser)
      } catch (error) {
        console.error('初始化认证状态失败:', error)
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    // 监听认证状态变化
    const { data: { subscription } } = authService.onAuthStateChange(async (authUser) => {
      if (authUser) {
        const currentUser = await authService.getCurrentUser()
        setUser(currentUser)
      } else {
        setUser(null)
        setPermissions([])
      }
      setLoading(false)
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  // 当用户变化时刷新权限
  useEffect(() => {
    if (user) {
      refreshPermissions()
    }
  }, [user])

  return {
    user,
    permissions,
    loading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    refreshPermissions,
    signIn,
    signOut
  }
}