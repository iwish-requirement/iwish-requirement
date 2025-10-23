import { createSupabaseClient } from '@/lib/supabase'
import type { 
  Permission, 
  Role, 
  CreateRoleInput,
  UpdateRoleInput,
  PaginatedResponse 
} from '@/types'

// 与 user_roles 连接查询返回的数据结构一致的本地类型定义（包含嵌套的 role 信息）
interface UserRoleAssignment {
  id: string
  user_id: string
  role_id: string
  role?: {
    id: string
    name: string
    description?: string
    role_permissions?: Array<{ permission?: Permission }>
  }
  is_active: boolean
  assigned_by?: string
  created_at?: string
}

export class PermissionService {
  private supabase = createSupabaseClient()

  private dispatchPermissionUpdated() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('permission:updated'))
    }
  }

  // ===============================================
  // 权限管理
  // ===============================================

  // 获取所有权限
  async getAllPermissions(): Promise<Permission[]> {
    try {
      const { data, error } = await this.supabase
        .from('permissions')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('获取权限列表失败:', error)
      throw error
    }
  }

  // 获取权限分类
  async getPermissionCategories(): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('permissions')
        .select('category')
        .order('category', { ascending: true })

      if (error) throw error
      
      const categories = new Set<string>()
      data?.forEach(item => {
        if (item.category) categories.add(item.category)
      })
      
      return Array.from(categories)
    } catch (error) {
      console.error('获取权限分类失败:', error)
      return []
    }
  }

  // ===============================================
  // 角色管理
  // ===============================================

  // 获取角色列表
  async getRoles(params?: {
    page?: number
    limit?: number
    search?: string
    is_active?: boolean
  }): Promise<PaginatedResponse<Role>> {
    try {
      const page = params?.page || 1
      const limit = params?.limit || 20
      const offset = (page - 1) * limit

      let query = this.supabase
        .from('roles')
        .select(`
          *,
          role_permissions (
            permission:permissions (*)
          )
        `, { count: 'exact' })

      // 搜索过滤
      if (params?.search) {
        query = query.or(`name.ilike.%${params.search}%,description.ilike.%${params.search}%`)
      }

      // 状态过滤
      if (params?.is_active !== undefined) {
        query = query.eq('is_active', params.is_active)
      }

      // 分页和排序
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      const { data, error, count } = await query

      if (error) throw error

      return {
        data: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit),
          has_next: page * limit < (count || 0),
          has_prev: page > 1
        }
      }
    } catch (error) {
      console.error('获取角色列表失败:', error)
      throw error
    }
  }

  // 获取单个角色
  async getRole(id: string): Promise<Role | null> {
    try {
      const { data, error } = await this.supabase
        .from('roles')
        .select(`
          *,
          role_permissions (
            permission:permissions (*)
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('获取角色失败:', error)
      return null
    }
  }

  // 创建角色
  async createRole(roleData: CreateRoleInput): Promise<Role> {
    try {
      const { data: role, error: roleError } = await this.supabase
        .from('roles')
        .insert({
          name: roleData.name,
          description: roleData.description,
          is_active: roleData.is_active ?? true,
          created_by: roleData.created_by
        })
        .select()
        .single()

      if (roleError) throw roleError

      // 分配权限
      if (roleData.permission_ids && roleData.permission_ids.length > 0) {
        const rolePermissions = roleData.permission_ids.map(permissionId => ({
          role_id: role.id,
          permission_id: permissionId
        }))

        const { error: permError } = await this.supabase
          .from('role_permissions')
          .insert(rolePermissions)

        if (permError) throw permError
      }

      this.dispatchPermissionUpdated()
      return await this.getRole(role.id) as Role
    } catch (error) {
      console.error('创建角色失败:', error)
      throw error
    }
  }

  // 更新角色
  async updateRole(id: string, roleData: UpdateRoleInput): Promise<Role> {
    try {
      // 更新角色基本信息
      const { data: role, error: roleError } = await this.supabase
        .from('roles')
        .update({
          name: roleData.name,
          description: roleData.description,
          is_active: roleData.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (roleError) throw roleError

      // 更新权限分配
      if (roleData.permission_ids !== undefined) {
        // 删除现有权限
        await this.supabase
          .from('role_permissions')
          .delete()
          .eq('role_id', id)

        // 添加新权限
        if (roleData.permission_ids.length > 0) {
          const rolePermissions = roleData.permission_ids.map(permissionId => ({
            role_id: id,
            permission_id: permissionId
          }))

          const { error: permError } = await this.supabase
            .from('role_permissions')
            .insert(rolePermissions)

          if (permError) throw permError
        }
      }

      this.dispatchPermissionUpdated()
      return await this.getRole(id) as Role
    } catch (error) {
      console.error('更新角色失败:', error)
      throw error
    }
  }

  // 删除角色
  async deleteRole(id: string): Promise<void> {
    try {
      // 检查是否有用户使用此角色
      const { data: userRoles, error: checkError } = await this.supabase
        .from('user_roles')
        .select('id')
        .eq('role_id', id)
        .limit(1)

      if (checkError) throw checkError

      if (userRoles && userRoles.length > 0) {
        throw new Error('无法删除角色：仍有用户使用此角色')
      }

      // 删除角色权限关联
      await this.supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', id)

      // 删除角色
      const { error } = await this.supabase
        .from('roles')
        .delete()
        .eq('id', id)

      if (error) throw error
      this.dispatchPermissionUpdated()
    } catch (error) {
      console.error('删除角色失败:', error)
      throw error
    }
  }

  // ===============================================
  // 用户角色管理
  // ===============================================

  // 获取用户角色
  async getUserRoles(userId: string): Promise<UserRoleAssignment[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_roles')
        .select(`
          *,
          role:roles (
            *,
            role_permissions (
              permission:permissions (*)
            )
          )
        `)
        .eq('user_id', userId)
        .eq('is_active', true)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('获取用户角色失败:', error)
      return []
    }
  }

  // 分配角色给用户
  async assignRoleToUser(userId: string, roleId: string, assignedBy: string): Promise<UserRole> {
    try {
      // 检查是否已经分配过此角色
      const { data: existing } = await this.supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role_id', roleId)
        .single()

      if (existing) {
        throw new Error('用户已拥有此角色')
      }

      const { data, error } = await this.supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role_id: roleId,
          assigned_by: assignedBy,
          is_active: true
        })
        .select(`
          *,
          role:roles (
            *,
            role_permissions (
              permission:permissions (*)
            )
          )
        `)
        .single()

      if (error) throw error
      this.dispatchPermissionUpdated()
      return data
    } catch (error) {
      console.error('分配角色失败:', error)
      throw error
    }
  }

  // 移除用户角色
  async removeRoleFromUser(userId: string, roleId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role_id', roleId)

      if (error) throw error
      this.dispatchPermissionUpdated()
    } catch (error) {
      console.error('移除用户角色失败:', error)
      throw error
    }
  }

  // 更新用户角色状态
  async updateUserRoleStatus(userId: string, roleId: string, isActive: boolean): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_roles')
        .update({ 
          is_active: isActive,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('role_id', roleId)

      if (error) throw error
    } catch (error) {
      console.error('更新用户角色状态失败:', error)
      throw error
    }
  }

  // ===============================================
  // 权限检查
  // ===============================================

  // 检查用户是否有特定权限（基于角色-权限集合，避免嵌套筛选误判）
  async checkUserPermission(userId: string, permissionCode: string): Promise<boolean> {
    try {
      const userPermissions = await this.getUserPermissions(userId)
      const codes = new Set(userPermissions.map(p => p.code))
      return codes.has(permissionCode)
    } catch (error) {
      console.error('检查用户权限失败:', error)
      return false
    }
  }

  // 获取用户所有权限
  async getUserPermissions(userId: string): Promise<Permission[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_roles')
        .select(`
          role:roles!inner (
            role_permissions (
              permission:permissions (*)
            )
          )
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .eq('roles.is_active', true)

      if (error) throw error

      const permissions = new Set<Permission>()
      data?.forEach(userRole => {
        userRole.role?.role_permissions?.forEach((rp: any) => {
          if (rp.permission) {
            permissions.add(rp.permission)
          }
        })
      })

      return Array.from(permissions)
    } catch (error) {
      console.error('获取用户权限失败:', error)
      return []
    }
  }

  // 批量检查用户权限
  async checkUserPermissions(userId: string, permissionCodes: string[]): Promise<Record<string, boolean>> {
    try {
      const userPermissions = await this.getUserPermissions(userId)
      const userPermissionCodes = new Set(userPermissions.map(p => p.code))

      const result: Record<string, boolean> = {}
      permissionCodes.forEach(code => {
        result[code] = userPermissionCodes.has(code)
      })

      return result
    } catch (error) {
      console.error('批量检查用户权限失败:', error)
      const result: Record<string, boolean> = {}
      permissionCodes.forEach(code => {
        result[code] = false
      })
      return result
    }
  }

  // ===============================================
  // 权限统计
  // ===============================================

  // 获取角色使用统计
  async getRoleUsageStats(): Promise<Array<{
    role_id: string
    role_name: string
    user_count: number
    active_user_count: number
  }>> {
    try {
      const { data, error } = await this.supabase
        .from('roles')
        .select(`
          id,
          name,
          user_roles (
            user_id,
            is_active
          )
        `)

      if (error) throw error

      return (data || []).map(role => ({
        role_id: role.id,
        role_name: role.name,
        user_count: role.user_roles?.length || 0,
        active_user_count: role.user_roles?.filter((ur: any) => ur.is_active).length || 0
      }))
    } catch (error) {
      console.error('获取角色使用统计失败:', error)
      return []
    }
  }

  // 获取权限使用统计
  async getPermissionUsageStats(): Promise<Array<{
    permission_id: string
    permission_name: string
    role_count: number
    user_count: number
  }>> {
    try {
      const { data, error } = await this.supabase
        .from('permissions')
        .select(`
          id,
          name,
          role_permissions (
            role:roles (
              user_roles (
                user_id,
                is_active
              )
            )
          )
        `)

      if (error) throw error

      return ((data || []) as any[]).map((permission: any) => {
        const roles = permission.role_permissions || []
        const userIds = new Set<string>()
        
        roles.forEach((rp: any) => {
          rp.role?.user_roles?.forEach((ur: any) => {
            if (ur.is_active) {
              userIds.add(ur.user_id)
            }
          })
        })

        return {
          permission_id: permission.id,
          permission_name: permission.name,
          role_count: roles.length,
          user_count: userIds.size
        }
      })
    } catch (error) {
      console.error('获取权限使用统计失败:', error)
      return []
    }
  }
}

export const permissionService = new PermissionService()