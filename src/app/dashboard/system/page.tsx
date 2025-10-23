'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SimplePermissionManager } from '@/components/ui/simple-permission-manager'
import { createSupabaseClient } from '@/lib/supabase'
import { authService } from '@/services/auth'

export default function SystemPage() {
  // Supabase 客户端
  const supabase = createSupabaseClient()

  const [config, setConfig] = useState({
    siteName: 'IWISH需求管理平台',
    siteDescription: '企业级可配置需求管理系统',
    adminEmail: 'admin@iwishweb.com',
    maxFileSize: '10',
    allowedFileTypes: 'jpg,jpeg,png,gif,pdf,doc,docx,xls,xlsx,ppt,pptx',
    emailNotifications: 'enabled',
    autoAssignment: 'disabled',
    requireApproval: 'enabled',
    defaultPriority: 'medium',
    sessionTimeout: '24',
    maxLoginAttempts: '5',
    passwordMinLength: '6',
    enableTwoFactor: 'disabled'
  })

  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // 监听配置变化
  useEffect(() => {
    setHasChanges(true)
  }, [config])

  // 初始化：从数据库读取配置
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('system_config')
        .select('data')
        .eq('id', 'default')
        .maybeSingle()

      if (error) {
        console.error('加载系统配置失败', error)
        return
      }

      if (data && data.data) {
        setConfig(prev => ({ ...prev, ...data.data }))
        setHasChanges(false)
      } else {
        // 若不存在，写入默认记录，保证后续可更新
        const { error: insErr } = await supabase
          .from('system_config')
          .insert([{ id: 'default', data: {
            siteName: 'IWISH需求管理平台',
            siteDescription: '企业级可配置需求管理系统',
            adminEmail: 'admin@iwishweb.com',
            maxFileSize: '10',
            allowedFileTypes: 'jpg,jpeg,png,gif,pdf,doc,docx,xls,xlsx,ppt,pptx',
            emailNotifications: 'enabled',
            autoAssignment: 'disabled',
            requireApproval: 'enabled',
            defaultPriority: 'medium',
            sessionTimeout: '24',
            maxLoginAttempts: '5',
            passwordMinLength: '6',
            enableTwoFactor: 'disabled'
          }}])

        if (insErr) console.error('初始化系统配置失败', insErr)
      }
    }

    load()
  }, [])

  const handleConfigChange = (field: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('system_config')
        .upsert({ id: 'default', data: config })

      if (error) {
        console.error('保存配置失败:', error)
        alert('保存失败，请重试')
        return
      }

      setLastSaved(new Date())
      setHasChanges(false)

      const successMsg = document.createElement('div')
      successMsg.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50'
      successMsg.textContent = '✅ 配置保存成功！'
      document.body.appendChild(successMsg)
      setTimeout(() => document.body.removeChild(successMsg), 2000)
    } catch (error) {
      console.error('保存配置失败:', error)
      alert('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!confirm('确定要重置为默认配置吗？')) return

    const defaults = {
      siteName: 'IWISH需求管理平台',
      siteDescription: '企业级可配置需求管理系统',
      adminEmail: 'admin@iwishweb.com',
      maxFileSize: '10',
      allowedFileTypes: 'jpg,jpeg,png,gif,pdf,doc,docx,xls,xlsx,ppt,pptx',
      emailNotifications: 'enabled',
      autoAssignment: 'disabled',
      requireApproval: 'enabled',
      defaultPriority: 'medium',
      sessionTimeout: '24',
      maxLoginAttempts: '5',
      passwordMinLength: '6',
      enableTwoFactor: 'disabled'
    }

    setConfig(defaults)

    const { error } = await supabase
      .from('system_config')
      .upsert({ id: 'default', data: defaults })

    if (error) {
      console.error('重置配置失败:', error)
      alert('重置失败，请重试')
      return
    }

    const successMsg = document.createElement('div')
    successMsg.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50'
    successMsg.textContent = '✅ 已重置为默认配置'
    document.body.appendChild(successMsg)
    setTimeout(() => document.body.removeChild(successMsg), 2000)

    setHasChanges(false)
  }

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* 页面标题 */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            系统管理
          </h1>
          <p className="text-gray-600">
            管理系统配置、权限、角色和动态功能
          </p>
          {lastSaved && (
            <p className="text-sm text-green-600 mt-2">
              ✅ 最后保存时间: {lastSaved.toLocaleString()}
            </p>
          )}
        </div>

        {/* 主要内容 - 使用标签页 */}
        <Tabs defaultValue="permissions" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="permissions">动态权限系统</TabsTrigger>
            <TabsTrigger value="config">系统配置</TabsTrigger>
          </TabsList>

          <TabsContent value="permissions" className="space-y-6">
            <SimplePermissionManager />
          </TabsContent>

          <TabsContent value="config" className="space-y-6">
            {/* 保存状态提示 */}
            {hasChanges && (
              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded text-yellow-800">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <span className="text-yellow-400 text-xl">⚠️</span>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700 font-medium">
                      您有未保存的更改，请记得保存配置。
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 桌面通知设置 */}
            <Card className="bg-white border shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <span className="text-2xl">🔔</span>
                  <span>桌面通知</span>
                </CardTitle>
                <CardDescription className="text-gray-600">
                  开启后，系统会在有新需求分配或评分提醒时，通过浏览器系统通知提醒您。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center space-x-3">
                  <Button onClick={async () => {
                    try {
                      const { setupPushForUser } = await import('@/services/push-notify')
                      const current = await authService.getCurrentUser()
                      if (!current?.id) {
                        alert('请先登录后再开启通知')
                        return
                      }
                      const ok = await setupPushForUser(current.id)
                      alert(ok ? '桌面通知已开启（若浏览器弹出授权，请允许）' : '开启失败，请稍后重试')
                    } catch (e) {
                      alert('开启失败，请稍后重试')
                      console.warn('[WebPush] 系统页订阅失败:', e)
                    }
                  }}>开启桌面通知</Button>
                  <Button variant="secondary" onClick={async () => {
                    try {
                      const { resetAndSubscribe } = await import('@/services/webpush')
                      const current = await authService.getCurrentUser()
                      if (!current?.id) {
                        alert('请先登录后再重置订阅')
                        return
                      }
                      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
                      const ok = await resetAndSubscribe(current.id, publicKey)
                      alert(ok ? '重置订阅成功并已重新开启' : '重置订阅失败，请稍后重试')
                    } catch (e) {
                      alert('重置订阅失败，请稍后重试')
                      console.warn('[WebPush] 重置订阅失败:', e)
                    }
                  }}>重置桌面通知</Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* 基础设置 */}
              <Card className="bg-white border shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <span className="text-2xl">🏢</span>
                    <span>基础设置</span>
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    系统的基本信息配置
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                  <div className="space-y-2">
                    <Label htmlFor="siteName" className="text-sm font-medium text-gray-700">网站名称</Label>
                    <Input
                      id="siteName"
                      value={config.siteName}
                      onChange={(e) => handleConfigChange('siteName', e.target.value)}
                      className="border border-gray-300 focus:border-gray-400 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="siteDescription" className="text-sm font-medium text-gray-700">网站描述</Label>
                    <Textarea
                      id="siteDescription"
                      value={config.siteDescription}
                      onChange={(e) => handleConfigChange('siteDescription', e.target.value)}
                      rows={3}
                      className="border border-gray-300 focus:border-gray-400 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="adminEmail" className="text-sm font-medium text-gray-700">管理员邮箱</Label>
                    <Input
                      id="adminEmail"
                      type="email"
                      value={config.adminEmail}
                      onChange={(e) => handleConfigChange('adminEmail', e.target.value)}
                      className="border border-gray-300 focus:border-gray-400 transition-colors text-gray-900 placeholder:text-gray-400"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* 文件上传设置 */}
              <Card className="bg-white border shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <span className="text-2xl">📁</span>
                    <span>文件上传设置</span>
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    配置文件上传的限制和规则
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                  <div className="space-y-2">
                    <Label htmlFor="maxFileSize" className="text-sm font-medium text-gray-700">最大文件大小 (MB)</Label>
                    <Input
                      id="maxFileSize"
                      type="number"
                      value={config.maxFileSize}
                      onChange={(e) => handleConfigChange('maxFileSize', e.target.value)}
                      className="border border-gray-300 focus:border-gray-400 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="allowedFileTypes" className="text-sm font-medium text-gray-700">允许的文件类型</Label>
                    <Textarea
                      id="allowedFileTypes"
                      value={config.allowedFileTypes}
                      onChange={(e) => handleConfigChange('allowedFileTypes', e.target.value)}
                      placeholder="用逗号分隔，如：jpg,png,pdf"
                      rows={3}
                      className="border border-gray-300 focus:border-gray-400 transition-colors"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* 通知设置 */}
              <Card className="bg-white border shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <span className="text-2xl">🔔</span>
                    <span>通知设置</span>
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    配置系统通知和邮件设置
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                  <div className="space-y-2">
                    <Label htmlFor="emailNotifications" className="text-sm font-medium text-gray-700">邮件通知</Label>
                    <Select value={config.emailNotifications} onValueChange={(value) => handleConfigChange('emailNotifications', value)}>
                      <SelectTrigger className="border border-gray-300 focus:border-gray-400">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="enabled">✅ 启用</SelectItem>
                        <SelectItem value="disabled">❌ 禁用</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="autoAssignment" className="text-sm font-medium text-gray-700">自动分配</Label>
                    <Select value={config.autoAssignment} onValueChange={(value) => handleConfigChange('autoAssignment', value)}>
                      <SelectTrigger className="border border-gray-300 focus:border-gray-400 text-gray-900">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="enabled">✅ 启用</SelectItem>
                        <SelectItem value="disabled">❌ 禁用</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="requireApproval" className="text-sm font-medium text-gray-700">需要审批</Label>
                    <Select value={config.requireApproval} onValueChange={(value) => handleConfigChange('requireApproval', value)}>
                      <SelectTrigger className="border border-gray-300 focus:border-gray-400 text-gray-900">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="enabled">✅ 启用</SelectItem>
                        <SelectItem value="disabled">❌ 禁用</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* 安全设置 */}
              <Card className="bg-white border shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <span className="text-2xl">🔒</span>
                    <span>安全设置</span>
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    配置系统安全相关设置
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                  <div className="space-y-2">
                    <Label htmlFor="sessionTimeout" className="text-sm font-medium text-gray-700">会话超时 (小时)</Label>
                    <Input
                      id="sessionTimeout"
                      type="number"
                      value={config.sessionTimeout}
                      onChange={(e) => handleConfigChange('sessionTimeout', e.target.value)}
                      className="border border-gray-300 focus:border-gray-400 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxLoginAttempts" className="text-sm font-medium text-gray-700">最大登录尝试次数</Label>
                    <Input
                      id="maxLoginAttempts"
                      type="number"
                      value={config.maxLoginAttempts}
                      onChange={(e) => handleConfigChange('maxLoginAttempts', e.target.value)}
                      className="border border-gray-300 focus:border-gray-400 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="passwordMinLength" className="text-sm font-medium text-gray-700">密码最小长度</Label>
                    <Input
                      id="passwordMinLength"
                      type="number"
                      value={config.passwordMinLength}
                      onChange={(e) => handleConfigChange('passwordMinLength', e.target.value)}
                      className="border border-gray-300 focus:border-gray-400 transition-colors text-gray-900 placeholder:text-gray-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="enableTwoFactor" className="text-sm font-medium text-gray-700">双因子认证</Label>
                    <Select value={config.enableTwoFactor} onValueChange={(value) => handleConfigChange('enableTwoFactor', value)}>
                      <SelectTrigger className="border border-gray-300 focus:border-gray-400">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="enabled">✅ 启用</SelectItem>
                        <SelectItem value="disabled">❌ 禁用</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 系统信息 */}
            <Card className="bg-white border shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-900">系统信息</CardTitle>
                <CardDescription>暂无系统统计信息</CardDescription>
              </CardHeader>
            </Card>

            {/* 操作按钮 */}
            <div className="flex justify-center space-x-4">
              <Button 
                variant="outline" 
                onClick={handleReset}
                className="px-6 py-2"
              >
                重置为空
              </Button>
              <Button 
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="px-6 py-2"
              >
                {saving ? '保存中...' : '保存配置'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}