'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { requirementService } from '@/services/requirement'
import { userService } from '@/services/user'
import { departmentService } from '@/services/department'
import { formSchemaService } from '@/services/formSchema'
import { usePermissions } from '@/hooks/usePermissions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  ArrowLeft,
  Calendar, 
  User, 
  Building,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Edit,
  Star,
  FileText,
  Settings,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { createSupabaseClient } from '@/lib/supabase'
import { toast } from 'sonner'
import type { Requirement, User as UserType } from '@/types'
import type { Department } from '@/services/department'
import type { FormSchema } from '@/services/formSchema'

import { getSmartDepartmentDisplayName, getSmartPositionDisplayName } from '@/utils/displayHelpers'

const ATTACH_BUCKET = process.env.NEXT_PUBLIC_ATTACHMENTS_BUCKET || 'attachments'

const statusConfig = {
  not_started: { label: '未开始', color: 'bg-gray-100 text-gray-800', icon: Clock },
  in_progress: { label: '处理中', color: 'bg-blue-100 text-blue-800', icon: Play },
  completed: { label: '已完成', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  delayed: { label: '沟通延期', color: 'bg-orange-100 text-orange-800', icon: Pause },
  cancelled: { label: '不做处理', color: 'bg-red-100 text-red-800', icon: XCircle }
}

const priorityConfig = {
  low: { label: '低', color: 'bg-gray-100 text-gray-800' },
  medium: { label: '中', color: 'bg-yellow-100 text-yellow-800' },
  high: { label: '高', color: 'bg-orange-100 text-orange-800' },
  urgent: { label: '紧急', color: 'bg-red-100 text-red-800' }
}

export default function RequirementDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, hasPermission, canEditRequirement, canUpdateRequirementStatus } = usePermissions()
  const requirementId = params.id as string
  
  const [requirement, setRequirement] = useState<Requirement | null>(null)
  const [creator, setCreator] = useState<UserType | null>(null)
  const [assignee, setAssignee] = useState<UserType | null>(null)
  const [department, setDepartment] = useState<Department | null>(null)
  const [formSchema, setFormSchema] = useState<FormSchema | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  // 评论状态
  const [comments, setComments] = useState<Array<{ id: string; user_id?: string; content: string; created_at: string; attachments?: Array<{ file_name: string; file_url: string }> }>>([])
  const [newComment, setNewComment] = useState<string>('')
  const [commentLoading, setCommentLoading] = useState<boolean>(false)
  const [commentFiles, setCommentFiles] = useState<FileList | null>(null)
  const [replyParentId, setReplyParentId] = useState<string | null>(null)
  const sb = useMemo(() => createSupabaseClient(), [])
  const [newStatus, setNewStatus] = useState<string>('')
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [departmentDisplayName, setDepartmentDisplayName] = useState<string>('')
  const [positionDisplayName, setPositionDisplayName] = useState<string>('')
  const [creatorDeptDisplay, setCreatorDeptDisplay] = useState<string>('')
  const [creatorPosDisplay, setCreatorPosDisplay] = useState<string>('')
  const [assigneeDeptDisplay, setAssigneeDeptDisplay] = useState<string>('')
  const [assigneePosDisplay, setAssigneePosDisplay] = useState<string>('')

  useEffect(() => {
    const loadRequirementDetail = async () => {
      if (!requirementId || !user) return
      
      try {
        setLoading(true)
        console.log('开始加载需求详情:', requirementId)
        
        // 加载需求详情
        const req = await requirementService.getRequirement(requirementId)
        console.log('需求详情加载结果:', req)
        
        if (!req) {
          toast.error('需求不存在')
          router.push('/dashboard/requirements')
          return
        }
        
        setRequirement(req)
        
        // 加载显示名称
        const [deptDisplayName, posDisplayName] = await Promise.all([
          getSmartDepartmentDisplayName(req.department),
          getSmartPositionDisplayName(req.assignee_position)
        ])
        setDepartmentDisplayName(deptDisplayName)
        setPositionDisplayName(posDisplayName)
        
        // 加载相关信息
        try {
          // 加载创建者信息（兼容历史 created_by）
          const creatorId = (req as any).submitter_id || (req as any).created_by
          if (creatorId) {
            const creatorInfo = await userService.getUser(creatorId)
            setCreator(creatorInfo)
          }
          
          // 加载执行人信息
          if (req.assignee_id) {
            const assigneeInfo = await userService.getUser(req.assignee_id)
            setAssignee(assigneeInfo)
          }
          
          // 加载部门信息
          const departments = await departmentService.getDepartments()
          const dept = departments.find(d => d.code === req.department || d.name === req.department)
          setDepartment(dept || null)
          
          // 加载表单模板信息
          if (req.form_schema_id) {
            const schemas = await formSchemaService.getAllFormSchemas()
            const schema = schemas.find(s => s.id === req.form_schema_id)
            if (schema) {
              setFormSchema(schema)
            }
          }
        } catch (error) {
          console.error('加载相关信息失败:', error)
          // 不阻断主流程
        }
        
      } catch (error) {
        console.error('加载需求详情失败:', error)
        toast.error('加载需求详情失败')
      } finally {
        setLoading(false)
      }
    }

    loadRequirementDetail()
  }, [requirementId, router, user])

  // 加载评论
  useEffect(() => {
    const loadComments = async () => {
      if (!requirementId) return
      try {
        setCommentLoading(true)
        const { data, error } = await sb
          .from('requirement_comments')
          .select('id, user_id, content, created_at, parent_id')
          .eq('requirement_id', requirementId)
          .order('created_at', { ascending: true })
          .limit(200)
        if (!error) {
          const base = (data || []) as Array<{ id: string; user_id?: string; content: string; created_at: string }>
          const ids = base.map(c => c.id)
          let attachMap: Record<string, Array<{ file_name: string; file_url: string }>> = {}
          if (ids.length > 0) {
            const { data: attaches } = await sb
              .from('requirement_comment_attachments')
              .select('comment_id, file_name, file_url')
              .in('comment_id', ids)
            for (const a of (attaches || []) as any[]) {
              const cid = (a as any).comment_id
              if (!attachMap[cid]) attachMap[cid] = []
              attachMap[cid].push({ file_name: (a as any).file_name, file_url: (a as any).file_url })
            }
          }
          {
            const byParent: Record<string, Array<{ id: string; user_id?: string; content: string; created_at: string; parent_id?: string }>> = {}
            const roots: Array<{ id: string; user_id?: string; content: string; created_at: string; parent_id?: string }> = []
            for (const c of base) {
              const pid = (c as any).parent_id
              if (pid) {
                if (!byParent[pid]) byParent[pid] = []
                byParent[pid].push(c)
              } else {
                roots.push(c)
              }
            }
            const ordered: Array<any> = []
            const pushWithChildren = (c: any, depth = 0) => {
              ordered.push({ ...c, attachments: attachMap[c.id] || [], depth })
              const children = byParent[c.id] || []
              for (const child of children) pushWithChildren(child, depth + 1)
            }
            for (const r of roots) pushWithChildren(r, 0)
            setComments(ordered)
          }
        }
      } finally {
        setCommentLoading(false)
      }
    }
    loadComments()
  }, [requirementId, sb])

  useEffect(() => {
    const run = async () => {
      if (!creator) {
        setCreatorDeptDisplay('')
        setCreatorPosDisplay('')
        return
      }
      const [deptName, posName] = await Promise.all([
        getSmartDepartmentDisplayName(creator.department || ''),
        getSmartPositionDisplayName(creator.position || '')
      ])
      setCreatorDeptDisplay(deptName)
      setCreatorPosDisplay(posName)
    }
    run()
  }, [creator])

  useEffect(() => {
    const run = async () => {
      if (!assignee) {
        setAssigneeDeptDisplay('')
        setAssigneePosDisplay('')
        return
      }
      const [deptName, posName] = await Promise.all([
        getSmartDepartmentDisplayName(assignee.department || ''),
        getSmartPositionDisplayName(assignee.position || '')
      ])
      setAssigneeDeptDisplay(deptName)
      setAssigneePosDisplay(posName)
    }
    run()
  }, [assignee])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  if (!requirement) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">需求不存在</h2>
          <p className="text-gray-600">指定的需求ID不存在或已被删除</p>
          <Button 
            variant="outline" 
            onClick={() => router.push('/dashboard/requirements')}
            className="mt-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回需求列表
          </Button>
        </div>
      </div>
    )
  }

  const currentStatusConfig = statusConfig[requirement.status]
  const StatusIcon = currentStatusConfig?.icon || AlertCircle

  // 状态修改处理函数
  const handleStatusChange = async () => {
    if (!newStatus || !requirement) return
    
    setUpdatingStatus(true)
    try {
      await requirementService.updateRequirementStatus(requirement.id, newStatus as any)
      setRequirement({ ...requirement, status: newStatus as any })
      setStatusDialogOpen(false)
      setNewStatus('')
      toast.success('需求状态已更新')
    } catch (error) {
      console.error('更新状态失败:', error)
      toast.error(`更新状态失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setUpdatingStatus(false)
    }
  }

  // 获取可用的状态选项
  const getAvailableStatuses = () => {
    if (!user || !requirement) return []

    const currentStatus = requirement.status
    const isCreator = user.id === (requirement.submitter_id as any) || user.id === (requirement as any).created_by
    const isAssignee = user.id === requirement.assignee_id

    // 管理员 / 可更新所有状态 / 编辑所有：可选除当前外全部
    if (
      hasPermission('system.admin') ||
      hasPermission('requirement.edit_all') ||
      hasPermission('requirement.status_update')
    ) {
      return Object.entries(statusConfig).filter(([key]) => key !== currentStatus)
    }

    // 拥有“更新自己单据状态”权限（创建者或执行人）：也可看到全部状态（除当前外）
    if (hasPermission('requirement.status_update_own') && (isCreator || isAssignee)) {
      return Object.entries(statusConfig).filter(([key]) => key !== currentStatus)
    }

    // 创建者在未开始时，具备编辑自己的权限也可取消
    if (hasPermission('requirement.edit_own') && isCreator && currentStatus === 'not_started') {
      return [['cancelled', statusConfig.cancelled]]
    }

    return []
  }

  // 返回可选状态键列表
  const availableStatusKeys: string[] = getAvailableStatuses().map(([key]) => String(key))

  // 评论权限与操作
  const canDeleteComment = (c: { user_id?: string }) => {
    if (!user) return false
    if (hasPermission('system.admin') || hasPermission('comment.delete_all')) return true
    const isOwner = !!c.user_id && c.user_id === user.id
    return isOwner && (hasPermission('comment.delete') || hasPermission('comment.delete_own'))
  }

  const reloadComments = async (reqId: string) => {
    const { data } = await sb
      .from('requirement_comments')
      .select('id, user_id, content, created_at, parent_id')
      .eq('requirement_id', reqId)
      .order('created_at', { ascending: true })
    const base = (data || []) as Array<{ id: string; user_id?: string; content: string; created_at: string }>
    const ids = base.map(c => c.id)
    let attachMap: Record<string, Array<{ file_name: string; file_url: string }>> = {}
    if (ids.length > 0) {
      const { data: attaches } = await sb
        .from('requirement_comment_attachments')
        .select('comment_id, file_name, file_url')
        .in('comment_id', ids)
      for (const a of (attaches || []) as any[]) {
        const cid = (a as any).comment_id
        if (!attachMap[cid]) attachMap[cid] = []
        attachMap[cid].push({ file_name: (a as any).file_name, file_url: (a as any).file_url })
      }
    }
    {
      const byParent: Record<string, Array<{ id: string; user_id?: string; content: string; created_at: string; parent_id?: string }>> = {}
      const roots: Array<{ id: string; user_id?: string; content: string; created_at: string; parent_id?: string }> = []
      for (const c of base) {
        const pid = (c as any).parent_id
        if (pid) {
          if (!byParent[pid]) byParent[pid] = []
          byParent[pid].push(c)
        } else {
          roots.push(c)
        }
      }
      const ordered: Array<any> = []
      const pushWithChildren = (c: any, depth = 0) => {
        ordered.push({ ...c, attachments: attachMap[c.id] || [], depth })
        const children = byParent[c.id] || []
        for (const child of children) pushWithChildren(child, depth + 1)
      }
      for (const r of roots) pushWithChildren(r, 0)
      setComments(ordered)
    }
  }







  const deleteComment = async (commentId: string) => {
    const target = comments.find(c => c.id === commentId)
    if (!target || !canDeleteComment(target)) return
    if (!window.confirm('确定删除该评论？')) return
    try {
      setCommentLoading(true)
      const { error } = await sb
        .from('requirement_comments')
        .delete()
        .eq('id', commentId)
      if (error) throw error
      // 乐观更新：先移除本地列表中的该评论
      setComments(prev => prev.filter(c => c.id !== commentId))
      if (requirement) await reloadComments(requirement.id)
      toast.success('评论已删除')
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message || '删除失败')
    } finally {
      setCommentLoading(false)
    }
  }

  const replyComment = (commentId: string) => {
    const target = comments.find(c => c.id === commentId)
    if (!target) return
    const lines = String(target.content).split('\n')
    const quoted = lines.map(l => `> ${l}`).join('\n') + '\n\n'
    setReplyParentId(commentId)
    setNewComment(quoted)
  }

  // 提交匿名评论
  const submitAnonymousComment = async () => {
    if (!requirement || !newComment.trim()) return
    try {
      setCommentLoading(true)
      const { data: auth } = await sb.auth.getUser()
      const uid = auth?.user?.id
      // author_id 仍写入当前用户以满足 RLS，但前端仅显示匿名
      const { data: insertRes, error } = await sb
        .from('requirement_comments')
        .insert({
          requirement_id: requirement.id,
          user_id: uid,
          content: newComment.trim(),
          parent_id: replyParentId || null
        })
        .select('id')
        .single()
      if (error) throw error

      // 上传附件到 Storage，并写入关联表
      if (insertRes?.id && commentFiles && commentFiles.length > 0) {
        const bucket = ATTACH_BUCKET
        for (const file of Array.from(commentFiles)) {
          const ext = file.name.split('.').pop() || ''
          const path = `${uid || 'anonymous'}/comments/${insertRes.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
          const { error: upErr } = await sb.storage.from(bucket).upload(path, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type || undefined
          })
          if (upErr) throw upErr
          const { data: urlData } = sb.storage.from(bucket).getPublicUrl(path)
          await sb.from('requirement_comment_attachments').insert({
            comment_id: insertRes.id,
            file_name: file.name,
            file_url: urlData.publicUrl,
            file_size: file.size,
            file_type: file.type || null,
            uploaded_by: uid
          })
        }
      }

      setNewComment('')
      setCommentFiles(null)
      setReplyParentId(null)
      // 重新加载
      const { data } = await sb
        .from('requirement_comments')
        .select('id, user_id, content, created_at, parent_id')
        .eq('requirement_id', requirement.id)
        .order('created_at', { ascending: true })
      {
        const base = (data || []) as Array<{ id: string; user_id?: string; content: string; created_at: string }>
        const ids = base.map(c => c.id)
        let attachMap: Record<string, Array<{ file_name: string; file_url: string }>> = {}
        if (ids.length > 0) {
          const { data: attaches } = await sb
            .from('requirement_comment_attachments')
            .select('comment_id, file_name, file_url')
            .in('comment_id', ids)
          for (const a of (attaches || []) as any[]) {
            const cid = (a as any).comment_id
            if (!attachMap[cid]) attachMap[cid] = []
            attachMap[cid].push({ file_name: (a as any).file_name, file_url: (a as any).file_url })
          }
        }
        {
          const byParent: Record<string, Array<{ id: string; user_id?: string; content: string; created_at: string; parent_id?: string }>> = {}
          const roots: Array<{ id: string; user_id?: string; content: string; created_at: string; parent_id?: string }> = []
          for (const c of base) {
            const pid = (c as any).parent_id
            if (pid) {
              if (!byParent[pid]) byParent[pid] = []
              byParent[pid].push(c)
            } else {
              roots.push(c)
            }
          }
          const ordered: Array<any> = []
          const pushWithChildren = (c: any, depth = 0) => {
            ordered.push({ ...c, attachments: attachMap[c.id] || [], depth })
            const children = byParent[c.id] || []
            for (const child of children) pushWithChildren(child, depth + 1)
          }
          for (const r of roots) pushWithChildren(r, 0)
          setComments(ordered)
        }
      }
      toast.success('已发布匿名评论')
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message || '评论失败')
    } finally {
      setCommentLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{requirement.title}</h1>
            <p className="text-gray-600">需求详情</p>
          </div>
        </div>
        
        <div className="flex space-x-3">
          {canEditRequirement(requirement) && (
            <Button onClick={() => router.push(`/dashboard/requirements/edit/${requirement.id}`)}>
              <Edit className="h-4 w-4 mr-2" />
              编辑需求
            </Button>
          )}
          
          {canUpdateRequirementStatus(requirement) && availableStatusKeys.length > 0 && (
            <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Settings className="h-4 w-4 mr-2" />
                  修改状态
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>修改需求状态</DialogTitle>
                  <DialogDescription>
                    当前状态：{currentStatusConfig?.label}
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">选择新状态</label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择状态" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableStatusKeys.map((key) => {
                          const cfg = statusConfig[key as keyof typeof statusConfig]
                          const CIcon = cfg.icon
                          return (
                            <SelectItem key={key} value={key}>
                              <div className="flex items-center space-x-2">
                                <CIcon className="h-4 w-4" />
                                <span>{cfg.label}</span>
                              </div>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
                    取消
                  </Button>
                  <Button 
                    onClick={handleStatusChange} 
                    disabled={!newStatus || updatingStatus}
                  >
                    {updatingStatus ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        更新中...
                      </>
                    ) : (
                      '确认修改'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 主要内容 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 基本信息 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>基本信息</CardTitle>
                <div className="flex items-center space-x-2">
                  <Badge className={currentStatusConfig?.color}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {currentStatusConfig?.label}
                  </Badge>
                  <Badge className={priorityConfig[requirement.priority]?.color}>
                    {priorityConfig[requirement.priority]?.label}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-900 mb-2">需求描述</h3>
                <p className="text-gray-700 leading-relaxed">{requirement.description}</p>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">处理部门</h4>
                  <div className="flex items-center space-x-2">
                    <Building className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-700">{departmentDisplayName || requirement.department}</span>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">目标岗位</h4>
                  <span className="text-gray-700">{positionDisplayName || requirement.assignee_position}</span>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">创建时间</h4>
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-700">
                      {new Date(requirement.created_at).toLocaleString('zh-CN')}
                    </span>
                  </div>
                </div>
                
                {requirement.due_date && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">截止日期</h4>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span className="text-gray-700">
                        {new Date(requirement.due_date).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 专属表单数据 */}
          {requirement.form_data && Object.keys(requirement.form_data).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>{formSchema?.name || '专属表单数据'}</span>
                </CardTitle>
                <CardDescription>
                  {formSchema?.description || `${departmentDisplayName || requirement.department} - ${positionDisplayName || requirement.assignee_position} 专属表单`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {formSchema?.fields ? (
                    // 如果有表单模板，按模板显示
                    formSchema.fields.map((field) => {
                      const value = requirement.form_data[field.id]
                      if (!value && value !== 0 && value !== false) return null
                      
                      return (
                        <div key={field.id} className="border-b border-gray-100 pb-3 last:border-b-0">
                          <h4 className="font-medium text-gray-900 mb-1">{field.label}</h4>
                          <div className="text-gray-700">
                            {Array.isArray(value) ? value.join(', ') : String(value)}
                          </div>
                          {field.description && (
                            <p className="text-xs text-gray-500 mt-1">{field.description}</p>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    // 如果没有表单模板，直接显示所有数据
                    Object.entries(requirement.form_data).map(([key, value]) => (
                      <div key={key} className="border-b border-gray-100 pb-3 last:border-b-0">
                        <h4 className="font-medium text-gray-900 mb-1">{key}</h4>
                        <div className="text-gray-700">
                          {Array.isArray(value) ? value.join(', ') : String(value)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 匿名评论 */}
          <Card>
            <CardHeader>
              <CardTitle>评论</CardTitle>
              <CardDescription>匿名评论已开启，显示时不包含用户身份信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {commentLoading && <div className="text-sm text-muted-foreground">加载中...</div>}
                {!commentLoading && comments.length === 0 && (
                  <div className="text-sm text-muted-foreground">还没有评论</div>
                )}
                {!commentLoading && comments.length > 0 && (
                  <div className="space-y-3">
                    {comments.map(c => (
                      <div key={c.id} className="rounded border p-3 bg-gray-50" style={{ marginLeft: (c as any).depth ? (c as any).depth * 16 : 0 }}>
                        <div className="text-xs text-gray-500 mb-1">
                          匿名 · {new Date(c.created_at).toLocaleString('zh-CN')}
                        </div>
                        <div className="text-sm text-gray-800 whitespace-pre-wrap">
                          {c.content}
                        </div>
                        {c.attachments && c.attachments.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {c.attachments.map((f, idx) => (
                              <div key={idx} className="text-xs">
                                {/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test((f as any).file_url || (f as any).file_name) ? (
                                  <img
                                    src={(f as any).file_url}
                                    alt={(f as any).file_name || '图片附件'}
                                    className="max-h-48 rounded border"
                                    loading="lazy"
                                  />
                                ) : (
                                  <>附件：<a href={(f as any).file_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{(f as any).file_name}</a></>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          {canDeleteComment(c) && (
                            <Button variant="ghost" size="sm" onClick={() => deleteComment(c.id)}>
                              删除
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => replyComment(c.id)}>
                            回复
                          </Button>
                        </div>


                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="输入评论内容（匿名发布）"
                  rows={3}
                />
                <Input
                  type="file"
                  multiple
                  onChange={(e) => setCommentFiles(e.target.files)}
                />
                <div className="flex justify-end">
                  <Button onClick={submitAnonymousComment} disabled={commentLoading || !newComment.trim()}>
                    发布评论
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 侧边栏 */}
        <div className="space-y-6">
          {/* 人员信息 */}
          <Card>
            <CardHeader>
              <CardTitle>相关人员</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">创建者</h4>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {creator?.full_name || creator?.email || '未知用户'}
                    </p>
                    {creator?.department && (
                      <p className="text-sm text-gray-500">{creatorDeptDisplay || creator.department} - {creatorPosDisplay || creator.position}</p>
                    )}
                  </div>
                </div>
              </div>
              
              {assignee && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">执行人</h4>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {assignee.full_name || assignee.email}
                        </p>
                        <p className="text-sm text-gray-500">{assigneeDeptDisplay || assignee.department} - {assigneePosDisplay || assignee.position}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>



          {/* 时间线 */}
          <Card>
            <CardHeader>
              <CardTitle>时间线</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div>
                    <p className="text-sm font-medium">需求创建</p>
                    <p className="text-xs text-gray-500">
                      {new Date(requirement.created_at).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>
                
                {requirement.updated_at !== requirement.created_at && (
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <div>
                      <p className="text-sm font-medium">最后更新</p>
                      <p className="text-xs text-gray-500">
                        {new Date(requirement.updated_at).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                )}
                
                {requirement.status === 'completed' && requirement.overall_rating && (
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                    <div>
                      <p className="text-sm font-medium">需求评分</p>
                      <p className="text-xs text-gray-500">
                        综合评分: {requirement.overall_rating.toFixed(1)} 分
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}