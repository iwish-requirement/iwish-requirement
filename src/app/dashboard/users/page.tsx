'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { userService } from '@/services/userService'
import { roleService } from '@/services/roleService'
import { departmentPositionService } from '@/services/departmentPosition'
import { usePermissions, PermissionGuard } from '@/hooks/usePermissions'

import type { User, Role } from '@/types'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Users, 
  Shield, 
  Search, 
  Filter,
  UserCheck,
  UserX,
  Settings,
  Save,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'

export default function UsersPage() {
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  
  // 页面级权限检查
  if (!permissionsLoading && !hasPermission('user.manage')) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Shield className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">访问被拒绝</h2>
          <p className="text-gray-600">您没有权限访问用户管理页面</p>
        </div>
      </div>
    )
  }

  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [departments, setDepartments] = useState<Array<{value: string, label: string}>>([])
  const [positions, setPositions] = useState<Array<{value: string, label: string}>>([])
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  
  // 对话框状态
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false)

  // 表单数据
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    department: '',
    position: '',
    title: '',
    role: 'employee',
    phone: ''
  })

  const [roleFormData, setRoleFormData] = useState({
    role: '',
    reason: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setPageLoading(true)
      const [usersData, rolesData, departmentsData, positionsData] = await Promise.all([
        userService.getUsers(),
        userService.getRoles(),
        departmentPositionService.getDepartmentOptions(),
        departmentPositionService.getPositionOptions()
      ])
      
      setUsers(usersData)
      setRoles(rolesData)
      setDepartments(departmentsData)
      setPositions(positionsData)
    } catch (error) {
      console.error('加载数据失败:', error)
      toast.error('加载数据失败')
    } finally {
      setPageLoading(false)
    }
  }

  const loadPositionsByDepartment = async (departmentCode: string) => {
    try {
      const positionsData = await departmentPositionService.getPositionOptions(departmentCode)
      setPositions(positionsData)
    } catch (error) {
      console.error('加载岗位数据失败:', error)
      toast.error('加载岗位数据失败')
    }
  }

  const handleDepartmentChange = (departmentCode: string) => {
    setFormData({ ...formData, department: departmentCode, position: '' })
    if (departmentCode) {
      loadPositionsByDepartment(departmentCode)
    } else {
      // 如果没有选择部门，加载所有岗位
      departmentPositionService.getPositionOptions().then(setPositions)
    }
  }

  const handleCreateUser = async () => {
    if (!formData.email || !formData.full_name || !formData.department || !formData.position) {
      toast.error('请填写必要信息')
      return
    }

    setLoading(true)
    try {
      await userService.createUser(formData)
      await loadData()
      setIsCreateDialogOpen(false)
      resetFormData()
      toast.success('用户创建成功')
    } catch (error: any) {
      console.error('创建用户失败:', error)
      toast.error(error.message || '创建用户失败')
    } finally {
      setLoading(false)
    }
  }

  const handleEditUser = async () => {
    if (!selectedUser || !formData.full_name || !formData.department || !formData.position) {
      toast.error('请填写必要信息')
      return
    }

    setLoading(true)
    try {
      await userService.updateUser(selectedUser.id, {
        full_name: formData.full_name,
        department: formData.department,
        position: formData.position,
        phone: formData.phone
      })
      
      await loadData()
      setIsEditDialogOpen(false)
      setSelectedUser(null)
      resetFormData()
      toast.success('用户信息更新成功')
    } catch (error: any) {
      console.error('更新用户失败:', error)
      toast.error(error.message || '更新用户失败')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateUserRole = async () => {
    if (!selectedUser || !roleFormData.role) {
      toast.error('请选择角色')
      return
    }

    setLoading(true)
    try {
      await userService.updateUserRole(selectedUser.id, roleFormData.role)
      await loadData()
      setIsRoleDialogOpen(false)
      setSelectedUser(null)
      setRoleFormData({ role: '', reason: '' })
      toast.success('用户角色更新成功')
    } catch (error: any) {
      console.error('更新用户角色失败:', error)
      toast.error(error.message || '更新用户角色失败')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleUserStatus = async (user: User) => {
    if (!hasPermission('user.edit')) {
      toast.error('您没有权限执行此操作')
      return
    }

    setLoading(true)
    try {
      await userService.toggleUserStatus(user.id, !user.active)
      await loadData()
      toast.success(`用户已${user.active ? '禁用' : '激活'}`)
    } catch (error: any) {
      console.error('更新用户状态失败:', error)
      toast.error(error.message || '更新用户状态失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (user: User) => {
    if (!hasPermission('user.delete')) {
      toast.error('您没有权限执行此操作')
      return
    }

    if (!confirm(`确定要删除用户"${user.full_name}"吗？此操作不可撤销。`)) {
      return
    }

    setLoading(true)
    try {
      await userService.deleteUser(user.id)
      await loadData()
      toast.success('用户删除成功')
    } catch (error: any) {
      console.error('删除用户失败:', error)
      toast.error(error.message || '删除用户失败')
    } finally {
      setLoading(false)
    }
  }

  const resetFormData = () => {
    setFormData({
      email: '',
      full_name: '',
      department: '',
      position: '',
      title: '',
      role: 'employee',
      phone: ''
    })
  }

  const openCreateDialog = () => {
    resetFormData()
    setIsCreateDialogOpen(true)
  }

  const openEditDialog = async (user: User) => {
    setSelectedUser(user)
    setFormData({
      email: user.email,
      full_name: user.full_name || '',
      department: user.department,
      position: user.position,
      title: (user as any).title || '',
      role: user.role,
      phone: user.phone || ''
    })
    
    // 如果用户有部门，加载该部门的岗位
    if (user.department) {
      try {
        const positionsData = await departmentPositionService.getPositionOptions(user.department)
        setPositions(positionsData)
      } catch (error) {
        console.error('加载岗位数据失败:', error)
      }
    }
    
    setIsEditDialogOpen(true)
  }

  const openRoleDialog = (user: User) => {
    setSelectedUser(user)
    setRoleFormData({
      role: user.role,
      reason: ''
    })
    setIsRoleDialogOpen(true)
  }



  const getRoleBadge = (role: string) => {
    const roleInfo = roles.find(r => r.name === role)
    if (roleInfo) {
      return <Badge variant="default">{roleInfo.name}</Badge>
    }
    
    // 兜底显示
    const roleMap = {
      'super_admin': { label: '超级管理员', variant: 'destructive' as const },
      'admin': { label: '管理员', variant: 'default' as const },
      'employee': { label: '员工', variant: 'secondary' as const }
    }
    
    const fallback = roleMap[role as keyof typeof roleMap] || { label: role, variant: 'outline' as const }
    return <Badge variant={fallback.variant}>{fallback.label}</Badge>
  }

  const getDepartmentLabel = (departmentCode: string) => {
    const dept = departments.find(d => d.value === departmentCode)
    return dept ? dept.label : departmentCode
  }

  const getPositionLabel = (positionCode: string) => {
    const pos = positions.find(p => p.value === positionCode)
    return pos ? pos.label : positionCode
  }

  const filteredUsers = users.filter(user => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      user.full_name?.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.department.toLowerCase().includes(query) ||
      user.position.toLowerCase().includes(query)
    )
  })

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">加载用户数据中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            用户管理
          </h1>
          <p className="text-muted-foreground mt-2">
            管理系统用户账户和角色权限分配
          </p>
        </div>
        
        <PermissionGuard permission="user.create">
          <Button 
            onClick={openCreateDialog}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
          >
            <Plus className="mr-2 h-4 w-4" />
            创建用户
          </Button>
        </PermissionGuard>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">总用户数</p>
                <p className="text-2xl font-bold">{users.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <UserCheck className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">活跃用户</p>
                <p className="text-2xl font-bold">{users.filter(u => u.active).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">管理员</p>
                <p className="text-2xl font-bold">
                  {users.filter(u => ['admin', 'super_admin'].includes(u.role)).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <UserX className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">禁用用户</p>
                <p className="text-2xl font-bold">{users.filter(u => !u.active).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="搜索用户（姓名、邮箱、部门、职位）..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              筛选
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 用户列表 */}
      <Card>
        <CardHeader>
          <CardTitle>用户列表 ({filteredUsers.length})</CardTitle>
          <CardDescription>
            系统中的所有用户账户信息
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors flex-wrap gap-3">
                <div className="flex-1">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-medium text-sm">
                        {(user.full_name || user.email).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-medium">{user.full_name || '未设置姓名'}</h3>
                      <p className="text-sm text-gray-500 break-words">{user.email}</p>
                    </div>
                    <div>
                      <p className="text-sm">{getDepartmentLabel(user.department)} - {getPositionLabel(user.position)}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        {getRoleBadge(user.role)}
                        <Badge variant={user.active ? 'default' : 'secondary'}>
                          {user.active ? '激活' : '禁用'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 flex-wrap">
                  <PermissionGuard permission="user.edit">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(user)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </PermissionGuard>
                  
                  <PermissionGuard permission="user.manage">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openRoleDialog(user)}
                      title="角色权限"
                    >
                      <Shield className="h-4 w-4" />
                    </Button>
                  </PermissionGuard>
                  

                  
                  <PermissionGuard permission="user.edit">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleUserStatus(user)}
                      disabled={loading}
                    >
                      {user.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                    </Button>
                  </PermissionGuard>
                  
                  <PermissionGuard permission="user.delete">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteUser(user)}
                      disabled={loading}
                      className="hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </PermissionGuard>
                </div>
              </div>
            ))}
            
            {filteredUsers.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                {searchQuery ? '未找到匹配的用户' : '暂无用户数据'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 创建用户对话框 */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>创建新用户</DialogTitle>
            <DialogDescription>
              为系统创建新的用户账户
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱 *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@example.com"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="full_name">姓名 *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="用户姓名"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">职称（可选）</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="例如：技术部负责人"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">部门 *</Label>
                <Select value={formData.department} onValueChange={handleDepartmentChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择部门" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(dept => (
                      <SelectItem key={dept.value} value={dept.value}>
                        {dept.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="position">职位 *</Label>
                <Select 
                  value={formData.position} 
                  onValueChange={(value) => setFormData({ ...formData, position: value })}
                  disabled={!formData.department}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.department ? "选择职位" : "请先选择部门"} />
                  </SelectTrigger>
                  <SelectContent>
                    {positions.map(pos => (
                      <SelectItem key={pos.value} value={pos.value}>
                        {pos.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">电话</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="联系电话"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role">角色 *</Label>
              <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="选择用户角色" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(role => (
                    <SelectItem key={role.id} value={role.name}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateUser} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  创建中...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  创建用户
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑用户对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑用户信息</DialogTitle>
            <DialogDescription>
              修改用户的基本信息
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_email">邮箱</Label>
              <Input
                id="edit_email"
                type="email"
                value={formData.email}
                disabled
                className="bg-gray-50"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit_full_name">姓名 *</Label>
              <Input
                id="edit_full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="用户姓名"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_title">职称（可选）</Label>
              <Input
                id="edit_title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="例如：技术部负责人"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_department">部门 *</Label>
                <Select value={formData.department} onValueChange={handleDepartmentChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择部门" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(dept => (
                      <SelectItem key={dept.value} value={dept.value}>
                        {dept.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit_position">职位 *</Label>
                <Select 
                  value={formData.position} 
                  onValueChange={(value) => setFormData({ ...formData, position: value })}
                  disabled={!formData.department}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.department ? "选择职位" : "请先选择部门"} />
                  </SelectTrigger>
                  <SelectContent>
                    {positions.map(pos => (
                      <SelectItem key={pos.value} value={pos.value}>
                        {pos.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit_phone">电话</Label>
              <Input
                id="edit_phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="联系电话"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleEditUser} disabled={loading}>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 角色分配对话框 */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>分配用户角色</DialogTitle>
            <DialogDescription>
              为用户 "{selectedUser?.full_name}" 分配新的角色权限
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role_select">选择角色 *</Label>
              <Select value={roleFormData.role} onValueChange={(value) => setRoleFormData({ ...roleFormData, role: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="选择新角色" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(role => (
                    <SelectItem key={role.id} value={role.name}>
                      <div className="flex items-center space-x-2">
                        <span>{role.name}</span>
                        {role.description && (
                          <span className="text-xs text-gray-500">- {role.description}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role_reason">变更原因</Label>
              <Textarea
                id="role_reason"
                value={roleFormData.reason}
                onChange={(e) => setRoleFormData({ ...roleFormData, reason: e.target.value })}
                placeholder="请说明角色变更的原因..."
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleUpdateUserRole} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  更新中...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  更新角色
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </div>
  )
}