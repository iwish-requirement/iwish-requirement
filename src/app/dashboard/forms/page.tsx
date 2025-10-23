'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2, Copy, Eye, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { FormSchema, formConfigService } from '@/services/formConfig'
import { useRouter } from 'next/navigation'

export default function FormsPage() {
  const router = useRouter()
  const [forms, setForms] = useState<FormSchema[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState<string>('all')

  useEffect(() => {
    loadForms()
  }, [])

  const loadForms = async () => {
    try {
      setLoading(true)
      const data = await formConfigService.getFormSchemas()
      setForms(data)
    } catch (error) {
      console.error('Failed to load forms:', error)
      toast.error('加载表单失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个表单吗？此操作不可撤销。')) {
      return
    }
    
    try {
      await formConfigService.deleteFormSchema(id)
      toast.success('表单删除成功')
      loadForms()
    } catch (error) {
      console.error('Failed to delete form:', error)
      toast.error('删除表单失败')
    }
  }

  const handleDuplicate = async (form: FormSchema) => {
    try {
      const newName = `${form.name} - 副本`
      await formConfigService.duplicateFormSchema(form.id!, newName)
      toast.success('表单复制成功')
      loadForms()
    } catch (error) {
      console.error('Failed to duplicate form:', error)
      toast.error('复制表单失败')
    }
  }

  const handleEdit = (form: FormSchema) => {
    router.push(`/dashboard/forms/edit/${form.id}`)
  }

  const handleCreate = () => {
    router.push('/dashboard/forms/create')
  }

  const handlePreview = (form: FormSchema) => {
    // 简单的预览，可以后续改进为模态框
    alert(`表单预览：${form.name}\n字段数量：${form.fields?.length || 0}\n部门：${form.department || '通用'}\n岗位：${form.position || '通用'}`)
  }

  const filteredForms = forms.filter(form => {
    const matchesSearch = form.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (form.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesDepartment = departmentFilter === 'all' || form.department === departmentFilter
    return matchesSearch && matchesDepartment
  })

  const departments = Array.from(new Set(forms.map(form => form.department).filter(Boolean)))

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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">表单配置</h1>
          <p className="text-gray-600">管理系统中的表单模板</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          新建表单
        </Button>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="搜索表单名称或描述..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="筛选部门" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部部门</SelectItem>
            {departments.map(dept => (
              <SelectItem key={dept} value={dept}>{dept}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 表单列表 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredForms.map((form) => (
          <Card key={form.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{form.name}</CardTitle>
                  <CardDescription className="mt-1">
                    {form.description}
                  </CardDescription>
                </div>
                <Badge variant={form.is_active ? "default" : "secondary"}>
                  {form.is_active ? "启用" : "禁用"}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>部门:</span>
                  <span>{form.department || '通用'}</span>
                </div>
                <div className="flex justify-between">
                  <span>岗位:</span>
                  <span>{form.position || '通用'}</span>
                </div>
                <div className="flex justify-between">
                  <span>字段数:</span>
                  <span>{form.fields?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>更新时间:</span>
                  <span>{form.updated_at ? new Date(form.updated_at).toLocaleDateString() : '-'}</span>
                </div>
              </div>
              
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePreview(form)}
                  title="预览表单"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleEdit(form)}
                  title="编辑表单"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDuplicate(form)}
                  title="复制表单"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-red-600 hover:text-red-700"
                  onClick={() => handleDelete(form.id!)}
                  title="删除表单"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredForms.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">
            {searchTerm || departmentFilter ? '没有找到匹配的表单' : '暂无表单配置'}
          </p>
          {!searchTerm && departmentFilter === 'all' && (
            <Button className="mt-4" onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              创建第一个表单
            </Button>
          )}
        </div>
      )}
    </div>
  )
}