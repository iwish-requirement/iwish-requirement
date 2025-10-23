'use client'

import { useState, useEffect, useMemo, useCallback, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { PermissionTree } from '@/components/ui/permission-tree'
import { Plus, Edit, Trash2, Users, Shield, Settings, Save, Eye, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { roleService } from '@/services/roleService'
import { usePermissions } from '@/hooks/usePermissions'
import type { Role, Permission, DynamicPermission } from '@/types'

interface RoleWithPermissions extends Omit<Role, 'permissions'> {
  permissions: DynamicPermission[]
  userCount?: number
}

export default function RolesPage() {
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  
  // 页面级权限检查
  if (!permissionsLoading && !hasPermission('permission.manage')) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Shield className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">访问被拒绝</h2>
          <p className="text-gray-600">您没有权限访问角色权限管理页面</p>
        </div>
      </div>
    )
  }

  const [roles, setRoles] = useState<RoleWithPermissions[]>([])
  const [permissions, setPermissions] = useState<DynamicPermission[]>([])
  const [permissionTree, setPermissionTree] = useState<DynamicPermission[]>([])
  const [selectedRole, setSelectedRole] = useState<RoleWithPermissions | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[]
  })
  // Shopify 风格增强：权限搜索与分组折叠
  const [permSearch, setPermSearch] = useState('')
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({})
  // 过滤后的权限树（按搜索关键字，useMemo 缓存）
  const filteredPermissionTree = useMemo(() => {
    const q = (permSearch || '').trim().toLowerCase()
    const match = (n: any): boolean => {
      const text = ((n?.name || n?.display_name || n?.code || '') as string).toLowerCase()
      return q === '' || text.includes(q)
    }
    const filterNode = (n: any): any | null => {
      if (!n) return null
      const hasChildren = Array.isArray(n?.children)
      if (hasChildren) {
        const children = n.children.map(filterNode).filter(Boolean)
        return (children.length > 0 || match(n)) ? { ...n, children } : null
      }
      return match(n) ? n : null
    }
    return (permissionTree as unknown as any[]).map(filterNode).filter(Boolean)
  }, [permissionTree, permSearch])

  // 只读视图下的选中权限 ID 使用 useMemo 缓存，避免每次渲染都创建新数组导致子树重渲染
  const viewSelectedIds = useMemo(
    () => (selectedRole?.permissions ? selectedRole.permissions.map(p => p.id) : []),
    [selectedRole]
  )

  // 加载数据
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setPageLoading(true)
      const [rolesData, permissionsData, treeData] = await Promise.all([
        roleService.getRoles(),
        roleService.getAllPermissions(),
        roleService.getPermissionTree()
      ])

      // 为每个角色加载权限信息
      const rolesWithPermissions = await Promise.all(
        rolesData.map(async (role) => {
          try {
            const roleWithPerms = await roleService.getRoleWithPermissions(role.id)
            return {
              ...role,
              permissions: roleWithPerms.permissions,
              userCount: 0 // TODO: 从用户表获取实际数量
            }
          } catch (error) {
            console.error(`加载角色 ${role.name} 的权限失败:`, error)
            return {
              ...role,
              permissions: [],
              userCount: 0
            }
          }
        })
      )

      setRoles(rolesWithPermissions)
      setPermissions(permissionsData)
      setPermissionTree(treeData)
    } catch (error) {
      console.error('加载数据失败:', error)
      toast.error('加载数据失败')
    } finally {
      setPageLoading(false)
    }
  }

  const handleCreateRole = async () => {
    if (!formData.name.trim()) {
      toast.error('请输入角色名称')
      return
    }

    // 检查角色名称是否可用
    const isAvailable = await roleService.isRoleNameAvailable(formData.name)
    if (!isAvailable) {
      toast.error('角色名称已存在')
      return
    }

    setLoading(true)
    try {
      const newRole = await roleService.createRole({
        name: formData.name,
        description: formData.description,
        permissionIds: formData.permissions
      })

      // 重新加载数据
      await loadData()
      
      setIsCreateDialogOpen(false)
      resetFormData()
      toast.success('角色创建成功')
    } catch (error) {
      console.error('创建角色失败:', error)
      toast.error('创建失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleEditRole = async () => {
    if (!selectedRole || !formData.name.trim()) {
      toast.error('请输入角色名称')
      return
    }

    // 检查角色名称是否可用（排除当前角色）
    const isAvailable = await roleService.isRoleNameAvailable(formData.name, selectedRole.id)
    if (!isAvailable) {
      toast.error('角色名称已存在')
      return
    }

    setLoading(true)
    try {
      await roleService.updateRole(selectedRole.id, {
        name: formData.name,
        description: formData.description,
        permissionIds: formData.permissions
      })

      // 重新加载数据
      await loadData()
      
      setIsEditDialogOpen(false)
      setSelectedRole(null)
      resetFormData()
      toast.success('角色更新成功')
    } catch (error) {
      console.error('更新角色失败:', error)
      toast.error('更新失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteRole = async (role: RoleWithPermissions) => {
    if (['super_admin', 'admin', 'employee'].includes(role.name)) {
      toast.error('不能删除系统预设角色')
      return
    }

    if (!confirm(`确定要删除角色"${role.name}"吗？`)) return

    setLoading(true)
    try {
      await roleService.deleteRole(role.id)
      await loadData()
      toast.success('角色删除成功')
    } catch (error: any) {
      console.error('删除角色失败:', error)
      toast.error(error.message || '删除失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const resetFormData = () => {
    setFormData({
      name: '',
      description: '',
      permissions: []
    })
  }

  const openCreateDialog = () => {
    resetFormData()
    setIsCreateDialogOpen(true)
  }

  const openEditDialog = (role: RoleWithPermissions) => {
    setSelectedRole(role)
    setFormData({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions.map(p => p.id)
    })
    setIsEditDialogOpen(true)
  }

  const openViewDialog = (role: RoleWithPermissions) => {
    setSelectedRole(role)
    setIsViewDialogOpen(true)
  }

  const handlePermissionChange = useCallback((permissionId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      permissions: checked 
        ? [...prev.permissions, permissionId]
        : prev.permissions.filter(p => p !== permissionId)
    }))
  }, [])

  // 折叠切换（useCallback 缓存，避免每次渲染创建新函数）
  const toggleCollapsed = useCallback((catId: string) => {
    setCollapsedCats(prev => ({ ...prev, [catId]: !prev[catId] }))
  }, [])

  // 英文分组名到中文的显示映射，仅影响展示
  const getCnLabel = (val?: string) => {
    if (!val) return ''
    const map: Record<string, string> = {
      system: '系统',
      user: '用户',
      requirement: '需求',
      form: '表单',
      rating: '评分',
      analytics: '统计',
      navigation: '导航',
      comment: '评论',
      data: '数据'
    }
    return map[val] || val
  }

  // 递归渲染权限树
  const renderPermissionTree = (permissions: DynamicPermission[], level = 0, isReadOnly = false) => {
    return permissions.map(permission => {
      const hasPermission = isReadOnly 
        ? selectedRole?.permissions.some(p => p.id === permission.id) || false
        : formData.permissions.includes(permission.id)
      
      return (
        <div key={permission.id} className={`${level > 0 ? 'ml-6' : ''}`}>
          <div className="flex items-center space-x-2 py-1">
            <Checkbox
              id={permission.id}
              checked={hasPermission}
              onCheckedChange={(checked) => !isReadOnly && handlePermissionChange(permission.id, checked as boolean)}
              disabled={isReadOnly}
            />
            <Label htmlFor={permission.id} className="text-sm flex items-center space-x-2">
              <span>{permission.name}</span>
              {permission.category && (
                <Badge variant="outline" className="text-xs">
                  {permission.category}
                </Badge>
              )}
            </Label>
          </div>
          {permission.description && (
            <div className={`text-xs text-gray-500 ${level > 0 ? 'ml-8' : 'ml-6'}`}>
              {permission.description}
            </div>
          )}
        </div>
      )
    })
  }

  const RoleDialog = ({ isOpen, onOpenChange, title, onSave, isReadOnly = false }: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    onSave?: () => void;
    isReadOnly?: boolean;
  }) => (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isReadOnly ? '查看角色详细信息和权限配置' : '配置角色信息和权限'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">角色名称 *</Label>
              <Input
                id="name"
                value={isReadOnly ? selectedRole?.name || '' : formData.name}
                onChange={(e) => !isReadOnly && setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="输入角色名称"
                disabled={isReadOnly}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">角色描述</Label>
              <Textarea
                id="description"
                value={isReadOnly ? selectedRole?.description || '' : formData.description}
                onChange={(e) => !isReadOnly && setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="输入角色描述"
                rows={3}
                disabled={isReadOnly}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between space-x-2">
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-blue-600" />
                <Label className="text-base font-medium">权限配置（细分）</Label>
              </div>
              {!isReadOnly && (
                <div className="w-64">
                  <Input
                    value={permSearch}
                    onChange={(e) => setPermSearch(e.target.value)}
                    placeholder="搜索权限名称或代码"
                  />
                </div>
              )}
            </div>
            
            <div className="border rounded-lg p-4 max-h-96 overflow-y-auto bg-gray-50">
              {permissionTree.length > 0 ? (
                <div className="space-y-4">
                  {(filteredPermissionTree as unknown as any[]).map((categoryNode: any) => {
                    // 收集该分类下所有权限 ID（用于统计与全选）
                    const collectIds = (node: any): string[] => {
                      if (!node) return []
                      const isCategory = typeof node.id === 'string' && node.id.startsWith('category:')
                      const selfIds = isCategory ? [] : [node.id]
                      const childIds = Array.isArray(node.children)
                        ? node.children.flatMap((c: any) => collectIds(c))
                        : []
                      return [...selfIds, ...childIds]
                    }
                    const allIds: string[] = collectIds(categoryNode)
                    const selectedCount = allIds.filter(id => formData.permissions.includes(id)).length
                    const allSelected = allIds.length > 0 && selectedCount === allIds.length

                    const toggleCategory = (checked: boolean) => {
                      setFormData(prev => {
                        const set = new Set(prev.permissions)
                        if (checked) {
                          allIds.forEach(id => set.add(id))
                        } else {
                          allIds.forEach(id => set.delete(id))
                        }
                        return { ...prev, permissions: Array.from(set) }
                      })
                    }

                    const catId = String(categoryNode.id)
                    const collapsed = !!collapsedCats[catId]
                    const catTitle = getCnLabel(categoryNode.name || categoryNode.display_name || categoryNode.category)

                    return (
                      <div key={categoryNode.id} className="rounded-md border bg-white">
                        {/* 面板标题行 */}
                        <div className="flex items-center justify-between px-3 py-2">
                          <div className="flex items-center space-x-2">
                            {!isReadOnly && (
                              <Checkbox
                                id={`cat-${categoryNode.id}`}
                                checked={allSelected}
                                onCheckedChange={(checked) => toggleCategory(!!checked)}
                              />
                            )}
                            <Label htmlFor={`cat-${categoryNode.id}`} className="text-sm font-medium">
                              {catTitle}
                              <span className="ml-2 text-xs text-gray-500">
                                ({selectedCount}/{allIds.length})
                              </span>
                            </Label>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleCollapsed(catId)}>
                            {collapsed ? '展开' : '收起'}
                          </Button>
                        </div>

                        {/* 面板内容：仅渲染该分类的 children */}
                        <div className={`px-3 pb-3 ${collapsed ? 'hidden' : ''}`}>
                          {Array.isArray(categoryNode.children) && categoryNode.children.length > 0 && (
                            <PermissionTree
                              permissions={categoryNode.children as unknown as any[]}
                              selectedPermissions={isReadOnly ? viewSelectedIds : formData.permissions}
                              onPermissionToggle={isReadOnly ? undefined : handlePermissionChange}
                              showActions={false}
                              showCheckboxes={!isReadOnly}
                            />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>暂无权限数据</p>
                </div>
              ) }
            </div>
            
            {!isReadOnly && (
              <div className="text-sm text-gray-600">
                已选择 {formData.permissions.length} 项
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isReadOnly ? '关闭' : '取消'}
          </Button>
          {!isReadOnly && onSave && (
            <Button onClick={onSave} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  保存
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">加载角色数据中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            动态角色权限管理
          </h1>
          <p className="text-muted-foreground mt-2">
            管理系统角色和动态权限分配，支持自定义权限配置
          </p>
        </div>
        <Button 
          onClick={openCreateDialog}
          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
        >
          <Plus className="mr-2 h-4 w-4" />
          新建角色
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">总角色数</p>
                <p className="text-2xl font-bold">{roles.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">总权限数</p>
                <p className="text-2xl font-bold">{permissions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Settings className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">系统角色</p>
                <p className="text-2xl font-bold">
                  {roles.filter(r => ['super_admin', 'admin', 'employee'].includes(r.name)).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Plus className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">自定义角色</p>
                <p className="text-2xl font-bold">
                  {roles.filter(r => !['super_admin', 'admin', 'employee'].includes(r.name)).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 角色列表 */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {roles.map((role) => (
          <Card key={role.id} className="relative border shadow-sm hover:shadow-md transition-all duration-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-500" />
                  <CardTitle className="text-lg font-semibold">{role.name}</CardTitle>
                  {['super_admin', 'admin', 'employee'].includes(role.name) && (
                    <Badge variant="secondary" className="text-xs">系统</Badge>
                  )}
                </div>
                <div className="flex space-x-1">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => openViewDialog(role)}
                    className="hover:bg-green-50 hover:text-green-600"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => openEditDialog(role)}
                    className="hover:bg-blue-50 hover:text-blue-600"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  {!['super_admin', 'admin', 'employee'].includes(role.name) && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDeleteRole(role)}
                      className="hover:bg-red-50 hover:text-red-600"
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <CardDescription className="text-sm">{role.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center space-x-2 mb-3">
                  <Shield className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium">权限列表 ({role.permissions.length})</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {role.permissions.slice(0, 4).map((permission) => (
                    <Badge key={permission.id} variant="secondary" className="text-xs">
                      {permission.name}
                    </Badge>
                  ))}
                  {role.permissions.length > 4 && (
                    <Badge variant="outline" className="text-xs">
                      +{role.permissions.length - 4}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 对话框 */}
      <RoleDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        title="创建新角色"
        onSave={handleCreateRole}
      />

      <RoleDialog
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        title="编辑角色"
        onSave={handleEditRole}
      />

      <RoleDialog
        isOpen={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
        title="查看角色详情"
        isReadOnly={true}
      />
    </div>
  )
}