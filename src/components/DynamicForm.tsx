'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { FormSchema, FormField } from '@/types'

interface DynamicFormProps {
  schema: FormSchema
  initialData?: Record<string, any>
  onSubmit: (data: Record<string, any>) => void
  onCancel?: () => void
  loading?: boolean
}

interface FormErrors {
  [key: string]: string
}

export function DynamicForm({ 
  schema, 
  initialData = {}, 
  onSubmit, 
  onCancel, 
  loading = false 
}: DynamicFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>(initialData)
  const [errors, setErrors] = useState<FormErrors>({})
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set())

  // 初始化表单数据和可见字段
  useEffect(() => {
    const initialVisibleFields = new Set<string>()
    
    schema.fields.forEach(field => {
      // 设置默认值
      if (!(field.name in formData)) {
        setFormData(prev => ({
          ...prev,
          [field.name]: field.default_value || getDefaultValueByType(field.type)
        }))
      }

      // 检查字段可见性
      if (shouldShowField(field, formData)) {
        initialVisibleFields.add(field.name)
      }
    })

    setVisibleFields(initialVisibleFields)
  }, [schema.fields, formData])

  // 根据字段类型获取默认值
  const getDefaultValueByType = (type: string): any => {
    switch (type) {
      case 'checkbox':
        return false
      case 'number':
        return 0
      case 'select':
      case 'radio':
        return ''
      default:
        return ''
    }
  }

  // 检查字段是否应该显示
  const shouldShowField = (field: FormField, currentData: Record<string, any>): boolean => {
    if (!field.conditional_logic) return true

    const { show_when, logic_operator = 'and' } = field.conditional_logic

    if (!show_when || show_when.length === 0) return true

    const results = show_when.map(condition => {
      const fieldValue = currentData[condition.field]
      const conditionValue = condition.value

      switch (condition.operator) {
        case 'equals':
          return fieldValue === conditionValue
        case 'not_equals':
          return fieldValue !== conditionValue
        case 'contains':
          return String(fieldValue).includes(String(conditionValue))
        case 'not_contains':
          return !String(fieldValue).includes(String(conditionValue))
        case 'greater_than':
          return Number(fieldValue) > Number(conditionValue)
        case 'less_than':
          return Number(fieldValue) < Number(conditionValue)
        default:
          return false
      }
    })

    return logic_operator === 'and' 
      ? results.every(Boolean) 
      : results.some(Boolean)
  }

  // 验证字段
  const validateField = (field: FormField, value: any): string => {
    // 必填验证
    if (field.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      return `${field.label}是必填项`
    }

    if (!field.validation || !value) return ''

    const validation = field.validation

    // 字符串长度验证
    if (typeof value === 'string') {
      if (validation.min_length && value.length < validation.min_length) {
        return `${field.label}最少需要${validation.min_length}个字符`
      }
      if (validation.max_length && value.length > validation.max_length) {
        return `${field.label}最多允许${validation.max_length}个字符`
      }
    }

    // 数字范围验证
    if (field.type === 'number') {
      const numValue = Number(value)
      if (validation.min && numValue < validation.min) {
        return `${field.label}不能小于${validation.min}`
      }
      if (validation.max && numValue > validation.max) {
        return `${field.label}不能大于${validation.max}`
      }
    }

    // 正则表达式验证
    if (validation.pattern) {
      const regex = new RegExp(validation.pattern)
      if (!regex.test(String(value))) {
        return validation.pattern_message || `${field.label}格式不正确`
      }
    }

    return ''
  }

  // 处理字段值变化
  const handleFieldChange = (fieldName: string, value: any) => {
    const newFormData = { ...formData, [fieldName]: value }
    setFormData(newFormData)

    // 清除该字段的错误
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[fieldName]
        return newErrors
      })
    }

    // 重新计算可见字段
    const newVisibleFields = new Set<string>()
    schema.fields.forEach(field => {
      if (shouldShowField(field, newFormData)) {
        newVisibleFields.add(field.name)
      }
    })
    setVisibleFields(newVisibleFields)
  }

  // 渲染表单字段
  const renderField = (field: FormField) => {
    if (!visibleFields.has(field.name)) return null

    const value = formData[field.name] || ''
    const error = errors[field.name]

    const commonProps = {
      id: field.name,
      name: field.name,
      placeholder: field.placeholder,
      disabled: loading,
      className: error ? 'border-red-500' : ''
    }

    let fieldElement: React.ReactNode

    switch (field.type) {
      case 'text':
      case 'email':
      case 'url':
      case 'tel':
        fieldElement = (
          <Input
            {...commonProps}
            type={field.type}
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
          />
        )
        break

      case 'number':
        fieldElement = (
          <Input
            {...commonProps}
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(field.name, Number(e.target.value))}
          />
        )
        break

      case 'textarea':
        fieldElement = (
          <Textarea
            {...commonProps}
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
          />
        )
        break

      case 'date':
        fieldElement = (
          <Input
            {...commonProps}
            type="date"
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
          />
        )
        break

      case 'datetime':
        fieldElement = (
          <Input
            {...commonProps}
            type="datetime-local"
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
          />
        )
        break

      case 'time':
        fieldElement = (
          <Input
            {...commonProps}
            type="time"
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
          />
        )
        break

      case 'select':
        fieldElement = (
          <select
            {...commonProps}
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${error ? 'border-red-500' : ''}`}
          >
            <option value="">请选择...</option>
            {field.options?.map((option, index) => (
              <option key={index} value={option}>
                {option}
              </option>
            ))}
          </select>
        )
        break

      case 'radio':
        fieldElement = (
          <div className="space-y-2">
            {field.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <input
                  type="radio"
                  id={`${field.name}-${index}`}
                  name={field.name}
                  value={option}
                  checked={value === option}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  disabled={loading}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                />
                <Label htmlFor={`${field.name}-${index}`} className="text-sm">
                  {option}
                </Label>
              </div>
            ))}
          </div>
        )
        break

      case 'checkbox':
        if (field.options && field.options.length > 1) {
          // 多选复选框
          fieldElement = (
            <div className="space-y-2">
              {field.options.map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`${field.name}-${index}`}
                    checked={Array.isArray(value) ? value.includes(option) : false}
                    onChange={(e) => {
                      const currentValues = Array.isArray(value) ? value : []
                      if (e.target.checked) {
                        handleFieldChange(field.name, [...currentValues, option])
                      } else {
                        handleFieldChange(field.name, currentValues.filter((v: any) => v !== option))
                      }
                    }}
                    disabled={loading}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                  />
                  <Label htmlFor={`${field.name}-${index}`} className="text-sm">
                    {option}
                  </Label>
                </div>
              ))}
            </div>
          )
        } else {
          // 单个复选框
          fieldElement = (
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={field.name}
                checked={Boolean(value)}
                onChange={(e) => handleFieldChange(field.name, e.target.checked)}
                disabled={loading}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <Label htmlFor={field.name} className="text-sm">
                {field.options?.[0] || field.label}
              </Label>
            </div>
          )
        }
        break

      case 'switch':
        fieldElement = (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={field.name}
              checked={Boolean(value)}
              onChange={(e) => handleFieldChange(field.name, e.target.checked)}
              disabled={loading}
              className="h-6 w-11 rounded-full bg-gray-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <Label htmlFor={field.name} className="text-sm">
              {field.label}
            </Label>
          </div>
        )
        break

      default:
        fieldElement = (
          <Input
            {...commonProps}
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
          />
        )
    }

    return (
      <div key={field.name} className="space-y-2">
        {field.type !== 'checkbox' && field.type !== 'switch' && (
          <Label htmlFor={field.name} className="text-sm font-medium">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
        )}
        {fieldElement}
        {field.description && (
          <p className="text-xs text-gray-500">{field.description}</p>
        )}
        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}
      </div>
    )
  }

  // 验证整个表单
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    schema.fields.forEach(field => {
      if (visibleFields.has(field.name)) {
        const error = validateField(field, formData[field.name])
        if (error) {
          newErrors[field.name] = error
        }
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 处理表单提交
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    // 只提交可见字段的数据
    const visibleData: Record<string, any> = {}
    schema.fields.forEach(field => {
      if (visibleFields.has(field.name)) {
        visibleData[field.name] = formData[field.name]
      }
    })

    onSubmit(visibleData)
  }

  // 按顺序排序字段
  const sortedFields = [...schema.fields].sort((a, b) => (a.order || 0) - (b.order || 0))

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{schema.name}</CardTitle>
        {schema.description && (
          <p className="text-sm text-gray-600">{schema.description}</p>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {sortedFields.map(renderField)}
          
          <div className="flex justify-end space-x-4 pt-6">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
              >
                取消
              </Button>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? '提交中...' : '提交'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}