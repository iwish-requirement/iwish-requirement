'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Plus, Save, Eye, ArrowLeft } from 'lucide-react'
import { DndContext, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { FormSchema, FormField, FieldType, formConfigService } from '@/services/formConfig'
import { FormFieldEditor } from '@/components/forms/FormFieldEditor'
import { FormPreview } from '@/components/forms/FormPreview'
import { departmentService } from '@/services/department'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

function SortableField({
  field,
  index,
  fieldTypes,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown
}: {
  field: FormField
  index: number
  fieldTypes: FieldType[]
  onUpdate: (updatedField: FormField) => void
  onDelete: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  // 将拖拽监听绑在整卡片容器，简单可靠；如需仅在把手拖拽，可在 FormFieldEditor 里将 listeners 透传到把手
  return (
    <div ref={setNodeRef} style={style} className="sortable-item">
      <div className="drag-handle" {...attributes} {...listeners} />
      <FormFieldEditor
        key={`${field.id}-${index}`}
        field={field}
        fieldTypes={fieldTypes}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
      />
    </div>
  )
}

export default function CreateFormPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [fieldTypes, setFieldTypes] = useState<FieldType[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [positions, setPositions] = useState<any[]>([])
  
  const [formSchema, setFormSchema] = useState<FormSchema>({
    name: '',
    description: '',
    department: 'general',
    position: 'general',
    fields: [],
    is_active: true
  })

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    if (formSchema.department) {
      loadPositions(formSchema.department)
    }
  }, [formSchema.department])

  const loadInitialData = async () => {
    try {
      const [fieldTypesData, departmentsData] = await Promise.all([
        formConfigService.getFieldTypes(),
        departmentService.getDepartments()
      ])
      setFieldTypes(fieldTypesData)
      setDepartments(departmentsData)
    } catch (error) {
      console.error('Failed to load initial data:', error)
      toast.error('加载数据失败')
    }
  }

  const loadPositions = async (departmentCode: string) => {
    try {
      const positionsData = await departmentService.getPositionsByDepartment(departmentCode)
      setPositions(positionsData)
    } catch (error) {
      console.error('Failed to load positions:', error)
      toast.error('加载岗位失败')
    }
  }

  const handleBasicInfoChange = (field: keyof FormSchema, value: any) => {
    setFormSchema(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const addField = () => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      type: 'text',
      label: '新字段',
      required: false
    }
    
    setFormSchema(prev => ({
      ...prev,
      fields: [...prev.fields, newField]
    }))
  }

  const updateField = (index: number, field: FormField) => {
    setFormSchema(prev => ({
      ...prev,
      fields: prev.fields.map((f, i) => i === index ? field : f)
    }))
  }

  const deleteField = (index: number) => {
    setFormSchema(prev => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== index)
    }))
  }

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= formSchema.fields.length) return

    setFormSchema(prev => {
      const newFields = [...prev.fields]
      const temp = newFields[index]
      newFields[index] = newFields[newIndex]
      newFields[newIndex] = temp
      return { ...prev, fields: newFields }
    })
  }

  const handleSave = async () => {
    try {
      setLoading(true)
      
      // 验证表单
      const validation = formConfigService.validateFormSchema(formSchema)
      if (!validation.valid) {
        toast.error(`表单验证失败: ${validation.errors.join(', ')}`)
        return
      }

      // 保存表单
      await formConfigService.createFormSchema(formSchema)
      toast.success('表单创建成功')
      router.push('/dashboard/forms')
    } catch (error) {
      console.error('Failed to save form:', error)
      toast.error('保存表单失败')
    } finally {
      setLoading(false)
    }
  }

  const handlePreview = () => {
    const validation = formConfigService.validateFormSchema(formSchema)
    if (!validation.valid) {
      toast.error(`无法预览: ${validation.errors.join(', ')}`)
      return
    }
    setPreviewOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
          <div>
            <h1 className="text-2xl font-bold">创建表单</h1>
            <p className="text-gray-600">设计自定义表单模板</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={formSchema.fields.length === 0}
          >
            <Eye className="h-4 w-4 mr-2" />
            预览
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || !formSchema.name || formSchema.fields.length === 0}
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：基本信息 */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="form-name">表单名称 *</Label>
                <Input
                  id="form-name"
                  value={formSchema.name}
                  onChange={(e) => handleBasicInfoChange('name', e.target.value)}
                  placeholder="输入表单名称"
                />
              </div>

              <div>
                <Label htmlFor="form-description">表单描述</Label>
                <Textarea
                  id="form-description"
                  value={formSchema.description}
                  onChange={(e) => handleBasicInfoChange('description', e.target.value)}
                  placeholder="描述表单用途"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="form-department">适用部门 *</Label>
                <Select
                  value={formSchema.department}
                  onValueChange={(value) => handleBasicInfoChange('department', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择部门" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">通用表单</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.code}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="form-position">适用岗位 *</Label>
                <Select
                  value={formSchema.position}
                  onValueChange={(value) => handleBasicInfoChange('position', value)}
                  disabled={!formSchema.department}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择岗位" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">通用岗位</SelectItem>
                    {positions.map((pos) => (
                      <SelectItem key={pos.id} value={pos.code}>
                        {pos.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="form-active"
                  checked={formSchema.is_active}
                  onCheckedChange={(checked) => handleBasicInfoChange('is_active', !!checked)}
                />
                <Label htmlFor="form-active">启用表单</Label>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右侧：字段配置 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>字段配置</CardTitle>
                <Button onClick={addField}>
                  <Plus className="h-4 w-4 mr-2" />
                  添加字段
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {formSchema.fields.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>暂无字段，点击"添加字段"开始设计表单</p>
                </div>
              ) : (
                <DndContext
                  onDragEnd={(event: DragEndEvent) => {
                    const { active, over } = event
                    if (!over || active.id === over.id) return
                    const oldIndex = formSchema.fields.findIndex(f => f.id === active.id)
                    const newIndex = formSchema.fields.findIndex(f => f.id === over.id)
                    if (oldIndex === -1 || newIndex === -1) return
                    setFormSchema(prev => {
                      const newFields = [...prev.fields]
                      const [moved] = newFields.splice(oldIndex, 1)
                      newFields.splice(newIndex, 0, moved)
                      return { ...prev, fields: newFields }
                    })
                  }}
                >
                  <SortableContext
                    items={formSchema.fields.map(f => f.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-4">
                      {formSchema.fields.map((field, index) => (
                        <SortableField
                          key={field.id}
                          field={field}
                          index={index}
                          fieldTypes={fieldTypes}
                          onUpdate={(updatedField) => updateField(index, updatedField)}
                          onDelete={() => deleteField(index)}
                          onMoveUp={index > 0 ? () => moveField(index, 'up') : undefined}
                          onMoveDown={index < formSchema.fields.length - 1 ? () => moveField(index, 'down') : undefined}
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

      {/* 预览对话框 */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>表单预览</DialogTitle>
            <DialogDescription>
              预览表单的最终效果
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <FormPreview schema={formSchema} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}