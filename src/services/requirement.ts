import { createSupabaseClient } from '@/lib/supabase'
import { permissionService } from '@/services/permission'
import { wecomNotify } from '@/services/wecom'
import type { 
  Requirement, 
  RequirementSummary,
  CreateRequirementInput, 
  UpdateRequirementInput, 
  PaginatedResponse,
  SearchFilters,
  RequirementStats,
  RequirementStatus
} from '@/types'

export class RequirementService {
  private supabase = createSupabaseClient()



  // 获取需求列表                          
  async getRequirements(params?: {
    page?: number
    limit?: number
    filters?: SearchFilters
    userId?: string
    userRole?: string
  }): Promise<PaginatedResponse<Requirement>> {
    try {
      const page = params?.page || 1
      const limit = params?.limit || 20
      const offset = (page - 1) * limit

      let query = this.supabase
        .from('requirements')
        .select(`
          id,
          title,
          description,
          status,
          priority,
          created_at,
          updated_at,
          due_date,
          assignee_id,
          assignee_name,
          assignee_department,
          assignee_position,
          submitter_id,
          submitter_name,
          created_by,
          department,
          form_data
        `, { count: 'exact' })

      // 权限过滤：根据用户权限动态过滤
      if (params?.userId) {
        // 检查用户是否有查看所有需求的权限（统一使用当前权限系统）
        const canViewAll = await permissionService.checkUserPermission(params.userId, 'requirement.view_all')
        
        if (!canViewAll) {
          // 如果没有查看所有需求的权限，只能看到自己相关的需求（兼容历史 created_by 与 submitter_id）
          query = query.or(`created_by.eq.${params.userId},submitter_id.eq.${params.userId},assignee_id.eq.${params.userId}`)
        }
      }

      // 搜索过滤
      if (params?.filters?.search) {
        query = query.or(`title.ilike.%${params.filters.search}%,description.ilike.%${params.filters.search}%`)
      }

      // 状态过滤
      if (params?.filters?.status && params.filters.status.length > 0) {
        query = query.in('status', params.filters.status)
      }

      // 优先级过滤
      if (params?.filters?.priority && params.filters.priority.length > 0) {
        query = query.in('priority', params.filters.priority)
      }

      // 部门过滤
      if (params?.filters?.department && params.filters.department.length > 0) {
        query = query.in('assignee_department', params.filters.department)
      }

      // 岗位过滤
      if (params?.filters?.position && params.filters.position.length > 0) {
        query = query.in('assignee_position', params.filters.position)
      }

      // 处理人过滤
      if (params?.filters?.assignee_id && params.filters.assignee_id.length > 0) {
        query = query.in('assignee_id', params.filters.assignee_id)
      }

      // 提交人过滤
      if (params?.filters?.submitter_id && params.filters.submitter_id.length > 0) {
        query = query.in('submitter_id', params.filters.submitter_id)
      }

      // 日期范围过滤
      if (params?.filters?.date_range) {
        query = query
          .gte('created_at', params.filters.date_range.start)
          .lte('created_at', params.filters.date_range.end)
      }

      // 标签过滤
      if (params?.filters?.tags && params.filters.tags.length > 0) {
        query = query.overlaps('tags', params.filters.tags)
      }

      // 分页和排序
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      const { data, error, count } = await query

      if (error) throw error

      return {
        data: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit),
          has_next: page * limit < (count || 0),
          has_prev: page > 1
        }
      }
    } catch (error) {
      console.error('获取需求列表失败:', error)
      throw error
    }
  }

  // 获取单个需求
  async getRequirement(id: string): Promise<Requirement | null> {
    try {
      const { data, error } = await this.supabase
        .from('requirements')
        .select(`
          id,
          title,
          description,
          status,
          priority,
          created_at,
          updated_at,
          due_date,
          assignee_id,
          assignee_name,
          assignee_department,
          assignee_position,
          submitter_id,
          submitter_name,
          created_by,
          department,
          form_data,
          form_schema_id
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('获取需求失败:', error)
      return null
    }
  }

  // 创建需求
  async createRequirement(requirementData: CreateRequirementInput): Promise<Requirement> {
    try {
      // 获取当前用户信息
      const { data: { user }, error: authError } = await this.supabase.auth.getUser()
      if (authError || !user) {
        throw new Error('用户未登录')
      }

      // 获取用户详细信息 - 直接使用用户ID查询
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (userError || !userData) {
        console.error('获取用户信息失败:', userError)
        throw new Error(`获取用户信息失败: ${userError?.message || '用户不存在'}`)
      }

      // 如果有指定执行人，优先使用执行人的岗位中文名称用于显示
      let assigneePositionDisplay = requirementData.assignee_position || userData.position_code || userData.position
      let assigneeNameDisplay: string | null = null
      let assigneeDeptDisplay: string | null = null

      if (requirementData.assignee_id) {
        const { data: assigneeUser } = await this.supabase
          .from('users')
          .select('position, position_code, department, department_code, full_name, email')
          .eq('id', requirementData.assignee_id)
          .single()
        if (assigneeUser) {
          // 优先中文名称，其次代码，最后回退原始值
          assigneePositionDisplay = assigneeUser.position || assigneeUser.position_code || assigneePositionDisplay
          assigneeNameDisplay = assigneeUser.full_name || assigneeUser.email
          assigneeDeptDisplay = assigneeUser.department || assigneeUser.department_code || null
        }
      }

      // 构建需求数据 - 与统一RLS策略对齐（写入提交者/执行者归属信息），并兼容展示字段
      const insertData = {
        title: requirementData.title,
        description: requirementData.description,
        priority: requirementData.priority,
        due_date: requirementData.due_date,

        // 提交者归属信息（RLS 插入校验依赖于此）
        created_by: user.id, // 兼容历史
        submitter_id: user.id,
        submitter_name: userData.full_name || userData.email,
        submitter_department: userData.department,
        submitter_position: userData.position,

        // 执行者（可为空；若指定则填充）
        assignee_id: requirementData.assignee_id || requirementData.assignee_users?.[0]?.user_id || null,
        assignee_name: assigneeNameDisplay,
        assignee_department: assigneeDeptDisplay,
        assignee_position: assigneePositionDisplay,

        // 其他
        status: 'not_started' as RequirementStatus,
        form_data: requirementData.form_data || {},
        form_schema_id: requirementData.form_schema_id,

        // 前端展示兼容字段（存在即写入）
        department: requirementData.department || userData.department
      }

      const { data, error } = await this.supabase
        .from('requirements')
        .insert(insertData)
        .select()
        .single()

      if (error) throw error

      // 如果有指定执行人，创建执行人关联
      if (requirementData.assignee_users && requirementData.assignee_users.length > 0) {
        const assigneeData = requirementData.assignee_users.map(assignee => ({
          requirement_id: data.id,
          user_id: assignee.user_id,
          role_type: assignee.role_type,
          assigned_at: new Date().toISOString()
        }))

        const { error: assigneeError } = await this.supabase
          .from('requirement_assignees')
          .insert(assigneeData)

        if (assigneeError) {
          console.error('创建执行人关联失败:', assigneeError)
          // 不抛出错误，因为需求已经创建成功
        }
      }

      // 异步发送“有新的需求”企业微信通知（失败不影响主流程）
      try {
        // 收集可能的执行人ID（单执行人与多执行人）
        const assigneeIds = Array.from(new Set([
          data.assignee_id,
          ...(requirementData.assignee_users?.map(u => u.user_id) || [])
        ].filter(Boolean))) as string[]

        let assigneeWecomIds: string[] = []
        if (assigneeIds.length > 0) {
          const { data: usersRows } = await this.supabase
            .from('users')
            .select('id, wecom_user_id')
            .in('id', assigneeIds)
          assigneeWecomIds = (usersRows || [])
            .map(u => (u as any).wecom_user_id)
            .filter((x: any): x is string => !!x)
        }

        await wecomNotify.notifyNewRequirement({
          ...(data as any),
          assignee_wecom_ids: assigneeWecomIds,
          assignee_user_ids: assigneeIds
        })
      } catch (e) {
        console.warn('发送企微通知失败（新需求）：', e)
      }

      return data
    } catch (error) {
      console.error('创建需求失败:', error)
      throw error
    }
  }

  // 更新需求
  async updateRequirement(id: string, requirementData: UpdateRequirementInput): Promise<Requirement> {
    try {
      const { data, error } = await this.supabase
        .from('requirements')
        .update(requirementData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('更新需求失败:', error)
      throw error
    }
  }

  // 删除需求
  async deleteRequirement(id: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('requirements')
        .delete()
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      console.error('删除需求失败:', error)
      throw error
    }
  }

  // 批量删除需求
  async deleteRequirements(ids: string[]): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('requirements')
        .delete()
        .in('id', ids)

      if (error) throw error
    } catch (error) {
      console.error('批量删除需求失败:', error)
      throw error
    }
  }

  // 分配需求
  async assignRequirement(id: string, assigneeData: {
    assignee_id: string
    assignee_name: string
    assignee_department: string
    assignee_position: string
  }): Promise<Requirement> {
    try {
      const { data, error } = await this.supabase
        .from('requirements')
        .update({
          ...assigneeData,
          status: 'in_progress',
          started_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      // 精准通知：为新分配的执行人发送消息（如果其 wecom_user_id 可用）
      try {
        const { data: assigneeUser } = await this.supabase
          .from('users')
          .select('id, wecom_user_id')
          .eq('id', assigneeData.assignee_id)
          .maybeSingle()
        const assigneeWecomIds = assigneeUser?.wecom_user_id ? [assigneeUser.wecom_user_id] : []
        await wecomNotify.notifyNewRequirement({
          ...(data as any),
          assignee_wecom_ids: assigneeWecomIds,
          assignee_user_ids: [assigneeData.assignee_id]
        })
      } catch (e) {
        console.warn('发送企微通知失败（分配需求）：', e)
      }

      return data
    } catch (error) {
      console.error('分配需求失败:', error)
      throw error
    }
  }

  // 更新需求状态
  async updateRequirementStatus(id: string, status: string): Promise<Requirement> {
    try {
      // 1) 获取当前用户与权限
      const { data: auth } = await this.supabase.auth.getUser()
      const currentUserId = auth?.user?.id
      if (!currentUserId) {
        throw new Error('未登录用户，无法更新需求状态')
      }

      // 2) 读取需求记录（用于关联性判断）
      const { data: req, error: fetchErr } = await this.supabase
        .from('requirements')
        .select('id, title, description, status, priority, submitter_id, submitter_name, assignee_id, assignee_name, assignee_department, assignee_position, created_at, updated_at, due_date, started_at, completed_at, form_data, form_schema_id, tags')
        .eq('id', id)
        .single()
      if (fetchErr || !req) {
        throw new Error('需求不存在或无权限查看该需求')
      }

      // 3) 拉取权限集并判定
      const userPerms = await permissionService.getUserPermissions(currentUserId)
      const codes = new Set(userPerms.map(p => p.code))
      const has = (code: string) => codes.has(code)

      const isCreator = (req as any).submitter_id === currentUserId || (req as any).created_by === currentUserId
      const isAssignee = req.assignee_id === currentUserId

      // 权限放行：
      // - 全局：status_update 或 edit_all 或 system.admin
      // - 自己相关：status_update_own 且 (创建者或执行人)
      // - 兼容旧逻辑：edit_own 允许创建者更新
      const allow =
        has('requirement.status_update') ||
        has('requirement.edit_all') ||
        has('system.admin') ||
        (has('requirement.status_update_own') && (isCreator || isAssignee)) ||
        (has('requirement.edit_own') && isCreator)

      if (!allow) {
        throw new Error('无权限更新该需求状态（需要编辑所有/编辑自己/更新自己状态权限）')
      }

      // 4) 构造更新数据（仅状态）
      // 注意：此前尝试写入 started_at/completed_at 触发 PGRST204（列不存在）
      // 为恢复功能，这里只更新 status；确认实际列名后再安全加回时间戳写入
      const updateData: any = { status }

      // 5) 执行更新
      const { data, error, status: httpStatus } = await this.supabase
        .from('requirements')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        if ((error as any).code === 'PGRST116' || httpStatus === 404) {
          const msg = `无权限或记录不存在（RLS/过滤导致 0 行匹配）。id=${id}, status=${status}`
          console.warn(msg)
          throw new Error(msg)
        }
        throw error
      }
      return data as Requirement
    } catch (error) {
      console.error('更新需求状态失败:', error)
      throw error
    }
  }

  // 获取需求统计
  async getRequirementStats(): Promise<RequirementStats> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_requirement_stats')

      if (error) throw error

      const stats = data[0] || {}

      // 获取部门和岗位统计
      const { data: requirements } = await this.supabase
        .from('requirements')
        .select('assignee_department, assignee_position, submitter_department, submitter_position, created_at, completed_at')

      const by_department: Record<string, number> = {}
      const by_position: Record<string, number> = {}
      const by_assignee: Record<string, number> = {}
      let total_completion_time = 0
      let completed_count = 0

      requirements?.forEach((req: any) => {
        // 按处理部门统计
        if (req.assignee_department) {
          by_department[req.assignee_department] = (by_department[req.assignee_department] || 0) + 1
        }

        // 按处理岗位统计
        if (req.assignee_position) {
          by_position[req.assignee_position] = (by_position[req.assignee_position] || 0) + 1
        }

        // 计算完成时间
        if (req.created_at && req.completed_at) {
          const created = new Date(req.created_at)
          const completed = new Date(req.completed_at)
          const hours = (completed.getTime() - created.getTime()) / (1000 * 60 * 60)
          total_completion_time += hours
          completed_count++
        }
      })

      return {
        total: parseInt(stats.total_count) || 0,
        by_status: {
          not_started: parseInt(stats.pending_count) || 0,
          in_progress: parseInt(stats.in_progress_count) || 0,
          completed: parseInt(stats.completed_count) || 0,
          cancelled: parseInt(stats.cancelled_count) || 0,
          delayed: parseInt(stats.on_hold_count) || 0
        },
        by_priority: {
          high: parseInt(stats.high_priority_count) || 0,
          medium: parseInt(stats.medium_priority_count) || 0,
          low: parseInt(stats.low_priority_count) || 0,
          urgent: parseInt(stats.urgent_priority_count) || 0
        },
        by_department,
        by_position,
        by_assignee,
        avg_completion_time: completed_count > 0 ? total_completion_time / completed_count : 0,
        overdue_count: parseInt(stats.overdue_count) || 0
      }
    } catch (error) {
      console.error('获取需求统计失败:', error)
      throw error
    }
  }

  // 获取我的需求统计
  async getMyRequirementStats(userId: string): Promise<{
    submitted: number
    assigned: number
    completed: number
    pending: number
  }> {
    try {
      const { data: submitted } = await this.supabase
        .from('requirements')
        .select('id', { count: 'exact' })
        .eq('submitter_id', userId)

      const { data: assigned } = await this.supabase
        .from('requirements')
        .select('id', { count: 'exact' })
        .eq('assignee_id', userId)

      const { data: completed } = await this.supabase
        .from('requirements')
        .select('id', { count: 'exact' })
        .eq('assignee_id', userId)
        .eq('status', 'completed')

      const { data: pending } = await this.supabase
        .from('requirements')
        .select('id', { count: 'exact' })
        .eq('assignee_id', userId)
        .in('status', ['pending', 'in_progress'])

      return {
        submitted: submitted?.length || 0,
        assigned: assigned?.length || 0,
        completed: completed?.length || 0,
        pending: pending?.length || 0
      }
    } catch (error) {
      console.error('获取我的需求统计失败:', error)
      return {
        submitted: 0,
        assigned: 0,
        completed: 0,
        pending: 0
      }
    }
  }

  // 获取最近需求
  async getRecentRequirements(limit: number = 10): Promise<Requirement[]> {
    try {
      const { data, error } = await this.supabase
        .from('requirements')
        .select('id, title, description, status, priority, submitter_id, created_by, department, assignee_position, assignee_id, assignee_name, assignee_department, created_at, updated_at, due_date, form_data, tags')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('获取最近需求失败:', error)
      return []
    }
  }

  // 获取即将到期的需求
  async getUpcomingRequirements(days: number = 7): Promise<RequirementSummary[]> {
    try {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + days)

      const { data, error } = await this.supabase
        .from('requirements')
        .select('id, title, status, due_date, assignee_id, assignee_name')
        .lte('due_date', futureDate.toISOString())
        .not('status', 'in', '(completed,cancelled,rejected)')
        .order('due_date', { ascending: true })

      if (error) throw error
      return (data || []) as RequirementSummary[]
    } catch (error) {
      console.error('获取即将到期需求失败:', error)
      return []
    }
  }

  // 获取逾期需求
  async getOverdueRequirements(): Promise<RequirementSummary[]> {
    try {
      const now = new Date().toISOString()

      const { data, error } = await this.supabase
        .from('requirements')
        .select('id, title, status, due_date, assignee_id, assignee_name')
        .lt('due_date', now)
        .not('status', 'in', '(completed,cancelled,rejected)')
        .order('due_date', { ascending: true })

      if (error) throw error
      return (data || []) as RequirementSummary[]
    } catch (error) {
      console.error('获取逾期需求失败:', error)
      return []
    }
  }

  // 更新需求执行人
  async updateRequirementAssignees(requirementId: string, assignees: Array<{
    user_id: string
    role_type: 'primary' | 'secondary' | 'reviewer'
  }>): Promise<void> {
    try {
      // 删除现有的执行人
      await this.supabase
        .from('requirement_assignees')
        .delete()
        .eq('requirement_id', requirementId)

      // 添加新的执行人
      if (assignees.length > 0) {
        const assigneeData = assignees.map(assignee => ({
          requirement_id: requirementId,
          user_id: assignee.user_id,
          role_type: assignee.role_type,
          assigned_at: new Date().toISOString()
        }))

        const { error } = await this.supabase
          .from('requirement_assignees')
          .insert(assigneeData)

        if (error) throw error
      }
    } catch (error) {
      console.error('更新需求执行人失败:', error)
      throw error
    }
  }

  // 导出需求数据
  async exportRequirements(filters?: SearchFilters): Promise<Requirement[]> {
    try {
      let query = this.supabase
        .from('requirements')
        .select('*')

      // 应用过滤条件
      if (filters?.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
      }

      if (filters?.status && filters.status.length > 0) {
        query = query.in('status', filters.status)
      }

      if (filters?.priority && filters.priority.length > 0) {
        query = query.in('priority', filters.priority)
      }

      if (filters?.department && filters.department.length > 0) {
        query = query.in('assignee_department', filters.department)
      }

      if (filters?.date_range) {
        query = query
          .gte('created_at', filters.date_range.start)
          .lte('created_at', filters.date_range.end)
      }

      query = query.order('created_at', { ascending: false })

      const { data, error } = await query

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('导出需求数据失败:', error)
      throw error
    }
  }
}

export const requirementService = new RequirementService()
export type { Requirement }