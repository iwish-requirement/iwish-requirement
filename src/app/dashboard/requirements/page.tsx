'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  Edit, 
  Trash2, 
  Calendar, 
  User, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Palette,
  Video,
  Monitor,
  Building,
  Star,
  Settings
} from 'lucide-react'
import { toast } from 'sonner'

import { requirementService } from '@/services/requirement'
import { departmentService, type Department, type Position } from '@/services/department'
import { formSchemaService, type FormField, type FormSchema } from '@/services/formSchema'
import { userService } from '@/services/user'
import { PermissionWrapper } from '@/components/PermissionWrapper'
import { usePermissions } from '@/hooks/usePermissions'
import type { Requirement, User as UserType } from '@/types'
import { getSmartDepartmentDisplayName, getSmartPositionDisplayName } from '@/utils/displayHelpers'


// 使用从 types 导入的 Requirement 接口

export default function RequirementsPage() {
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [users, setUsers] = useState<UserType[]>([])
  const { user, hasPermission, canEditRequirement, canDeleteRequirement } = usePermissions()
  const router = useRouter()

  const [selectedDepartment, setSelectedDepartment] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [requirementsLoading, setRequirementsLoading] = useState(true)

  // 动态表单相关状态
  const [departments, setDepartments] = useState<Department[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [filteredPositions, setFilteredPositions] = useState<Position[]>([])
  const [currentFormSchema, setCurrentFormSchema] = useState<FormSchema | null>(null)
  const [dynamicFields, setDynamicFields] = useState<FormField[]>([])
  const [dynamicFormData, setDynamicFormData] = useState<Record<string, any>>({})
  const [requirementDisplayNames, setRequirementDisplayNames] = useState<Record<string, { department: string; position: string }>>({})

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    department: '',
    assignee_position: '',
    priority: 'medium' as const,
    due_date: ''
  })

  // 加载需求数据
  useEffect(() => {
    const loadRequirements = async () => {
      try {
        setRequirementsLoading(true)
        const requirementsResponse = await requirementService.getRequirements()
        console.log('Requirements response:', requirementsResponse)
        
        // 确保我们有一个数组
        let allRequirements: any[] = []
        
        if (requirementsResponse && typeof requirementsResponse === 'object') {
          if (Array.isArray(requirementsResponse)) {
            // 如果直接返回数组
            allRequirements = requirementsResponse
          } else if (requirementsResponse.data && Array.isArray(requirementsResponse.data)) {
            // 如果是分页响应格式
            allRequirements = requirementsResponse.data
          }
        }
        
        console.log('All requirements loaded:', allRequirements)
        setRequirements(allRequirements)
        
        // 加载显示名称
        const displayNames: Record<string, { department: string; position: string }> = {}
        for (const req of allRequirements) {
          const [deptName, posName] = await Promise.all([
            getSmartDepartmentDisplayName(req.department),
            getSmartPositionDisplayName(req.assignee_position)
          ])
          displayNames[req.id] = { department: deptName, position: posName }
        }
        setRequirementDisplayNames(displayNames)
      } catch (error) {
        console.error('加载需求数据失败:', error)
        toast.error('加载需求数据失败')
        setRequirements([])
      } finally {
        setRequirementsLoading(false)
      }
    }
    
    if (user) {
      loadRequirements()
    }
  }, [user])

  // 加载部门、岗位和用户数据
  useEffect(() => {
    const loadData = async () => {
      try {
        const [departmentsData, positionsData, usersResponse] = await Promise.all([
          departmentService.getDepartments(),
          departmentService.getPositions(),
          userService.getUsers()
        ])
        setDepartments(departmentsData)
        setPositions(positionsData)
        
        // 处理用户数据响应
        if (Array.isArray(usersResponse)) {
          setUsers(usersResponse)
        } else if (usersResponse && usersResponse.data && Array.isArray(usersResponse.data)) {
          setUsers(usersResponse.data)
        } else {
          setUsers([])
        }
      } catch (error) {
        console.error('加载数据失败:', error)
        toast.error('加载基础数据失败')
      }
    }
    loadData()
  }, [])

  // 根据选择的部门过滤岗位
  useEffect(() => {
    if (formData.department) {
      const selectedDept = departments.find(d => d.code === formData.department)
      if (selectedDept) {
        const filtered = positions.filter(p => p.department_code === selectedDept.code)
        setFilteredPositions(filtered)
      }
    } else {
      setFilteredPositions([])
    }
    // 清空岗位选择和动态表单
    setFormData(prev => ({ ...prev, assignee_position: '' }))
    setCurrentFormSchema(null)
    setDynamicFields([])
    setDynamicFormData({})
  }, [formData.department, departments, positions])

  // 根据选择的岗位加载对应的表单模板
  useEffect(() => {
    const loadFormSchema = async () => {
      if (formData.department && formData.assignee_position) {
        try {
          console.log('正在查找表单模板:', {
            department: formData.department,
            position: formData.assignee_position
          })
          
          // 尝试获取岗位专用表单
          const schema = await formSchemaService.getFormSchemaByPosition(
            formData.department,
            formData.assignee_position
          )

          if (schema) {
            console.log('找到专用表单:', schema.name)
            setCurrentFormSchema(schema)
            setDynamicFields(schema.fields || [])
          } else {
            console.log('未找到专用表单，使用通用表单')
            // 如果没有专用表单，使用通用表单
            const genericSchema = await formSchemaService.getGenericFormSchema()
            setCurrentFormSchema(genericSchema)
            setDynamicFields(genericSchema.fields || [])
          }
          
          // 重置动态表单数据
          setDynamicFormData({})
        } catch (error) {
          console.error('加载表单模板失败:', error)
          // 出错时使用通用表单
          const genericSchema = await formSchemaService.getGenericFormSchema()
          setCurrentFormSchema(genericSchema)
          setDynamicFields(genericSchema.fields || [])
        }
      }
    }

    loadFormSchema()
  }, [formData.department, formData.assignee_position])

  const departmentOptions = [
    { value: 'all', label: '全部部门', icon: Building },
    ...departments.map(dept => ({
      value: dept.code,
      label: dept.name,
      icon: dept.code === 'creative' ? Palette : dept.code === 'tech' ? Monitor : Building
    }))
  ]

  // 渲染动态表单字段
  const renderDynamicField = (field: FormField) => {
    const value = dynamicFormData[field.id] || ''

    switch (field.type) {
      case 'text':
      case 'number':
        return (
          <Input
            id={field.id}
            type={field.type}
            value={value}
            onChange={(e) => handleDynamicFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
          />
        )

      case 'textarea':
        return (
          <Textarea
            id={field.id}
            value={value}
            onChange={(e) => handleDynamicFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            required={field.required}
          />
        )

      case 'select':
        return (
          <Select 
            value={value} 
            onValueChange={(val: string) => handleDynamicFieldChange(field.id, val)}
          >
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || `选择${field.label}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case 'checkbox':
        return (
          <div className="space-y-2">
            {field.options?.map((option) => (
              <div key={option} className="flex items-center space-x-2">
                <Checkbox
                  id={`${field.id}-${option}`}
                  checked={(value as string[])?.includes(option) || false}
                  onCheckedChange={(checked) => {
                    const currentValues = (value as string[]) || []
                    if (checked) {
                      handleDynamicFieldChange(field.id, [...currentValues, option])
                    } else {
                      handleDynamicFieldChange(field.id, currentValues.filter(v => v !== option))
                    }
                  }}
                />
                <Label htmlFor={`${field.id}-${option}`}>{option}</Label>
              </div>
            ))}
          </div>
        )

      case 'radio':
        return (
          <RadioGroup 
            value={value} 
            onValueChange={(val) => handleDynamicFieldChange(field.id, val)}
          >
            {field.options?.map((option) => (
              <div key={option} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`${field.id}-${option}`} />
                <Label htmlFor={`${field.id}-${option}`}>{option}</Label>
              </div>
            ))}
          </RadioGroup>
        )

      case 'date':
        return (
          <Input
            id={field.id}
            type="date"
            value={value}
            onChange={(e) => handleDynamicFieldChange(field.id, e.target.value)}
            required={field.required}
          />
        )

      default:
        return (
          <Input
            id={field.id}
            value={value}
            onChange={(e) => handleDynamicFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
          />
        )
    }
  }

  const priorityConfig = {
    low: { label: '低', color: 'bg-gray-100 text-gray-800', icon: '●' },
    medium: { label: '中', color: 'bg-blue-100 text-blue-800', icon: '●' },
    high: { label: '高', color: 'bg-orange-100 text-orange-800', icon: '●' },
    urgent: { label: '紧急', color: 'bg-red-100 text-red-800', icon: '●' }
  }

  const statusConfig = {
    not_started: { label: '未开始', color: 'bg-gray-100 text-gray-800', icon: Clock },
    in_progress: { label: '处理中', color: 'bg-blue-100 text-blue-800', icon: AlertCircle },
    completed: { label: '已完成', color: 'bg-green-100 text-green-800', icon: CheckCircle },
    delayed: { label: '沟通延期', color: 'bg-orange-100 text-orange-800', icon: AlertCircle },
    cancelled: { label: '不做处理', color: 'bg-red-100 text-red-800', icon: XCircle }
  }

  const filteredRequirements = requirements.filter(req => {
    const matchesDepartment = selectedDepartment === 'all' || req.department === selectedDepartment
    const matchesSearch = req.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         req.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (req.tags && req.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
    return matchesDepartment && matchesSearch
  })

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleDynamicFieldChange = (fieldId: string, value: any) => {
    setDynamicFormData(prev => ({ ...prev, [fieldId]: value }))
  }

  const handleCreateRequirement = async () => {
    if (!formData.title || !formData.department || !formData.assignee_position) {
      toast.error('请填写必要信息')
      return
    }

    // 验证动态表单字段
    if (currentFormSchema) {
      const validation = formSchemaService.validateFormData(dynamicFields, dynamicFormData)
      if (!validation.isValid) {
        toast.error(`表单验证失败: ${validation.errors.join(', ')}`)
        return
      }
    }

    setLoading(true)
    try {
      // 用户信息将由 requirementService.createRequirement 内部处理

      const selectedDept = departments.find(d => d.code === formData.department)
      const selectedPos = filteredPositions.find(p => p.code === formData.assignee_position)

      const requirementData = {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        status: 'not_started' as const,
        department: selectedDept?.name || '', // 映射到正确的数据库字段
        assignee_position: selectedPos?.name || '', // 执行人岗位
        due_date: formData.due_date || undefined,
        form_data: dynamicFormData,
        form_schema_id: currentFormSchema?.id || undefined,
        created_by: '' // 将由服务内部填充
      }

      await requirementService.createRequirement(requirementData)
      setIsCreateDialogOpen(false)
      resetFormData()
      toast.success('需求创建成功')
      
      // 重新加载需求列表
      // loadRequirements()
    } catch (error) {
      console.error('创建需求失败:', error)
      toast.error('创建失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteRequirement = async (reqId: string) => {
    if (!confirm('确定要删除这个需求吗？')) return

    setLoading(true)
    try {
      await requirementService.deleteRequirement(reqId)
      // 重新拉取或本地移除，避免数据与后端不一致
      setRequirements(prev => prev.filter(req => req.id !== reqId))
      toast.success('需求删除成功')
    } catch (error) {
      console.error('删除需求失败:', error)
      toast.error('删除失败，请重试')
      // 可选：回退刷新列表以确保显示一致
      // const requirementsResponse = await requirementService.getRequirements()
      // setRequirements(Array.isArray(requirementsResponse) ? requirementsResponse : (requirementsResponse?.data || []))
    } finally {
      setLoading(false)
    }
  }

  const resetFormData = () => {
    setFormData({
      title: '',
      description: '',
      department: '',
      assignee_position: '',
      priority: 'medium',
      due_date: ''
    })
    setDynamicFormData({})
    setCurrentFormSchema(null)
    setDynamicFields([])
    setFilteredPositions([])
  }

  const openCreateDialog = () => {
    resetFormData()
    setIsCreateDialogOpen(true)
  }

  const openViewDialog = (requirement: Requirement) => {
    setSelectedRequirement(requirement)
    setIsViewDialogOpen(true)
  }

  const getDepartmentStats = () => {
    const stats: { [key: string]: { total: number; pending: number; completed: number } } = {}
    
    requirements.forEach(req => {
      if (!stats[req.department]) {
        stats[req.department] = { total: 0, pending: 0, completed: 0 }
      }
      stats[req.department].total++
      if (req.status === 'not_started') stats[req.department].pending++
      if (req.status === 'completed') stats[req.department].completed++
    })
    
    return stats
  }

  const departmentStats = getDepartmentStats()

  // 获取用户显示名称
  const getUserDisplayName = (userId: string) => {
    const user = users.find(u => u.id === userId)
    return user?.full_name || user?.email || '未知用户'
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            需求管理
          </h1>
          <p className="text-muted-foreground mt-2">
            按部门管理和跟踪需求进度
          </p>
        </div>
        <div className="flex space-x-3">
          {hasPermission('requirement.create') && (
            <Button 
              onClick={() => window.location.href = '/dashboard/requirements/create'}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              <Plus className="mr-2 h-4 w-4" />
              新建需求
            </Button>
          )}
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {departmentOptions.slice(1).map(dept => {
          const stats = departmentStats[dept.value] || { total: 0, pending: 0, completed: 0 }
          const Icon = dept.icon
          return (
            <Card key={dept.value} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{dept.label}</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">
                      待处理 {stats.pending} · 已完成 {stats.completed}
                    </p>
                  </div>
                  <Icon className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 搜索和筛选 */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="搜索需求标题、描述或标签..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="选择部门" />
          </SelectTrigger>
          <SelectContent>
            {departmentOptions.map(dept => {
              const Icon = dept.icon
              return (
                <SelectItem key={dept.value} value={dept.value}>
                  <div className="flex items-center space-x-2">
                    <Icon className="h-4 w-4" />
                    <span>{dept.label}</span>
                  </div>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      {/* 需求列表 */}
      <div className="grid gap-4">
        {filteredRequirements.length === 0 ? (
          <Card className="border-0 shadow-lg">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="text-gray-400 mb-4">
                <Search className="h-12 w-12" />
              </div>
              <h3 className="text-lg font-semibold text-gray-600 mb-2">暂无需求</h3>
              <p className="text-gray-500 text-center">
                {selectedDepartment === 'all' ? '还没有创建任何需求' : '该部门暂无需求'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredRequirements.map((requirement) => {
            const StatusIcon = statusConfig[requirement.status]?.icon || AlertCircle
            return (
              <Card key={requirement.id} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer"
                    onClick={() => router.push(`/dashboard/requirements/detail/${requirement.id}`)}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold">{requirement.title}</h3>
                        <Badge className={priorityConfig[requirement.priority]?.color}>
                          {priorityConfig[requirement.priority]?.label}
                        </Badge>
                        <Badge className={statusConfig[requirement.status]?.color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusConfig[requirement.status]?.label}
                        </Badge>
                      </div>
                      
                      <p className="text-gray-600 mb-3 line-clamp-2 break-words">{requirement.description}</p>
                      
                      <div className="flex flex-wrap gap-1 mb-3">
                        {(requirement.tags || []).map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <User className="w-4 h-4" />
                          <span>创建者: {getUserDisplayName(requirement.created_by)}</span>
                        </div>
                        
                        {requirement.assignee_id && (
                          <div className="flex items-center space-x-1">
                            <User className="w-4 h-4" />
                            <span>执行者: {getUserDisplayName(requirement.assignee_id)}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center space-x-1">
                          <Building className="w-4 h-4" />
                          <span>部门: {requirementDisplayNames[requirement.id]?.department || requirement.department}</span>
                        </div>
                        
                        <div className="flex items-center space-x-1">
                          <User className="w-4 h-4" />
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
                    
                    <div className="flex flex-wrap space-x-2 ml-4" onClick={(e) => e.stopPropagation()}>
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
                          onClick={() => handleDeleteRequirement(requirement.id)}
                          className="hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* 创建需求对话框 */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>创建新需求</DialogTitle>
            <DialogDescription>
              填写需求详细信息
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">需求标题 *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="输入需求标题"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="department">所属部门 *</Label>
                <Select value={formData.department} onValueChange={(value) => {
                  setFormData(prev => ({ ...prev, department: value, type: '' }))
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择部门" />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentOptions.slice(1).map(dept => (
                      <SelectItem key={dept.value} value={dept.value}>
                        {dept.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assignee_position">目标岗位 *</Label>
                <Select 
                  value={formData.assignee_position} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, assignee_position: value }))}
                  disabled={!formData.department}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择岗位" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredPositions.map(position => (
                      <SelectItem key={position.id} value={position.code}>
                        {position.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="priority">优先级</Label>
                <Select value={formData.priority} onValueChange={(value: any) => setFormData(prev => ({ ...prev, priority: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">截止日期</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">需求描述</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="详细描述需求内容..."
                rows={4}
              />
            </div>

            {/* 动态表单字段 */}
            {currentFormSchema && dynamicFields.length > 0 && (
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center space-x-2">
                  <h4 className="font-medium text-sm text-gray-700">
                    {currentFormSchema.name}
                  </h4>
                  <Badge variant="outline" className="text-xs">
                    {currentFormSchema.department} - {currentFormSchema.position}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  {dynamicFields.map((field) => (
                    <div key={field.id} className="space-y-2">
                      <Label htmlFor={field.id} className="flex items-center space-x-1">
                        <span>{field.label}</span>
                        {field.required && <span className="text-red-500">*</span>}
                      </Label>
                      {renderDynamicField(field)}
                      {field.description && (
                        <p className="text-xs text-gray-500">{field.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 表单状态提示 */}
            {formData.department && formData.assignee_position && !currentFormSchema && (
              <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                正在加载表单模板...
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateRequirement} disabled={loading}>
              {loading ? '创建中...' : '创建需求'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 查看需求对话框 */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>需求详情</DialogTitle>
          </DialogHeader>
          
          {selectedRequirement && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details" className="flex items-center space-x-2">
                  <Eye className="h-4 w-4" />
                  <span>需求信息</span>
                </TabsTrigger>

              </TabsList>
              
              <div className="mt-4 max-h-[60vh] overflow-y-auto">
                <TabsContent value="details" className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <h2 className="text-xl font-semibold">{selectedRequirement.title}</h2>
                    <Badge className={priorityConfig[selectedRequirement.priority].color}>
                      {priorityConfig[selectedRequirement.priority].label}
                    </Badge>
                    <Badge className={statusConfig[selectedRequirement.status].color}>
                      {statusConfig[selectedRequirement.status].label}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">创建者：</span>
                      <span className="text-gray-600">{getUserDisplayName(selectedRequirement.created_by)}</span>
                    </div>
                    <div>
                      <span className="font-medium">负责人：</span>
                      <span className="text-gray-600">{selectedRequirement.assignee_id ? getUserDisplayName(selectedRequirement.assignee_id) : '未指定'}</span>
                    </div>
                    <div>
                      <span className="font-medium">创建时间：</span>
                      <span className="text-gray-600">{new Date(selectedRequirement.created_at).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="font-medium">截止时间：</span>
                      <span className="text-gray-600">{selectedRequirement.due_date || '无截止日期'}</span>
                    </div>
                    <div>
                      <span className="font-medium">所属部门：</span>
                      <span className="text-gray-600">{requirementDisplayNames[selectedRequirement.id]?.department || selectedRequirement.department}</span>
                    </div>
                    <div>
                      <span className="font-medium">目标岗位：</span>
                      <span className="text-gray-600">{requirementDisplayNames[selectedRequirement.id]?.position || selectedRequirement.assignee_position}</span>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">需求描述</h4>
                    <p className="text-gray-600 bg-gray-50 p-3 rounded-lg">
                      {selectedRequirement.description}
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">标签</h4>
                    <div className="flex flex-wrap gap-1">
                      {(selectedRequirement.tags || []).map(tag => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </TabsContent>
                

              </div>
            </Tabs>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}