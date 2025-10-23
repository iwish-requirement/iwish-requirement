'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requirementService } from '@/services/requirement'
import { authService } from '@/services/auth'
import { BarChart3, Hourglass, Loader2, User2, Plus, ClipboardList, Users } from 'lucide-react'
import { getSmartDepartmentDisplayName, getSmartPositionDisplayName } from '@/utils/displayHelpers'
import type { Requirement, User } from '@/types'

interface DashboardStats {
  totalRequirements: number
  pendingRequirements: number
  inProgressRequirements: number
  completedRequirements: number
  myRequirements: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalRequirements: 0,
    pendingRequirements: 0,
    inProgressRequirements: 0,
    completedRequirements: 0,
    myRequirements: 0
  })
  const [recentRequirements, setRecentRequirements] = useState<Requirement[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        // 获取当前用户信息
        const user = await authService.getCurrentUser()
        setCurrentUser(user)

        // 获取需求统计
        const requirementsResponse = await requirementService.getRequirements({
          page: 1,
          limit: 100
        })

        const requirements = requirementsResponse.data
        
        const dashboardStats: DashboardStats = {
          totalRequirements: requirements.length,
          pendingRequirements: requirements.filter(r => r.status === 'not_started').length,
          inProgressRequirements: requirements.filter(r => r.status === 'in_progress').length,
          completedRequirements: requirements.filter(r => r.status === 'completed').length,
          myRequirements: requirements.filter(r => r.created_by === user?.id).length
        }

        setStats(dashboardStats)

        // 获取最近的需求
        const recentResponse = await requirementService.getRequirements({
          page: 1,
          limit: 5
        })
        // 计算部门/岗位中文显示名（不改原字段，仅加临时字段用于展示）
        const mapped = await Promise.all(
          (recentResponse.data || []).map(async (r) => {
            const [dept, pos] = await Promise.all([
              getSmartDepartmentDisplayName(r.department as any),
              getSmartPositionDisplayName(r.assignee_position as any)
            ])
            return { ...r, _deptDisplay: dept, _posDisplay: pos } as any
          })
        )
        setRecentRequirements(mapped as Requirement[])

      } catch (error) {
        console.error('加载仪表板数据失败:', error)
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [])

  const getStatusText = (status: string) => {
    switch (status) {
      case 'not_started':
        return '未开始'
      case 'in_progress':
        return '进行中'
      case 'completed':
        return '已完成'
      case 'cancelled':
        return '已取消'
      default:
        return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'not_started':
        return 'text-gray-700 bg-gray-100'
      case 'in_progress':
        return 'text-blue-600 bg-blue-100'
      case 'completed':
        return 'text-green-600 bg-green-100'
      case 'cancelled':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high':
        return '高'
      case 'medium':
        return '中'
      case 'low':
        return '低'
      default:
        return priority
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600'
      case 'medium':
        return 'text-yellow-600'
      case 'low':
        return 'text-green-600'
      default:
        return 'text-gray-600'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-200 h-32 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 欢迎信息 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">仪表板</h1>
        <p className="text-gray-600 text-base">
          欢迎回来，{currentUser?.full_name || currentUser?.email}！这里是您的工作概览。
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">总需求数</CardTitle>
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRequirements}</div>
            <p className="text-sm text-muted-foreground">
              系统中的所有需求
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">待处理</CardTitle>
            <Hourglass className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingRequirements}</div>
            <p className="text-sm text-muted-foreground">
              等待处理的需求
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">进行中</CardTitle>
            <Loader2 className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgressRequirements}</div>
            <p className="text-sm text-muted-foreground">
              正在处理的需求
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">我的需求</CardTitle>
            <User2 className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.myRequirements}</div>
            <p className="text-xs text-muted-foreground">
              我提交的需求
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 最近需求 */}
      <Card>
        <CardHeader>
          <CardTitle>最近需求</CardTitle>
          <CardDescription>
            最新提交的需求列表
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentRequirements.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              暂无需求数据
            </div>
          ) : (
            <div className="space-y-4">
              {recentRequirements.map((requirement) => (
                <div
                  key={requirement.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">
                      {requirement.title}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {requirement.description}
                    </p>
                    <div className="flex items-center space-x-4 mt-2">
                      <span className="text-sm text-gray-500">
                        {(requirement as any)._deptDisplay || requirement.department} - {(requirement as any)._posDisplay || requirement.assignee_position}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(requirement.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(requirement.priority)}`}
                    >
                      {getPriorityText(requirement.priority)}
                    </span>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${getStatusColor(requirement.status)}`}
                    >
                      {getStatusText(requirement.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 快速操作 */}
      <Card>
        <CardHeader>
          <CardTitle>快速操作</CardTitle>
          <CardDescription>
            常用功能快速入口
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/dashboard/requirements/create"
              className="flex items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Plus className="mr-3 h-5 w-5 text-muted-foreground" />
              <div>
                <h3 className="text-base font-medium">创建需求</h3>
                <p className="text-sm text-gray-600">提交新的需求</p>
              </div>
            </a>
            
            <a
              href="/dashboard/requirements"
              className="flex items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ClipboardList className="mr-3 h-5 w-5 text-muted-foreground" />
              <div>
                <h3 className="text-base font-medium">需求列表</h3>
                <p className="text-sm text-gray-600">查看所有需求</p>
              </div>
            </a>

            {currentUser?.role && ['super_admin', 'admin'].includes(currentUser.role) && (
              <a
                href="/dashboard/users"
                className="flex items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Users className="mr-3 h-5 w-5 text-muted-foreground" />
                <div>
                  <h3 className="text-base font-medium">用户管理</h3>
                  <p className="text-sm text-gray-600">管理系统用户</p>
                </div>
              </a>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}