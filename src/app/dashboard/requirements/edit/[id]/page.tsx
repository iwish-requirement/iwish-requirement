'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { requirementService } from '@/services/requirement'
import { departmentService, type Department, type Position } from '@/services/department'
import { createSupabaseClient } from '@/lib/supabase'
import { formSchemaService, type FormField, type FormSchema } from '@/services/formSchema'
import { usePermissions } from '@/hooks/usePermissions'
import type { Requirement } from '@/types'

const ATTACH_BUCKET = process.env.NEXT_PUBLIC_ATTACHMENTS_BUCKET || 'attachments'

// 优先级配置
const priorityConfig = {
  low: { label: '低', color: 'bg-gray-100 text-gray-800' },
  medium: { label: '中', color: 'bg-blue-100 text-blue-800' },
  high: { label: '高', color: 'bg-orange-100 text-orange-800' },
  urgent: { label: '紧急', color: 'bg-red-100 text-red-800' }
}

export default function EditRequirementPage() {
  const params = useParams()
  const router = useRouter()
  const { user, canEditRequirement } = usePermissions()
  const sb = useMemo(() => createSupabaseClient(), [])
  const requirementId = params.id as string

  const [requirement, setRequirement] = useState<Requirement | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // 表单相关状态
  const [departments, setDepartments] = useState<Department[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [filteredPositions, setFilteredPositions] = useState<Position[]>([])
  const [currentFormSchema, setCurrentFormSchema] = useState<FormSchema | null>(null)
  const [dynamicFields, setDynamicFields] = useState<FormField[]>([])
  const [dynamicFormData, setDynamicFormData] = useState<Record<string, any>>({})
  // 需求级附件
  type ReqAttachment = {
    id: string
    file_name: string
    file_url: string
    file_size: number | null
    file_type: string | null
    uploaded_by: string
    created_at: string
  }
  const [attachments, setAttachments] = useState<ReqAttachment[]>([])
  const [attaching, setAttaching] = useState(false)
  const [newFiles, setNewFiles] = useState<FileList | null>(null)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    department: '',
    assignee_position: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    due_date: ''
  })



  // 加载需求详情
  useEffect(() => {
    if (!requirementId) return

    const loadRequirement = async () => {
      try {
        setLoading(true)
        const [requirementData, departmentsData, positionsData] = await Promise.all([
          requirementService.getRequirement(requirementId),
          departmentService.getDepartments(),
          departmentService.getPositions()
        ])

        if (!requirementData) {
          toast.error('需求不存在')
          router.push('/dashboard/requirements')
          return
        }

        setRequirement(requirementData)
        setDepartments(departmentsData)
        setPositions(positionsData)

        // 加载需求级附件
        try {
          const { data: atts, error: attErr } = await sb
            .from('requirement_attachments')
            .select('id,file_name,file_url,file_size,file_type,uploaded_by,created_at')
            .eq('requirement_id', requirementId)
            .order('created_at', { ascending: false })
            .limit(100)
          if (!attErr && atts) {
            setAttachments(atts as ReqAttachment[])
          }
        } catch (e) {
          console.warn('加载需求附件失败', e)
        }

        // 设置表单数据
        setFormData({
          title: requirementData.title || '',
          description: requirementData.description || '',
          department: requirementData.department || '',
          assignee_position: requirementData.assignee_position || '',
          priority: requirementData.priority || 'medium',
          due_date: requirementData.due_date ? new Date(requirementData.due_date).toISOString().split('T')[0] : ''
        })

        // 设置动态表单数据
        if (requirementData.form_data) {
          setDynamicFormData(requirementData.form_data)
        }

      } catch (error) {
        console.error('加载需求失败:', error)
        toast.error('加载需求失败')
        router.push('/dashboard/requirements')
      } finally {
        setLoading(false)
      }
    }

    loadRequirement()
  }, [requirementId, router])

  // 根据选择的部门过滤岗位
  useEffect(() => {
    if (formData.department) {
      const selectedDept = departments.find(d => d.code === formData.department || d.name === formData.department)
      if (selectedDept) {
        const filtered = positions.filter(p => p.department_code === selectedDept.code)
        setFilteredPositions(filtered)
      }
    } else {
      setFilteredPositions([])
    }
  }, [formData.department, departments, positions])

  // 根据选择的岗位加载对应的表单模板
  useEffect(() => {
    const loadFormSchema = async () => {
      if (formData.department && formData.assignee_position) {
        try {
          // 尝试获取岗位专用表单
          const schema = await formSchemaService.getFormSchemaByPosition(
            formData.department,
            formData.assignee_position
          )

          if (schema) {
            setCurrentFormSchema(schema)
            setDynamicFields(schema.fields || [])
          } else {
            // 如果没有专用表单，使用通用表单
            const genericSchema = await formSchemaService.getGenericFormSchema()
            setCurrentFormSchema(genericSchema)
            setDynamicFields(genericSchema.fields || [])
          }
        } catch (error) {
          console.error('加载表单模板失败:', error)
        }
      }
    }

    loadFormSchema()
  }, [formData.department, formData.assignee_position])

  // 上传文件到 Supabase Storage，返回公开 URL（动态字段用）
  const uploadFileAndGetUrl = async (file: File): Promise<string> => {
    const { data: auth } = await sb.auth.getUser()
    const uid = auth?.user?.id || 'anonymous'
    const ext = file.name.split('.').pop() || ''
    const path = `${uid}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
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

  // 上传需求级附件（插入 requirement_attachments）
  const uploadRequirementAttachments = async (files: FileList) => {
    if (!requirement) {
      toast.error('需求未加载完成')
      return
    }
    setAttaching(true)
    try {
      const { data: auth } = await sb.auth.getUser()
      const uid = auth?.user?.id || 'anonymous'
      const bucket = ATTACH_BUCKET

      const uploaded: ReqAttachment[] = []
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop() || ''
        const path = `${uid}/requirements/${requirement.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await sb.storage.from(bucket).upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined
        })
        if (upErr) throw upErr
        const { data: urlData } = sb.storage.from(bucket).getPublicUrl(path)
        const publicUrl = urlData.publicUrl

        const { data: inserted, error: insErr } = await sb
          .from('requirement_attachments')
          .insert({
            requirement_id: requirement.id,
            file_name: file.name,
            file_url: publicUrl,
            file_size: file.size,
            file_type: file.type || null,
            uploaded_by: uid
          })
          .select('id,file_name,file_url,file_size,file_type,uploaded_by,created_at')
          .single()
        if (insErr) throw insErr
        uploaded.push(inserted as ReqAttachment)
      }

      setAttachments(prev => [...uploaded, ...prev])
      setNewFiles(null)
      toast.success('附件上传成功')
    } catch (err: any) {
      console.error('需求附件上传失败', err)
      const msg = err?.message || '附件上传失败，请检查存储桶配置'
      toast.error(msg)
    } finally {
      setAttaching(false)
    }
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

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleDynamicFieldChange = (fieldId: string, value: any) => {
    setDynamicFormData(prev => ({ ...prev, [fieldId]: value }))
  }

  const handleSave = async () => {
    if (!requirement || !canEditRequirement(requirement)) {
      toast.error('您没有权限编辑此需求')
      return
    }

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

    setSaving(true)
    try {
      const updateData = {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        due_date: formData.due_date || undefined,
        form_data: dynamicFormData,
        form_schema_id: currentFormSchema?.id || undefined
      }

      await requirementService.updateRequirement(requirement.id, updateData)
      toast.success('需求更新成功')
      router.push(`/dashboard/requirements/detail/${requirement.id}`)
    } catch (error) {
      console.error('更新需求失败:', error)
      toast.error('更新失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">加载中...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!requirement) {
    return (
      <div>
        <div className="text-center py-12">
          <p className="text-gray-600">需求不存在</p>
        </div>
      </div>
    )
  }

  if (!canEditRequirement(requirement)) {
    return (
      <div>
        <div className="text-center py-12">
          <p className="text-gray-600">您没有权限编辑此需求</p>
          <Button 
            onClick={() => router.push(`/dashboard/requirements/detail/${requirement.id}`)}
            className="mt-4"
          >
            返回需求详情
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            onClick={() => router.push(`/dashboard/requirements/detail/${requirement.id}`)}
            className="p-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              编辑需求
            </h1>
            <p className="text-gray-600 mt-1">
              修改需求信息和详细内容
            </p>
          </div>
        </div>
      </div>

      {/* 编辑表单 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>需求信息</span>
            <Badge className={priorityConfig[requirement.priority as keyof typeof priorityConfig]?.color}>
              当前优先级: {priorityConfig[requirement.priority as keyof typeof priorityConfig]?.label}
            </Badge>
          </CardTitle>
          <CardDescription>
            修改需求的基本信息和详细内容
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 基础信息 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="title">需求标题 *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="输入需求标题"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="priority">优先级</Label>
              <Select 
                value={formData.priority} 
                onValueChange={(value: any) => handleInputChange('priority', value)}
              >
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
              onChange={(e) => handleInputChange('due_date', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">需求描述</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="详细描述需求内容..."
              rows={4}
            />
          </div>

          {/* 需求附件 */}
          <div className="space-y-3 border-t pt-6">
            <Label>需求附件</Label>
            <div className="flex items-center gap-3">
              <Input
                type="file"
                multiple
                onChange={(e) => setNewFiles(e.target.files)}
              />
              <Button
                variant="secondary"
                disabled={!newFiles || attaching}
                onClick={() => newFiles && uploadRequirementAttachments(newFiles)}
              >
                {attaching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    上传中...
                  </>
                ) : (
                  '上传附件'
                )}
              </Button>
            </div>

            {attachments.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-gray-600">已上传的附件：</div>
                <ul className="list-disc pl-5 space-y-1">
                  {attachments.map(att => (
                    <li key={att.id} className="text-sm">
                      <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {att.file_name}
                      </a>
                      <span className="text-gray-500 ml-2">
                        {att.file_type ? `(${att.file_type})` : ''} {typeof att.file_size === 'number' ? `· ${Math.round(att.file_size / 1024)} KB` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* 动态表单字段 */}
          {currentFormSchema && dynamicFields.length > 0 && (
            <div className="space-y-4 border-t pt-6">
              <div className="flex items-center space-x-2">
                <h4 className="font-medium text-gray-700">
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

          {/* 操作按钮 */}
          <div className="flex justify-end space-x-4 pt-6 border-t">
            <Button
              variant="outline"
              onClick={() => router.push(`/dashboard/requirements/detail/${requirement.id}`)}
            >
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  保存修改
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}