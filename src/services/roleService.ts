import { createSupabaseClient } from '@/lib/supabase'
import type { Role, Permission, DynamicPermission } from '@/types'

export class RoleService {
  private supabase = createSupabaseClient()

  private dispatchPermissionUpdated() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('permission:updated'))
    }
  }

  // 获取所有角色
  async getRoles(): Promise<Role[]> {
    try {
      const { data, error } = await this.supabase
        .from('roles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('获取角色列表失败:', error)
      throw error
    }
  }

  // 获取角色详情（包含权限）
  async getRoleWithPermissions(roleId: string): Promise<Role & { permissions: DynamicPermission[] }> {
    try {
      const { data: role, error: roleError } = await this.supabase
        .from('roles')
        .select('*')
        .eq('id', roleId)
        .single()

      if (roleError) throw roleError

      const { data: permissions, error: permError } = await this.supabase
        .from('role_permissions')
        .select(`
          permission_id,
          permissions (
            id,
            name,
            code,
            display_name,
            description,
            category,
            resource,
            action,
            icon,
            color,
            is_system,
            is_active,
            parent_id,
            sort_order,
            created_by,
            created_at,
            updated_at
          )
        `)
        .eq('role_id', roleId)

      if (permError) throw permError

      const rolePermissionsRaw = permissions?.map(p => p.permissions).filter(Boolean) || []
      const rolePermissions: DynamicPermission[] = rolePermissionsRaw.map((perm: any) => ({
        id: perm.id,
        code: perm.code,
        name: perm.name,
        description: perm.description,
        category: perm.category,
        resource: perm.resource,
        action: perm.action,
        conditions: {},
        is_system: !!perm.is_system,
        is_active: !!perm.is_active,
        created_by: perm.created_by,
        created_at: perm.created_at,
        updated_at: perm.updated_at
      }))

      return {
        ...role,
        permissions: rolePermissions
      }
    } catch (error) {
      console.error('获取角色详情失败:', error)
      throw error
    }
  }

  // 获取所有可用权限
  async getAllPermissions(): Promise<DynamicPermission[]> {
    try {
      const { data, error } = await this.supabase
        .from('permissions')
        .select('*')
        .order('sort_order', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('获取权限列表失败:', error)
      throw error
    }
  }

  // 创建角色
  async createRole(roleData: {
    name: string
    description?: string
    permissionIds: string[]
  }): Promise<Role> {
    try {
      // 创建角色
      const { data: role, error: roleError } = await this.supabase
        .from('roles')
        .insert({
          name: roleData.name,
          description: roleData.description,
          is_active: true
        })
        .select()
        .single()

      if (roleError) throw roleError

      // 分配权限
      if (roleData.permissionIds.length > 0) {
        const rolePermissions = roleData.permissionIds.map(permissionId => ({
          role_id: role.id,
          permission_id: permissionId
        }))

        const { error: permError } = await this.supabase
          .from('role_permissions')
          .insert(rolePermissions)

        if (permError) throw permError
      }

      this.dispatchPermissionUpdated()
      return role
    } catch (error) {
      console.error('创建角色失败:', error)
      throw error
    }
  }

  // 更新角色
  async updateRole(roleId: string, roleData: {
    name?: string
    description?: string
    permissionIds?: string[]
  }): Promise<Role> {
    try {
      // 更新角色基本信息
      const updateData: any = {}
      if (roleData.name !== undefined) updateData.name = roleData.name
      if (roleData.description !== undefined) updateData.description = roleData.description
      updateData.updated_at = new Date().toISOString()

      const { data: role, error: roleError } = await this.supabase
        .from('roles')
        .update(updateData)
        .eq('id', roleId)
        .select()

      if (roleError) throw roleError

      // 如果没有返回数据，重新查询
      if (!role || role.length === 0) {
        const { data: refetchedRole, error: refetchError } = await this.supabase
          .from('roles')
          .select('*')
          .eq('id', roleId)
          .single()

        if (refetchError) throw refetchError
        
        // 更新权限分配
        if (roleData.permissionIds !== undefined) {
          await this.updateRolePermissions(roleId, roleData.permissionIds)
        }

        this.dispatchPermissionUpdated()
        return refetchedRole
      }

      // 更新权限分配
      if (roleData.permissionIds !== undefined) {
        await this.updateRolePermissions(roleId, roleData.permissionIds)
      }

      this.dispatchPermissionUpdated()
      return Array.isArray(role) ? role[0] : role
    } catch (error) {
      console.error('更新角色失败:', error)
      throw error
    }
  }

  // 更新角色权限
  async updateRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
    try {
      // 使用数据库事务函数一次性更新，避免部分失败或并发问题
      const { error } = await this.supabase.rpc('update_role_permissions_tx', {
        p_role_id: roleId,
        p_permission_ids: permissionIds
      })
      if (error) throw error
      this.dispatchPermissionUpdated()
    } catch (error) {
      console.error('更新角色权限失败:', error)
      throw error
    }
  }

  // 删除角色
  async deleteRole(roleId: string): Promise<void> {
    try {
      // 检查是否为系统角色
      const { data: role, error: checkError } = await this.supabase
        .from('roles')
        .select('name, is_active')
        .eq('id', roleId)
        .single()

      if (checkError) throw checkError

      if (['super_admin', 'admin', 'employee'].includes(role.name)) {
        throw new Error('不能删除系统预设角色')
      }

      // 检查是否有用户使用此角色
      const { data: users, error: userError } = await this.supabase
        .from('users')
        .select('id')
        .eq('role', role.name)
        .limit(1)

      if (userError) throw userError

      if (users && users.length > 0) {
        throw new Error('该角色正在被用户使用，无法删除')
      }

      // 删除角色权限关联
      const { error: permError } = await this.supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', roleId)

      if (permError) throw permError

      // 删除角色
      const { error: roleError } = await this.supabase
        .from('roles')
        .delete()
        .eq('id', roleId)

      if (roleError) throw roleError
      this.dispatchPermissionUpdated()
    } catch (error) {
      console.error('删除角色失败:', error)
      throw error
    }
  }

  // 获取权限树结构（按功能域分组）
  async getPermissionTree(): Promise<DynamicPermission[]> {
    try {
      const permissions = await this.getAllPermissions()

      // 1) 功能域中文名称映射（可按需扩展）
      const categoryLabels: Record<string, string> = {
        requirement: '需求管理',
        user: '用户管理',
        role: '角色管理',
        permission: '权限管理',
        form: '表单配置',
        navigation: '导航配置',
        system: '系统管理',
        analytics: '统计分析',
        comment: '评论管理',
        other: '其他'
      }

      // 2) 按分类分组
      const byCategory = new Map<string, DynamicPermission[]>()
      permissions.forEach((p: any) => {
        const cat = (p as any).category || 'other'
        if (!byCategory.has(cat)) byCategory.set(cat, [])
        byCategory.get(cat)!.push(p as any)
      })

      // 3) 构建每个分类内的树，并包一层“分类节点”
      const categoryTrees: (DynamicPermission & { children: DynamicPermission[] })[] = []

      for (const [cat, list] of byCategory.entries()) {
        const label = categoryLabels[cat] || cat

        // 分类内构建父子树
        const map = new Map<string, (DynamicPermission & { children: DynamicPermission[] })>()
        list.forEach((p: any) => map.set((p as any).id, { ...(p as any), children: [] }))

        // 建立父子关系（仅在分类内）
        const roots: (DynamicPermission & { children: DynamicPermission[] })[] = []
        list.forEach((p: any) => {
          const pid = (p as any).parent_id
          const node = map.get((p as any).id)!
          if (pid && map.has(pid)) {
            map.get(pid)!.children.push(node)
          } else {
            roots.push(node)
          }
        })

        // 构造分类“虚拟节点”，强制断言为 DynamicPermission 以便前端展示分组
        const categoryNode = ({
          id: `category:${cat}`,
          name: label,
          code: `category.${cat}`,
          description: `${label} 权限`,
          category: cat,
          parent_id: null,
          sort_order: 0,
          is_system: true,
          icon: null,
          color: null,
          display_name: label,
          children: roots
        } as unknown) as DynamicPermission & { children: DynamicPermission[] }

        categoryTrees.push(categoryNode)
      }

      // 按常见分类顺序排序，未覆盖的放最后
      const order = ['requirement', 'form', 'navigation', 'user', 'role', 'permission', 'system', 'analytics', 'comment', 'other']
      categoryTrees.sort((a: any, b: any) => {
        const ia = order.indexOf((a as any).category)
        const ib = order.indexOf((b as any).category)
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
      })

      return categoryTrees as unknown as DynamicPermission[]
    } catch (error) {
      console.error('获取权限树失败:', error)
      throw error
    }
  }

  // 检查角色名称是否可用
  async isRoleNameAvailable(name: string, excludeId?: string): Promise<boolean> {
    try {
      let query = this.supabase
        .from('roles')
        .select('id')
        .eq('name', name)

      if (excludeId) {
        query = query.neq('id', excludeId)
      }

      const { data, error } = await query.limit(1)

      if (error) throw error
      return !data || data.length === 0
    } catch (error) {
      console.error('检查角色名称失败:', error)
      return false
    }
  }
}

export const roleService = new RoleService()