import { createSupabaseClient } from '@/lib/supabase'

export interface Department {
  id: string
  code: string
  name: string
  description: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Position {
  id: string
  code: string
  name: string
  description: string | null
  department_code: string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export class DepartmentService {
  private supabase = createSupabaseClient()

  // 获取所有部门
  async getDepartments(): Promise<Department[]> {
    try {
      const { data, error } = await this.supabase
        .from('departments')
        .select('id, code, name, description, is_active, sort_order, created_at, updated_at')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('获取部门列表失败:', error)
      return []
    }
  }

  // 获取所有岗位
  async getPositions(departmentCode?: string): Promise<Position[]> {
    try {
      let query = this.supabase
        .from('positions')
        .select('id, code, name, description, department_code, is_active, sort_order, created_at, updated_at')
        .eq('is_active', true)

      if (departmentCode) {
        query = query.eq('department_code', departmentCode)
      }

      const { data, error } = await query.order('sort_order', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('获取岗位列表失败:', error)
      return []
    }
  }

  // 根据部门获取岗位
  async getPositionsByDepartment(departmentCode: string): Promise<Position[]> {
    return this.getPositions(departmentCode)
  }
}

export const departmentService = new DepartmentService()