'use client'

import React, { useState, memo } from 'react'
import { ChevronDown, ChevronRight, Shield, ShieldCheck, Plus, Edit, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import type { Permission } from '@/types'

interface PermissionTreeProps {
  permissions: Permission[]
  selectedPermissions?: string[]
  onPermissionToggle?: (permissionId: string, checked: boolean) => void
  onCreatePermission?: (parentId?: string) => void
  onEditPermission?: (permission: Permission) => void
  onDeletePermission?: (permission: Permission) => void
  showActions?: boolean
  showCheckboxes?: boolean
  className?: string
  // 外部折叠控制：key 为节点 id，true 表示折叠
  collapsedMap?: Record<string, boolean>
}

interface PermissionNodeProps {
  permission: Permission
  level: number
  selectedPermissions?: string[]
  onPermissionToggle?: (permissionId: string, checked: boolean) => void
  onCreatePermission?: (parentId?: string) => void
  onEditPermission?: (permission: Permission) => void
  onDeletePermission?: (permission: Permission) => void
  showActions?: boolean
  showCheckboxes?: boolean
  // 外部折叠控制
  collapsedMap?: Record<string, boolean>
}

const PermissionNode: React.FC<PermissionNodeProps> = ({
  permission,
  level,
  selectedPermissions = [],
  onPermissionToggle,
  onCreatePermission,
  onEditPermission,
  onDeletePermission,
  showActions = false,
  showCheckboxes = false,
  collapsedMap
}) => {
  // 根据外部折叠控制初始化与同步
  const [isExpanded, setIsExpanded] = useState(() => !(collapsedMap?.[permission.id] ?? false))
  const hasChildren = permission.children && permission.children.length > 0
  const isSelected = selectedPermissions.includes(permission.id)

  const handleToggle = () => {
    setIsExpanded(!isExpanded)
  }

  // 当外部折叠映射变化时，同步当前节点的展开状态


  const handleCheckboxChange = (checked: boolean) => {
    onPermissionToggle?.(permission.id, checked)
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      system: 'bg-blue-100 text-blue-800',
      user: 'bg-green-100 text-green-800',
      requirement: 'bg-yellow-100 text-yellow-800',
      form: 'bg-purple-100 text-purple-800',
      rating: 'bg-orange-100 text-orange-800',
      analytics: 'bg-cyan-100 text-cyan-800',
      navigation: 'bg-lime-100 text-lime-800',
      comment: 'bg-gray-100 text-gray-800'
    }
    return colors[category] || 'bg-gray-100 text-gray-800'
  }

  const getCategoryTextColor = (category: string) => {
    const colors: Record<string, string> = {
      system: 'text-blue-600',
      user: 'text-green-600',
      requirement: 'text-yellow-600',
      form: 'text-purple-600',
      rating: 'text-orange-600',
      analytics: 'text-cyan-600',
      navigation: 'text-lime-600',
      comment: 'text-gray-600'
    }
    return colors[category] || 'text-gray-600'
  }

  // 将已知英文分类映射为中文，仅影响展示
  const getCategoryLabel = (category?: string) => {
    if (!category) return ''
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
    return map[category] || category
  }

  // 将顶级英文名称映射为中文，仅在名称完全等于已知键时替换
  const getPermissionLabel = (p: Permission) => {
    const raw = p.display_name || p.name || p.code
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
    return map[raw] || raw
  }

  return (
    <div className="select-none">
      <div 
        className={`flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-gray-50 group ${
          level > 0 ? 'ml-4' : ''
        }`}
        style={{ paddingLeft: `${level * 16 + 12}px` }}
      >
        {/* 展开/收起按钮 */}
        {hasChildren ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleToggle}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        ) : (
          <div className="w-6" />
        )}

        {/* 复选框 */}
        {showCheckboxes && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={handleCheckboxChange}
            className="h-4 w-4"
          />
        )}



        {/* 权限信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className={`h-4 w-4 ${getCategoryTextColor(permission.category)}`} />
            <span className="text-sm font-medium text-gray-900 truncate">
              {getPermissionLabel(permission)}
            </span>
            {permission.category && (
              <Badge 
                variant="secondary" 
                className={`text-xs ${getCategoryColor(permission.category)}`}
              >
                {getCategoryLabel(permission.category)}
              </Badge>
            )}
          </div>

          {permission.description && (
            <div className="text-[11px] text-gray-400 truncate">
              {permission.description}
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        {showActions && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onCreatePermission?.(permission.id)}
              title="添加子权限"
            >
              <Plus className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onEditPermission?.(permission)}
              title="编辑权限"
            >
              <Edit className="h-3 w-3" />
            </Button>
            {!permission.is_system && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                onClick={() => onDeletePermission?.(permission)}
                title="删除权限"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 子权限：常驻渲染，仅通过样式隐藏/显示，避免卸载重建 */}
      {hasChildren && (
        <div className={`ml-1 ${isExpanded ? '' : 'hidden'}`}>
          {permission.children!.map((child) => (
            <PermissionNode
              key={child.id}
              permission={child}
              level={level + 1}
              selectedPermissions={selectedPermissions}
              onPermissionToggle={onPermissionToggle}
              onCreatePermission={onCreatePermission}
              onEditPermission={onEditPermission}
              onDeletePermission={onDeletePermission}
              showActions={showActions}
              showCheckboxes={showCheckboxes}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const areEqual = (prev: PermissionNodeProps, next: PermissionNodeProps) => {
  return (
    prev.permission === next.permission &&
    prev.selectedPermissions === next.selectedPermissions &&
    prev.onPermissionToggle === next.onPermissionToggle &&
    prev.showActions === next.showActions &&
    prev.showCheckboxes === next.showCheckboxes &&
    prev.level === next.level
  )
}
const MemoPermissionNode = memo(PermissionNode, areEqual)

const PermissionTreeComp: React.FC<PermissionTreeProps> = ({
  permissions,
  selectedPermissions = [],
  onPermissionToggle,
  onCreatePermission,
  onEditPermission,
  onDeletePermission,
  showActions = false,
  showCheckboxes = false,
  className = '',
  collapsedMap
}) => {
  return (
    <div className={`space-y-1 ${className}`}>
      {permissions.map((permission) => (
        <MemoPermissionNode
          key={permission.id}
          permission={permission}
          level={0}
          selectedPermissions={selectedPermissions}
          onPermissionToggle={onPermissionToggle}
          onCreatePermission={onCreatePermission}
          onEditPermission={onEditPermission}
          onDeletePermission={onDeletePermission}
          showActions={showActions}
          showCheckboxes={showCheckboxes}
          collapsedMap={collapsedMap}
        />
      ))}
    </div>
  )
}

export const PermissionTree = memo(PermissionTreeComp)