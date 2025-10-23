'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Plus, 
  Search, 
  Filter,
  Clock,
  Play,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Pause,
  Building,
  User as UserIcon,
  Calendar,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { requirementService } from '@/services/requirement'
import { userService } from '@/services/user'
import { departmentService } from '@/services/department'
import { usePermissions } from '@/hooks/usePermissions'
import type { Requirement, User } from '@/types'
import { getSmartDepartmentDisplayName, getSmartPositionDisplayName } from '@/utils/displayHelpers'

// 状态配置
const statusConfig = {
  not_started: { label: '未开始', color: 'bg-gray-100 text-gray-800', icon: Clock },
  in_progress: { label: '处理中', color: 'bg-blue-100 text-blue-800', icon: Play },
  completed: { label: '已完成', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  delayed: { label: '沟通延期', color: 'bg-orange-100 text-orange-800', icon: Pause },
  cancelled: { label: '不做处理', color: 'bg-red-100 text-red-800', icon: XCircle }
}

// 优先级配置
const priorityConfig = {
  low: { label: '低', color: 'bg-gray-100 text-gray-800' },
  medium: { label: '中', color: 'bg-blue-100 text-blue-800' },
  high: { label: '高', color: 'bg-orange-100 text-orange-800' },
  urgent: { label: '紧急', color: 'bg-red-100 text-red-800' }
}

export default function DepartmentRequirementsPage() {
  const params = useParams()
  const router = useRouter()
  const { user, hasPermission, hasAnyPermission, canEditRequirement, canDeleteRequirement, loading: permLoading } = usePermissions()
  const departmentCode = params.department as string

  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [departmentInfo, setDepartmentInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [requirementDisplayNames, setRequirementDisplayNames] = useState<Record<string, { department: string; position: string }>>({})

  // 权限检查
  const canAccessDepartment = (permission: string) => {
    if (!user) return false
    
    // 使用权限系统检查
    return hasPermission(permission) || hasAnyPermission([
      'requirement.view_all',
      'requirement.view_own', 
      'requirement.view',
      'requirement.create'
    ])
  }

  // 加载数据
  useEffect(() => {
    // 权限未就绪或用户未就绪时，不进行权限判断，避免刷新时误判
    if (permLoading || !user) return

    const loadData = async () => {
      try {
        setLoading(true)
        
        // 检查权限 - 员工可以查看各部门的需求
        const canViewRequirements = hasAnyPermission([
          'requirement.view',
          'requirement.view_all', 
          'requirement.view_own',
          'requirement.create'
        ])
        
        if (!canViewRequirements) {
          toast.error('您没有权限访问此页面')
          router.push('/dashboard')
          return
        }

        // 并行加载数据
        const [requirementsResponse, usersResponse, departmentsData] = await Promise.all([
          requirementService.getRequirements(),
          userService.getUsers(),
          departmentService.getDepartments()
        ])

        // 确保需求数据是数组
        let requirementsData: any[] = []
        if (requirementsResponse && typeof requirementsResponse === 'object') {
          if (Array.isArray(requirementsResponse)) {
            requirementsData = requirementsResponse
          } else if (requirementsResponse.data && Array.isArray(requirementsResponse.data)) {
            requirementsData = requirementsResponse.data
          }
        }

        // 确保用户数据是数组
        let usersData: any[] = []
        if (usersResponse && typeof usersResponse === 'object') {
          if (Array.isArray(usersResponse)) {
            usersData = usersResponse
          } else if (usersResponse.data && Array.isArray(usersResponse.data)) {
            usersData = usersResponse.data
          }
        }

        // 根据部门代码筛选需求
        const departmentRequirements = requirementsData.filter(req => {
          // 支持部门代码和部门名称匹配
          return req.department === departmentCode || 
                 req.department_code === departmentCode ||
                 req.assignee_department === departmentCode ||
                 req.assignee_department_code === departmentCode
        })

        // 查找部门信息
        const deptInfo = departmentsData.find(dept => 
          dept.code === departmentCode || dept.name === departmentCode
        )

        setRequirements(departmentRequirements)
        setUsers(usersData)
        setDepartmentInfo(deptInfo || { name: departmentCode, code: departmentCode })
        
        // 加载显示名称
        const displayNames: Record<string, { department: string; position: string }> = {}
        for (const req of departmentRequirements) {
          const [deptName, posName] = await Promise.all([
            getSmartDepartmentDisplayName(req.department),
            getSmartPositionDisplayName(req.assignee_position)
          ])
          displayNames[req.id] = { department: deptName, position: posName }
        }
        setRequirementDisplayNames(displayNames)
        
      } catch (error) {
        console.error('加载数据失败:', error)
        toast.error('加载数据失败')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user, permLoading, departmentCode, router])

  // 筛选需求
  const filteredRequirements = requirements.filter(requirement => {
    const matchesSearch = !searchQuery || 
      requirement.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      requirement.description.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || requirement.status === statusFilter
    const matchesPriority = priorityFilter === 'all' || requirement.priority === priorityFilter
    
    return matchesSearch && matchesStatus && matchesPriority
  })

  // 获取用户显示名称
  const getUserDisplayName = (userId: string) => {
    const user = users.find(u => u.id === userId)
    return user?.full_name || user?.email || '未知用户'
  }

  // 跳转到需求详情
  const handleRequirementClick = (requirementId: string) => {
    router.push(`/dashboard/requirements/detail/${requirementId}`)
  }

  // 跳转到创建需求
  const handleCreateRequirement = () => {
    router.push('/dashboard/requirements/create')
  }

  if (loading || permLoading) {
    return (
      <div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">加载中...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                {departmentInfo?.name || departmentCode}需求管理
              </h1>
              <p className="text-gray-600 mt-1">
                管理和跟踪{departmentInfo?.name || departmentCode}的所有需求
              </p>
            </div>
          </div>
          
          {hasPermission('requirement.create') && (
            <Button onClick={handleCreateRequirement} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" />
              创建需求
            </Button>
          )}
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">总需求数</p>
                <p className="text-2xl font-bold text-gray-900">{requirements.length}</p>
              </div>
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Building className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">待处理</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {requirements.filter(r => r.status === 'not_started').length}
                </p>
              </div>
              <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <Clock className="h-4 w-4 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">处理中</p>
                <p className="text-2xl font-bold text-blue-600">
                  {requirements.filter(r => r.status === 'in_progress').length}
                </p>
              </div>
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Play className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">已完成</p>
                <p className="text-2xl font-bold text-green-600">
                  {requirements.filter(r => r.status === 'completed').length}
                </p>
              </div>
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 筛选和搜索 */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="搜索需求标题或描述..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有状态</SelectItem>
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="优先级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有优先级</SelectItem>
                  {Object.entries(priorityConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 需求列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>需求列表</span>
            <Badge variant="outline">
              {filteredRequirements.length} 个需求
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredRequirements.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无需求</h3>
              <p className="text-gray-500 mb-4">
                {requirements.length === 0 
                  ? `${departmentInfo?.name || departmentCode}还没有任何需求`
                  : '没有符合筛选条件的需求'
                }
              </p>
              {hasPermission('requirement.create') && requirements.length === 0 && (
                <Button onClick={handleCreateRequirement}>
                  <Plus className="mr-2 h-4 w-4" />
                  创建第一个需求
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRequirements.map((requirement) => {
                const StatusIcon = statusConfig[requirement.status as keyof typeof statusConfig]?.icon || Clock
                
                return (
                  <div
                    key={requirement.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleRequirementClick(requirement.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold text-gray-900 hover:text-blue-600">
                            {requirement.title}
                          </h3>
                          <Badge className={statusConfig[requirement.status as keyof typeof statusConfig]?.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig[requirement.status as keyof typeof statusConfig]?.label}
                          </Badge>
                          <Badge className={priorityConfig[requirement.priority as keyof typeof priorityConfig]?.color}>
                            {priorityConfig[requirement.priority as keyof typeof priorityConfig]?.label}
                          </Badge>
                        </div>
                        
                        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                          {requirement.description}
                        </p>
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <div className="flex items-center space-x-1">
                            <UserIcon className="w-4 h-4" />
                            <span>创建者: {getUserDisplayName(requirement.created_by)}</span>
                          </div>
                          
                          {requirement.assignee_id && (
                            <div className="flex items-center space-x-1">
                              <UserIcon className="w-4 h-4" />
                              <span>执行者: {getUserDisplayName(requirement.assignee_id)}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center space-x-1">
                            <Building className="w-4 h-4" />
                            <span>部门: {requirementDisplayNames[requirement.id]?.department || requirement.department}</span>
                          </div>
                          
                          <div className="flex items-center space-x-1">
                            <UserIcon className="w-4 h-4" />
                            <span>岗位: {requirementDisplayNames[requirement.id]?.position || requirement.assignee_position}</span>
                          </div>
                          
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(requirement.created_at).toLocaleDateString()}</span>
                          </div>
                          
                          {requirement.due_date && (
                            <div className="flex items-center space-x-1">
                              <Clock className="w-4 h-4" />
                              <span>截止: {new Date(requirement.due_date).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="ml-4 flex items-center space-x-2">
                        {/* 评分显示 */}
                        {requirement.overall_rating && (
                          <div className="text-right mr-4">
                            <div className="text-sm text-gray-500">评分</div>
                            <div className="text-lg font-semibold text-yellow-600">
                              {requirement.overall_rating.toFixed(1)}
                            </div>
                          </div>
                        )}
                        
                        {/* 操作按钮 */}
                        <div className="flex space-x-1" onClick={(e) => e.stopPropagation()}>
                          {canEditRequirement(requirement) && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => router.push(`/dashboard/requirements/edit/${requirement.id}`)}
                              className="hover:bg-green-50 hover:text-green-600"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canDeleteRequirement(requirement) && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={async () => {
                                if (!confirm('确定要删除这个需求吗？')) return
                                try {
                                  await requirementService.deleteRequirement(requirement.id)
                                  // 本地移除，避免与后端不一致；如需更稳妥可重新加载列表
                                  setRequirements(prev => prev.filter(req => req.id !== requirement.id))
                                  toast.success('需求删除成功')
                                } catch (error) {
                                  console.error('删除需求失败:', error)
                                  toast.error('删除失败，请重试')
                                }
                              }}
                              className="hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}