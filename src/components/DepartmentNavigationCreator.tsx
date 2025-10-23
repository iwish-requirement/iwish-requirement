'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Plus, 
  Building, 
  FileText, 
  Settings,
  Check,
  X,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { NavigationConfigService } from '@/services/config'
import { departmentService, type Department } from '@/services/department'
import { useNavigationRefresh } from '@/hooks/useNavigationRefresh'

interface DepartmentNavItem {
  id: string
  departmentCode: string
  departmentName: string
  hasNavigation: boolean
  navigationId?: string
  isCustom?: boolean
}

interface DepartmentNavigationCreatorProps {
  onNavigationChange?: () => void
}

export function DepartmentNavigationCreator({ onNavigationChange }: DepartmentNavigationCreatorProps = {}) {
  const [departments, setDepartments] = useState<Department[]>([])
  const [departmentNavItems, setDepartmentNavItems] = useState<DepartmentNavItem[]>([])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isCustomDepartmentDialogOpen, setIsCustomDepartmentDialogOpen] = useState(false)
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  
  // 使用导航刷新钩子
  const { triggerRefresh } = useNavigationRefresh()

  const [formData, setFormData] = useState({
    customName: '',
    useCustomName: false,
    addToRequirementsMenu: true
  })

  const [customDepartmentData, setCustomDepartmentData] = useState({
    name: '',
    code: ''
  })

  // 加载部门数据和现有导航
  useEffect(() => {
    const loadData = async () => {
      try {
        setInitialLoading(true)
        const [departmentsData, navigationConfigs] = await Promise.all([
          departmentService.getDepartments(),
          NavigationConfigService.getNavigationConfigs()
        ])
        
        setDepartments(departmentsData)
        
        // 检查哪些部门已经有导航项
        const navItems: DepartmentNavItem[] = departmentsData.map(dept => {
          const existingNav = navigationConfigs.find(nav => 
            nav.path === `/dashboard/requirements/${dept.code}` ||
            nav.path.includes(`/dashboard/requirements/${dept.code}`)
          )
          
          return {
            id: dept.id,
            departmentCode: dept.code,
            departmentName: dept.name,
            hasNavigation: !!existingNav,
            navigationId: existingNav?.id
          }
        })
        
        setDepartmentNavItems(navItems)
      } catch (error) {
        console.error('加载数据失败:', error)
        toast.error('加载部门数据失败')
      } finally {
        setInitialLoading(false)
      }
    }

    loadData()
  }, [])

  const handleCreateNavigation = async () => {
    if (!selectedDepartment) {
      toast.error('请选择部门')
      return
    }

    setLoading(true)
    try {
      const displayName = formData.useCustomName && formData.customName 
        ? formData.customName 
        : `${selectedDepartment.name}需求`

      let parentId: string | null = null

      // 如果选择添加到需求管理菜单下，找到需求管理的ID
      if (formData.addToRequirementsMenu) {
        console.log('正在查找需求管理父菜单...')
        const navigationConfigs = await NavigationConfigService.getNavigationConfigs()
        console.log('获取到的导航配置:', navigationConfigs)
        
        const requirementsMenu = navigationConfigs.find(nav => 
          nav.path === '/dashboard/requirements' || 
          nav.path === '/requirements' || 
          nav.name === '需求管理' ||
          nav.name.includes('需求')
        )
        
        if (requirementsMenu) {
          parentId = requirementsMenu.id
          console.log('找到父菜单:', requirementsMenu)
        } else {
          console.log('未找到需求管理父菜单')
        }
      }

      // 创建导航项
      const newNavigationItem = {
        name: displayName,
        path: `/dashboard/requirements/${selectedDepartment.code}`,
        icon: 'Building',
        parent_id: parentId || undefined,
        order_index: departmentNavItems.length + 10, // 给一些空间
        required_permissions: ['requirement.view'],
        component: undefined,
        meta_config: {
          department: selectedDepartment.code,
          departmentName: selectedDepartment.name,
          description: `${selectedDepartment.name}的需求管理页面`
        },
        is_active: true
      }

      console.log('准备创建导航项:', newNavigationItem)
      const createdItem = await NavigationConfigService.createNavigationItem(newNavigationItem)
      console.log('创建成功:', createdItem)
      
      // 更新本地状态
      setDepartmentNavItems(prev => 
        prev.map(item => 
          item.departmentCode === selectedDepartment.code
            ? { ...item, hasNavigation: true, navigationId: createdItem.id }
            : item
        )
      )

      setIsCreateDialogOpen(false)
      resetFormData()
      
      // 通知父组件刷新导航数据
      if (onNavigationChange) {
        onNavigationChange()
      }
      
      // 触发全局导航刷新
      triggerRefresh()
      
      toast.success(`已为 ${selectedDepartment.name} 创建导航项`)
    } catch (error: any) {
      console.error('创建导航项失败:', error)
      console.error('错误详情:', error.message || error)
      toast.error(`创建导航项失败: ${error.message || '未知错误'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveNavigation = async (departmentCode: string, navigationId: string) => {
    if (!confirm('确定要删除这个部门的导航项吗？')) return

    try {
      await NavigationConfigService.deleteNavigationItem(navigationId)
      
      // 更新本地状态
      setDepartmentNavItems(prev => 
        prev.map(item => 
          item.departmentCode === departmentCode
            ? { ...item, hasNavigation: false, navigationId: undefined }
            : item
        )
      )

      // 通知父组件刷新导航数据
      if (onNavigationChange) {
        onNavigationChange()
      }

      // 触发全局导航刷新
      triggerRefresh()

      toast.success('导航项删除成功')
    } catch (error: any) {
      console.error('删除导航项失败:', error)
      toast.error('删除导航项失败')
    }
  }

  const resetFormData = () => {
    setFormData({
      customName: '',
      useCustomName: false,
      addToRequirementsMenu: true
    })
    setSelectedDepartment(null)
  }

  const resetCustomDepartmentData = () => {
    setCustomDepartmentData({
      name: '',
      code: ''
    })
  }

  const openCreateDialog = (department: Department) => {
    setSelectedDepartment(department)
    setFormData({
      customName: `${department.name}需求`,
      useCustomName: false,
      addToRequirementsMenu: true
    })
    setIsCreateDialogOpen(true)
  }

  const handleCreateCustomDepartment = async () => {
    if (!customDepartmentData.name || !customDepartmentData.code) {
      toast.error('请填写部门名称和代码')
      return
    }

    // 检查代码是否已存在
    const existingDept = departmentNavItems.find(item => 
      item.departmentCode === customDepartmentData.code
    )
    if (existingDept) {
      toast.error('部门代码已存在')
      return
    }

    try {
      setLoading(true)

      // 创建自定义部门导航项
      const displayName = `${customDepartmentData.name}需求`
      
      // 查找需求管理父菜单
      const navigationConfigs = await NavigationConfigService.getNavigationConfigs()
      const requirementsMenu = navigationConfigs.find(nav => 
        nav.path === '/dashboard/requirements' || 
        nav.name === '需求管理'
      )

      const newNavigationItem = {
        name: displayName,
        path: `/dashboard/requirements/${customDepartmentData.code}`,
        icon: 'Building',
        parent_id: requirementsMenu?.id || undefined,
        order_index: departmentNavItems.length + 10,
        required_permissions: ['requirement.view'],
        component: undefined,
        meta_config: {
          department: customDepartmentData.code,
          departmentName: customDepartmentData.name,
          description: `${customDepartmentData.name}的需求管理页面`,
          isCustom: true
        },
        is_active: true
      }

      const createdItem = await NavigationConfigService.createNavigationItem(newNavigationItem)
      
      // 添加到本地状态
      const newNavItem: DepartmentNavItem = {
        id: `custom-${customDepartmentData.code}`,
        departmentCode: customDepartmentData.code,
        departmentName: customDepartmentData.name,
        hasNavigation: true,
        navigationId: createdItem.id,
        isCustom: true
      }

      setDepartmentNavItems(prev => [...prev, newNavItem])
      setIsCustomDepartmentDialogOpen(false)
      resetCustomDepartmentData()
      
      // 通知父组件刷新导航数据
      if (onNavigationChange) {
        onNavigationChange()
      }
      
      // 触发全局导航刷新
      triggerRefresh()
      
      toast.success(`已为 ${customDepartmentData.name} 创建导航项`)
    } catch (error: any) {
      console.error('创建自定义部门导航失败:', error)
      toast.error(`创建失败: ${error.message || '未知错误'}`)
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-600">加载部门数据中...</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Building className="h-5 w-5" />
              <span>部门需求导航管理</span>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsCustomDepartmentDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              自定义部门
            </Button>
          </CardTitle>
          <CardDescription>
            为不同部门创建专属的需求管理页面导航项，支持自定义部门
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {departmentNavItems.length === 0 ? (
              <div className="text-center py-8">
                <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">暂无部门数据</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {departmentNavItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center space-x-3">
                      <Building className="h-5 w-5 text-gray-600" />
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium">{item.departmentName}</h4>
                          {item.isCustom && (
                            <Badge variant="outline" className="text-xs">
                              自定义
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          路径: /dashboard/requirements/{item.departmentCode}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {item.hasNavigation ? (
                        <>
                          <Badge className="bg-green-100 text-green-800">
                            <Check className="w-3 h-3 mr-1" />
                            已创建
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveNavigation(item.departmentCode, item.navigationId!)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="w-4 h-4 mr-1" />
                            删除
                          </Button>
                        </>
                      ) : (
                        <>
                          <Badge variant="outline" className="text-gray-600">
                            未创建
                          </Badge>
                          <Button
                            size="sm"
                            onClick={() => {
                              const dept = departments.find(d => d.code === item.departmentCode)
                              if (dept) openCreateDialog(dept)
                            }}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            创建导航
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 创建导航对话框 */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>创建部门导航</DialogTitle>
            <DialogDescription>
              为 {selectedDepartment?.name} 创建需求管理导航项
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>导航路径</Label>
              <Input
                value={`/dashboard/requirements/${selectedDepartment?.code || ''}`}
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-gray-500">
                系统将自动生成路径，无需修改
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="useCustomName"
                  checked={formData.useCustomName}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, useCustomName: checked as boolean }))
                  }
                />
                <Label htmlFor="useCustomName" className="text-sm">
                  自定义导航名称
                </Label>
              </div>

              {formData.useCustomName && (
                <div className="space-y-2">
                  <Label htmlFor="customName">导航名称</Label>
                  <Input
                    id="customName"
                    value={formData.customName}
                    onChange={(e) => setFormData(prev => ({ ...prev, customName: e.target.value }))}
                    placeholder={`${selectedDepartment?.name}需求`}
                  />
                </div>
              )}

              {!formData.useCustomName && (
                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                  默认名称: {selectedDepartment?.name}需求
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="addToRequirementsMenu"
                  checked={formData.addToRequirementsMenu}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, addToRequirementsMenu: checked as boolean }))
                  }
                />
                <Label htmlFor="addToRequirementsMenu" className="text-sm">
                  添加到"需求管理"菜单下
                </Label>
              </div>
              <p className="text-xs text-gray-500">
                {formData.addToRequirementsMenu 
                  ? '将作为需求管理的子菜单项显示' 
                  : '将作为顶级菜单项显示'
                }
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateNavigation} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  创建中...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  创建导航
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 自定义部门对话框 */}
      <Dialog open={isCustomDepartmentDialogOpen} onOpenChange={setIsCustomDepartmentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>创建自定义部门导航</DialogTitle>
            <DialogDescription>
              创建一个自定义部门的需求管理导航项
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deptName">部门名称</Label>
              <Input
                id="deptName"
                value={customDepartmentData.name}
                onChange={(e) => setCustomDepartmentData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="例如：产品部"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deptCode">部门代码</Label>
              <Input
                id="deptCode"
                value={customDepartmentData.code}
                onChange={(e) => setCustomDepartmentData(prev => ({ ...prev, code: e.target.value.toLowerCase() }))}
                placeholder="例如：product"
              />
              <p className="text-xs text-gray-500">
                部门代码将用于生成URL路径，建议使用英文小写字母
              </p>
            </div>

            <div className="space-y-2">
              <Label>预览路径</Label>
              <Input
                value={`/dashboard/requirements/${customDepartmentData.code || '{code}'}`}
                disabled
                className="bg-gray-50"
              />
            </div>

            <div className="space-y-2">
              <Label>导航名称预览</Label>
              <Input
                value={`${customDepartmentData.name || '{部门名称}'}需求`}
                disabled
                className="bg-gray-50"
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsCustomDepartmentDialogOpen(false)
                resetCustomDepartmentData()
              }}
            >
              取消
            </Button>
            <Button 
              onClick={handleCreateCustomDepartment} 
              disabled={loading || !customDepartmentData.name || !customDepartmentData.code}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  创建中...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  创建导航
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}