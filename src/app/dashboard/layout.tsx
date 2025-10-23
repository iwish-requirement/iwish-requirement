'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { PermissionProvider, usePermissions } from '@/hooks/usePermissions'
import { navigationRefreshManager } from '@/hooks/useNavigationRefresh'
import { authService } from '@/services/auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { User } from '@/types'
import {
  Search, LogOut, ChevronDown, ChevronRight, LayoutDashboard, FileText, Plus,
  Users, Settings, Shield, Cog, Menu, Award, BarChart2, ClipboardList, Building, X
} from 'lucide-react'
import { getSmartDepartmentDisplayName, getSmartPositionDisplayName } from '@/utils/displayHelpers'

interface NavigationItem {
  id: string
  name: string
  path: string
  icon: string
  visible: boolean
  children?: NavigationItem[]
}

interface DashboardLayoutProps {
  children: React.ReactNode
}

function DashboardContent({ children }: DashboardLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [deptDisplay, setDeptDisplay] = useState('')
  const [posDisplay, setPosDisplay] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  // 移动端侧栏抽屉开关
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [navigationItems, setNavigationItems] = useState<NavigationItem[]>([])
  const [dynamicNavigationItems, setDynamicNavigationItems] = useState<any[]>([])

  const { hasPermission, hasAnyPermission, canManageSystem, loading: permissionsLoading } = usePermissions()

  // 动态导航
  const loadDynamicNavigation = useCallback(async () => {
    try {
      const { NavigationConfigService } = await import('@/services/config')
      const configs = await NavigationConfigService.getNavigationConfigs()
      setDynamicNavigationItems(configs || [])
    } catch (e) {
      console.error('加载动态导航失败:', e)
      setDynamicNavigationItems([])
    }
  }, [])

  useEffect(() => {
    loadDynamicNavigation()
    const unsub = navigationRefreshManager.subscribe(loadDynamicNavigation)
    return unsub
  }, [loadDynamicNavigation])

  // 认证
  useEffect(() => {
    const run = async () => {
      try {
        const current = await authService.getCurrentUser()
        if (!current) {
          router.push('/login')
          return
        }
        setUser(current)
      } catch (e) {
        console.error('认证失败', e)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [router])

  // 用户部门/岗位中文显示（仅展示用）
  useEffect(() => {
    const run = async () => {
      if (!user) {
        setDeptDisplay('')
        setPosDisplay('')
        return
      }
      const d = user.department ? await getSmartDepartmentDisplayName(user.department) : ''
      const p = user.position ? await getSmartPositionDisplayName(user.position) : ''
      setDeptDisplay(d)
      setPosDisplay(p)
    }
    run()
  }, [user?.id, user?.department, user?.position])

  // 登录成功后自动订阅 Web Push（仅当用户存在且有公钥）
  useEffect(() => {
    const run = async () => {
      try {
        if (!user?.id) return
        const { setupPushForUser } = await import('@/services/push-notify')
        await setupPushForUser(user.id)
      } catch (e) {
        console.warn('[WebPush] 登录后订阅失败:', e)
      }
    }
    run()
  }, [user?.id])

  // 基于权限的导航组装
  const getIcon = (iconName: string) => {
    const icons: Record<string, any> = {
      LayoutDashboard, FileText, Plus, Users, Settings, Shield, Cog, Menu, Award, BarChart2, ClipboardList, Building
    }
    return icons[iconName] || FileText
  }

  const getNavigationItems = useCallback((dynamicItems: any[] = []): NavigationItem[] => {
    const items: NavigationItem[] = [
      { id: '1', name: '仪表板', path: '/dashboard', icon: 'LayoutDashboard', visible: true }
    ]

    const requirementsChildren: NavigationItem[] = [
      { id: '2-1', name: '需求列表', path: '/dashboard/requirements', icon: 'FileText', visible: hasAnyPermission(['requirement.view_own','requirement.view_all','requirement.view','requirement.create']) }
    ]

    dynamicItems.forEach((navItem: any) => {
      if (navItem.parent_id === 'dcfeeb9c-40e1-436c-b545-76780c976f89') {
        const ok = navItem.required_permissions?.length
          ? navItem.required_permissions.some((p: string) =>
              hasPermission(p) || hasAnyPermission(['requirement.view_own','requirement.view_all','requirement.view','requirement.create']))
          : hasAnyPermission(['requirement.view_own','requirement.view_all','requirement.view','requirement.create'])
        if (ok) {
          requirementsChildren.push({ id: navItem.id, name: navItem.name, path: navItem.path, icon: navItem.icon || 'Building', visible: true })
        }
      }
    })

    items.push({ id: '2', name: '需求管理', path: '/dashboard/requirements', icon: 'FileText', visible: true, children: requirementsChildren })

    const ratingChildren: NavigationItem[] = []
    if (canManageSystem || hasPermission('rating.form.manage')) {
      ratingChildren.push({ id: '4-0', name: '评分模板管理', path: '/dashboard/rating-forms', icon: 'Award', visible: true })
    }
    ratingChildren.push(
      { id: '4-1', name: '本月评分', path: '/dashboard/ratings/monthly', icon: 'ClipboardList', visible: hasAnyPermission(['requirement.view_own','requirement.view_all','requirement.view','requirement.create']) },
      { id: '4-2', name: '评分概览', path: '/dashboard/ratings/stats', icon: 'BarChart2', visible: true }
    )
    items.push({ id: '4', name: '评分', path: '/dashboard/ratings', icon: 'Award', visible: true, children: ratingChildren })

    if (canManageSystem) {
      const adminChildren: NavigationItem[] = []
      if (hasPermission('user.manage')) adminChildren.push({ id: '3-1', name: '用户管理', path: '/dashboard/users', icon: 'Users', visible: true })
      if (hasPermission('permission.manage')) adminChildren.push({ id: '3-2', name: '角色权限', path: '/dashboard/roles', icon: 'Shield', visible: true })
      if (hasPermission('navigation.manage')) adminChildren.push({ id: '3-3', name: '导航管理', path: '/dashboard/navigation', icon: 'Menu', visible: true })
      if (hasPermission('form.manage')) adminChildren.push({ id: '3-4', name: '表单配置', path: '/dashboard/forms', icon: 'FileText', visible: true })
      if (hasPermission('rating.form.manage')) adminChildren.push({ id: '3-5', name: '评分模板管理', path: '/dashboard/rating-forms', icon: 'Award', visible: true })
      if (hasPermission('user.manage')) adminChildren.push({ id: '3-6', name: '部门岗位管理', path: '/dashboard/departments', icon: 'Building', visible: true })
      if (hasPermission('system.manage')) adminChildren.push({ id: '3-7', name: '系统配置', path: '/dashboard/system', icon: 'Cog', visible: true })
      if (adminChildren.length) items.push({ id: '3', name: '系统管理', path: '/dashboard/admin', icon: 'Settings', visible: true, children: adminChildren })
    }

    return items
  }, [hasPermission, hasAnyPermission, canManageSystem])

  useEffect(() => {
    if (!loading && !permissionsLoading) {
      setNavigationItems(getNavigationItems(dynamicNavigationItems))
    }
  }, [loading, permissionsLoading, dynamicNavigationItems, getNavigationItems])

  // 路由变化时自动关闭移动端抽屉
  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [pathname])

  // 窗口变为桌面断点时，确保关闭移动端抽屉
  useEffect(() => {
    const handler = () => {
      if (window.innerWidth >= 1024) setMobileSidebarOpen(false)
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const filteredItems = useMemo(() => {
    const base = navigationItems.filter(i => i.visible)
    if (!searchQuery) return base
    const q = searchQuery.toLowerCase()
    return base.map(i => ({
      ...i,
      children: i.children?.filter(c => c.visible && c.name.toLowerCase().includes(q))
    })).filter(i => i.name.toLowerCase().includes(q) || (i.children && i.children.length > 0))
  }, [navigationItems, searchQuery])

  const toggleExpanded = (id: string) => {
    const s = new Set(expandedItems)
    s.has(id) ? s.delete(id) : s.add(id)
    setExpandedItems(s)
  }

  const renderMenuItem = (item: NavigationItem, level = 0, isMobile = false) => {
    const Icon = getIcon(item.icon)
    const isActive = pathname === item.path
    const isExpanded = expandedItems.has(item.id)
    const hasChildren = !!(item.children && item.children.length)
    const paddingLeft = level === 0 ? 'pl-3' : 'pl-8'

    return (
      <div key={item.id}>
        <div
          className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 ${isActive ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700' : 'text-gray-700 hover:bg-gray-50'} ${paddingLeft}`}
          onClick={() => {
            if (hasChildren) {
              toggleExpanded(item.id)
            } else {
              router.push(item.path)
              if (isMobile) setMobileSidebarOpen(false)
            }
          }}
        >
          <div className="flex items-center space-x-3">
            <Icon className={`h-4 w-4 ${isActive ? 'text-blue-700' : 'text-gray-500'}`} />
            {!sidebarCollapsed && <span className={`text-sm font-medium ${isActive ? 'text-blue-700' : 'text-gray-700'}`}>{item.name}</span>}
          </div>
          {!sidebarCollapsed && hasChildren && (
            <div className="flex items-center space-x-1">
              {item.children && item.children.filter(c => c.visible).length > 0 && (
                <Badge variant="secondary" className="text-xs">{item.children.filter(c => c.visible).length}</Badge>
              )}
              {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
            </div>
          )}
        </div>

        {hasChildren && isExpanded && !sidebarCollapsed && (
          <div className="mt-1 space-y-1">
            {item.children?.filter(c => c.visible).map(c => renderMenuItem(c, level + 1))}
          </div>
        )}
      </div>
    )
  }

  const handleLogout = async () => {
    try {
      await authService.signOut()
      router.push('/login')
    } catch (e) {
      console.error('登出失败', e)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部栏固定 */}
      <header className="bg-white shadow-sm border-b border-gray-200 fixed lg:sticky top-0 z-50 w-full">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const isDesktop = typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
                  if (isDesktop) {
                    setSidebarCollapsed(prev => !prev)
                  } else {
                    setMobileSidebarOpen(prev => !prev)
                  }
                }}
                className="hover:bg-gray-100"
                title={sidebarCollapsed ? '展开侧边栏' : '收缩侧边栏'}
              >
                {sidebarCollapsed ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">iW</span>
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">iWish 需求管理系统</h1>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-3">
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">{user.full_name || user.email}</div>
                  <div className="text-xs text-gray-500">
                    {(user as any).title ? (user as any).title : `${deptDisplay || user?.department || ''}${(deptDisplay || user?.department) && (posDisplay || user?.position) ? ' - ' : ''}${posDisplay || user?.position || ''}`}
                  </div>
                </div>
                <button
                  onClick={() => router.push('/dashboard/profile')}
                  className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center hover:from-blue-600 hover:to-purple-600 transition-all duration-200 cursor-pointer"
                  title="个人中心"
                >
                  <span className="text-white font-medium text-sm">{(user.full_name || user.email || '').charAt(0).toUpperCase()}</span>
                </button>
              </div>

              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-500 hover:text-gray-700">
                <LogOut className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline">登出</span>
              </Button>
            </div>
          </div>
        </div>
      </header>
      {/* 移动端占位，避免 fixed 头部遮挡内容 */}
      <div className="h-16 lg:h-0" aria-hidden></div>

      <div className="flex">
        {/* 固定侧栏 */}
        <nav
          className={`hidden lg:block fixed left-0 top-16 z-40 bg-white shadow-sm border-r border-gray-200 transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-64'} h-[calc(100vh-64px)]`}
        >
          <div className="p-4 h-full overflow-y-auto">
            {!sidebarCollapsed && (
              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="搜索菜单..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-gray-50 border-gray-200 focus:bg-white"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              {filteredItems.length === 0 ? (
                !sidebarCollapsed && (
                  <div className="text-center py-8">
                    <Search className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">未找到匹配的菜单</p>
                  </div>
                )
              ) : (
                filteredItems.map(item => renderMenuItem(item))
              )}
            </div>
          </div>
        </nav>

        {/* 移动端抽屉与遮罩 */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setMobileSidebarOpen(false)} />
        )}
        <nav
          className={`lg:hidden fixed left-0 top-16 z-40 bg-white shadow-sm border-r border-gray-200 w-72 max-w-[80vw] h-[calc(100vh-64px)] transform transition-transform duration-300 ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="p-4 h-full overflow-y-auto">
            <div className="space-y-2">
              {filteredItems.length === 0 ? (
                <div className="text-center py-8">
                  <Search className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">未找到匹配的菜单</p>
                </div>
              ) : (
                filteredItems.map(item => renderMenuItem(item, 0, true))
              )}
            </div>
          </div>
        </nav>

        {/* 占位侧栏仅桌面端生效，避免主区域被覆盖 */}
        <div aria-hidden className={`hidden lg:block ${sidebarCollapsed ? 'w-16' : 'w-64'}`}></div>

        {/* 主内容区域（统一宽度与边距） */}
        <main className="flex-1">
          <div className="mx-auto w-full max-w-full lg:max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6 overflow-x-auto">{children}</div>
        </main>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <PermissionProvider>
      <DashboardContent>{children}</DashboardContent>
    </PermissionProvider>
  )
}