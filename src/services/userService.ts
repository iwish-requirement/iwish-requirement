import { createSupabaseClient } from '@/lib/supabase'
import type { User, Role } from '@/types'

export class UserService {
  private supabase = createSupabaseClient()

  // 获取所有用户
  async getUsers(): Promise<User[]> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('获取用户列表失败:', error)
      throw error
    }
  }

  // 获取用户详情
  async getUserById(userId: string): Promise<User | null> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('获取用户详情失败:', error)
      throw error
    }
  }

  // 更新用户信息
  async updateUser(userId: string, userData: Partial<User>): Promise<User> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .update({
          ...userData,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('更新用户失败:', error)
      throw error
    }
  }

  // 更新用户角色 - 同步更新用户表和角色权限系统
  async updateUserRole(userId: string, role: string): Promise<User> {
    try {
      // 1. 更新用户表中的角色字段
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .update({
          role,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single()

      if (userError) throw userError

      // 2. 同步更新角色权限系统
      // 首先获取角色ID
      const { data: roleData, error: roleError } = await this.supabase
        .from('roles')
        .select('id')
        .eq('name', role)
        .single()

      if (roleError) {
        console.error('角色不存在:', role, roleError)
        // 如果角色不存在，只更新用户表，不影响权限系统
        return userData
      }

      // 删除用户的所有现有角色分配
      await this.supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)

      // 分配新角色
      const { error: assignError } = await this.supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role_id: roleData.id,
          assigned_by: userId, // 临时使用用户自己的ID，实际应该是操作者ID
          is_active: true
        })

      if (assignError) {
        console.error('分配角色失败:', assignError)
        // 即使角色分配失败，用户表已更新，返回用户数据
      }

      return userData
    } catch (error) {
      console.error('更新用户角色失败:', error)
      throw error
    }
  }

  // 激活/停用用户
  async toggleUserStatus(userId: string, active: boolean): Promise<User> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .update({
          active,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('更新用户状态失败:', error)
      throw error
    }
  }

  // 删除用户
  async deleteUser(userId: string): Promise<void> {
    try {
      // 检查是否有关联的需求
      const { data: requirements, error: reqError } = await this.supabase
        .from('requirements')
        .select('id')
        .or(`submitter_id.eq.${userId},assignee_id.eq.${userId}`)
        .limit(1)

      if (reqError) throw reqError

      if (requirements && requirements.length > 0) {
        throw new Error('该用户有关联的需求记录，无法删除')
      }

      // 删除用户
      const { error } = await this.supabase
        .from('users')
        .delete()
        .eq('id', userId)

      if (error) throw error
    } catch (error) {
      console.error('删除用户失败:', error)
      throw error
    }
  }

  // 创建用户
  async createUser(userData: {
    email: string
    full_name: string
    department: string
    position: string
    role: string
    phone?: string
    title?: string | null
    initialPassword?: string
  }): Promise<User> {
    try {
      const resp = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      })
      const json = await resp.json()
      if (!resp.ok || !json.ok) {
        throw new Error(json.error || '创建用户失败')
      }
      return json.user as User
    } catch (error) {
      console.error('创建用户失败:', error)
      throw error
    }
  }

  // 获取所有角色
  async getRoles(): Promise<Role[]> {
    try {
      const { data, error } = await this.supabase
        .from('roles')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('获取角色列表失败:', error)
      throw error
    }
  }

  // 批量更新用户角色
  async batchUpdateUserRoles(updates: { userId: string; role: string }[]): Promise<void> {
    try {
      const promises = updates.map(update => 
        this.updateUserRole(update.userId, update.role)
      )
      
      await Promise.all(promises)
    } catch (error) {
      console.error('批量更新用户角色失败:', error)
      throw error
    }
  }

  // 搜索用户
  async searchUsers(query: string): Promise<User[]> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,department.ilike.%${query}%,position.ilike.%${query}%`)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('搜索用户失败:', error)
      throw error
    }
  }

  // 按部门获取用户
  async getUsersByDepartment(department: string): Promise<User[]> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('department', department)
        .eq('active', true)
        .order('full_name')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('获取部门用户失败:', error)
      throw error
    }
  }

  // 按角色获取用户
  async getUsersByRole(role: string): Promise<User[]> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('role', role)
        .eq('active', true)
        .order('full_name')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('获取角色用户失败:', error)
      throw error
    }
  }
}

export const userService = new UserService()