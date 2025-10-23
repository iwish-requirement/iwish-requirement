'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { 
  Settings, 
  Shield, 
  Layout, 
  Workflow, 
  Database,
  Users,
  FileText,
  Navigation,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react'
import { PermissionConfigService, FormDesignerService, NavigationConfigService, WorkflowConfigService } from '@/services/config'
import { PermissionDialog } from '@/components/PermissionDialog'
import type { PermissionSchema, FieldTypeSchema, WorkflowSchema, NavigationConfigExtended } from '@/types'

// 配置分类定义
const CONFIG_CATEGORIES = [
  {
    key: 'permissions',
    name: '权限配置',
    description: '管理系统权限和角色',
    icon: Shield,
    component: 'PermissionManager'
  },
  {
    key: 'forms',
    name: '表单设计',
    description: '设计和配置动态表单',
    icon: FileText,
    component: 'FormDesigner'
  },
  {
    key: 'navigation',
    name: '导航配置',
    description: '配置系统导航菜单',
    icon: Navigation,
    component: 'NavigationDesigner'
  },
  {
    key: 'workflows',
    name: '工作流配置',
    description: '设计业务流程',
    icon: Workflow,
    component: 'WorkflowDesigner'
  },
  {
    key: 'system',
    name: '系统配置',
    description: '系统参数和设置',
    icon: Settings,
    component: 'SystemConfig'
  }
]

