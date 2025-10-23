'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  Eye,
  Copy
} from 'lucide-react'
import { DndContext, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { FormSchema, FormField, formConfigService } from '@/services/formConfig'
import { departmentService } from '@/services/department'

const fieldTypes = [
  { value: 'text', label: '单行文本' },
  { value: 'textarea', label: '多行文本' },
  { value: 'number', label: '数字' },
  { value: 'email', label: '邮箱' },
  { value: 'url', label: '网址' },
  { value: 'tel', label: '电话' },
  { value: 'date', label: '日期' },
  { value: 'datetime', label: '日期时间' },
  { value: 'time', label: '时间' },
  { value: 'select', label: '下拉选择' },
  { value: 'radio', label: '单选按钮' },
  { value: 'checkbox', label: '多选框' },
  { value: 'switch', label: '开关' },
  { value: 'file', label: '文件上传' },
  { value: 'image', label: '图片上传' }
]

function SortableFieldCard({
  field,
  index,
  renderCard
}: {
  field: FormField
  index: number
  renderCard: (index: number) => JSX.Element
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div className="absolute left-[-8px] top-2 w-[6px] h-6 rounded bg-gray-200 cursor-grab active:cursor-grabbing" {...attributes} {...listeners} />
      {renderCard(index)}
    </div>
  )
}

export default function EditFormPage() {
  const params = useParams()
  const router = useRouter()
  const formId = params.id as string

  const [form, setForm] = useState<FormSchema>({
    name: '',
    description: '',
    department: '',
    position: '',
    is_active: true,
    fields: []
  })
  
  const [departments, setDepartments] = useState<any[]>([])
  const [positions, setPositions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadFormData()
    loadDepartments()
  }, [formId])

  useEffect(() => {
    if (form.department) {
      loadPositions(form.department)
    }
  }, [form.department])

  const loadFormData = async () => {
    try {
      setLoading(true)
      const formData = await formConfigService.getFormSchema(formId)
      if (formData) {
        setForm(formData)
      } else {
        toast.error('表单不存在')
        router.push('/dashboard/forms')
      }
    } catch (error) {
      console.error('Failed to load form:', error)
      toast.error('加载表单失败')
      router.push('/dashboard/forms')
    } finally {
      setLoading(false)
    }
  }

  const loadDepartments = async () => {
    try {
      const data = await departmentService.getDepartments()
      setDepartments(data)
    } catch (error) {
      console.error('Failed to load departments:', error)
    }
  }

  const loadPositions = async (departmentCode: string) => {
    try {
      const data = await departmentService.getPositions()
      const filtered = data.filter(p => p.department_code === departmentCode)
      setPositions(filtered)
    } catch (error) {
      console.error('Failed to load positions:', error)
    }
  }

  const handleFormChange = (field: keyof FormSchema, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleFieldChange = (index: number, field: string, value: any) => {
    const newFields = [...(form.fields || [])]
    newFields[index] = { ...newFields[index], [field]: value }
    setForm(prev => ({ ...prev, fields: newFields }))
  }

  const addField = () => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      label: '新字段',
      type: 'text',
      required: false
    }
    
    setForm(prev => ({
      ...prev,
      fields: [...(prev.fields || []), newField]
    }))
  }

  const removeField = (index: number) => {
    const newFields = [...(form.fields || [])]
    newFields.splice(index, 1)
    setForm(prev => ({ ...prev, fields: newFields }))
  }

  const duplicateField = (index: number) => {
    const fieldToCopy = form.fields![index]
    const newField: FormField = {
      ...fieldToCopy,
      id: `field_${Date.now()}`,
      label: `${fieldToCopy.label} - 副本`
    }
    
    setForm(prev => ({
      ...prev,
      fields: [...(prev.fields || []), newField]
    }))
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('请输入表单名称')
      return
    }

    setSaving(true)
    try {
      await formConfigService.updateFormSchema(formId, form)
      toast.success('表单保存成功')
      router.push('/dashboard/forms')
    } catch (error) {
      console.error('Failed to save form:', error)
      toast.error('保存表单失败')
    } finally {
      setSaving(false)
    }
  }

  const handleFieldOptionsChange = (fieldIndex: number, options: string) => {
    const optionsArray = options.split('\n').filter(opt => opt.trim())
    handleFieldChange(fieldIndex, 'options', optionsArray)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.push('/dashboard/forms')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
          <div>
            <h1 className="text-2xl font-bold">编辑表单</h1>
            <p className="text-gray-600">修改表单配置和字段</p>
          </div>
        </div>
        
        <div className="flex space-x-3">
          <Button variant="outline">
            <Eye className="h-4 w-4 mr-2" />
            预览
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 表单基本信息 */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
              <CardDescription>配置表单的基本属性</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">表单名称 *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  placeholder="输入表单名称"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">表单描述</Label>
                <Textarea
                  id="description"
                  value={form.description || ''}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  placeholder="输入表单描述"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">适用部门</Label>
                <Select 
                  value={form.department || undefined} 
                  onValueChange={(value) => handleFormChange('department', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择部门" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">通用</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept.code} value={dept.code}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="position">适用岗位</Label>
                <Select 
                  value={form.position || undefined} 
                  onValueChange={(value) => handleFormChange('position', value)}
                  disabled={!form.department}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择岗位" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">通用</SelectItem>
                    {positions.map(pos => (
                      <SelectItem key={pos.code} value={pos.code}>
                        {pos.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={form.is_active}
                  onCheckedChange={(checked) => handleFormChange('is_active', checked)}
                />
                <Label htmlFor="is_active">启用表单</Label>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 字段配置 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>字段配置</CardTitle>
                  <CardDescription>
                    共 {(form.fields || []).length} 个字段
                  </CardDescription>
                </div>
                <Button onClick={addField} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  添加字段
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {(form.fields || []).length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">暂无字段</p>
                  <Button onClick={addField} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    添加第一个字段
                  </Button>
                </div>
              ) : (
                <DndContext
                  onDragEnd={(event: DragEndEvent) => {
                    const { active, over } = event
                    if (!over || active.id === over.id) return
                    const oldIndex = (form.fields || []).findIndex(f => f.id === active.id)
                    const newIndex = (form.fields || []).findIndex(f => f.id === over.id)
                    if (oldIndex === -1 || newIndex === -1) return
                    setForm(prev => {
                      const newFields = [...(prev.fields || [])]
                      const [moved] = newFields.splice(oldIndex, 1)
                      newFields.splice(newIndex, 0, moved)
                      return { ...prev, fields: newFields }
                    })
                  }}
                >
                  <SortableContext
                    items={(form.fields || []).map(f => f.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-4">
                      {(form.fields || []).map((field, i) => (
                        <SortableFieldCard
                          key={field.id}
                          field={field}
                          index={i}
                          renderCard={(index) => (
                            <div className="border rounded-lg p-4 bg-white shadow-sm">
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>字段标签 *</Label>
                                    <Input
                                      value={form.fields![index].label}
                                      onChange={(e) => handleFieldChange(index, 'label', e.target.value)}
                                      placeholder="字段标签"
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label>字段类型</Label>
                                    <Select
                                      value={form.fields![index].type || 'text'}
                                      onValueChange={(value) => {
                                        handleFieldChange(index, 'type', value)
                                        const currentAccept = form.fields![index].accept
                                        if (!currentAccept) {
                                          if (value === 'image') {
                                            handleFieldChange(index, 'accept', 'image/*')
                                          } else if (value === 'file') {
                                            handleFieldChange(index, 'accept', '*/*')
                                          }
                                        }
                                      }}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {fieldTypes.map(type => (
                                          <SelectItem key={type.value} value={type.value}>
                                            {type.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <Label>占位符</Label>
                                  <Input
                                    value={form.fields![index].placeholder || ''}
                                    onChange={(e) => handleFieldChange(index, 'placeholder', e.target.value)}
                                    placeholder="输入占位符文本"
                                  />
                                </div>

                                {(['file', 'image'].includes(form.fields![index].type as string)) && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label>接受格式</Label>
                                      <Input
                                        value={
                                          (form.fields![index].accept ??
                                            (form.fields![index].type === 'image' ? 'image/*' : '*/*'))
                                        }
                                        onChange={(e) => handleFieldChange(index, 'accept', e.target.value)}
                                        placeholder="如: image/*,.png,.jpg,.pdf"
                                      />
                                      <p className="text-xs text-gray-500">
                                        设置 input[type=file] 的 accept；图片建议使用 image/*。
                                      </p>
                                    </div>
                                    <div className="space-y-2">
                                      <Label>允许多文件</Label>
                                      <div className="flex items-center space-x-2">
                                        <Switch
                                          checked={!!form.fields![index].multiple}
                                          onCheckedChange={(checked) => handleFieldChange(index, 'multiple', !!checked)}
                                        />
                                        <span className="text-sm text-gray-600">
                                          {form.fields![index].multiple ? '可选择多个文件' : '仅单文件'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {(['select', 'radio', 'checkbox'].includes(form.fields![index].type as string)) && (
                                  <div className="space-y-2">
                                    <Label>选项</Label>
                                    <div className="flex flex-wrap gap-2">
                                      {(form.fields?.[index].options || []).map(opt => (
                                        <Badge key={opt} variant="secondary" className="px-2 py-1">
                                          <span>{opt}</span>
                                          <button
                                            type="button"
                                            className="ml-2 text-red-600 hover:text-red-700"
                                            onClick={() => {
                                              const current = form.fields?.[index].options || []
                                              const next = current.filter(o => o !== opt)
                                              handleFieldChange(index, 'options', next)
                                            }}
                                            title="删除选项"
                                          >
                                            ×
                                          </button>
                                        </Badge>
                                      ))}
                                    </div>
                                    <Input
                                      placeholder="输入选项后回车添加"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault()
                                          const target = e.target as HTMLInputElement
                                          const value = (target.value || '').trim()
                                          if (!value) return
                                          const current = form.fields?.[index].options || []
                                          if (current.includes(value)) {
                                            target.value = ''
                                            return
                                          }
                                          handleFieldChange(index, 'options', [...current, value])
                                          target.value = ''
                                        }
                                      }}
                                    />
                                    <p className="text-xs text-gray-500">支持去重，点击标签右侧 × 可删除</p>
                                  </div>
                                )}

                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-4">
                                    <div className="flex items-center space-x-2">
                                      <Switch
                                        checked={form.fields![index].required}
                                        onCheckedChange={(checked) => handleFieldChange(index, 'required', checked)}
                                      />
                                      <Label>必填</Label>
                                    </div>
                                    <Badge variant="outline">
                                      #{index + 1}
                                    </Badge>
                                  </div>
                                  
                                  <div className="flex space-x-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => duplicateField(index)}
                                      title="复制字段"
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => removeField(index)}
                                      className="text-red-600 hover:text-red-700"
                                      title="删除字段"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}