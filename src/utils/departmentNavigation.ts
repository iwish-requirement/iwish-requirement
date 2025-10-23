import { NavigationConfigService } from '@/services/config'
import { departmentService } from '@/services/department'

// 为部门创建导航菜单的工具函数
export class DepartmentNavigationManager {
  
  // 为所有部门创建需求管理导航
  static async createDepartmentNavigations() {
    try {
      const departments = await departmentService.getDepartments()
      
      // 获取现有的导航配置
      const existingConfigs = await NavigationConfigService.getNavigationConfigs()
      
      // 找到需求管理的父级菜单
      const requirementParent = existingConfigs.find(config => 
        config.path === '/dashboard/requirements' && !config.parent_id
      )
      
      if (!requirementParent) {
        console.warn('未找到需求管理父级菜单')
        return
      }

      // 为每个部门创建子菜单
      const departmentMenus = []
      
      for (const dept of departments) {
        // 检查是否已存在该部门的菜单
        const existingDeptMenu = existingConfigs.find(config => 
          config.path === `/dashboard/requirements/${dept.code}` && 
          config.parent_id === requirementParent.id
        )
        
        if (!existingDeptMenu) {
          const deptMenu = {
            name: `${dept.name}需求`,
            path: `/dashboard/requirements/${dept.code}`,
            icon: this.getDepartmentIcon(dept.code),
            parent_id: requirementParent.id,
            order_index: dept.sort_order + 10, // 确保在基础菜单之后
            required_permissions: ['requirement.view_own', 'requirement.view_all', 'requirement.view', 'requirement.create'],
            component: undefined,
            meta_config: {
              department: dept.code,
              department_name: dept.name,
              description: `${dept.name}的专属需求管理页面`
            },
            is_active: true
          }
          
          departmentMenus.push(deptMenu)
        }
      }

      // 批量创建菜单
      for (const menu of departmentMenus) {
        try {
          await NavigationConfigService.createNavigationItem(menu)
          console.log(`已创建 ${menu.name} 导航菜单`)
        } catch (error) {
          console.error(`创建 ${menu.name} 导航菜单失败:`, error)
        }
      }

      return departmentMenus.length
    } catch (error) {
      console.error('创建部门导航失败:', error)
      throw error
    }
  }

  // 根据部门代码获取合适的图标
  static getDepartmentIcon(departmentCode: string): string {
    const iconMap: Record<string, string> = {
      'creative': 'Palette',
      'tech': 'Monitor', 
      'marketing': 'Megaphone',
      'hr': 'Users',
      'finance': 'Calculator',
      'operations': 'Settings',
      'sales': 'TrendingUp',
      'support': 'Headphones',
      'legal': 'Scale',
      'admin': 'Building'
    }
    
    return iconMap[departmentCode] || 'Building'
  }

  // 清理无效的部门导航（当部门被删除时）
  static async cleanupInvalidDepartmentNavigations() {
    try {
      const departments = await departmentService.getDepartments()
      const activeDeptCodes = departments.map(d => d.code)
      
      const existingConfigs = await NavigationConfigService.getNavigationConfigs()
      
      // 找到所有部门需求菜单
      const deptMenus = existingConfigs.filter(config => 
        config.path.startsWith('/dashboard/requirements/') && 
        config.path !== '/dashboard/requirements'
      )
      
      // 删除无效的部门菜单
      for (const menu of deptMenus) {
        const deptCode = menu.path.split('/').pop()
        if (deptCode && !activeDeptCodes.includes(deptCode)) {
          try {
            await NavigationConfigService.deleteNavigationItem(menu.id)
            console.log(`已删除无效的部门菜单: ${menu.name}`)
          } catch (error) {
            console.error(`删除无效菜单失败:`, error)
          }
        }
      }
    } catch (error) {
      console.error('清理无效部门导航失败:', error)
      throw error
    }
  }

  // 更新部门导航信息（当部门信息变更时）
  static async updateDepartmentNavigation(departmentCode: string, departmentName: string) {
    try {
      const existingConfigs = await NavigationConfigService.getNavigationConfigs()
      
      const deptMenu = existingConfigs.find(config => 
        config.path === `/dashboard/requirements/${departmentCode}`
      )
      
      if (deptMenu) {
        // 这里需要在 NavigationConfigService 中添加更新方法
        // 暂时跳过更新逻辑
        console.log(`需要更新部门菜单: ${departmentName}`)
      }
    } catch (error) {
      console.error('更新部门导航失败:', error)
      throw error
    }
  }
}