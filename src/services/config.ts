// =====================================================
// 配置管理服务 - 支持超级管理员自定义权限和配置
// =====================================================

import { supabase, createSupabaseClient } from '@/lib/supabase'
import type { 
  PermissionSchema, 
  FieldTypeSchema, 
  WorkflowSchema, 
  PageSchema,
  NavigationConfigExtended,
  FormDesignerField,
  PermissionDesignerItem,
  NavigationDesignerItem,
  ConfigActionPayload
} from '@/types'

// =====================================================
// 权限配置管理
// =====================================================

export class PermissionConfigService {
  // 获取所有权限配置
  static async getPermissionSchemas(): Promise<PermissionSchema[]> {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('permission_schemas')
      .select('*')
      .order('category', { ascending: true })
      .order('resource', { ascending: true })
      .order('action', { ascending: true })

    if (error) throw error
    return data || []
  }

  // 获取权限分类
  static async getPermissionCategories(): Promise<string[]> {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('permission_schemas')
      .select('category')
      .order('category')

    if (error) throw error
    
    const categoriesSet = new Set<string>((data || []).map(item => item.category).filter(Boolean))
    const categories = Array.from(categoriesSet)
    return categories
  }

  // 创建自定义权限
  static async createPermission(permission: Omit<PermissionSchema, 'id' | 'created_at' | 'updated_at'>): Promise<PermissionSchema> {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('permission_schemas')
      .insert([{
        ...permission,
        is_system: false // 自定义权限标记为非系统权限
      }])
      .select()
      .single()

    if (error) throw error
    return data
  }

  // 更新权限配置
  static async updatePermission(id: string, updates: Partial<PermissionSchema>): Promise<PermissionSchema> {
    const { data, error } = await supabase
      .from('permission_schemas')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // 删除自定义权限（系统权限不能删除）
  static async deletePermission(id: string): Promise<void> {
    const { error } = await supabase
      .from('permission_schemas')
      .delete()
      .eq('id', id)
      .eq('is_system', false) // 只能删除非系统权限

    if (error) throw error
  }

  // 批量更新权限状态
  static async togglePermissions(ids: string[], is_active: boolean): Promise<void> {
    const { error } = await supabase
      .from('permission_schemas')
      .update({ is_active })
      .in('id', ids)

    if (error) throw error
  }
}

// =====================================================
// 字段类型配置管理
// =====================================================

export class FieldTypeConfigService {
  // 获取所有字段类型
  static async getFieldTypes(): Promise<FieldTypeSchema[]> {
    const { data, error } = await supabase
      .from('field_type_schemas')
      .select('*')
      .eq('is_active', true)
      .order('is_system', { ascending: false })
      .order('display_name')

    if (error) throw error
    return data || []
  }

  // 创建自定义字段类型
  static async createFieldType(fieldType: Omit<FieldTypeSchema, 'id' | 'created_at' | 'updated_at'>): Promise<FieldTypeSchema> {
    const { data, error } = await supabase
      .from('field_type_schemas')
      .insert([{
        ...fieldType,
        is_system: false
      }])
      .select()
      .single()

    if (error) throw error
    return data
  }

