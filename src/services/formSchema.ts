import { createSupabaseClient } from '@/lib/supabase'

export interface FormSchema {
  id: string
  name: string
  description: string | null
  department: string
  position: string
  fields: any[]
  is_active: boolean
  validation_rules: any
  conditional_logic: any
  layout_config: any
  workflow_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface FormField {
  id: string
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date' | 'file' | 'number'
  label: string
  placeholder?: string
  description?: string
  required: boolean
  options?: string[]
  accept?: string
  validation?: any
}

export class FormSchemaService {
  private supabase = createSupabaseClient()

  // 根据部门和岗位获取表单模板
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

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      return data
    } catch (error) {
      console.error('获取表单模板失败:', error)
      return null
    }
  }

  // 获取通用表单模板
  async getGenericFormSchema(): Promise<FormSchema> {
    return {
      id: 'generic',
      name: '通用需求表单',
      description: '通用的需求提交表单',
      department: '',
      position: '',
      fields: [
        {
          id: 'additional_requirements',
          type: 'textarea',
          label: '详细需求说明',
          placeholder: '请详细描述您的需求...',
          required: true
        },
        {
          id: 'expected_delivery',
          type: 'date',
          label: '期望交付时间',
          required: false
        },
        {
          id: 'reference_materials',
          type: 'file',
          label: '参考资料',
          accept: '*/*',
          required: false
        },
        {
          id: 'budget_range',
          type: 'select',
          label: '预算范围',
          options: ['1000以下', '1000-5000', '5000-10000', '10000以上', '待商议'],
          required: false
        },
        {
          id: 'contact_method',
          type: 'select',
          label: '联系方式偏好',
          options: ['邮件', '电话', '微信', '钉钉'],
          required: false
        }
      ],
      is_active: true,
      validation_rules: {},
      conditional_logic: {},
      layout_config: {},
      workflow_id: null,
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }

  // 获取默认表单字段（保持向后兼容）
  async getDefaultFormSchema(): Promise<FormField[]> {
    return [
      {
        id: 'additional_requirements',
        type: 'textarea',
        label: '详细需求说明',
        placeholder: '请详细描述您的需求...',
        required: true
      },
      {
        id: 'expected_delivery',
        type: 'date',
        label: '期望交付时间',
        required: false
      },
      {
        id: 'reference_materials',
        type: 'file',
        label: '参考资料',
        accept: '*/*',
        required: false
      },
      {
        id: 'budget_range',
        type: 'select',
        label: '预算范围',
        options: ['1000以下', '1000-5000', '5000-10000', '10000以上', '待商议'],
        required: false
      },
      {
        id: 'contact_method',
        type: 'select',
        label: '联系方式偏好',
        options: ['邮件', '电话', '微信', '钉钉'],
        required: false
      }
    ]
  }

  // 获取所有表单模板
  async getAllFormSchemas(): Promise<FormSchema[]> {
    try {
      const { data, error } = await this.supabase
        .from('form_schemas')
        .select('*')
        .eq('is_active', true)
        .order('department', { ascending: true })
        .order('position', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('获取表单模板列表失败:', error)
      return []
    }
  }

  // 根据部门获取该部门的所有表单模板
  async getFormSchemasByDepartment(department: string): Promise<FormSchema[]> {
    try {
      const { data, error } = await this.supabase
        .from('form_schemas')
        .select('*')
        .eq('department', department)
        .eq('is_active', true)
        .order('position', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('获取部门表单模板失败:', error)
      return []
    }
  }

  // 创建表单模板
  async createFormSchema(formSchema: Omit<FormSchema, 'id' | 'created_at' | 'updated_at'>): Promise<FormSchema> {
    try {
      const { data, error } = await this.supabase
        .from('form_schemas')
        .insert(formSchema)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('创建表单模板失败:', error)
      throw error
    }
  }

  // 更新表单模板
  async updateFormSchema(id: string, updates: Partial<FormSchema>): Promise<FormSchema> {
    try {
      const { data, error } = await this.supabase
        .from('form_schemas')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('更新表单模板失败:', error)
      throw error
    }
  }

  // 删除表单模板
  async deleteFormSchema(id: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('form_schemas')
        .update({ is_active: false })
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      console.error('删除表单模板失败:', error)
      throw error
    }
  }

  // 验证表单数据
  validateFormData(fields: FormField[], formData: Record<string, any>): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    fields.forEach(field => {
      const value = formData[field.id]

      // 检查必填字段
      if (field.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
        errors.push(`${field.label}是必填项`)
      }

      // 检查选择类型字段的值是否在选项中
      if (value && field.options && ['select', 'radio'].includes(field.type)) {
        if (!field.options.includes(value)) {
          errors.push(`${field.label}的值不在可选范围内`)
        }
      }

      // 检查多选字段
      if (value && field.type === 'checkbox' && Array.isArray(value)) {
        const invalidOptions = value.filter(v => !field.options?.includes(v))
        if (invalidOptions.length > 0) {
          errors.push(`${field.label}包含无效选项: ${invalidOptions.join(', ')}`)
        }
      }
    })

    return {
      isValid: errors.length === 0,
      errors
    }
  }
}

export const formSchemaService = new FormSchemaService()