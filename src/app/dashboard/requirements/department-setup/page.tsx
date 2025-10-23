'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  Building, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  ArrowLeft,
  Settings
} from 'lucide-react'
import { toast } from 'sonner'
import { DepartmentNavigationManager } from '@/utils/departmentNavigation'
import Link from 'next/link'

export default function DepartmentSetupPage() {
  const [loading, setLoading] = useState(false)
  const [setupStatus, setSetupStatus] = useState<{
    created: number
    errors: string[]
  } | null>(null)

  const handleCreateDepartmentNavigations = async () => {
    setLoading(true)
    setSetupStatus(null)
    
    try {
      const createdCount = await DepartmentNavigationManager.createDepartmentNavigations()
      
      setSetupStatus({
        created: createdCount || 0,
        errors: []
      })
      
      if ((createdCount || 0) > 0) {
        toast.success(`成功创建 ${createdCount} 个部门导航菜单`)
      } else {
        toast.info('所有部门导航菜单已存在，无需创建')
      }
    } catch (error) {
      console.error('创建部门导航失败:', error)
      setSetupStatus({
        created: 0,
        errors: [error instanceof Error ? error.message : '未知错误']
      })
      toast.error('创建部门导航失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCleanupNavigations = async () => {
    setLoading(true)
    
    try {
      await DepartmentNavigationManager.cleanupInvalidDepartmentNavigations()
      toast.success('清理完成')
    } catch (error) {
      console.error('清理失败:', error)
      toast.error('清理失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Link href="/dashboard/requirements">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回需求管理
          </Button>
        </Link>
        <div className="h-6 w-px bg-gray-300"></div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            部门导航设置
          </h1>
          <p className="text-muted-foreground mt-2">
            为每个部门创建专属的需求管理页面
          </p>
        </div>
      </div>

      {/* 功能说明 */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Building className="h-5 w-5" />
            <span>部门导航管理</span>
          </CardTitle>
          <CardDescription>
            自动为每个活跃的部门创建专属的需求管理页面，让各部门能够独立管理自己的需求。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">功能特点：</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• 为每个部门创建独立的需求列表页面</li>
              <li>• 自动根据部门类型选择合适的图标</li>
              <li>• 支持权限控制，确保数据安全</li>
              <li>• 自动清理已删除部门的导航菜单</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={handleCreateDepartmentNavigations}
              disabled={loading}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  创建中...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  创建部门导航
                </>
              )}
            </Button>

            <Button 
              variant="outline"
              onClick={handleCleanupNavigations}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  清理中...
                </>
              ) : (
                <>
                  <Settings className="mr-2 h-4 w-4" />
                  清理无效导航
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 操作结果 */}
      {setupStatus && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {setupStatus.errors.length === 0 ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              <span>操作结果</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {setupStatus.created > 0 && (
              <div className="flex items-center space-x-2">
                <Badge className="bg-green-100 text-green-800">
                  成功创建 {setupStatus.created} 个导航菜单
                </Badge>
              </div>
            )}

            {setupStatus.created === 0 && setupStatus.errors.length === 0 && (
              <div className="flex items-center space-x-2">
                <Badge variant="secondary">
                  所有部门导航已存在
                </Badge>
              </div>
            )}

            {setupStatus.errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-red-600">错误信息：</p>
                {setupStatus.errors.map((error, index) => (
                  <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                    {error}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 使用说明 */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>使用说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <h4 className="font-medium">1. 创建部门导航</h4>
            <p className="text-sm text-gray-600">
              点击"创建部门导航"按钮，系统会自动为所有活跃的部门创建专属的需求管理页面。
              每个部门的页面路径格式为：<code className="bg-gray-100 px-1 rounded">/dashboard/requirements/[部门代码]</code>
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">2. 访问部门页面</h4>
            <p className="text-sm text-gray-600">
              创建完成后，您可以在左侧导航菜单的"需求管理"下看到各部门的子菜单。
              点击即可进入对应部门的专属需求管理页面。
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">3. 清理无效导航</h4>
            <p className="text-sm text-gray-600">
              当部门被删除或停用时，可以使用"清理无效导航"功能自动移除对应的导航菜单。
            </p>
          </div>

          <div className="bg-yellow-50 p-3 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>注意：</strong>创建导航菜单需要管理员权限。如果您没有看到某些部门的菜单，
              请检查部门是否处于活跃状态，以及您是否有相应的访问权限。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}