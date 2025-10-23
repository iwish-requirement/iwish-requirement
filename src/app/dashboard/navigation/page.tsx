'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  FileText, 
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react'
import { toast } from 'sonner'
import { NavigationConfigService } from '@/services/config'
import { DepartmentNavigationCreator } from '@/components/DepartmentNavigationCreator'

interface NavigationItem {
  id: string
  name: string
  path: string
  icon: string
  parent_id?: string | null
  order: number
  visible: boolean
  children?: NavigationItem[]
}

export default function NavigationPage() {
  const [navigationItems, setNavigationItems] = useState<NavigationItem[]>([])
  const [initialLoading, setInitialLoading] = useState(true)

  // 加载导航数据
  useEffect(() => {
    loadNavigationData()
  }, [])

  const loadNavigationData = async () => {
    try {
      setInitialLoading(true)
      const navigationConfigs = await NavigationConfigService.getNavigationConfigs()
      
      // 转换导航数据
      const navItems: NavigationItem[] = navigationConfigs.map(config => ({
        id: config.id,
        name: config.name,
        path: config.path,
        icon: config.icon || 'FileText',
        parent_id: config.parent_id || null,
        order: config.order_index,
        visible: config.is_active
      }))
      setNavigationItems(navItems)
    } catch (error) {
      console.error('加载数据失败:', error)
      toast.error('加载数据失败')
    } finally {
      setInitialLoading(false)
    }
  }

  const toggleVisibility = async (itemId: string) => {
    try {
      const item = navigationItems.find(i => i.id === itemId)
      if (!item) return
      
      await NavigationConfigService.updateNavigationItem(itemId, {
        is_active: !item.visible
      })
      
      setNavigationItems(prev =>
        prev.map(navItem =>
          navItem.id === itemId ? { ...navItem, visible: !navItem.visible } : navItem
        )
      )
      
      toast.success(`导航项${item.visible ? '隐藏' : '显示'}成功`)
    } catch (error) {
      console.error('更新导航项可见性失败:', error)
      toast.error('更新失败')
    }
  }

  if (initialLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">加载导航数据中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">导航管理</h1>
        <p className="text-gray-600">管理系统导航菜单和部门需求页面</p>
      </div>

      {/* 部门需求导航管理 */}
      <DepartmentNavigationCreator onNavigationChange={loadNavigationData} />

      {/* 所有导航项列表 */}
      <Card>
        <CardHeader>
          <CardTitle>所有导航项</CardTitle>
          <CardDescription>
            查看和管理系统中的所有导航项
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {navigationItems.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">暂无导航项</p>
              </div>
            ) : (
              navigationItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 flex-wrap gap-3">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-gray-600" />
                    <div>
                      <h4 className="font-medium">{item.name}</h4>
                      <p className="text-sm text-gray-500 break-words">{item.path}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Badge variant={item.visible ? "default" : "secondary"}>
                      {item.visible ? "显示" : "隐藏"}
                    </Badge>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleVisibility(item.id)}
                    >
                      {item.visible ? (
                        <Eye className="h-4 w-4 text-green-600" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}