'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trash2, Plus, GripVertical } from 'lucide-react'
import { FormField, FieldType } from '@/services/formConfig'

interface FormFieldEditorProps {
  field: FormField
  fieldTypes: FieldType[]
  onUpdate: (field: FormField) => void
  onDelete: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
}

export function FormFieldEditor({
  field,
  fieldTypes,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown
}: FormFieldEditorProps) {
  const [localField, setLocalField] = useState<FormField>(field)
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    setLocalField(field)
  }, [field])

  const handleFieldChange = (updates: Partial<FormField>) => {
    const updatedField = { ...localField, ...updates }
    setLocalField(updatedField)
    onUpdate(updatedField)
  }

  const handleOptionsChange = (options: string[]) => {
    handleFieldChange({ options })
  }

  const addOption = () => {
    const options = localField.options || []
    handleOptionsChange([...options, ''])
  }

  const updateOption = (index: number, value: string) => {
    const options = [...(localField.options || [])]
    options[index] = value
    handleOptionsChange(options)
  }

  const removeOption = (index: number) => {
    const options = [...(localField.options || [])]
    options.splice(index, 1)
    handleOptionsChange(options)
  }

  const selectedFieldType = fieldTypes.find(ft => ft.type_name === localField.type)
  const needsOptions = ['select', 'radio', 'checkbox', 'multiselect'].includes(localField.type)

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
            <CardTitle className="text-sm">
              {localField.label || '新字段'}
            </CardTitle>
            {selectedFieldType && (
              <Badge variant="secondary" className="text-xs">
                {selectedFieldType.display_name}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? '简单' : '高级'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 基础配置 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor={`field-id-${field.id}`}>字段ID *</Label>
            <Input
              id={`field-id-${field.id}`}
              value={localField.id}
              onChange={(e) => handleFieldChange({ id: e.target.value })}
              placeholder="field_id"
            />
          </div>
          <div>
            <Label htmlFor={`field-type-${field.id}`}>字段类型 *</Label>
            <Select
              value={localField.type}
              onValueChange={(type) => handleFieldChange({ type })}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择字段类型" />
              </SelectTrigger>
              <SelectContent>
                {fieldTypes.map((fieldType) => (
                  <SelectItem key={fieldType.id} value={fieldType.type_name}>
                    {fieldType.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor={`field-label-${field.id}`}>字段标签 *</Label>
          <Input
            id={`field-label-${field.id}`}
            value={localField.label}
            onChange={(e) => handleFieldChange({ label: e.target.value })}
            placeholder="字段显示名称"
          />
        </div>

        <div>
          <Label htmlFor={`field-placeholder-${field.id}`}>占位符</Label>
          <Input
            id={`field-placeholder-${field.id}`}
            value={localField.placeholder || ''}
            onChange={(e) => handleFieldChange({ placeholder: e.target.value })}
            placeholder="输入提示文字"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id={`field-required-${field.id}`}
            checked={localField.required || false}
            onCheckedChange={(required) => handleFieldChange({ required: !!required })}
          />
          <Label htmlFor={`field-required-${field.id}`}>必填字段</Label>
        </div>

        {/* 选项配置 */}
        {needsOptions && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>选项配置</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOption}
              >
                <Plus className="h-4 w-4 mr-1" />
                添加选项
              </Button>
            </div>
            <div className="space-y-2">
              {(localField.options || []).map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                    placeholder={`选项 ${index + 1}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeOption(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 高级配置 */}
        {showAdvanced && (
          <div className="border-t pt-4 space-y-4">
            <h4 className="font-medium text-sm">高级配置</h4>
            
            {/* 数字类型配置 */}
            {localField.type === 'number' && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>最小值</Label>
                  <Input
                    type="number"
                    value={localField.min || ''}
                    onChange={(e) => handleFieldChange({ min: e.target.value ? Number(e.target.value) : undefined })}
                  />
                </div>
                <div>
                  <Label>最大值</Label>
                  <Input
                    type="number"
                    value={localField.max || ''}
                    onChange={(e) => handleFieldChange({ max: e.target.value ? Number(e.target.value) : undefined })}
                  />
                </div>
                <div>
                  <Label>步长</Label>
                  <Input
                    type="number"
                    value={localField.step || ''}
                    onChange={(e) => handleFieldChange({ step: e.target.value ? Number(e.target.value) : undefined })}
                  />
                </div>
              </div>
            )}

            {/* 文本域配置 */}
            {localField.type === 'textarea' && (
              <div>
                <Label>行数</Label>
                <Input
                  type="number"
                  value={localField.rows || 3}
                  onChange={(e) => handleFieldChange({ rows: Number(e.target.value) })}
                  min="1"
                  max="20"
                />
              </div>
            )}

            {/* 文件上传配置 */}
            {localField.type === 'file' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>接受的文件类型</Label>
                  <Input
                    value={localField.accept || ''}
                    onChange={(e) => handleFieldChange({ accept: e.target.value })}
                    placeholder="如: image/*,.pdf,.doc"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={localField.multiple || false}
                    onCheckedChange={(multiple) => handleFieldChange({ multiple: !!multiple })}
                  />
                  <Label>允许多文件</Label>
                </div>
              </div>
            )}

            {/* 验证规则 */}
            <div>
              <Label>验证规则</Label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <Label className="text-xs">最小长度</Label>
                  <Input
                    type="number"
                    value={localField.validation?.minLength || ''}
                    onChange={(e) => handleFieldChange({
                      validation: {
                        ...localField.validation,
                        minLength: e.target.value ? Number(e.target.value) : undefined
                      }
                    })}
                  />
                </div>
                <div>
                  <Label className="text-xs">最大长度</Label>
                  <Input
                    type="number"
                    value={localField.validation?.maxLength || ''}
                    onChange={(e) => handleFieldChange({
                      validation: {
                        ...localField.validation,
                        maxLength: e.target.value ? Number(e.target.value) : undefined
                      }
                    })}
                  />
                </div>
              </div>
              <div className="mt-2">
                <Label className="text-xs">正则表达式</Label>
                <Input
                  value={localField.validation?.pattern || ''}
                  onChange={(e) => handleFieldChange({
                    validation: {
                      ...localField.validation,
                      pattern: e.target.value
                    }
                  })}
                  placeholder="验证正则表达式"
                />
              </div>
              <div className="mt-2">
                <Label className="text-xs">错误提示</Label>
                <Input
                  value={localField.validation?.message || ''}
                  onChange={(e) => handleFieldChange({
                    validation: {
                      ...localField.validation,
                      message: e.target.value
                    }
                  })}
                  placeholder="验证失败时的提示信息"
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}