import { createSupabaseClient } from '@/lib/supabase'

export interface FormField {
  id: string
  type: string
  label: string
  placeholder?: string
  required?: boolean
  options?: string[]
  accept?: string
  multiple?: boolean
  min?: number
  max?: number
  step?: number
  rows?: number
  format?: string
  validation?: {
    minLength?: number
    maxLength?: number
    pattern?: string
    message?: string
  }
}

export interface FormSchema {
  id?: string
  name: string
  description?: string
  department: string
  position: string
  fields: FormField[]
  validation_rules?: Record<string, any>
  conditional_logic?: Record<string, any>
  layout_config?: Record<string, any>
  workflow_id?: string
  is_active?: boolean
  created_by?: string
  created_at?: string
  updated_at?: string
}

export interface FieldType {
  id: string
  type_name: string
  display_name: string
  description: string
  component_name: string
  default_props: Record<string, any>
  validation_rules: Record<string, any>
  is_system: boolean
  is_active: boolean
}

export class FormConfigService {
  private getSupabase() {
    return createSupabaseClient()
  }

  // 获取所有表单配置
  async getFormSchemas(): Promise<FormSchema[]> {
    const supabase = this.getSupabase()
    const { data, error } = await supabase
      .from('form_schemas')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  }

  // 根据部门和岗位获取表单配置
  async getFormSchemaByPosition(department: string, position: string): Promise<FormSchema | null> {
    const supabase = this.getSupabase()
    const { data, error } = await supabase
      .from('form_schemas')
      .select('*')
      .eq('department', department)
      .eq('position', position)
      .eq('is_active', true)
      .single()
    
    if (error && error.code !== 'PGRST116') {
      throw error
    }
    
    return data || null
  }

  // 获取单个表单配置
  async getFormSchema(id: string): Promise<FormSchema | null> {
    const supabase = this.getSupabase()
    const { data, error } = await supabase
      .from('form_schemas')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error && error.code !== 'PGRST116') {
      throw error
    }
    
    return data || null
  }

  // 创建表单配置
  async createFormSchema(schema: Omit<FormSchema, 'id' | 'created_at' | 'updated_at'>): Promise<FormSchema> {
    const supabase = this.getSupabase()
    // 获取当前用户
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('用户未登录')

    const { data, error } = await supabase
      .from('form_schemas')
      .insert([{
        ...schema,
        created_by: user.id
      }])
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // 更新表单配置
  async updateFormSchema(id: string, schema: Partial<FormSchema>): Promise<FormSchema> {
    const supabase = this.getSupabase()
    const { data, error } = await supabase
      .from('form_schemas')
      .update({
        ...schema,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // 删除表单配置
  async deleteFormSchema(id: string): Promise<void> {
    const supabase = this.getSupabase()
    const { error } = await supabase
      .from('form_schemas')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }

  // 复制表单配置
  async duplicateFormSchema(id: string, newName: string): Promise<FormSchema> {
    const original = await this.getFormSchema(id)
    if (!original) throw new Error('表单配置不存在')

    const duplicate = {
      ...original,
      name: newName,
      id: undefined,
      created_at: undefined,
      updated_at: undefined,
      created_by: undefined
    }

    return this.createFormSchema(duplicate)
  }

  // 获取所有字段类型
  async getFieldTypes(): Promise<FieldType[]> {
    const supabase = this.getSupabase()
    const { data, error } = await supabase
      .from('field_type_schemas')
      .select('*')
      .eq('is_active', true)
      .order('type_name')
    
    if (error) throw error
    return data || []
  }

  // 验证表单配置
  validateFormSchema(schema: FormSchema): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!schema.name?.trim()) {
      errors.push('表单名称不能为空')
    }

    if (!schema.department?.trim()) {
      errors.push('部门不能为空')
    }

    if (!schema.position?.trim()) {
      errors.push('岗位不能为空')
    }

    if (!schema.fields || schema.fields.length === 0) {
      errors.push('至少需要一个表单字段')
    }

    // 验证字段
    schema.fields?.forEach((field, index) => {
      if (!field.id?.trim()) {
        errors.push(`第${index + 1}个字段的ID不能为空`)
      }

      if (!field.label?.trim()) {
        errors.push(`第${index + 1}个字段的标签不能为空`)
      }

      if (!field.type?.trim()) {
        errors.push(`第${index + 1}个字段的类型不能为空`)
      }

      // 检查ID重复
      const duplicateIds = schema.fields.filter(f => f.id === field.id)
      if (duplicateIds.length > 1) {
        errors.push(`字段ID "${field.id}" 重复`)
      }
    })

    return {
      valid: errors.length === 0,
      errors
    }
  }

  // 生成通用表单配置
  getGenericFormSchema(): FormSchema {
    return {
      name: '通用需求表单',
      description: '通用的需求提交表单，适用于所有岗位',
      department: '',
      position: '',
      fields: [
        {
          id: 'title',
          type: 'text',
          label: '需求标题',
          placeholder: '请输入需求标题',
          required: true,
          validation: {
            minLength: 2,
            maxLength: 100,
            message: '标题长度应在2-100个字符之间'
          }
        },
        {
          id: 'description',
          type: 'textarea',
          label: '需求描述',
          placeholder: '请详细描述您的需求',
          required: true,
          rows: 4,
          validation: {
            minLength: 10,
            maxLength: 1000,
            message: '描述长度应在10-1000个字符之间'
          }
        },
        {
          id: 'priority',
          type: 'select',
          label: '优先级',
          required: true,
          options: ['低', '中', '高', '紧急']
        },
        {
          id: 'due_date',
          type: 'date',
          label: '期望完成时间',
          required: false
        },
        {
          id: 'attachments',
          type: 'file',
          label: '附件',
          required: false,
          multiple: true,
          accept: '*'
        },
        {
          id: 'notes',
          type: 'textarea',
          label: '备注',
          placeholder: '其他补充说明',
          required: false,
          rows: 3
        }
      ],
      is_active: true
    }
  }
}

export const formConfigService = new FormConfigService()