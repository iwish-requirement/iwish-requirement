import { createSupabaseClient } from '@/lib/supabase'
import type { 
  FormSchema, 
  FormField, 
  CreateFormSchemaInput, 
  UpdateFormSchemaInput,
  PaginatedResponse 
} from '@/types'

export class FormService {
  private supabase = createSupabaseClient()

  // 获取表单配置列表
  async getFormSchemas(params?: {
    page?: number
    limit?: number
    search?: string
    department?: string
    position?: string
    is_active?: boolean
  }): Promise<PaginatedResponse<FormSchema>> {
    try {
      const page = params?.page || 1
      const limit = params?.limit || 20
      const offset = (page - 1) * limit

      let query = this.supabase
        .from('form_schemas')
        .select('*', { count: 'exact' })

      // 搜索过滤
      if (params?.search) {
        query = query.or(`name.ilike.%${params.search}%,description.ilike.%${params.search}%`)
      }

      // 部门过滤
      if (params?.department) {
        query = query.eq('department', params.department)
      }

      // 岗位过滤
      if (params?.position) {
        query = query.eq('position', params.position)
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
      console.error('获取表单配置列表失败:', error)
      throw error
    }
  }

  // 获取单个表单配置
  async getFormSchema(id: string): Promise<FormSchema | null> {
    try {
      const { data, error } = await this.supabase
        .from('form_schemas')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('获取表单配置失败:', error)
      return null
    }
  }

  // 根据部门和岗位获取表单配置
  async getFormSchemaByPosition(department: string, position: string): Promise<FormSchema | null> {
    try {
      const { data, error } = await this.supabase
        .from('form_schemas')
        .select('*')
        .eq('department', department)
        .eq('position', position)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('获取岗位表单配置失败:', error)
      
      // 如果没有找到特定岗位的配置，尝试获取通用配置
      try {
        const { data: fallbackData, error: fallbackError } = await this.supabase
          .from('form_schemas')
          .select('*')
          .eq('department', department)
          .eq('position', '通用')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (fallbackError) throw fallbackError
        return fallbackData
      } catch (fallbackError) {
        console.error('获取通用表单配置失败:', fallbackError)
        return null
      }
    }
  }

  // 创建表单配置
  async createFormSchema(formData: CreateFormSchemaInput): Promise<FormSchema> {
    try {
      const { data, error } = await this.supabase
        .from('form_schemas')
        .insert(formData)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('创建表单配置失败:', error)
      throw error
    }
  }

  // 更新表单配置
  async updateFormSchema(id: string, formData: UpdateFormSchemaInput): Promise<FormSchema> {
    try {
      const { data, error } = await this.supabase
        .from('form_schemas')
        .update(formData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('更新表单配置失败:', error)
      throw error
    }
  }

  // 删除表单配置
  async deleteFormSchema(id: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('form_schemas')
        .delete()
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      console.error('删除表单配置失败:', error)
      throw error
    }
  }

  // 复制表单配置
  async duplicateFormSchema(id: string, newName: string): Promise<FormSchema> {
    try {
      // 获取原表单配置
      const original = await this.getFormSchema(id)
      if (!original) {
        throw new Error('原表单配置不存在')
      }

      // 创建副本
      const duplicateData: CreateFormSchemaInput = {
        name: newName,
        description: original.description,
        department: original.department,
        position: original.position,
        fields: original.fields,
        is_active: false, // 默认为非激活状态
        created_by: original.created_by
      }

      return await this.createFormSchema(duplicateData)
    } catch (error) {
      console.error('复制表单配置失败:', error)
      throw error
    }
  }

  // 激活/停用表单配置
  async toggleFormSchemaStatus(id: string, is_active: boolean): Promise<FormSchema> {
    try {
      const { data, error } = await this.supabase
        .from('form_schemas')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('更新表单配置状态失败:', error)
      throw error
    }
  }

  // 验证表单字段配置
  validateFormFields(fields: FormField[]): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!Array.isArray(fields) || fields.length === 0) {
      errors.push('表单必须包含至少一个字段')
      return { valid: false, errors }
    }

    const fieldNames = new Set<string>()
    const fieldIds = new Set<string>()

