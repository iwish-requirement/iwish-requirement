# 动态权限管理系统

## 概述

本系统已完全重构为基于动态权限管理的架构，移除了所有硬编码的角色检查，确保所有功能都严格按照角色权限管理系统来控制访问。

## 核心组件

### 1. 权限配置 (`src/config/permissions.ts`)
- 定义了所有系统权限代码
- 权限分类和描述
- 权限分组配置
- 权限验证工具函数

### 2. 权限服务 (`src/services/permission.ts`)
- 动态权限检查
- 角色权限管理
- 用户权限获取
- 权限统计分析

### 3. 认证服务 (`src/services/auth.ts`)
- 完全基于动态权限的用户认证
- 移除硬编码角色逻辑
- 集成权限服务进行权限检查

### 4. 权限 Hook (`src/hooks/usePermissions.tsx`)
- React 权限检查 Hook
- 权限上下文管理
- 便捷的权限检查方法

### 5. 权限组件 (`src/components/PermissionWrapper.tsx`)
- 权限包装组件
- 页面级权限保护
- 按钮权限控制

## 权限体系

### 权限分类
- **需求管理** (requirement): 创建、查看、编辑、删除需求
- **用户管理** (user): 用户的增删改查和角色管理
- **角色管理** (role): 角色的创建、编辑、分配
- **权限管理** (permission): 权限的查看和管理
- **系统管理** (system): 系统配置、备份、恢复
- **分析统计** (analytics): 查看和导出分析报告
- **数据管理** (data): 数据导入导出、备份
- **评论管理** (comment): 评论的创建、编辑、删除
- **表单管理** (form): 动态表单的管理
- **导航管理** (navigation): 导航菜单的管理

### 基础角色配置
1. **超级管理员** (super_admin): 拥有所有权限
2. **管理员** (admin): 拥有大部分管理权限，不包括系统级权限
3. **员工** (employee): 基础权限，只能管理自己的需求

## 使用方式

### 1. 在组件中检查权限
```tsx
import { usePermissionCheck } from '@/hooks/usePermissions'

function MyComponent() {
  const { canCreateRequirement, canViewAllRequirements } = usePermissionCheck()
  
  return (
    <div>
      {canCreateRequirement && <CreateButton />}
      {canViewAllRequirements && <AllRequirementsList />}
    </div>
  )
}
```

### 2. 使用权限包装组件
```tsx
import { PermissionWrapper } from '@/components/PermissionWrapper'

function MyComponent() {
  return (
    <PermissionWrapper permission="requirement.create">
      <CreateButton />
    </PermissionWrapper>
  )
}
```

### 3. 页面级权限保护
```tsx
import { PagePermissionGuard } from '@/components/PermissionWrapper'

function AdminPage() {
  return (
    <PagePermissionGuard permission="system.manage">
      <AdminContent />
    </PagePermissionGuard>
  )
}
```

### 4. 多权限检查
```tsx
<PermissionWrapper 
  permissions={['requirement.edit', 'requirement.delete']}
  requireAll={false} // 拥有任一权限即可
>
  <ActionButtons />
</PermissionWrapper>
```

## 权限初始化

运行权限初始化脚本来创建基础权限和角色：

```bash
npm run init-permissions
```

或者在代码中调用：
```typescript
import { initializePermissions } from '@/scripts/initPermissions'

await initializePermissions()
```

## 数据库结构

### permissions 表
- `id`: 权限ID
- `code`: 权限代码 (如 'requirement.create')
- `name`: 权限名称
- `display_name`: 显示名称
- `description`: 权限描述
- `category`: 权限分类
- `is_system`: 是否为系统权限
- `sort_order`: 排序

### roles 表
- `id`: 角色ID
- `name`: 角色名称
- `description`: 角色描述
- `is_active`: 是否激活

### role_permissions 表
- `role_id`: 角色ID
- `permission_id`: 权限ID

### user_roles 表
- `user_id`: 用户ID
- `role_id`: 角色ID
- `is_active`: 是否激活
- `assigned_by`: 分配者
- `assigned_at`: 分配时间

## 安全特性

1. **完全动态**: 所有权限检查都基于数据库中的权限配置
2. **无硬编码**: 移除了所有硬编码的角色检查逻辑
3. **细粒度控制**: 支持非常细致的权限控制
4. **实时更新**: 权限变更立即生效
5. **审计追踪**: 记录权限分配和变更历史

## 迁移指南

### 从硬编码角色到动态权限

**之前的代码:**
```typescript
if (user.role === 'admin' || user.role === 'super_admin') {
  // 管理员逻辑
}
```

**现在的代码:**
```typescript
const { hasPermission } = usePermissionCheck()
if (hasPermission('requirement.manage_all')) {
  // 权限检查逻辑
}
```

### 组件权限保护

**之前的代码:**
```tsx
{user.role === 'admin' && <AdminButton />}
```

**现在的代码:**
```tsx
<PermissionWrapper permission="system.manage">
  <AdminButton />
</PermissionWrapper>
```

## 最佳实践

1. **使用权限代码**: 始终使用 `PERMISSIONS` 常量中定义的权限代码
2. **组件级保护**: 在组件级别进行权限检查，而不是在业务逻辑中
3. **最小权限原则**: 只授予用户完成工作所需的最小权限
4. **权限分组**: 合理使用权限分组来简化管理
5. **定期审计**: 定期检查和清理不必要的权限

## 扩展性

系统设计为高度可扩展：
- 可以轻松添加新的权限类别
- 支持权限继承和依赖关系
- 可以实现基于条件的动态权限
- 支持临时权限和权限过期

这个权限系统确保了所有功能都严格按照角色权限管理来控制，为系统提供了强大的安全保障和灵活的权限管理能力。