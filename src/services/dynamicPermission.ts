import { createSupabaseClient } from '@/lib/supabase'
import type { 
  Permission, 
  Role, 
  PageConfig,

  ExportConfig,
  CreateExportConfigInput,
  CreatePermissionInput,
  UpdatePermissionInput,
  CreateRoleInput,
  UpdateRoleInput,
  CreatePageConfigInput,
  UpdatePageConfigInput,


  PaginatedResponse 
} from '@/types'
import { permissionService } from '@/services/permission'
import { authService } from '@/services/auth'

export class DynamicPermissionService {
  private supabase = createSupabaseClient()

  private dispatchPermissionUpdated() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('permission:updated'))
    }
  }

  // ===============================================
  // 动态权限管理
  // ===============================================

  // 获取所有权限（树形结构）
  async getAllPermissions(): Promise<Permission[]> {
    try {
      const { data, error } = await this.supabase
        .from('permissions')
        .select('*')
        .order('sort_order', { ascending: true })

      if (error) throw error

      // 构建树形结构
      const permissionMap = new Map<string, Permission>()
      const rootPermissions: Permission[] = []

      // 先创建所有权限的映射
      data?.forEach(permission => {
        permissionMap.set(permission.id, { ...permission, children: [] })
      })

      // 构建父子关系
      data?.forEach(permission => {
        const permissionNode = permissionMap.get(permission.id)!
        if (permission.parent_id) {
          const parent = permissionMap.get(permission.parent_id)
          if (parent) {
            parent.children!.push(permissionNode)
          }
        } else {
          rootPermissions.push(permissionNode)
        }
      })

      return rootPermissions
    } catch (error) {
      console.error('获取权限列表失败:', error)
      throw error
    }
  }

  // 获取扁平权限列表
  async getFlatPermissions(): Promise<Permission[]> {
    try {
      const { data, error } = await this.supabase
        .from('permissions')
        .select('*')
        .order('category', { ascending: true })
        .order('sort_order', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('获取扁平权限列表失败:', error)
      throw error
    }
  }

  // 创建权限
  async createPermission(permissionData: CreatePermissionInput): Promise<Permission> {
    try {
      const { data, error } = await this.supabase
        .from('permissions')
        .insert(permissionData)
        .select()
        .single()

      if (error) throw error
      this.dispatchPermissionUpdated()
      return data
    } catch (error) {
      console.error('创建权限失败:', error)
      throw error
    }
  }

  // 更新权限
  async updatePermission(id: string, permissionData: UpdatePermissionInput): Promise<Permission> {
    try {
      const { data, error } = await this.supabase
        .from('permissions')
        .update({
          ...permissionData,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      this.dispatchPermissionUpdated()
      return data
    } catch (error) {
      console.error('更新权限失败:', error)
      throw error
    }
  }

  // 删除权限
  async deletePermission(id: string): Promise<void> {
    try {
      // 检查是否有子权限
      const { data: children } = await this.supabase
        .from('permissions')
        .select('id')
        .eq('parent_id', id)
        .limit(1)

      if (children && children.length > 0) {
        throw new Error('无法删除权限：存在子权限')
      }

      // 检查是否有角色使用此权限
      const { data: rolePermissions } = await this.supabase
        .from('role_permissions')
        .select('id')
        .eq('permission_id', id)
        .limit(1)

      if (rolePermissions && rolePermissions.length > 0) {
        throw new Error('无法删除权限：仍有角色使用此权限')
      }

      const { error } = await this.supabase
        .from('permissions')
        .delete()
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      console.error('删除权限失败:', error)
      throw error
    }
  }

  // ===============================================
  // 动态角色管理
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

      // 转换数据格式
      const roles = ((data || []) as any[]).map((role: any) => ({
        ...role,
        permissions: role.role_permissions?.map((rp: any) => rp.permission) || []
      }))

      return {
        data: roles,
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
      
      return {
        ...(data as any),
        permissions: (data as any).role_permissions?.map((rp: any) => rp.permission) || []
      }
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
      const { error: roleError } = await this.supabase
        .from('roles')
        .update({
          name: roleData.name,
          description: roleData.description,
          is_active: roleData.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

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
  // 动态权限检查（使用数据库函数）
  // ===============================================

  // 检查用户是否有特定权限
  async checkUserPermission(userId: string, permissionCode: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .rpc('user_has_permission', {
          user_id: userId,
          permission_code: permissionCode
        })

      if (error) throw error
      return data || false
    } catch (error) {
      console.error('检查用户权限失败:', error)
      return false
    }
  }

  // 检查用户是否有任一权限
  async checkUserAnyPermission(userId: string, permissionCodes: string[]): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .rpc('user_has_any_permission', {
          user_id: userId,
          permission_codes: permissionCodes
        })

      if (error) throw error
      return data || false
    } catch (error) {
      console.error('检查用户任一权限失败:', error)
      return false
    }
  }

  // 获取用户可访问的页面
  async getUserAccessiblePages(userId: string): Promise<PageConfig[]> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_user_accessible_pages', {
          user_id: userId
        })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('获取用户可访问页面失败:', error)
      return []
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

  // ===============================================
  // 页面配置管理
  // ===============================================

  // 获取所有页面配置
  async getPageConfigs(): Promise<PageConfig[]> {
    try {
      const { data, error } = await this.supabase
        .from('page_configs')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('获取页面配置失败:', error)
      return []
    }
  }

  // 创建页面配置
  async createPageConfig(configData: CreatePageConfigInput): Promise<PageConfig> {
    try {
      const { data, error } = await this.supabase
        .from('page_configs')
        .insert(configData)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('创建页面配置失败:', error)
      throw error
    }
  }

  // 更新页面配置
  async updatePageConfig(id: string, configData: UpdatePageConfigInput): Promise<PageConfig> {
    try {
      const { data, error } = await this.supabase
        .from('page_configs')
        .update({
          ...configData,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('更新页面配置失败:', error)
      throw error
    }
  }

  // 删除页面配置
  async deletePageConfig(id: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('page_configs')
        .delete()
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      console.error('删除页面配置失败:', error)
      throw error
    }
  }

  // 评分维度管理（已移除）

  // ===============================================
  // 导出配置管理
  // ===============================================

  // 获取导出配置
  async getExportConfigs(): Promise<ExportConfig[]> {
    try {
      const { data, error } = await this.supabase
        .from('export_configs')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('获取导出配置失败:', error)
      return []
    }
  }

  // 创建导出配置
  async createExportConfig(configData: CreateExportConfigInput): Promise<ExportConfig> {
    try {
      const { data, error } = await this.supabase
        .from('export_configs')
        .insert(configData)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('创建导出配置失败:', error)
      throw error
    }
  }
}

export const dynamicPermissionService = new DynamicPermissionService()