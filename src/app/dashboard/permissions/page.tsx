'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Shield, Users, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { usePermissions, PermissionGuard } from '@/hooks/usePermissions'
import { DynamicPermissionService } from '@/services/dynamicPermission'
import { toast } from 'sonner'
import type { Permission, CreatePermissionInput } from '@/types'

const dynamicPermissionService = new DynamicPermissionService()

export default function PermissionsPage() {
  const { hasPermission } = usePermissions()
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null)

  // 表单状态
  const [formData, setFormData] = useState<CreatePermissionInput>({
    code: '',
    name: '',
    description: '',
    category: '',
    display_name: '',
    icon: '',
    color: '',
    is_system: false,
    parent_id: undefined,
    sort_order: 0
  })

  // 权限分类
  const categories = [
    { value: 'requirement', label: '需求管理', icon: '📋' },
    { value: 'user', label: '用户管理', icon: '👥' },
    { value: 'system', label: '系统管理', icon: '⚙️' },
    { value: 'analytics', label: '数据分析', icon: '📊' },
    { value: 'comment', label: '评论管理', icon: '💬' },
    { value: 'rating', label: '评分系统', icon: '⭐' },
    { value: 'form', label: '表单配置', icon: '📝' },
    { value: 'navigation', label: '导航配置', icon: '🧭' },
    { value: 'custom', label: '自定义', icon: '🔧' }
  ]

  // 加载权限列表
  const loadPermissions = async () => {
    try {
      setLoading(true)
      const data = await dynamicPermissionService.getAllPermissions()
      setPermissions(data)
    } catch (error) {
      console.error('加载权限失败:', error)
      toast.error('加载权限列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPermissions()
  }, [])

  // 过滤权限
  const filteredPermissions = permissions.filter(permission => {
    const matchesSearch = permission.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         permission.code.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || permission.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  // 创建权限
  const handleCreatePermission = async () => {
    try {
      if (!formData.code || !formData.name || !formData.category) {
        toast.error('请填写必填字段')
        return
      }

      await dynamicPermissionService.createPermission(formData)
      toast.success('权限创建成功')
      setIsCreateDialogOpen(false)
      resetForm()
      loadPermissions()
    } catch (error) {
      console.error('创建权限失败:', error)
      toast.error('创建权限失败')
    }
  }

  // 更新权限
  const handleUpdatePermission = async () => {
    try {
      if (!editingPermission || !formData.code || !formData.name || !formData.category) {
        toast.error('请填写必填字段')
        return
      }

      await dynamicPermissionService.updatePermission(editingPermission.id, formData)
      toast.success('权限更新成功')
      setIsEditDialogOpen(false)
      setEditingPermission(null)
      resetForm()
      loadPermissions()
    } catch (error) {
      console.error('更新权限失败:', error)
      toast.error('更新权限失败')
    }
  }

  // 删除权限
  const handleDeletePermission = async (permission: Permission) => {
    if (permission.is_system) {
      toast.error('系统权限不能删除')
      return
    }

    if (!confirm(`确定要删除权限 "${permission.name}" 吗？`)) {
      return
    }

    try {
      await dynamicPermissionService.deletePermission(permission.id)
      toast.success('权限删除成功')
      loadPermissions()
    } catch (error) {
      console.error('删除权限失败:', error)
      toast.error('删除权限失败')
    }
  }

  // 重置表单
  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      category: '',
      display_name: '',
      icon: '',
      color: '',
      is_system: false,
      parent_id: undefined,
      sort_order: 0
    })
  }

  // 编辑权限
  const handleEditPermission = (permission: Permission) => {
    setEditingPermission(permission)
    setFormData({
      code: permission.code,
      name: permission.name,
      description: permission.description || '',
      category: permission.category,
      display_name: permission.display_name || '',
      icon: permission.icon || '',
      color: permission.color || '',
      is_system: permission.is_system,
      parent_id: permission.parent_id,
      sort_order: permission.sort_order
    })
    setIsEditDialogOpen(true)
  }

  // 获取分类图标
  const getCategoryIcon = (category: string) => {
    const cat = categories.find(c => c.value === category)
    return cat?.icon || '🔧'
  }

  // 获取分类标签
  const getCategoryLabel = (category: string) => {
    const cat = categories.find(c => c.value === category)
    return cat?.label || category
  }

  return (
    <PermissionGuard permission="permission.manage" fallback={
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">权限不足</h3>
          <p className="mt-1 text-sm text-gray-500">您没有权限访问权限管理页面</p>
        </div>
      </div>
    }>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">权限管理</h1>
            <p className="text-gray-600">管理系统权限和自定义权限</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                创建权限
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>创建新权限</DialogTitle>
                <DialogDescription>
                  创建一个新的自定义权限
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="code">权限代码 *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="例如: custom.feature"
                  />
                </div>
                <div>
                  <Label htmlFor="name">权限名称 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="例如: 自定义功能"
                  />
                </div>
                <div>
                  <Label htmlFor="category">权限分类 *</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择分类" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(category => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.icon} {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="description">权限描述</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="描述这个权限的作用"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleCreatePermission}>
                  创建权限
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* 搜索和筛选 */}
        <div className="flex space-x-4">
          <div className="flex-1">
            <Input
              placeholder="搜索权限..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有分类</SelectItem>
              {categories.map(category => (
                <SelectItem key={category.value} value={category.value}>
                  {category.icon} {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 权限列表 */}
        <div className="grid gap-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">加载中...</p>
            </div>
          ) : filteredPermissions.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">没有找到权限</h3>
              <p className="mt-1 text-sm text-gray-500">尝试调整搜索条件或创建新权限</p>
            </div>
          ) : (
            filteredPermissions.map(permission => (
              <Card key={permission.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">
                        {getCategoryIcon(permission.category)}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium">{permission.name}</h3>
                          <Badge variant={permission.is_system ? "default" : "secondary"}>
                            {permission.is_system ? "系统" : "自定义"}
                          </Badge>
                          <Badge variant="outline">
                            {getCategoryLabel(permission.category)}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          代码: <code className="bg-gray-100 px-1 rounded">{permission.code}</code>
                        </p>
                        {permission.description && (
                          <p className="text-sm text-gray-500 mt-1">{permission.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditPermission(permission)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {!permission.is_system && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeletePermission(permission)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* 编辑权限对话框 */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>编辑权限</DialogTitle>
              <DialogDescription>
                修改权限信息
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-code">权限代码 *</Label>
                <Input
                  id="edit-code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  disabled={editingPermission?.is_system}
                />
              </div>
              <div>
                <Label htmlFor="edit-name">权限名称 *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-category">权限分类 *</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                  disabled={editingPermission?.is_system}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.icon} {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-description">权限描述</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleUpdatePermission}>
                更新权限
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  )
}