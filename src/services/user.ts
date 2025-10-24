import { createSupabaseClient } from '@/lib/supabase'
import type { User, CreateUserInput, UpdateUserInput, Role, PaginatedResponse } from '@/types'

export type { User } from '@/types'

export class UserService {
  private supabase = createSupabaseClient()

  // 获取用户列表
  async getUsers(params?: {
    page?: number
    limit?: number
    search?: string
    department?: string
    position?: string
    role?: string
    active?: boolean
  }): Promise<PaginatedResponse<User>> {
    try {
      const page = params?.page || 1
      const limit = params?.limit || 20
      const offset = (page - 1) * limit

      let query = this.supabase
        .from('users')
        .select('*', { count: 'exact' })

      // 搜索过滤
      if (params?.search) {
        query = query.or(`full_name.ilike.%${params.search}%,email.ilike.%${params.search}%`)
      }

      // 部门过滤
      if (params?.department) {
        query = query.eq('department', params.department)
      }

      // 岗位过滤
      if (params?.position) {
        query = query.eq('position', params.position)
      }

      // 角色过滤
      if (params?.role) {
        query = query.eq('role', params.role)
      }

      // 状态过滤
      if (params?.active !== undefined) {
        query = query.eq('active', params.active)
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
      console.error('获取用户列表失败:', error)
      throw error
    }
  }

  // 获取单个用户
  async getUser(id: string): Promise<User | null> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('获取用户失败:', error)
      return null
    }
  }

  // 创建用户
  async createUser(userData: CreateUserInput): Promise<User> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .insert(userData)
        .select()
        .single()

      if (error) throw error

      // 分配默认角色
      const { data: defaultRole } = await this.supabase
        .from('roles')
        .select('id')
        .eq('code', userData.role || 'employee')
        .single()

      if (defaultRole) {
        const resp = await fetch('/api/admin/user-roles/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: data.id, roleId: defaultRole.id, assignedBy: data.id })
        })
        if (!resp.ok) {
          const json = await resp.json().catch(() => ({}))
          console.error('创建用户后分配默认角色失败:', json)
        }
      }

      return data
    } catch (error) {
      console.error('创建用户失败:', error)
      throw error
    }
  }

  // 更新用户
  async updateUser(id: string, userData: UpdateUserInput): Promise<User> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .update(userData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      // 如果更新了角色，需要更新角色关联
      if (userData.role) {
        // 删除旧的角色关联（服务端）
        {
          const resp = await fetch('/api/admin/user-roles/clear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: id })
          })
          if (!resp.ok) {
            const json = await resp.json().catch(() => ({}))
            console.error('更新用户时清空角色失败:', json)
          }
        }

        // 添加新的角色关联（服务端）
        const { data: newRole } = await this.supabase
          .from('roles')
          .select('id')
          .eq('code', userData.role)
          .single()

        if (newRole) {
          const resp = await fetch('/api/admin/user-roles/assign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: id, roleId: newRole.id, assignedBy: id })
          })
          if (!resp.ok) {
            const json = await resp.json().catch(() => ({}))
            console.error('更新用户时分配新角色失败:', json)
          }
        }
      }

      return data
    } catch (error) {
      console.error('更新用户失败:', error)
      throw error
    }
  }

  // 删除用户
  async deleteUser(id: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('users')
        .delete()
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      console.error('删除用户失败:', error)
      throw error
    }
  }

  // 批量删除用户
  async deleteUsers(ids: string[]): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('users')
        .delete()
        .in('id', ids)

      if (error) throw error
    } catch (error) {
      console.error('批量删除用户失败:', error)
      throw error
    }
  }

  // 激活/停用用户
  async toggleUserStatus(id: string, active: boolean): Promise<User> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .update({ active })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('更新用户状态失败:', error)
      throw error
    }
  }

  // 获取用户的角色
  async getUserRoles(userId: string): Promise<Role[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_roles')
        .select(`
          roles (
            id,
            name,
            code,
            description,
            is_system,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', userId)

      if (error) throw error
      return (data?.map(item => item.roles).filter(Boolean) || []) as unknown as Role[]
    } catch (error) {
      console.error('获取用户角色失败:', error)
      return []
    }
  }

  // 为用户分配角色
  async assignRoles(userId: string, roleIds: string[]): Promise<void> {
    try {
      // 删除现有角色
      await this.supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)

      // 分配新角色
      if (roleIds.length > 0) {
        const userRoles = roleIds.map(roleId => ({
          user_id: userId,
          role_id: roleId
        }))

        const { error } = await this.supabase
          .from('user_roles')
          .insert(userRoles)

        if (error) throw error
      }
    } catch (error) {
      console.error('分配用户角色失败:', error)
      throw error
    }
  }

  // 获取所有部门
  async getDepartments(): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('department')
        .not('department', 'is', null)

      if (error) throw error

      const departments = Array.from(new Set(data?.map(item => item.department).filter(Boolean)))
      return departments.sort()
    } catch (error) {
      console.error('获取部门列表失败:', error)
      return []
    }
  }

  // 获取所有岗位
  async getPositions(department?: string): Promise<string[]> {
    try {
      let query = this.supabase
        .from('users')
        .select('position')
        .not('position', 'is', null)

      if (department) {
        query = query.eq('department', department)
      }

      const { data, error } = await query

      if (error) throw error

      const positions = Array.from(new Set(data?.map(item => item.position).filter(Boolean)))
      return positions.sort()
    } catch (error) {
      console.error('获取岗位列表失败:', error)
      return []
    }
  }

  // 获取用户统计
  async getUserStats() {
    try {
      const { data: users, error } = await this.supabase
        .from('users')
        .select('department, position, role, active, last_login')

      if (error) throw error

      const now = new Date()
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      const stats = {
        total_users: users?.length || 0,
        active_users: users?.filter(u => u.active).length || 0,
        by_department: {} as Record<string, number>,
        by_position: {} as Record<string, number>,
        by_role: {
          super_admin: 0,
          admin: 0,
          employee: 0
        } as Record<string, number>,
        recent_logins: users?.filter(u => 
          u.last_login && new Date(u.last_login) > sevenDaysAgo
        ).length || 0
      }

      // 按部门统计
      users?.forEach(user => {
        if (user.department) {
          stats.by_department[user.department] = (stats.by_department[user.department] || 0) + 1
        }
      })

      // 按岗位统计
      users?.forEach(user => {
        if (user.position) {
          stats.by_position[user.position] = (stats.by_position[user.position] || 0) + 1
        }
      })

      // 按角色统计
      users?.forEach(user => {
        if (user.role) {
          stats.by_role[user.role] = (stats.by_role[user.role] || 0) + 1
        }
      })

      return stats
    } catch (error) {
      console.error('获取用户统计失败:', error)
      throw error
    }
  }

  // 搜索用户（用于分配需求时的用户选择）
  async searchUsers(params: {
    search?: string
    department?: string
    position?: string
    departmentCode?: string
    positionCode?: string
    limit?: number
  }): Promise<User[]> {
    try {
      let query = this.supabase
        .from('users')
        .select('id, full_name, email, department, position, department_code, position_code, avatar_url')
        .eq('active', true)

      if (params.search) {
        query = query.or(`full_name.ilike.%${params.search}%,email.ilike.%${params.search}%`)
      }

      // 支持按部门名称或代码搜索
      if (params.department) {
        query = query.eq('department', params.department)
      }
      if (params.departmentCode) {
        query = query.eq('department_code', params.departmentCode)
      }

      // 支持按岗位名称或代码搜索
      if (params.position) {
        query = query.eq('position', params.position)
      }
      if (params.positionCode) {
        query = query.eq('position_code', params.positionCode)
      }

      query = query
        .order('full_name')
        .limit(params.limit || 50)

      const { data, error } = await query

      if (error) throw error
      return (data || []) as User[]
    } catch (error) {
      console.error('搜索用户失败:', error)
      return []
    }
  }

  // 根据部门获取用户列表（用于需求分配）
  async getUsersByDepartment(departmentName: string): Promise<User[]> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('id, full_name, email, department, position, department_code, position_code, avatar_url, role, active, created_at, updated_at')
        .eq('department', departmentName)
        .eq('active', true)
        .order('full_name')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('获取部门用户失败:', error)
      return []
    }
  }

  // 根据部门代码获取用户列表
  async getUsersByDepartmentCode(departmentCode: string): Promise<User[]> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('id, full_name, email, department, position, department_code, position_code, avatar_url, role, active, created_at, updated_at')
        .eq('department_code', departmentCode)
        .eq('active', true)
        .order('full_name')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('根据部门代码获取用户失败:', error)
      return []
    }
  }

  // 根据部门名称和代码获取用户列表（兼容两种查询方式）
  async getUsersByDepartmentNameOrCode(departmentIdentifier: string): Promise<User[]> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('id, full_name, email, department, position, department_code, position_code, avatar_url, role, active, created_at, updated_at')
        .or(`department.eq.${departmentIdentifier},department_code.eq.${departmentIdentifier}`)
        .eq('active', true)
        .order('full_name')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('根据部门标识获取用户失败:', error)
      return []
    }
  }

  // 检查邮箱是否已存在
  async checkEmailExists(email: string, excludeId?: string): Promise<boolean> {
    try {
      let query = this.supabase
        .from('users')
        .select('id')
        .eq('email', email)

      if (excludeId) {
        query = query.neq('id', excludeId)
      }

      const { data, error } = await query

      if (error) throw error
      return (data?.length || 0) > 0
    } catch (error) {
      console.error('检查邮箱失败:', error)
      return false
    }
  }
}

export const userService = new UserService()