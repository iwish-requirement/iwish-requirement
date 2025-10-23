'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Building,
  Briefcase,
  Users,
  Settings,
  AlertCircle,
  ArrowUpDown,
  Save,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { usePermissions, PermissionGuard } from '@/hooks/usePermissions'
import { departmentPositionService, type Department, type Position, type CreateDepartmentInput, type CreatePositionInput, type UpdateDepartmentInput, type UpdatePositionInput } from '@/services/departmentPosition'

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('departments')

  // 部门相关状态
  const [isDeptCreateDialogOpen, setIsDeptCreateDialogOpen] = useState(false)
  const [isDeptEditDialogOpen, setIsDeptEditDialogOpen] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [deptFormData, setDeptFormData] = useState({
    code: '',
    name: '',
    description: '',
    is_active: true,
    sort_order: 0
  })

  // 岗位相关状态
  const [isPosCreateDialogOpen, setIsPosCreateDialogOpen] = useState(false)
  const [isPosEditDialogOpen, setIsPosEditDialogOpen] = useState(false)
  const [editingPosition, setEditingPosition] = useState<Position | null>(null)
  const [posFormData, setPosFormData] = useState({
    code: '',
    name: '',
    description: '',
    department_code: '',
    is_active: true,
    sort_order: 0
  })

  const { hasPermission } = usePermissions()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setPageLoading(true)
      const [departmentsData, positionsData] = await Promise.all([
        departmentPositionService.getDepartments(),
        departmentPositionService.getPositions()
      ])
      setDepartments(departmentsData)
      setPositions(positionsData)
    } catch (error) {
      console.error('加载数据失败:', error)
      toast.error('加载数据失败')
    } finally {
      setPageLoading(false)
    }
  }

  // 部门管理函数
  const resetDeptFormData = () => {
    setDeptFormData({
      code: '',
      name: '',
      description: '',
      is_active: true,
      sort_order: 0
    })
  }

  const openDeptCreateDialog = () => {
    resetDeptFormData()
    setIsDeptCreateDialogOpen(true)
  }

  const openDeptEditDialog = (department: Department) => {
    setEditingDepartment(department)
    setDeptFormData({
      code: department.code,
      name: department.name,
      description: department.description || '',
      is_active: department.is_active,
      sort_order: department.sort_order
    })
    setIsDeptEditDialogOpen(true)
  }

  const handleCreateDepartment = async () => {
    if (!deptFormData.code.trim() || !deptFormData.name.trim()) {
      toast.error('请填写部门代码和名称')
      return
    }

    setLoading(true)
    try {
      const createData: CreateDepartmentInput = {
        code: deptFormData.code,
        name: deptFormData.name,
        description: deptFormData.description || undefined,
        is_active: deptFormData.is_active,
        sort_order: deptFormData.sort_order
      }

      const newDepartment = await departmentPositionService.createDepartment(createData)
      setDepartments(prev => [newDepartment, ...prev])
      setIsDeptCreateDialogOpen(false)
      resetDeptFormData()
      toast.success('部门创建成功')
    } catch (error: any) {
      console.error('创建部门失败:', error)
      toast.error(error.message || '创建部门失败')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateDepartment = async () => {
    if (!editingDepartment) return

    if (!deptFormData.name.trim()) {
      toast.error('请填写部门名称')
      return
    }

    setLoading(true)
    try {
      const updateData: UpdateDepartmentInput = {
        name: deptFormData.name,
        description: deptFormData.description || undefined,
        is_active: deptFormData.is_active,
        sort_order: deptFormData.sort_order
      }

      const updatedDepartment = await departmentPositionService.updateDepartment(
        editingDepartment.code,
        updateData
      )
      
      setDepartments(prev => prev.map(dept => 
        dept.code === editingDepartment.code ? updatedDepartment : dept
      ))
      setIsDeptEditDialogOpen(false)
      setEditingDepartment(null)
      resetDeptFormData()
      toast.success('部门更新成功')
    } catch (error: any) {
      console.error('更新部门失败:', error)
      toast.error(error.message || '更新部门失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteDepartment = async (department: Department) => {
    if (!confirm(`确定要删除部门"${department.name}"吗？`)) return

    setLoading(true)
    try {
      await departmentPositionService.deleteDepartment(department.code)
      setDepartments(prev => prev.filter(dept => dept.code !== department.code))
      toast.success('部门删除成功')
    } catch (error: any) {
      console.error('删除部门失败:', error)
      toast.error(error.message || '删除部门失败')
    } finally {
      setLoading(false)
    }
  }

  // 岗位管理函数
  const resetPosFormData = () => {
    setPosFormData({
      code: '',
      name: '',
      description: '',
      department_code: '',
      is_active: true,
      sort_order: 0
    })
  }

  const openPosCreateDialog = () => {
    resetPosFormData()
    setIsPosCreateDialogOpen(true)
  }

  const openPosEditDialog = (position: Position) => {
    setEditingPosition(position)
    setPosFormData({
      code: position.code,
      name: position.name,
      description: position.description || '',
      department_code: position.department_code || '',
      is_active: position.is_active,
      sort_order: position.sort_order
    })
    setIsPosEditDialogOpen(true)
  }

  const handleCreatePosition = async () => {
    if (!posFormData.code.trim() || !posFormData.name.trim()) {
      toast.error('请填写岗位代码和名称')
      return
    }

    setLoading(true)
    try {
      const createData: CreatePositionInput = {
        code: posFormData.code,
        name: posFormData.name,
        description: posFormData.description || undefined,
        department_code: posFormData.department_code === 'general' ? undefined : posFormData.department_code || undefined,
        is_active: posFormData.is_active,
        sort_order: posFormData.sort_order
      }

      const newPosition = await departmentPositionService.createPosition(createData)
      setPositions(prev => [newPosition, ...prev])
      setIsPosCreateDialogOpen(false)
      resetPosFormData()
      toast.success('岗位创建成功')
    } catch (error: any) {
      console.error('创建岗位失败:', error)
      toast.error(error.message || '创建岗位失败')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdatePosition = async () => {
    if (!editingPosition) return

    if (!posFormData.name.trim()) {
      toast.error('请填写岗位名称')
      return
    }

    setLoading(true)
    try {
      const updateData: UpdatePositionInput = {
        name: posFormData.name,
        description: posFormData.description || undefined,
        department_code: posFormData.department_code === 'general' ? undefined : posFormData.department_code || undefined,
        is_active: posFormData.is_active,
        sort_order: posFormData.sort_order
      }

      const updatedPosition = await departmentPositionService.updatePosition(
        editingPosition.code,
        updateData
      )
      
      setPositions(prev => prev.map(pos => 
        pos.code === editingPosition.code ? updatedPosition : pos
      ))
      setIsPosEditDialogOpen(false)
      setEditingPosition(null)
      resetPosFormData()
      toast.success('岗位更新成功')
    } catch (error: any) {
      console.error('更新岗位失败:', error)
      toast.error(error.message || '更新岗位失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePosition = async (position: Position) => {
    if (!confirm(`确定要删除岗位"${position.name}"吗？`)) return

    setLoading(true)
    try {
      await departmentPositionService.deletePosition(position.code)
      setPositions(prev => prev.filter(pos => pos.code !== position.code))
      toast.success('岗位删除成功')
    } catch (error: any) {
      console.error('删除岗位失败:', error)
      toast.error(error.message || '删除岗位失败')
    } finally {
      setLoading(false)
    }
  }

  // 过滤数据
  const filteredDepartments = departments.filter(dept =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dept.code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredPositions = positions.filter(pos =>
    pos.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pos.code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getDepartmentName = (code?: string) => {
    if (!code) return '通用岗位'
    const dept = departments.find(d => d.code === code)
    return dept ? dept.name : code
  }

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">加载部门岗位数据中...</p>
        </div>
      </div>
    )
  }

  return (
    <PermissionGuard permission="user.manage">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              部门岗位管理
            </h1>
            <p className="text-muted-foreground mt-2">
              管理系统中的部门和岗位信息
            </p>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Building className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">总部门数</p>
                  <p className="text-2xl font-bold">{departments.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Briefcase className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">总岗位数</p>
                  <p className="text-2xl font-bold">{positions.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">活跃部门</p>
                  <p className="text-2xl font-bold">{departments.filter(d => d.is_active).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Settings className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">活跃岗位</p>
                  <p className="text-2xl font-bold">{positions.filter(p => p.is_active).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 搜索 */}
        <Card>
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="搜索部门或岗位..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* 标签页 */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="departments" className="flex items-center space-x-2">
              <Building className="h-4 w-4" />
              <span>部门管理</span>
            </TabsTrigger>
            <TabsTrigger value="positions" className="flex items-center space-x-2">
              <Briefcase className="h-4 w-4" />
              <span>岗位管理</span>
            </TabsTrigger>
          </TabsList>

          {/* 部门管理 */}
          <TabsContent value="departments" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">部门列表</h2>
              <Button onClick={openDeptCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                创建部门
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredDepartments.map((department) => (
                <Card key={department.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{department.name}</CardTitle>
                        <p className="text-sm text-gray-500">代码: {department.code}</p>
                      </div>
                      <Badge variant={department.is_active ? 'default' : 'secondary'}>
                        {department.is_active ? '启用' : '禁用'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {department.description && (
                      <p className="text-sm text-gray-600 mb-3">{department.description}</p>
                    )}
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDeptEditDialog(department)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteDepartment(department)}
                        className="hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredDepartments.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? '未找到匹配的部门' : '暂无部门数据'}
              </div>
            )}
          </TabsContent>

          {/* 岗位管理 */}
          <TabsContent value="positions" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">岗位列表</h2>
              <Button onClick={openPosCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                创建岗位
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredPositions.map((position) => (
                <Card key={position.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{position.name}</CardTitle>
                        <p className="text-sm text-gray-500">代码: {position.code}</p>
                        <p className="text-sm text-blue-600">{getDepartmentName(position.department_code)}</p>
                      </div>
                      <Badge variant={position.is_active ? 'default' : 'secondary'}>
                        {position.is_active ? '启用' : '禁用'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {position.description && (
                      <p className="text-sm text-gray-600 mb-3">{position.description}</p>
                    )}
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openPosEditDialog(position)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeletePosition(position)}
                        className="hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredPositions.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? '未找到匹配的岗位' : '暂无岗位数据'}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* 创建部门对话框 */}
        <Dialog open={isDeptCreateDialogOpen} onOpenChange={setIsDeptCreateDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>创建部门</DialogTitle>
              <DialogDescription>
                创建新的部门信息
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dept_code">部门代码 *</Label>
                <Input
                  id="dept_code"
                  value={deptFormData.code}
                  onChange={(e) => setDeptFormData({ ...deptFormData, code: e.target.value })}
                  placeholder="如：creative"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="dept_name">部门名称 *</Label>
                <Input
                  id="dept_name"
                  value={deptFormData.name}
                  onChange={(e) => setDeptFormData({ ...deptFormData, name: e.target.value })}
                  placeholder="如：创意部"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="dept_description">部门描述</Label>
                <Textarea
                  id="dept_description"
                  value={deptFormData.description}
                  onChange={(e) => setDeptFormData({ ...deptFormData, description: e.target.value })}
                  placeholder="部门的职责和描述..."
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dept_sort_order">排序</Label>
                  <Input
                    id="dept_sort_order"
                    type="number"
                    value={deptFormData.sort_order}
                    onChange={(e) => setDeptFormData({ ...deptFormData, sort_order: parseInt(e.target.value) || 0 })}
                    min={0}
                  />
                </div>
                
                <div className="flex items-center space-x-2 pt-6">
                  <Switch
                    id="dept_is_active"
                    checked={deptFormData.is_active}
                    onCheckedChange={(checked) => setDeptFormData({ ...deptFormData, is_active: checked })}
                  />
                  <Label htmlFor="dept_is_active">启用部门</Label>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeptCreateDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleCreateDepartment} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    创建中...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    创建部门
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 编辑部门对话框 */}
        <Dialog open={isDeptEditDialogOpen} onOpenChange={setIsDeptEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>编辑部门</DialogTitle>
              <DialogDescription>
                修改部门信息
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit_dept_code">部门代码</Label>
                <Input
                  id="edit_dept_code"
                  value={deptFormData.code}
                  disabled
                  className="bg-gray-50"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit_dept_name">部门名称 *</Label>
                <Input
                  id="edit_dept_name"
                  value={deptFormData.name}
                  onChange={(e) => setDeptFormData({ ...deptFormData, name: e.target.value })}
                  placeholder="如：创意部"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit_dept_description">部门描述</Label>
                <Textarea
                  id="edit_dept_description"
                  value={deptFormData.description}
                  onChange={(e) => setDeptFormData({ ...deptFormData, description: e.target.value })}
                  placeholder="部门的职责和描述..."
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_dept_sort_order">排序</Label>
                  <Input
                    id="edit_dept_sort_order"
                    type="number"
                    value={deptFormData.sort_order}
                    onChange={(e) => setDeptFormData({ ...deptFormData, sort_order: parseInt(e.target.value) || 0 })}
                    min={0}
                  />
                </div>
                
                <div className="flex items-center space-x-2 pt-6">
                  <Switch
                    id="edit_dept_is_active"
                    checked={deptFormData.is_active}
                    onCheckedChange={(checked) => setDeptFormData({ ...deptFormData, is_active: checked })}
                  />
                  <Label htmlFor="edit_dept_is_active">启用部门</Label>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeptEditDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleUpdateDepartment} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    更新中...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    更新部门
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 创建岗位对话框 */}
        <Dialog open={isPosCreateDialogOpen} onOpenChange={setIsPosCreateDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>创建岗位</DialogTitle>
              <DialogDescription>
                创建新的岗位信息
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pos_code">岗位代码 *</Label>
                <Input
                  id="pos_code"
                  value={posFormData.code}
                  onChange={(e) => setPosFormData({ ...posFormData, code: e.target.value })}
                  placeholder="如：ui_designer"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="pos_name">岗位名称 *</Label>
                <Input
                  id="pos_name"
                  value={posFormData.name}
                  onChange={(e) => setPosFormData({ ...posFormData, name: e.target.value })}
                  placeholder="如：UI设计师"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="pos_department">所属部门</Label>
                <Select value={posFormData.department_code} onValueChange={(value) => setPosFormData({ ...posFormData, department_code: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择部门" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">通用岗位</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept.code} value={dept.code}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="pos_description">岗位描述</Label>
                <Textarea
                  id="pos_description"
                  value={posFormData.description}
                  onChange={(e) => setPosFormData({ ...posFormData, description: e.target.value })}
                  placeholder="岗位的职责和要求..."
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pos_sort_order">排序</Label>
                  <Input
                    id="pos_sort_order"
                    type="number"
                    value={posFormData.sort_order}
                    onChange={(e) => setPosFormData({ ...posFormData, sort_order: parseInt(e.target.value) || 0 })}
                    min={0}
                  />
                </div>
                
                <div className="flex items-center space-x-2 pt-6">
                  <Switch
                    id="pos_is_active"
                    checked={posFormData.is_active}
                    onCheckedChange={(checked) => setPosFormData({ ...posFormData, is_active: checked })}
                  />
                  <Label htmlFor="pos_is_active">启用岗位</Label>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPosCreateDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleCreatePosition} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    创建中...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    创建岗位
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 编辑岗位对话框 */}
        <Dialog open={isPosEditDialogOpen} onOpenChange={setIsPosEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>编辑岗位</DialogTitle>
              <DialogDescription>
                修改岗位信息
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit_pos_code">岗位代码</Label>
                <Input
                  id="edit_pos_code"
                  value={posFormData.code}
                  disabled
                  className="bg-gray-50"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit_pos_name">岗位名称 *</Label>
                <Input
                  id="edit_pos_name"
                  value={posFormData.name}
                  onChange={(e) => setPosFormData({ ...posFormData, name: e.target.value })}
                  placeholder="如：UI设计师"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit_pos_department">所属部门</Label>
                <Select value={posFormData.department_code} onValueChange={(value) => setPosFormData({ ...posFormData, department_code: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择部门" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">通用岗位</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept.code} value={dept.code}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit_pos_description">岗位描述</Label>
                <Textarea
                  id="edit_pos_description"
                  value={posFormData.description}
                  onChange={(e) => setPosFormData({ ...posFormData, description: e.target.value })}
                  placeholder="岗位的职责和要求..."
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_pos_sort_order">排序</Label>
                  <Input
                    id="edit_pos_sort_order"
                    type="number"
                    value={posFormData.sort_order}
                    onChange={(e) => setPosFormData({ ...posFormData, sort_order: parseInt(e.target.value) || 0 })}
                    min={0}
                  />
                </div>
                
                <div className="flex items-center space-x-2 pt-6">
                  <Switch
                    id="edit_pos_is_active"
                    checked={posFormData.is_active}
                    onCheckedChange={(checked) => setPosFormData({ ...posFormData, is_active: checked })}
                  />
                  <Label htmlFor="edit_pos_is_active">启用岗位</Label>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPosEditDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleUpdatePosition} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    更新中...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    更新岗位
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  )
}