  // 更新字段类型
  static async updateFieldType(id: string, updates: Partial<FieldTypeSchema>): Promise<FieldTypeSchema> {
    const { data, error } = await supabase
      .from('field_type_schemas')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // 删除自定义字段类型
  static async deleteFieldType(id: string): Promise<void> {
    const { error } = await supabase
      .from('field_type_schemas')
      .delete()
      .eq('id', id)
      .eq('is_system', false)

    if (error) throw error
  }
}

// =====================================================
// 表单设计器服务
// =====================================================

export class FormDesignerService {
  // 获取表单配置（包含扩展字段）
  static async getFormSchema(id: string) {
    const { data, error } = await supabase
      .from('form_schemas')
      .select(`
        *,
        workflow_schemas(*)
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  }

  // 保存表单设计
  static async saveFormDesign(formId: string, fields: FormDesignerField[], config: {
    validation_rules?: Record<string, any>
    conditional_logic?: Record<string, any>
    layout_config?: Record<string, any>
    workflow_id?: string
  }) {
    const { data, error } = await supabase
      .from('form_schemas')
      .update({
        fields: fields,
        ...config
      })
      .eq('id', formId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // 创建新表单
  static async createForm(form: {
    name: string
    description?: string
    department: string
    position: string
    fields: FormDesignerField[]
    validation_rules?: Record<string, any>
    conditional_logic?: Record<string, any>
    layout_config?: Record<string, any>
    workflow_id?: string
  }) {
    const { data, error } = await supabase
      .from('form_schemas')
      .insert([form])
      .select()
      .single()

    if (error) throw error
    return data
  }

  // 复制表单
  static async duplicateForm(sourceId: string, newName: string) {
    const source = await this.getFormSchema(sourceId)
    
    const { data, error } = await supabase
      .from('form_schemas')
      .insert([{
        name: newName,
        description: `复制自: ${source.name}`,
        department: source.department,
        position: source.position,
        fields: source.fields,
        validation_rules: source.validation_rules,
        conditional_logic: source.conditional_logic,
        layout_config: source.layout_config,
        workflow_id: source.workflow_id
      }])
      .select()
      .single()

    if (error) throw error
    return data
  }
}

// =====================================================
// 导航配置管理
// =====================================================

export class NavigationConfigService {
  // 获取导航配置
  static async getNavigationConfigs(): Promise<NavigationConfigExtended[]> {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('navigation_configs')
      .select('*')
      .eq('is_active', true)
      .order('order_index')

    if (error) throw error
    return data || []
  }

  // 获取导航树结构
  static async getNavigationTree(): Promise<NavigationDesignerItem[]> {
    const configs = await this.getNavigationConfigs()
    
    // 构建树结构
    const tree: NavigationDesignerItem[] = []
    const map = new Map<string, NavigationDesignerItem>()

    // 先创建所有节点
    configs.forEach(config => {
      const item: NavigationDesignerItem = {
        id: config.id,
        name: config.name,
        path: config.path,
        icon: config.icon,
        parent_id: config.parent_id,
        order_index: config.order_index,
        required_permissions: config.required_permissions,
        component: config.component,
        meta_config: config.meta_config,
        children: []
      }
      map.set(config.id, item)
    })

    // 构建父子关系
    configs.forEach(config => {
      const item = map.get(config.id)!
      if (config.parent_id && map.has(config.parent_id)) {
        const parent = map.get(config.parent_id)!
        parent.children = parent.children || []
        parent.children.push(item)
      } else {
        tree.push(item)
      }
    })

    return tree
  }

  // 保存导航配置
  static async saveNavigationConfig(items: NavigationDesignerItem[]): Promise<void> {
    // 扁平化树结构
    const flatItems: Omit<NavigationConfigExtended, 'created_at' | 'updated_at'>[] = []
    
    const flatten = (items: NavigationDesignerItem[], parentId?: string) => {
      items.forEach(item => {
        flatItems.push({
          id: item.id,
          name: item.name,
          path: item.path,
          icon: item.icon,
          parent_id: parentId,
          order_index: item.order_index,
          required_permissions: item.required_permissions,
          component: item.component,
          meta_config: item.meta_config || {},
          is_active: true
        })
        
        if (item.children && item.children.length > 0) {
          flatten(item.children, item.id)
        }
      })
    }

    flatten(items)

    // 批量更新
    const { error } = await supabase
      .from('navigation_configs')
      .upsert(flatItems)

    if (error) throw error
  }

  // 创建导航项
  static async createNavigationItem(item: Omit<NavigationConfigExtended, 'id' | 'created_at' | 'updated_at'>): Promise<NavigationConfigExtended> {
    const supabase = createSupabaseClient()
    
    // 确保字段名正确映射
    const insertData = {
      name: item.name,
      path: item.path,
      icon: item.icon || null,
      parent_id: item.parent_id || null,
      order_index: item.order_index || 0,
      required_permissions: item.required_permissions || [],
      component: item.component || null,
      meta_config: item.meta_config || {},
      is_active: item.is_active !== false
    }

    const { data, error } = await supabase
      .from('navigation_configs')
      .insert([insertData])
      .select()
      .single()

    if (error) {
      console.error('创建导航项失败:', error)
      throw error
    }
    return data
  }

  // 更新导航项
  static async updateNavigationItem(id: string, updates: Partial<NavigationConfigExtended>): Promise<NavigationConfigExtended> {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('navigation_configs')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // 删除导航项
  static async deleteNavigationItem(id: string): Promise<void> {
    const supabase = createSupabaseClient()
    const { error } = await supabase
      .from('navigation_configs')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

// =====================================================
// 工作流配置管理
// =====================================================

export class WorkflowConfigService {
  // 获取工作流配置
  static async getWorkflowSchemas(): Promise<WorkflowSchema[]> {
    const { data, error } = await supabase
      .from('workflow_schemas')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (error) throw error
    return data || []
  }

  // 创建工作流
  static async createWorkflow(workflow: Omit<WorkflowSchema, 'id' | 'created_at' | 'updated_at'>): Promise<WorkflowSchema> {
    const { data, error } = await supabase
      .from('workflow_schemas')
      .insert([workflow])
      .select()
      .single()

    if (error) throw error
    return data
  }

  // 更新工作流
  static async updateWorkflow(id: string, updates: Partial<WorkflowSchema>): Promise<WorkflowSchema> {
    const { data, error } = await supabase
      .from('workflow_schemas')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // 删除工作流
  static async deleteWorkflow(id: string): Promise<void> {
    const { error } = await supabase
      .from('workflow_schemas')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

// =====================================================
// 配置操作日志
// =====================================================

export class ConfigAuditService {
  // 记录配置操作
  static async logConfigAction(payload: ConfigActionPayload): Promise<void> {
    const { error } = await supabase
      .from('activity_logs')
      .insert([{
        user_id: payload.user_id,
        action: payload.action,
        resource_type: 'config',
        new_values: payload.data,
        created_at: payload.timestamp
      }])

    if (error) console.error('Failed to log config action:', error)
  }

  // 获取配置操作历史
  static async getConfigHistory(limit = 50) {
    const { data, error } = await supabase
      .from('activity_logs')
      .select(`
        *,
        user_profiles(name, email)
      `)
      .eq('resource_type', 'config')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  }
}