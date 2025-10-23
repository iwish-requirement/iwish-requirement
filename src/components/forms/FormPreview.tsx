'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Button } from '@/components/ui/button'
import { FormSchema, FormField } from '@/services/formConfig'

interface FormPreviewProps {
  schema: FormSchema
}

export function FormPreview({ schema }: FormPreviewProps) {
  const renderField = (field: FormField) => {
    const fieldId = `preview-${field.id}`
    
    return (
      <div key={field.id} className="space-y-2">
        <Label htmlFor={fieldId} className="flex items-center gap-1">
          {field.label}
          {field.required && <span className="text-red-500">*</span>}
        </Label>
        
        {renderFieldInput(field, fieldId)}
        
        {field.placeholder && field.type !== 'select' && field.type !== 'radio' && (
          <p className="text-xs text-gray-500">{field.placeholder}</p>
        )}
      </div>
    )
  }

  const renderFieldInput = (field: FormField, fieldId: string) => {
    switch (field.type) {
      case 'text':
      case 'email':
      case 'password':
        return (
          <Input
            id={fieldId}
            type={field.type}
            placeholder={field.placeholder}
            disabled
          />
        )

      case 'number':
        return (
          <Input
            id={fieldId}
            type="number"
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
            step={field.step}
            disabled
          />
        )

      case 'textarea':
        return (
          <Textarea
            id={fieldId}
            placeholder={field.placeholder}
            rows={field.rows || 3}
            disabled
          />
        )

      case 'select':
        return (
          <Select disabled>
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || '请选择'} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option, index) => (
                <SelectItem key={index} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case 'radio':
        return (
          <RadioGroup disabled>
            {field.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`${fieldId}-${index}`} />
                <Label htmlFor={`${fieldId}-${index}`}>{option}</Label>
              </div>
            ))}
          </RadioGroup>
        )

      case 'checkbox':
        return (
          <div className="space-y-2">
            {field.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Checkbox id={`${fieldId}-${index}`} disabled />
                <Label htmlFor={`${fieldId}-${index}`}>{option}</Label>
              </div>
            ))}
          </div>
        )

      case 'date':
        return (
          <Input
            id={fieldId}
            type="date"
            disabled
          />
        )

      case 'datetime':
        return (
          <Input
            id={fieldId}
            type="datetime-local"
            disabled
          />
        )

      case 'time':
        return (
          <Input
            id={fieldId}
            type="time"
            disabled
          />
        )

      case 'file':
        return (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500">
              {field.multiple ? '点击上传多个文件' : '点击上传文件'}
            </p>
            {field.accept && (
              <p className="text-xs text-gray-400 mt-1">
                支持格式: {field.accept}
              </p>
            )}
          </div>
        )

      default:
        return (
          <div className="p-2 bg-gray-100 rounded text-sm text-gray-600">
            未知字段类型: {field.type}
          </div>
        )
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{schema.name}</span>
          <span className="text-sm font-normal text-gray-500">
            预览模式
          </span>
        </CardTitle>
        {schema.description && (
          <p className="text-sm text-gray-600">{schema.description}</p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-6">
        {schema.fields.map(renderField)}
        
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" disabled>
            取消
          </Button>
          <Button disabled>
            提交
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}