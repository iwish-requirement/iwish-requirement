'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Settings, Users, Shield, BarChart3, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { PermissionTree } from './permission-tree'
import { dynamicPermissionService } from '@/services/dynamicPermission'
import type { Permission, Role, PageConfig } from '@/types'

// 临时模拟数据，避免加载错误
const mockPermissions: Permission[] = [
  {
    id: '1',
    name: '系统管理',
    code: 'system',
    display_name: '系统管理',
    description: '系统级别管理权限',
    category: 'system',
    icon: 'Settings',
    color: '#6366f1',
    is_system: true,
    sort_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    children: []
  }
]

const mockRoles: Role[] = [
  {
    id: '1',
    name: 'super_admin',
    description: '超级管理员',
    permissions: [],
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
]

export const DynamicPermissionManager: React.FC = () => {
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [pageConfigs, setPageConfigs] = useState<PageConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('permissions')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // 暂时使用模拟数据，避免数据库连接问题
      setTimeout(() => {
        setPermissions(mockPermissions)
        setRoles(mockRoles)
        setPageConfigs([])
        setLoading(false)
      }, 1000)

      // TODO: 恢复真实数据加载
      // const [permissionsData, rolesData, pageConfigsData, ratingDimensionsData] = await Promise.all([
      //   dynamicPermissionService.getAllPermissions(),
      //   dynamicPermissionService.getRoles({ limit: 100 }),
      //   dynamicPermissionService.getPageConfigs(),
      //   dynamicPermissionService.getRatingDimensions({ is_active: true })
      // ])

      // setPermissions(permissionsData)
      // setRoles(rolesData.data)
      // setPageConfigs(pageConfigsData)
      // setRatingDimensions(ratingDimensionsData)
    } catch (error) {
      console.error('加载数据失败:', error)
      setLoading(false)
    }
  }

  const handleCreatePermission = (parentId?: string) => {
    // TODO: 打开创建权限对话框
    console.log('创建权限', parentId)
  }

  const handleEditPermission = (permission: Permission) => {
    // TODO: 打开编辑权限对话框
    console.log('编辑权限', permission)
  }

  const handleDeletePermission = async (permission: Permission) => {
    if (confirm(`确定要删除权限 "${permission.display_name}" 吗？`)) {
      try {
        await dynamicPermissionService.deletePermission(permission.id)
        await loadData()
      } catch (error) {
        console.error('删除权限失败:', error)
        alert('删除权限失败')
      }
    }
  }

  const getPermissionStats = () => {
    const flatPermissions = permissions.reduce((acc: Permission[], perm) => {
      acc.push(perm)
      if (perm.children) {
        acc.push(...perm.children)
      }
      return acc
    }, [])

    const systemPermissions = flatPermissions.filter(p => p.is_system).length
    const customPermissions = flatPermissions.filter(p => !p.is_system).length
    const categories = new Set(flatPermissions.map(p => p.category)).size

    return {
      total: flatPermissions.length,
      system: systemPermissions,
      custom: customPermissions,
      categories
    }
  }

  const getRoleStats = () => {
    const activeRoles = roles.filter(r => r.is_active).length
    const inactiveRoles = roles.filter(r => !r.is_active).length

    return {
      total: roles.length,
      active: activeRoles,
      inactive: inactiveRoles
    }
  }

  const stats = getPermissionStats()
  const roleStats = getRoleStats()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总权限数</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              系统: {stats.system} | 自定义: {stats.custom}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">角色数量</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roleStats.total}</div>
            <p className="text-xs text-muted-foreground">
              活跃: {roleStats.active} | 停用: {roleStats.inactive}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">页面配置</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pageConfigs.length}</div>
            <p className="text-xs text-muted-foreground">
              动态页面配置数量
            </p>
          </CardContent>
        </Card>


      </div>

      {/* 主要内容 */}
      <Card>
        <CardHeader>
          <CardTitle>动态权限系统管理</CardTitle>
          <CardDescription>
            管理系统权限、角色、页面配置
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="permissions">权限管理</TabsTrigger>
              <TabsTrigger value="roles">角色管理</TabsTrigger>
              <TabsTrigger value="pages">页面配置</TabsTrigger>
            </TabsList>

            <TabsContent value="permissions" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">权限树</h3>
                <Button onClick={() => handleCreatePermission()}>
                  <Plus className="h-4 w-4 mr-2" />
                  创建权限
                </Button>
              </div>
              
              <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
                <PermissionTree
                  permissions={permissions}
                  showActions={true}
                  onCreatePermission={handleCreatePermission}
                  onEditPermission={handleEditPermission}
                  onDeletePermission={handleDeletePermission}
                />
              </div>
            </TabsContent>

            <TabsContent value="roles" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">角色列表</h3>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  创建角色
                </Button>
              </div>

              <div className="grid gap-4">
                {roles.map((role) => (
                  <Card key={role.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base">{role.name}</CardTitle>
                          <CardDescription>{role.description}</CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant={role.is_active ? "default" : "secondary"}>
                            {role.is_active ? "活跃" : "停用"}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.slice(0, 5).map((permission) => (
                          <Badge key={permission.id} variant="outline" className="text-xs">
                            {permission.display_name}
                          </Badge>
                        ))}
                        {role.permissions.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{role.permissions.length - 5} 更多
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="pages" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">页面配置</h3>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  创建页面
                </Button>
              </div>

              <div className="grid gap-4">
                {pageConfigs.map((config) => (
                  <Card key={config.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base">{config.name}</CardTitle>
                          <CardDescription>{config.path}</CardDescription>
                        </div>
                        <Badge variant={config.is_active ? "default" : "secondary"}>
                          {config.is_active ? "活跃" : "停用"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1">
                        {config.required_permissions.map((permission) => (
                          <Badge key={permission} variant="outline" className="text-xs">
                            {permission}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>


          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}