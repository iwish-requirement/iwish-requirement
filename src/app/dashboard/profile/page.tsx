'use client'

import { useState, useEffect } from 'react'
import { authService } from '@/services/auth'
import { createSupabaseClient } from '@/lib/supabase'
import { usePermissions } from '@/hooks/usePermissions'
import { departmentPositionService } from '@/services/departmentPosition'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { User, Lock, Mail, Building, Briefcase, Save, Eye, EyeOff, Shield, Info } from 'lucide-react'
import type { User as UserType } from '@/types'

const getRoleDisplayName = (role?: string): string => {
  switch (role) {
    case 'admin': return '管理员'
    case 'manager': return '经理'
    case 'staff': return '员工'
    case 'guest': return '访客'
    default: return role || ''
  }
}



export default function ProfilePage() {
  const { user: authUser, hasPermission } = usePermissions()
  const supabase = createSupabaseClient()
  const [user, setUser] = useState<UserType | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // 检查是否有系统管理权限
  const canManageSystem = hasPermission('system.admin')

  // 个人信息表单（只有超级管理员可以修改）
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    department: '',
    position: '',
    title: ''
  })
  const [departmentOptions, setDepartmentOptions] = useState<Array<{ value: string; label: string }>>([])
  const [positionOptions, setPositionOptions] = useState<Array<{ value: string; label: string }>>([])

  // 密码修改表单（所有用户都可以修改）
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  useEffect(() => {
    loadUserProfile()
  }, [])

  const loadUserProfile = async () => {
    try {
      const currentUser = await authService.getCurrentUser()
      if (currentUser) {
        setUser(currentUser)
        setProfileForm({
          full_name: currentUser.full_name || '',
          department: currentUser.department || '',
          position: currentUser.position || '',
          title: (currentUser as any).title || ''
        })
      }
    } catch (error) {
      console.error('加载用户信息失败:', error)
      setError('加载用户信息失败')
    } finally {
      setLoading(false)
    }
  }

  // 加载下拉选项
  const loadDepartmentOptions = async () => {
    const opts = await departmentPositionService.getDepartmentOptions(false)
    setDepartmentOptions(opts)
  }
  const loadPositionOptions = async (deptCode?: string) => {
    const opts = await departmentPositionService.getPositionOptions(deptCode)
    setPositionOptions(opts)
  }
  // 部门选择联动岗位
  const handleDepartmentSelect = async (deptCode: string) => {
    setProfileForm(prev => ({ ...prev, department: deptCode, position: '' }))
    await loadPositionOptions(deptCode)
  }
  // 初始化与联动
  useEffect(() => {
    loadDepartmentOptions()
    if (profileForm.department) {
      loadPositionOptions(profileForm.department)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileForm.department])

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 权限检查：只有有系统管理权限的用户可以修改个人信息
    if (!canManageSystem) {
      setError('您没有权限修改个人信息，请联系系统管理员')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    try {
      const { data, error } = await supabase
        .from('users')
        .update({
          full_name: profileForm.full_name,
          department: profileForm.department,
          position: profileForm.position,
          title: profileForm.title,
          updated_at: new Date().toISOString()
        })
        .eq('id', user?.id)
        .select()
        .single()

      if (error) throw error

      // 更新本地用户状态
      if (user) {
        setUser({
          ...user,
          full_name: profileForm.full_name,
          department: profileForm.department,
          position: profileForm.position
        })
      }

      setMessage('个人信息更新成功')
    } catch (error) {
      console.error('更新个人信息失败:', error)
      setError('更新个人信息失败')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    // 验证密码
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('新密码和确认密码不匹配')
      setSaving(false)
      return
    }

    if (passwordForm.newPassword.length < 6) {
      setError('新密码长度至少为6位')
      setSaving(false)
      return
    }

    try {
      // 使用 Supabase Auth 更新密码
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      })

      if (error) throw error

      setMessage('密码修改成功')
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
    } catch (error: any) {
      console.error('修改密码失败:', error)
      setError(error?.message || '修改密码失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-3">
        <User className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">个人中心</h1>
          <p className="text-gray-600">管理您的个人信息和账户设置</p>
        </div>
      </div>

      {message && (
        <Alert className="border-green-200 bg-green-50">
          <AlertDescription className="text-green-800">{message}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profile" className="flex items-center space-x-2">
            <User className="h-4 w-4" />
            <span>个人信息</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center space-x-2">
            <Lock className="h-4 w-4" />
            <span>安全设置</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>个人信息</span>
                {canManageSystem && (
                  <Shield className="h-4 w-4 text-amber-500" />
                )}
              </CardTitle>
              <CardDescription>
                {canManageSystem 
                  ? '您拥有系统管理权限，可以修改个人信息' 
                  : '个人基本信息只能由系统管理员修改'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!canManageSystem && (
                <Alert className="mb-6 border-blue-200 bg-blue-50">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <strong>权限说明：</strong>您的基本信息（姓名、部门、职位等）在创建账号时已设定，如需修改请联系超级管理员。您只能修改密码等安全设置。
                  </AlertDescription>
                </Alert>
              )}
              
              <form onSubmit={handleProfileUpdate} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center space-x-2">
                      <Mail className="h-4 w-4" />
                      <span>邮箱地址</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="bg-gray-50"
                    />
                    <p className="text-xs text-gray-500">邮箱地址不可修改</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="full_name" className="flex items-center space-x-2">
                      <span>姓名</span>
                      {!canManageSystem && <Lock className="h-3 w-3 text-gray-400" />}
                    </Label>
                    <Input
                      id="full_name"
                      type="text"
                      value={profileForm.full_name}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, full_name: e.target.value }))}
                      placeholder="请输入您的姓名"
                      disabled={!canManageSystem}
                      className={!canManageSystem ? "bg-gray-50 cursor-not-allowed" : ""}
                    />
                    {!canManageSystem && (
                      <p className="text-xs text-gray-500">此字段只能由系统管理员修改</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="department" className="flex items-center space-x-2">
                      <Building className="h-4 w-4" />
                      <span>部门</span>
                      {!canManageSystem && <Lock className="h-3 w-3 text-gray-400" />}
                    </Label>
                    <Select
                      value={profileForm.department}
                      onValueChange={handleDepartmentSelect}
                      disabled={!canManageSystem}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择部门" />
                      </SelectTrigger>
                      <SelectContent>
                        {departmentOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!canManageSystem && (
                      <p className="text-xs text-gray-500">此字段只能由系统管理员修改</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="position" className="flex items-center space-x-2">
                      <Briefcase className="h-4 w-4" />
                      <span>职位</span>
                      {!canManageSystem && <Lock className="h-3 w-3 text-gray-400" />}
                    </Label>
                    <Select
                      value={profileForm.position}
                      onValueChange={(value) => setProfileForm(prev => ({ ...prev, position: value }))}
                      disabled={!canManageSystem || !profileForm.department}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={profileForm.department ? '选择职位' : '请先选择部门'} />
                      </SelectTrigger>
                      <SelectContent>
                        {positionOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!canManageSystem && (
                      <p className="text-xs text-gray-500">此字段只能由系统管理员修改</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="title" className="flex items-center space-x-2">
                      <Briefcase className="h-4 w-4" />
                      <span>职称（可选）</span>
                      {!canManageSystem && <Lock className="h-3 w-3 text-gray-400" />}
                    </Label>
                    <Input
                      id="title"
                      type="text"
                      value={profileForm.title}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="例如：技术部负责人"
                      disabled={!canManageSystem}
                      className={!canManageSystem ? "bg-gray-50 cursor-not-allowed" : ""}
                    />
                    <p className="text-xs text-gray-500">若填写职称，系统将优先显示职称，否则显示职位</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role" className="flex items-center space-x-2">
                      <Shield className="h-4 w-4" />
                      <span>用户角色</span>
                      <Lock className="h-3 w-3 text-gray-400" />
                    </Label>
                    <Input
                      id="role"
                      type="text"
                      value={getRoleDisplayName(user?.role)}
                      disabled
                      className="bg-gray-50 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500">用户角色由系统管理员设定，不可修改</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={saving || !canManageSystem} 
                    className="flex items-center space-x-2"
                  >
                    <Save className="h-4 w-4" />
                    <span>{saving ? '保存中...' : canManageSystem ? '保存更改' : '无权限修改'}</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Lock className="h-5 w-5" />
                <span>安全设置</span>
              </CardTitle>
              <CardDescription>
                所有用户都可以修改自己的密码以确保账户安全
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">当前密码</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                      placeholder="请输入当前密码"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">新密码</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                      placeholder="请输入新密码（至少6位）"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">确认新密码</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="请再次输入新密码"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-green-900 mb-2">✅ 您可以修改的安全设置</h4>
                  <ul className="text-sm text-green-800 space-y-1">
                    <li>• 修改登录密码</li>
                    <li>• 密码长度至少6位</li>
                    <li>• 建议包含大小写字母、数字和特殊字符</li>
                    <li>• 定期更换密码以确保账户安全</li>
                  </ul>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={saving} className="flex items-center space-x-2">
                    <Lock className="h-4 w-4" />
                    <span>{saving ? '修改中...' : '修改密码'}</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}