export default function AdminConfigPage() {
  const [activeTab, setActiveTab] = useState('permissions')
  const [permissions, setPermissions] = useState<PermissionSchema[]>([])
  const [workflows, setWorkflows] = useState<WorkflowSchema[]>([])
  const [navigation, setNavigation] = useState<NavigationConfigExtended[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadConfigData()
  }, [])

  const loadConfigData = async () => {
    try {
      setLoading(true)
      const [permissionsData, workflowsData, navigationData] = await Promise.all([
        PermissionConfigService.getPermissionSchemas(),
        WorkflowConfigService.getWorkflowSchemas(),
        NavigationConfigService.getNavigationConfigs()
      ])
      
      setPermissions(permissionsData)
      setWorkflows(workflowsData)
      setNavigation(navigationData)
    } catch (error) {
      console.error('Failed to load config data:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">系统配置中心</h1>
          <p className="text-muted-foreground mt-2">
            超级管理员配置界面 - 自定义权限、表单、导航和工作流
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            配置驱动架构
          </Badge>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            实时生效
          </Badge>
        </div>
      </div>

      {/* 配置概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {CONFIG_CATEGORIES.map((category) => {
          const Icon = category.icon
          let count = 0
          
          switch (category.key) {
            case 'permissions':
              count = permissions.length
              break
            case 'workflows':
              count = workflows.length
              break
            case 'navigation':
              count = navigation.length
              break
            default:
              count = 0
          }

          return (
            <Card 
              key={category.key} 
              className={`cursor-pointer transition-all hover:shadow-md ${
                activeTab === category.key ? 'ring-2 ring-blue-500 bg-blue-50' : ''
              }`}
              onClick={() => setActiveTab(category.key)}
            >
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${
                    activeTab === category.key ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <Icon className={`h-5 w-5 ${
                      activeTab === category.key ? 'text-blue-600' : 'text-gray-600'
                    }`} />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{category.name}</p>
                    <p className="text-2xl font-bold">{count}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 配置管理界面 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          {CONFIG_CATEGORIES.map((category) => {
            const Icon = category.icon
            return (
              <TabsTrigger key={category.key} value={category.key} className="flex items-center space-x-2">
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{category.name}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        {/* 权限配置 */}
        <TabsContent value="permissions" className="space-y-4">
          <PermissionManager 
            permissions={permissions} 
            onUpdate={loadConfigData}
          />
        </TabsContent>

        {/* 表单设计 */}
        <TabsContent value="forms" className="space-y-4">
          <FormDesigner onUpdate={loadConfigData} />
        </TabsContent>

        {/* 导航配置 */}
        <TabsContent value="navigation" className="space-y-4">
          <NavigationDesigner 
            navigation={navigation}
            onUpdate={loadConfigData}
          />
        </TabsContent>

        {/* 工作流配置 */}
        <TabsContent value="workflows" className="space-y-4">
          <WorkflowDesigner 
            workflows={workflows}
            onUpdate={loadConfigData}
          />
        </TabsContent>

        {/* 系统配置 */}
        <TabsContent value="system" className="space-y-4">
          <SystemConfig onUpdate={loadConfigData} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// =====================================================
// 权限管理组件
// =====================================================

function PermissionManager({ 
  permissions, 
  onUpdate 
}: { 
  permissions: PermissionSchema[]
  onUpdate: () => void 
}) {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingPermission, setEditingPermission] = useState<PermissionSchema | null>(null)

  const handleTogglePermission = async (id: string, is_active: boolean) => {
    try {
      await PermissionConfigService.togglePermissions([id], is_active)
      onUpdate()
    } catch (error) {
      console.error('Failed to toggle permission:', error)
    }
  }

  const handleDeletePermission = async (id: string) => {
    if (!confirm('确定要删除这个权限吗？')) return
    
    try {
      await PermissionConfigService.deletePermission(id)
      onUpdate()
    } catch (error) {
      console.error('Failed to delete permission:', error)
    }
  }

  // 按分类分组权限
  const permissionsByCategory = permissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = []
    }
    acc[permission.category].push(permission)
    return acc
  }, {} as Record<string, PermissionSchema[]>)

  return (
    <div className="space-y-6">
      {/* 操作栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">权限配置管理</h2>
          <p className="text-muted-foreground">
            创建和管理自定义权限，支持基于资源和操作的细粒度控制
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          创建权限
        </Button>
      </div>

      {/* 权限列表 */}
      <div className="space-y-6">
        {Object.entries(permissionsByCategory).map(([category, categoryPermissions]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{category} 权限</span>
                <Badge variant="secondary">
                  {categoryPermissions.length} 个权限
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {categoryPermissions.map((permission) => (
                  <div 
                    key={permission.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">
                          {permission.code}
                        </code>
                        <span className="font-medium">{permission.name}</span>
                        {permission.is_system && (
                          <Badge variant="outline" className="text-xs">系统</Badge>
                        )}
                        {!permission.is_active && (
                          <Badge variant="secondary" className="text-xs">已禁用</Badge>
                        )}
                      </div>
                      {permission.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {permission.description}
                        </p>
                      )}
                      <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                        <span>资源: {permission.resource}</span>
                        <span>操作: {permission.action}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTogglePermission(permission.id, !permission.is_active)}
                      >
                        {permission.is_active ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingPermission(permission)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      
                      {!permission.is_system && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePermission(permission.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 创建/编辑权限对话框 */}
      {(showCreateDialog || editingPermission) && (
        <PermissionDialog
          permission={editingPermission}
          onClose={() => {
            setShowCreateDialog(false)
            setEditingPermission(null)
          }}
          onSave={() => {
            setShowCreateDialog(false)
            setEditingPermission(null)
            onUpdate()
          }}
        />
      )}
    </div>
  )
}

// 其他组件的占位符实现
function FormDesigner({ onUpdate }: { onUpdate: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>表单设计器</CardTitle>
        <CardDescription>拖拽式表单构建工具</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">表单设计器组件开发中...</p>
      </CardContent>
    </Card>
  )
}

function NavigationDesigner({ navigation, onUpdate }: { navigation: NavigationConfigExtended[], onUpdate: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>导航设计器</CardTitle>
        <CardDescription>配置系统导航菜单结构</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">导航设计器组件开发中...</p>
      </CardContent>
    </Card>
  )
}

function WorkflowDesigner({ workflows, onUpdate }: { workflows: WorkflowSchema[], onUpdate: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>工作流设计器</CardTitle>
        <CardDescription>设计业务流程和审批流程</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">工作流设计器组件开发中...</p>
      </CardContent>
    </Card>
  )
}

function SystemConfig({ onUpdate }: { onUpdate: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>系统配置</CardTitle>
        <CardDescription>管理系统参数和全局设置</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">系统配置组件开发中...</p>
      </CardContent>
    </Card>
  )
}

