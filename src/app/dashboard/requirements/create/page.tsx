'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { requirementService } from '@/services/requirement'
import { createSupabaseClient } from '@/lib/supabase'
import { departmentService, type Department, type Position } from '@/services/department'
import { userService, type User } from '@/services/user'
import { formSchemaService, type FormField, type FormSchema } from '@/services/formSchema'
import { type CreateRequirementInput } from '@/types'
import { toast } from 'sonner'

const ATTACH_BUCKET = process.env.NEXT_PUBLIC_ATTACHMENTS_BUCKET || 'attachments'

export default function CreateRequirementPage() {
  const router = useRouter()
  const sb = useMemo(() => createSupabaseClient(), [])
  const [loading, setLoading] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [filteredPositions, setFilteredPositions] = useState<Position[]>([])
  const [departmentUsers, setDepartmentUsers] = useState<User[]>([])
  const [currentFormSchema, setCurrentFormSchema] = useState<FormSchema | null>(null)
  const [dynamicFields, setDynamicFields] = useState<FormField[]>([])
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    department: '',
    assignee_position: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    due_date: ''
  })
  const [selectedAssignee, setSelectedAssignee] = useState<string>('')
  const [dynamicFormData, setDynamicFormData] = useState<Record<string, any>>({})
  const [attachments, setAttachments] = useState<Array<{ name: string; size: number; type: string; file?: File; url?: string }>>([])
  const [attaching, setAttaching] = useState(false)

  // 加载部门和岗位数据
  useEffect(() => {
    const loadData = async () => {
      try {
        const [departmentsData, positionsData] = await Promise.all([
          departmentService.getDepartments(),
          departmentService.getPositions()
        ])
        setDepartments(departmentsData)
        setPositions(positionsData)
      } catch (error) {
        console.error('加载数据失败:', error)
        toast.error('加载部门岗位数据失败')
      }
    }
    loadData()
  }, [])

  // 根据选择的部门过滤岗位和加载用户
  useEffect(() => {
    const loadDepartmentData = async () => {
      if (formData.department) {
        const selectedDept = departments.find(d => d.code === formData.department)
        if (selectedDept) {
          // 过滤岗位
          const filtered = positions.filter(p => p.department_code === selectedDept.code)
          setFilteredPositions(filtered)
          
          // 加载部门用户
          try {
            const users = await userService.getUsersByDepartmentNameOrCode(selectedDept.code)
            setDepartmentUsers(users)
          } catch (error) {
            console.error('加载部门用户失败:', error)
            toast.error('加载部门用户失败')
            setDepartmentUsers([])
          }
        }
      } else {
        setFilteredPositions([])
        setDepartmentUsers([])
      }
      // 清空相关选择
      setFormData(prev => ({ ...prev, assignee_position: '' }))
      setSelectedAssignee('')
      setCurrentFormSchema(null)
      setDynamicFields([])
      setDynamicFormData({})
    }

    loadDepartmentData()
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
          
          // 获取选中部门和岗位的代码，用于表单模板匹配
          const selectedDept = departments.find(d => d.code === formData.department)
          const selectedPosition = filteredPositions.find(p => p.code === formData.assignee_position)
          
          if (selectedDept && selectedPosition) {
            // 使用代码进行表单模板匹配（更稳定可靠）
            const schema = await formSchemaService.getFormSchemaByPosition(
              selectedDept.code, // 部门代码
              selectedPosition.code // 岗位代码
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
          } else {
            console.log('部门或岗位信息不完整，无法匹配表单模板')
            setCurrentFormSchema(null)
            setDynamicFields([])
            setDynamicFormData({})
          }
        } catch (error) {
          console.error('加载表单模板失败:', error)
          // 出错时使用通用表单
          try {
            const genericSchema = await formSchemaService.getGenericFormSchema()
            setCurrentFormSchema(genericSchema)
            setDynamicFields(genericSchema.fields || [])
          } catch (genericError) {
            console.error('加载通用表单也失败:', genericError)
            setCurrentFormSchema(null)
            setDynamicFields([])
          }
          setDynamicFormData({})
        }
      } else {
        setCurrentFormSchema(null)
        setDynamicFields([])
        setDynamicFormData({})
      }
    }

    loadFormSchema()
  }, [formData.department, formData.assignee_position])

  // 上传需求级附件到 Storage 并返回 publicUrl
  const uploadAttachmentToStorage = async (file: File): Promise<string> => {
    const { data: auth } = await sb.auth.getUser()
    const uid = auth?.user?.id || 'anonymous'
    const ext = file.name.split('.').pop() || ''
    const path = `${uid}/requirements/create/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const bucket = ATTACH_BUCKET
    const { error: upErr } = await sb.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined
    })
    if (upErr) throw upErr
    const { data: urlData } = sb.storage.from(ATTACH_BUCKET).getPublicUrl(path)
    return urlData.publicUrl
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 验证动态表单数据
      if (dynamicFields.length > 0) {
        const validation = formSchemaService.validateFormData(dynamicFields, dynamicFormData)
        if (!validation.isValid) {
          toast.error(`表单验证失败: ${validation.errors.join(', ')}`)
          return
        }
      }

      // 验证必填字段
      if (!formData.title.trim()) {
        toast.error('请填写需求标题')
        return
      }
      if (!formData.description.trim()) {
        toast.error('请填写需求描述')
        return
      }
      if (!formData.department) {
        toast.error('请选择处理部门')
        return
      }
      if (!formData.assignee_position) {
        toast.error('请选择执行人岗位')
        return
      }

      // 构建需求数据 - 映射到正确的数据库字段
      // CreateRequirementInput 中 submitter_id 将由服务端填充，这里使用局部断言规避前端必填校验
      const requirementData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        priority: formData.priority,
        due_date: formData.due_date || undefined,
        created_by: '', // 由服务内部填充
        department: formData.department, // 处理部门
        assignee_position: formData.assignee_position, // 执行人岗位
        assignee_id: selectedAssignee || undefined, // 指定的执行人
        status: 'not_started' as const,
        form_schema_id: currentFormSchema?.id || undefined,
        form_data: dynamicFormData,
        assignee_users: selectedAssignee ? [{ user_id: selectedAssignee, role_type: 'primary' as const }] : undefined
      } as unknown as CreateRequirementInput

      const created = await requirementService.createRequirement(requirementData)
      // created 可能返回需求对象或其 id，这里优先从对象读取 id，退化为 created 直接作为 id
      const reqId = (created && (created as any).id) ? (created as any).id : (typeof created === 'string' ? created : undefined)

      // 如果有选择的需求级附件，逐个上传并写入 requirement_attachments
      if (reqId && attachments.length > 0) {
        setAttaching(true)
        for (const att of attachments) {
          if (!att.file) continue
          const publicUrl = await uploadAttachmentToStorage(att.file)
          await sb
            .from('requirement_attachments')
            .insert({
              requirement_id: reqId,
              file_name: att.name,
              file_url: publicUrl,
              file_size: att.size,
              file_type: att.type || null,
              uploaded_by: (await sb.auth.getUser()).data.user?.id || null
            })
        }
        setAttaching(false)
      }

      toast.success('需求创建成功')
      router.push('/dashboard/requirements')
    } catch (error) {
      console.error('创建需求失败:', error)
      toast.error(`创建需求失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleDynamicFieldChange = (fieldId: string, value: any) => {
    setDynamicFormData(prev => ({
      ...prev,
      [fieldId]: value
    }))
  }

  // 上传文件到 Supabase Storage，返回公开 URL
  const uploadFileAndGetUrl = async (file: File): Promise<string> => {
    const { data: auth } = await sb.auth.getUser()
    const uid = auth?.user?.id || 'anonymous'
    const ext = file.name.split('.').pop() || ''
    const path = `${uid}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    // 使用名为 'attachments' 的存储桶，如未创建请在后台创建并设为公开读取
    const bucket = ATTACH_BUCKET
    const { error: upErr } = await sb.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined
    })
    if (upErr) throw upErr
    const { data: urlData } = sb.storage.from(ATTACH_BUCKET).getPublicUrl(path)
    return urlData.publicUrl
  }

  // 获取用户信息
  const getUserInfo = (userId: string) => {
    return departmentUsers.find(u => u.id === userId)
  }

  // 将部门代码/名称统一展示为中文名称（缺失时懒加载一次）
  const getDepartmentDisplay = (user: User | undefined) => {
    if (!user) return ''
    const code = (user as any).department_code
    // 1) 先按 code 命中
    const byCode = departments.find(d => d.code === code)
    if (byCode) return byCode.name
    // 2) 若用户.department 就是代码，按代码命中
    const byDeptFieldAsCode = departments.find(d => d.code === user.department)
    if (byDeptFieldAsCode) return byDeptFieldAsCode.name
    // 3) 再按 name 命中（用户.department 已是中文名）
    const byName = departments.find(d => d.name === user.department)
    if (byName) return byName.name
    // 4) 回退原值
    return user.department || ''
  }

  // 将岗位代码/名称统一展示为中文名称（缺失时懒加载一次）
  const getPositionDisplay = (user: User | undefined) => {
    if (!user) return ''
    const code = (user as any).position_code
    // 1) 优先在当前部门的岗位中按 code 命中
    const inFiltered = filteredPositions.find(p => p.code === code)
    if (inFiltered) return inFiltered.name
    // 2) 再在全量岗位中按 code 命中
    const inAll = positions.find(p => p.code === code)
    if (inAll) return inAll.name
    // 3) 若用户.position 就是代码，按代码命中
    const byPosFieldAsCode = positions.find(p => p.code === user.position)
    if (byPosFieldAsCode) return byPosFieldAsCode.name
    // 4) 如果 user.position 本身是中文名，直接显示
    const byName = positions.find(p => p.name === user.position)
    if (byName) return byName.name
    // 5) 仍然未命中，回退原值
    return user.position || ''
  }

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

      case 'image':
        return (
          <Input
            id={field.id}
            type="file"
            accept={field.accept || 'image/*'}
            multiple={field.multiple || false}
            onChange={async (e) => {
              const files = e.target.files
              if (!files || files.length === 0) return
              try {
                if (field.multiple) {
                  const urls: string[] = []
                  for (const file of Array.from(files)) {
                    const url = await uploadFileAndGetUrl(file)
                    urls.push(url)
                  }
                  handleDynamicFieldChange(field.id, urls)
                  toast.success('图片已上传')
                } else {
                  const file = files[0]
                  const url = await uploadFileAndGetUrl(file)
                  handleDynamicFieldChange(field.id, url)
                  toast.success('图片已上传')
                }
              } catch (err: any) {
                console.error('上传失败', err)
                toast.error(err?.message || '图片上传失败')
              }
            }}
            required={field.required}
          />
        )

      case 'file':
        return (
          <Input
            id={field.id}
            type="file"
            accept={field.accept}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (file) {
                try {
                  const url = await uploadFileAndGetUrl(file)
                  handleDynamicFieldChange(field.id, url)
                  toast.success('附件已上传')
                } catch (err: any) {
                  console.error('上传失败', err)
                  toast.error(err?.message || '附件上传失败')
                }
              }
            }}
            required={field.required}
          />
        )

      default:
        {
          // 未知类型兜底：根据字段名/标签智能判断为附件或网址，否则回退文本
          const label = (field.label || '').toLowerCase()
          const hint = `${label}`
          if (/(附件|上传|file|attachment|upload|image|图片)/i.test(hint)) {
            return (
              <Input
                id={field.id}
                type="file"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    try {
                      const url = await uploadFileAndGetUrl(file)
                      handleDynamicFieldChange(field.id, url)
                      toast.success('附件已上传')
                    } catch (err: any) {
                      console.error('上传失败', err)
                      toast.error(err?.message || '附件上传失败')
                    }
                  }
                }}
                required={field.required}
              />
            )
          }
          if (/(网址|链接|url|link)/i.test(hint)) {
            return (
              <Input
                id={field.id}
                type="url"
                value={value}
                onChange={(e) => handleDynamicFieldChange(field.id, e.target.value)}
                placeholder={field.placeholder || '请输入网址'}
                required={field.required}
              />
            )
          }
          // 通用文本兜底
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
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">创建需求</h1>
        <p className="text-gray-600">
          填写需求信息，系统会根据您的岗位显示相应的表单字段
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 基础信息 */}
        <Card>
          <CardHeader>
            <CardTitle>基础信息</CardTitle>
            <CardDescription>
              填写需求的基本信息
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">需求标题 *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="请输入需求标题"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">需求描述 *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="请详细描述您的需求"
                rows={4}
                required
              />
            </div>

            <div>
              <Label htmlFor="department">处理部门 *</Label>
              <Select value={formData.department} onValueChange={(value) => handleInputChange('department', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择处理部门" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.code}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 执行人选择 */}
            {formData.department && departmentUsers.length > 0 && (
              <div>
                <Label htmlFor="assignee">指定执行人</Label>
                <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择执行人" />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                            <span className="text-xs font-medium text-gray-600">
                              {user.full_name?.charAt(0) || user.email.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">{user.full_name || user.email}</span>
                            <span className="text-sm text-gray-500 ml-2">({getPositionDisplay(user)})</span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedAssignee && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600">
                          {getUserInfo(selectedAssignee)?.full_name?.charAt(0) || getUserInfo(selectedAssignee)?.email.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-blue-900">
                          {getUserInfo(selectedAssignee)?.full_name || getUserInfo(selectedAssignee)?.email}
                        </p>
                        <p className="text-sm text-blue-700">
                          {getPositionDisplay(getUserInfo(selectedAssignee))} - {getDepartmentDisplay(getUserInfo(selectedAssignee))}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {formData.department && departmentUsers.length === 0 && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  该部门暂无可用用户，请联系管理员添加用户到该部门。
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="assignee_position">目标岗位（可选）</Label>
              <Select 
                value={formData.assignee_position} 
                onValueChange={(value) => handleInputChange('assignee_position', value)}
                disabled={!formData.department}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formData.department ? "选择目标岗位" : "请先选择部门"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredPositions.map((pos) => (
                    <SelectItem key={pos.id} value={pos.code}>
                      {pos.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                指定需求主要针对的岗位类型，用于表单模板匹配
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priority">优先级</Label>
                <Select value={formData.priority} onValueChange={(value) => handleInputChange('priority', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择优先级" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">低</SelectItem>
                    <SelectItem value="medium">中</SelectItem>
                    <SelectItem value="high">高</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="due_date">截止日期</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => handleInputChange('due_date', e.target.value)}
                />
              </div>
            </div>

            {/* 需求附件（可选，多文件） */}
            <div className="space-y-2">
              <Label>附件（可选）</Label>
              <Input
                type="file"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || [])
                  setAttachments(files.map(f => ({ name: f.name, size: f.size, type: f.type, file: f })))
                }}
              />
              {attachments.length > 0 && (
                <div className="space-y-2">
                  <ul className="list-disc pl-5 space-y-1">
                    {attachments.map((a, idx) => (
                      <li key={idx} className="text-sm text-gray-700">
                        {a.name} <span className="text-xs text-gray-500">({Math.round(a.size / 1024)} KB)</span>
                      </li>
                    ))}
                  </ul>
                  {attaching && <div className="text-xs text-muted-foreground">附件上传中...</div>}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 动态表单字段 */}
        {dynamicFields.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>
                {currentFormSchema ? `${currentFormSchema.name}` : '通用需求表单'}
              </CardTitle>
              <CardDescription>
                {currentFormSchema 
                  ? currentFormSchema.description || `${formData.assignee_position}专用的详细需求信息`
                  : '请填写详细的需求信息'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {dynamicFields.map((field) => (
                <div key={field.id}>
                  <Label htmlFor={field.id}>
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  {renderDynamicField(field)}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* 提交按钮 */}
        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            取消
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? '创建中...' : '创建需求'}
          </Button>
        </div>
      </form>
    </div>
  )
}