    fields.forEach((field, index) => {
      // 检查必填属性
      if (!field.id) {
        errors.push(`字段 ${index + 1}: 缺少字段ID`)
      } else if (fieldIds.has(field.id)) {
        errors.push(`字段 ${index + 1}: 字段ID "${field.id}" 重复`)
      } else {
        fieldIds.add(field.id)
      }

      if (!field.name) {
        errors.push(`字段 ${index + 1}: 缺少字段名称`)
      } else if (fieldNames.has(field.name)) {
        errors.push(`字段 ${index + 1}: 字段名称 "${field.name}" 重复`)
      } else {
        fieldNames.add(field.name)
      }

      if (!field.label) {
        errors.push(`字段 ${index + 1}: 缺少字段标签`)
      }

      if (!field.type) {
        errors.push(`字段 ${index + 1}: 缺少字段类型`)
      }

      // 检查选项字段
      if (['select', 'radio', 'checkbox'].includes(field.type)) {
        if (!field.options || !Array.isArray(field.options) || field.options.length === 0) {
          errors.push(`字段 ${index + 1}: ${field.type} 类型字段必须提供选项`)
        }
      }

      // 检查验证规则
      if (field.validation) {
        if (field.validation.min_length !== undefined && field.validation.min_length < 0) {
          errors.push(`字段 ${index + 1}: 最小长度不能为负数`)
        }
        if (field.validation.max_length !== undefined && field.validation.max_length < 0) {
          errors.push(`字段 ${index + 1}: 最大长度不能为负数`)
        }
        if (field.validation.min_length !== undefined && field.validation.max_length !== undefined) {
          if (field.validation.min_length > field.validation.max_length) {
            errors.push(`字段 ${index + 1}: 最小长度不能大于最大长度`)
          }
        }
      }

      // 检查条件逻辑
      if (field.conditional_logic) {
        field.conditional_logic.show_when.forEach((condition, condIndex) => {
          if (!condition.field) {
            errors.push(`字段 ${index + 1}, 条件 ${condIndex + 1}: 缺少依赖字段`)
          }
          if (!condition.operator) {
            errors.push(`字段 ${index + 1}, 条件 ${condIndex + 1}: 缺少操作符`)
          }
          if (condition.value === undefined || condition.value === null) {
            errors.push(`字段 ${index + 1}, 条件 ${condIndex + 1}: 缺少比较值`)
          }
        })
      }
    })

    return {
      valid: errors.length === 0,
      errors
    }
  }

  // 获取表单字段类型选项
  getFieldTypeOptions(): Array<{ value: string; label: string; description: string }> {
    return [
      { value: 'text', label: '单行文本', description: '短文本输入框' },
      { value: 'textarea', label: '多行文本', description: '长文本输入框' },
      { value: 'number', label: '数字', description: '数字输入框' },
      { value: 'email', label: '邮箱', description: '邮箱地址输入框' },
      { value: 'url', label: '网址', description: 'URL链接输入框' },
      { value: 'tel', label: '电话', description: '电话号码输入框' },
      { value: 'date', label: '日期', description: '日期选择器' },
      { value: 'datetime', label: '日期时间', description: '日期时间选择器' },
      { value: 'time', label: '时间', description: '时间选择器' },
      { value: 'select', label: '下拉选择', description: '单选下拉框' },
      { value: 'radio', label: '单选按钮', description: '单选按钮组' },
      { value: 'checkbox', label: '复选框', description: '多选复选框' },
      { value: 'switch', label: '开关', description: '开关切换' },
      { value: 'file', label: '文件上传', description: '文件上传组件' },
      { value: 'image', label: '图片上传', description: '图片上传组件' },
      { value: 'rich_text', label: '富文本', description: '富文本编辑器' },
      { value: 'json', label: 'JSON', description: 'JSON数据输入' }
    ]
  }

  // 获取验证操作符选项
  getValidationOperators(): Array<{ value: string; label: string }> {
    return [
      { value: 'equals', label: '等于' },
      { value: 'not_equals', label: '不等于' },
      { value: 'contains', label: '包含' },
      { value: 'not_contains', label: '不包含' },
      { value: 'greater_than', label: '大于' },
      { value: 'less_than', label: '小于' }
    ]
  }

  // 生成默认表单字段
  generateDefaultFields(): FormField[] {
    return [
      {
        id: 'title',
        name: 'title',
        label: '需求标题',
        type: 'text',
        required: true,
        placeholder: '请输入需求标题',
        order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'description',
        name: 'description',
        label: '需求描述',
        type: 'textarea',
        required: true,
        placeholder: '请详细描述需求内容',
        order: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'priority',
        name: 'priority',
        label: '优先级',
        type: 'select',
        required: true,
        options: ['high', 'medium', 'low'],
        order: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'due_date',
        name: 'due_date',
        label: '期望完成时间',
        type: 'date',
        required: true,
        order: 4,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ]
  }

  // 获取表单使用统计
  async getFormUsageStats(formSchemaId: string): Promise<{
    total_requirements: number
    recent_usage: number
    avg_completion_time: number
  }> {
    try {
      const { data: requirements, error } = await this.supabase
        .from('requirements')
        .select('created_at, completed_at')
        .eq('form_schema_id', formSchemaId)

      if (error) throw error

      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

      const recentUsage = requirements?.filter(req => 
        new Date(req.created_at) > thirtyDaysAgo
      ).length || 0

      let totalCompletionTime = 0
      let completedCount = 0

      requirements?.forEach(req => {
        if (req.created_at && req.completed_at) {
          const created = new Date(req.created_at)
          const completed = new Date(req.completed_at)
          const hours = (completed.getTime() - created.getTime()) / (1000 * 60 * 60)
          totalCompletionTime += hours
          completedCount++
        }
      })

      return {
        total_requirements: requirements?.length || 0,
        recent_usage: recentUsage,
        avg_completion_time: completedCount > 0 ? totalCompletionTime / completedCount : 0
      }
    } catch (error) {
      console.error('获取表单使用统计失败:', error)
      return {
        total_requirements: 0,
        recent_usage: 0,
        avg_completion_time: 0
      }
    }
  }
}

export const formService = new FormService()