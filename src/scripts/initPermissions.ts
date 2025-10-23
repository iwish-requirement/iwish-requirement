/**
 * 权限初始化脚本
 * 用于在数据库中创建基础权限和角色数据
 */

import { createSupabaseClient } from '@/lib/supabase'
import { PERMISSIONS, PERMISSION_CATEGORIES, PERMISSION_DESCRIPTIONS, PERMISSION_GROUPS } from '@/config/permissions'

const supabase = createSupabaseClient()

// 基础权限数据
const basePermissions = PERMISSION_GROUPS.flatMap(group => 
  group.permissions.map(permissionCode => ({
    code: permissionCode,
    name: PERMISSION_DESCRIPTIONS[permissionCode as keyof typeof PERMISSION_DESCRIPTIONS] || permissionCode,
    display_name: PERMISSION_DESCRIPTIONS[permissionCode as keyof typeof PERMISSION_DESCRIPTIONS] || permissionCode,
    description: `${group.name} - ${PERMISSION_DESCRIPTIONS[permissionCode as keyof typeof PERMISSION_DESCRIPTIONS] || permissionCode}`,
    category: group.category,
    is_system: true,
    sort_order: 0
  }))
)

// 基础角色配置
const baseRoles = [
  {
    name: 'super_admin',
    description: '超级管理员 - 拥有所有权限',
    permissions: Object.values(PERMISSIONS).flatMap(category => Object.values(category))
  },
  {
    name: 'admin',
    description: '管理员 - 拥有大部分管理权限',
    permissions: [
      // 需求管理
      PERMISSIONS.REQUIREMENT.CREATE,
      PERMISSIONS.REQUIREMENT.VIEW_ALL,
      PERMISSIONS.REQUIREMENT.EDIT_ALL,
      PERMISSIONS.REQUIREMENT.ASSIGN,
      PERMISSIONS.REQUIREMENT.MANAGE_ALL,
      
      // 用户管理
      PERMISSIONS.USER.VIEW,
      PERMISSIONS.USER.CREATE,
      PERMISSIONS.USER.EDIT,
      PERMISSIONS.USER.MANAGE_ROLES,
      
      // 分析统计
      PERMISSIONS.ANALYTICS.VIEW,
      PERMISSIONS.ANALYTICS.EXPORT,
      
      // 数据管理
      PERMISSIONS.DATA.EXPORT,
      
      // 评论管理
      PERMISSIONS.COMMENT.CREATE,
      PERMISSIONS.COMMENT.DELETE_ALL,
      
      // 表单管理
      PERMISSIONS.FORM.VIEW,
      PERMISSIONS.FORM.EDIT,
      PERMISSIONS.FORM.MANAGE
    ]
  },
  {
    name: 'employee',
    description: '员工 - 基础权限',
    permissions: [
      // 需求管理
      PERMISSIONS.REQUIREMENT.CREATE,
      PERMISSIONS.REQUIREMENT.VIEW_OWN,
      PERMISSIONS.REQUIREMENT.EDIT_OWN,
      
      // 评论
      PERMISSIONS.COMMENT.CREATE,
      
      // 表单查看
      PERMISSIONS.FORM.VIEW
    ]
  }
]

export async function initializePermissions() {
  try {
    console.log('开始初始化权限数据...')

    // 1. 创建权限
    console.log('创建基础权限...')
    for (const permission of basePermissions) {
      const { error } = await supabase
        .from('permissions')
        .upsert(permission, { 
          onConflict: 'code',
          ignoreDuplicates: false 
        })

      if (error) {
        console.error(`创建权限失败 ${permission.code}:`, error)
      } else {
        console.log(`✓ 权限已创建: ${permission.code}`)
      }
    }

    // 2. 创建角色
    console.log('创建基础角色...')
    for (const roleConfig of baseRoles) {
      // 创建角色
      const { data: role, error: roleError } = await supabase
        .from('roles')
        .upsert({
          name: roleConfig.name,
          description: roleConfig.description,
          is_active: true
        }, { 
          onConflict: 'name',
          ignoreDuplicates: false 
        })
        .select()
        .single()

      if (roleError) {
        console.error(`创建角色失败 ${roleConfig.name}:`, roleError)
        continue
      }

      console.log(`✓ 角色已创建: ${roleConfig.name}`)

      // 获取权限ID
      const { data: permissions, error: permError } = await supabase
        .from('permissions')
        .select('id, code')
        .in('code', roleConfig.permissions)

      if (permError) {
        console.error(`获取权限失败:`, permError)
        continue
      }

      // 删除现有的角色权限关联
      await supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', role.id)

      // 创建角色权限关联
      const rolePermissions = permissions?.map(permission => ({
        role_id: role.id,
        permission_id: permission.id
      })) || []

      if (rolePermissions.length > 0) {
        const { error: rpError } = await supabase
          .from('role_permissions')
          .insert(rolePermissions)

        if (rpError) {
          console.error(`创建角色权限关联失败:`, rpError)
        } else {
          console.log(`✓ 角色权限已关联: ${roleConfig.name} (${rolePermissions.length} 个权限)`)
        }
      }
    }

    console.log('权限初始化完成！')
    return { success: true }

  } catch (error) {
    console.error('权限初始化失败:', error)
    return { success: false, error }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  initializePermissions()
    .then(result => {
      if (result.success) {
        console.log('✅ 权限初始化成功')
        process.exit(0)
      } else {
        console.error('❌ 权限初始化失败:', result.error)
        process.exit(1)
      }
    })
    .catch(error => {
      console.error('❌ 权限初始化异常:', error)
      process.exit(1)
    })
}