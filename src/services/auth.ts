import { createSupabaseClient } from '@/lib/supabase'
import { permissionService } from '@/services/permission'
import type { User, UserPermissions, Role } from '@/types'

export class AuthService {
  private supabase = createSupabaseClient()

  // 获取当前用户
  async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { user: authUser }, error: authError } = await this.supabase.auth.getUser()
      if (authError || !authUser) return null

      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select('*')
        .eq('email', authUser.email)
        .maybeSingle()

      if (userError) {
        console.error('Error fetching user data:', userError)
        return null
      }

      return userData
    } catch (error) {
      console.error('Error in getCurrentUser:', error)
      return null
    }
  }

  // 获取用户权限 - 完全基于动态权限系统
  async getUserPermissions(userId: string): Promise<UserPermissions> {
    try {
      // 使用权限服务获取用户的实际权限
      const userPermissions = await permissionService.getUserPermissions(userId)
      const permissionCodes = userPermissions.map(p => p.code)
      
      // 注意：这个函数已废弃，请使用 usePermissions Hook 中的权限检查方法
      return {
        // 需求权限
        can_create_requirement: permissionCodes.includes('requirement.create'),
        can_view_all_requirements: permissionCodes.includes('requirement.view_all'),
        can_view_own_requirements: permissionCodes.includes('requirement.view_own'),
        can_edit_own_requirements: permissionCodes.includes('requirement.edit_own'),
        can_edit_all_requirements: permissionCodes.includes('requirement.edit_all'),
        can_delete_own_requirements: permissionCodes.includes('requirement.delete_own'),
        can_delete_all_requirements: permissionCodes.includes('requirement.delete_all'),
        can_assign_requirements: permissionCodes.includes('requirement.assign'),
        
        // 用户管理权限
        can_manage_users: permissionCodes.includes('user.manage'),
        can_view_users: permissionCodes.includes('user.view'),
        can_create_users: permissionCodes.includes('user.create'),
        can_edit_users: permissionCodes.includes('user.edit'),
        can_delete_users: permissionCodes.includes('user.delete'),
        
        // 系统配置权限
        can_manage_forms: permissionCodes.includes('form.manage'),
        can_manage_permissions: permissionCodes.includes('permission.manage'),
        can_manage_navigation: permissionCodes.includes('navigation.manage'),
        can_view_analytics: permissionCodes.includes('analytics.view'),
        can_export_data: permissionCodes.includes('data.export'),
        
        // 评论权限
        can_comment: permissionCodes.includes('comment.create'),
        can_delete_comments: permissionCodes.includes('comment.delete')
      }
    } catch (error) {
      console.error('获取用户权限失败:', error)
      // 返回默认权限（最小权限）
      return {
        can_create_requirement: false,
        can_view_all_requirements: false,
        can_view_own_requirements: true,
        can_edit_own_requirements: false,
        can_edit_all_requirements: false,
        can_delete_own_requirements: false,
        can_delete_all_requirements: false,
        can_assign_requirements: false,
        can_manage_users: false,
        can_view_users: false,
        can_create_users: false,
        can_edit_users: false,
        can_delete_users: false,
        can_manage_forms: false,
        can_manage_permissions: false,
        can_manage_navigation: false,
        can_view_analytics: false,
        can_export_data: false,
        can_comment: false,
        can_delete_comments: false
      }
    }
  }

  // 检查用户是否有特定权限 - 使用动态权限系统
  async hasPermission(userId: string, permission: string): Promise<boolean> {
    try {
      return await permissionService.checkUserPermission(userId, permission)
    } catch (error) {
      console.error('检查权限失败:', error)
      return false
    }
  }

  // 检查用户是否有任一权限 - 使用动态权限系统
  async hasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
    try {
      const permissionResults = await permissionService.checkUserPermissions(userId, permissions)
      return Object.values(permissionResults).some(hasPermission => hasPermission)
    } catch (error) {
      console.error('检查权限失败:', error)
      return false
    }
  }

  // 登录
  async signIn(email: string, password: string) {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        return { success: false, error: error.message }
      }

      // 更新最后登录时间
      if (data.user) {
        await this.supabase
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', data.user.id)
      }

      return { success: true, data }
    } catch (error: any) {
      console.error('登录失败:', error)
      return { success: false, error: error.message || '登录失败' }
    }
  }

  // 登出
  async signOut() {
    try {
      const { error } = await this.supabase.auth.signOut()
      if (error) throw error
      return { error: null }
    } catch (error) {
      console.error('登出失败:', error)
      return { error }
    }
  }

  // 注册用户（仅超级管理员可用）
  async signUp(email: string, password: string, userData?: Partial<User>) {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password
      })

      if (error) throw error

      // 创建用户记录
      if (data.user) {
        const { error: userError } = await this.supabase
          .from('users')
          .upsert({
            id: data.user.id,
            email,
            full_name: userData?.full_name || '用户',
            department: userData?.department || '未分配',
            position: userData?.position || '员工',
            role: userData?.role || 'employee',
            active: true
          })

        if (userError) {
          console.error('创建用户记录失败:', userError)
          throw userError
        }
      }

      return { data, error: null }
    } catch (error) {
      console.error('注册失败:', error)
      return { data: null, error }
    }
  }

  // 重置密码
  async resetPassword(email: string) {
    try {
      const { error } = await this.supabase.auth.resetPasswordForEmail(email)
      if (error) throw error
      return { error: null }
    } catch (error) {
      console.error('重置密码失败:', error)
      return { error }
    }
  }

  // 更新密码
  async updatePassword(newPassword: string) {
    try {
      const { error } = await this.supabase.auth.updateUser({
        password: newPassword
      })
      if (error) throw error
      return { error: null }
    } catch (error) {
      console.error('更新密码失败:', error)
      return { error }
    }
  }

  // 监听认证状态变化
  onAuthStateChange(callback: (user: any) => void) {
    return this.supabase.auth.onAuthStateChange((event, session) => {
      callback(session?.user || null)
    })
  }
}

export const authService = new AuthService()