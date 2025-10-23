'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { X, Save, AlertCircle } from 'lucide-react'
import { PermissionConfigService } from '@/services/config'
import type { PermissionSchema } from '@/types'

interface PermissionDialogProps {
  permission: PermissionSchema | null
  onClose: () => void
  onSave: () => void
}

export function PermissionDialog({ permission, onClose, onSave }: PermissionDialogProps) {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    category: '',
    resource: '',
    action: '',
    conditions: '{}',
    is_active: true
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // 预定义的资源类型和操作类型
  const RESOURCES = ['user', 'requirement', 'form', 'system', 'navigation', 'workflow', 'report']
  const ACTIONS = ['create', 'read', 'update', 'delete', 'manage', 'assign', 'approve', 'export']
  const CATEGORIES = ['user', 'requirement', 'form', 'system', 'workflow', 'report']

  useEffect(() => {
    if (permission) {
      setFormData({
        code: permission.code,
        name: permission.name,
        description: permission.description || '',
        category: permission.category,
        resource: permission.resource,
        action: permission.action,
        conditions: JSON.stringify(permission.conditions, null, 2),
        is_active: permission.is_active
      })
    }
  }, [permission])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.code.trim()) {
      newErrors.code = '权限代码不能为空'
    } else if (!/^[a-z_]+\.[a-z_]+$/.test(formData.code)) {
      newErrors.code = '权限代码格式应为：resource.action（如：user.create）'
    }

    if (!formData.name.trim()) {
      newErrors.name = '权限名称不能为空'
    }

    if (!formData.category.trim()) {
      newErrors.category = '权限分类不能为空'
    }

    if (!formData.resource.trim()) {
      newErrors.resource = '资源类型不能为空'
    }

    if (!formData.action.trim()) {
      newErrors.action = '操作类型不能为空'
    }

    try {
      JSON.parse(formData.conditions)
    } catch (e) {
      newErrors.conditions = '条件配置必须是有效的JSON格式'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return

    try {
      setLoading(true)
      
      const permissionData = {
        code: formData.code,
        name: formData.name,
        description: formData.description,
        category: formData.category,
        resource: formData.resource,
        action: formData.action,
        conditions: JSON.parse(formData.conditions),
        is_active: formData.is_active,
        is_system: false
      }

      if (permission) {
        await PermissionConfigService.updatePermission(permission.id, permissionData)
      } else {
        await PermissionConfigService.createPermission(permissionData)
      }

      onSave()
    } catch (error) {
      console.error('Failed to save permission:', error)
      setErrors({ general: '保存失败，请重试' })
    } finally {
      setLoading(false)
    }
  }

  const generateCode = () => {
    if (formData.resource && formData.action) {
      setFormData(prev => ({
        ...prev,
        code: `${prev.resource}.${prev.action}`
      }))
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>{permission ? '编辑权限' : '创建权限'}</CardTitle>
            <CardDescription>
              {permission ? '修改现有权限配置' : '创建新的自定义权限'}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          {errors.general && (
            <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{errors.general}</span>
            </div>
          )}

          {/* 基础信息 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="resource">资源类型 *</Label>
              <select
                id="resource"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.resource}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, resource: e.target.value }))
                  setTimeout(generateCode, 100)
                }}
              >
                <option value="">选择资源类型</option>
                {RESOURCES.map(resource => (
                  <option key={resource} value={resource}>{resource}</option>
                ))}
              </select>
              {errors.resource && (
                <p className="text-sm text-red-600">{errors.resource}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="action">操作类型 *</Label>
              <select
                id="action"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.action}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, action: e.target.value }))
                  setTimeout(generateCode, 100)
                }}
              >
                <option value="">选择操作类型</option>
                {ACTIONS.map(action => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
              {errors.action && (
                <p className="text-sm text-red-600">{errors.action}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">权限代码 *</Label>
            <div className="flex space-x-2">
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                placeholder="如：user.create"
                className={errors.code ? 'border-red-500' : ''}
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={generateCode}
                disabled={!formData.resource || !formData.action}
              >
                生成
              </Button>
            </div>
            {errors.code && (
              <p className="text-sm text-red-600">{errors.code}</p>
            )}
            <p className="text-xs text-gray-500">
              权限代码格式：资源.操作（如：user.create, requirement.read）
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">权限名称 *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="如：创建用户"
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && (
              <p className="text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">权限分类 *</Label>
            <select
              id="category"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
            >
              <option value="">选择分类</option>
              {CATEGORIES.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            {errors.category && (
              <p className="text-sm text-red-600">{errors.category}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">权限描述</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="描述这个权限的作用和使用场景"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="conditions">条件配置 (JSON)</Label>
            <Textarea
              id="conditions"
              value={formData.conditions}
              onChange={(e) => setFormData(prev => ({ ...prev, conditions: e.target.value }))}
              placeholder='{"department": "specific", "level": "manager"}'
              rows={4}
              className={`font-mono text-sm ${errors.conditions ? 'border-red-500' : ''}`}
            />
            {errors.conditions && (
              <p className="text-sm text-red-600">{errors.conditions}</p>
            )}
            <p className="text-xs text-gray-500">
              可选的权限条件配置，用于实现更细粒度的权限控制
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
              className="rounded border-gray-300"
            />
            <Label htmlFor="is_active">启用权限</Label>
          </div>

          {/* 权限预览 */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">权限预览</h4>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">代码: {formData.code || '未设置'}</Badge>
              <Badge variant="outline">资源: {formData.resource || '未设置'}</Badge>
              <Badge variant="outline">操作: {formData.action || '未设置'}</Badge>
              <Badge variant="outline">分类: {formData.category || '未设置'}</Badge>
              <Badge variant={formData.is_active ? 'default' : 'secondary'}>
                {formData.is_active ? '已启用' : '已禁用'}
              </Badge>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  保存中...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {permission ? '更新权限' : '创建权限'}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}