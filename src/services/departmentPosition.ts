import { createSupabaseClient } from '@/lib/supabase'

export interface Department {
  id: string
  code: string
  name: string
  description?: string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Position {
  id: string
  code: string
  name: string
  description?: string
  department_code?: string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CreateDepartmentInput {
  code: string
  name: string
  description?: string
  is_active?: boolean
  sort_order?: number
}

export interface CreatePositionInput {
  code: string
  name: string
  description?: string
  department_code?: string
  is_active?: boolean
  sort_order?: number
}

export interface UpdateDepartmentInput {
  name?: string
  description?: string
  is_active?: boolean
  sort_order?: number
}

export interface UpdatePositionInput {
  name?: string
  description?: string
  department_code?: string
  is_active?: boolean
  sort_order?: number
}

class DepartmentPositionService {
  private supabase = createSupabaseClient()

  // 部门管理
  async getDepartments(activeOnly: boolean = false): Promise<Department[]> {
    try {
      let query = this.supabase
        .from('departments')
        .select('id, code, name, description, is_active, sort_order, created_at, updated_at')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })

      if (activeOnly) {
        query = query.eq('is_active', true)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('获取部门列表失败:', error)
      throw error
    }
  }

  async getDepartmentByCode(code: string): Promise<Department | null> {
    try {
      const { data, error } = await this.supabase
        .from('departments')
        .select('id, code, name, description, is_active, sort_order, created_at, updated_at')
        .eq('code', code)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('获取部门信息失败:', error)
      throw error
    }
  }

  async createDepartment(input: CreateDepartmentInput): Promise<Department> {
    try {
      const { data, error } = await this.supabase
        .from('departments')
        .insert({
          code: input.code,
          name: input.name,
          description: input.description,
          is_active: input.is_active ?? true,
          sort_order: input.sort_order ?? 0
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('创建部门失败:', error)
      throw error
    }
  }

  async updateDepartment(code: string, input: UpdateDepartmentInput): Promise<Department> {
    try {
      const { data, error } = await this.supabase
        .from('departments')
        .update(input)
        .eq('code', code)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('更新部门失败:', error)
      throw error
    }
  }

  async deleteDepartment(code: string): Promise<void> {
    try {
      // 检查是否有关联的岗位
      const { data: positions } = await this.supabase
        .from('positions')
        .select('id')
        .eq('department_code', code)
        .limit(1)

      if (positions && positions.length > 0) {
        throw new Error('该部门下还有岗位，无法删除')
      }

      const { error } = await this.supabase
        .from('departments')
        .delete()
        .eq('code', code)

      if (error) throw error
    } catch (error) {
      console.error('删除部门失败:', error)
      throw error
    }
  }

  // 岗位管理
  async getPositions(departmentCode?: string, activeOnly: boolean = false): Promise<Position[]> {
    try {
      let query = this.supabase
        .from('positions')
        .select('id, code, name, description, department_code, is_active, sort_order, created_at, updated_at')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })

      if (departmentCode) {
        query = query.eq('department_code', departmentCode)
      }

      if (activeOnly) {
        query = query.eq('is_active', true)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('获取岗位列表失败:', error)
      throw error
    }
  }

  async getPositionByCode(code: string): Promise<Position | null> {
    try {
      const { data, error } = await this.supabase
        .from('positions')
        .select('id, code, name, description, department_code, is_active, sort_order, created_at, updated_at')
        .eq('code', code)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('获取岗位信息失败:', error)
      throw error
    }
  }

  async createPosition(input: CreatePositionInput): Promise<Position> {
    try {
      const { data, error } = await this.supabase
        .from('positions')
        .insert({
          code: input.code,
          name: input.name,
          description: input.description,
          department_code: input.department_code,
          is_active: input.is_active ?? true,
          sort_order: input.sort_order ?? 0
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('创建岗位失败:', error)
      throw error
    }
  }

  async updatePosition(code: string, input: UpdatePositionInput): Promise<Position> {
    try {
      const { data, error } = await this.supabase
        .from('positions')
        .update(input)
        .eq('code', code)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('更新岗位失败:', error)
      throw error
    }
  }

  async deletePosition(code: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('positions')
        .delete()
        .eq('code', code)

      if (error) throw error
    } catch (error) {
      console.error('删除岗位失败:', error)
      throw error
    }
  }

  // 获取用户表中的部门和岗位数据（用于数据迁移或参考）
  async getUserDepartmentsAndPositions(): Promise<{
    departments: Array<{ department: string; count: number }>
    positions: Array<{ position: string; count: number }>
  }> {
    try {
      const { data: departments, error: deptError } = await this.supabase
        .from('users')
        .select('department')
        .not('department', 'is', null)

      const { data: positions, error: posError } = await this.supabase
        .from('users')
        .select('position')
        .not('position', 'is', null)

      if (deptError) throw deptError
      if (posError) throw posError

      // 统计部门使用情况
      const deptCounts = (departments || []).reduce((acc, { department }) => {
        acc[department] = (acc[department] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      // 统计岗位使用情况
      const posCounts = (positions || []).reduce((acc, { position }) => {
        acc[position] = (acc[position] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      return {
        departments: Object.entries(deptCounts).map(([department, count]) => ({
          department,
          count
        })),
        positions: Object.entries(posCounts).map(([position, count]) => ({
          position,
          count
        }))
      }
    } catch (error) {
      console.error('获取用户部门岗位数据失败:', error)
      throw error
    }
  }

  // 获取部门选项（用于下拉框）
  async getDepartmentOptions(includeAll: boolean = false): Promise<Array<{ value: string; label: string }>> {
    try {
      const departments = await this.getDepartments(true)
      const options = departments.map(dept => ({
        value: dept.code,
        label: dept.name
      }))

      if (includeAll) {
        options.unshift({ value: 'all', label: '全部部门' })
      }

      return options
    } catch (error) {
      console.error('获取部门选项失败:', error)
      return includeAll ? [{ value: 'all', label: '全部部门' }] : []
    }
  }

  // 获取岗位选项（用于下拉框）
  async getPositionOptions(departmentCode?: string): Promise<Array<{ value: string; label: string }>> {
    try {
      const positions = await this.getPositions(departmentCode, true)
      return positions.map(pos => ({
        value: pos.code,
        label: pos.name
      }))
    } catch (error) {
      console.error('获取岗位选项失败:', error)
      return []
    }
  }
}

export const departmentPositionService = new DepartmentPositionService()