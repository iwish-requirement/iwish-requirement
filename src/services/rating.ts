/**
 * 评分服务（模板驱动，提交者 -> 执行人 -> 月度综合评分）
 * 说明：
 * - 仅允许评分周期为“当月或上月”，其余月份将拒绝（validateCycleMonth）
 * - 幂等约束（建议数据库唯一约束）：
 *   rating_form_instances: unique(requester_id, executor_id, cycle_month)
 *   rating_form_responses: unique(instance_id, field_id)
 * - 模板匹配：严格使用 department + position，选择最新启用版本（version 最大且 is_active = true）
 *
 * 待对接数据表（建议）：
 * - rating_form_templates
 * - rating_form_instances
 * - rating_form_responses
 * - 需求/协作来源：从 requirement 或其派生视图获取 requester 在某月合作过的 executors（去重）
 */

import { createSupabaseClient } from '@/lib/supabase'
import type {
  ApplicableTemplateResult,
  ExecutorMonthlyStats,
  RatingFormInstance,
  RatingFormResponse,
  RatingFormTemplate,
  RequesterMonthlySessionItem,
  SubmitMonthlySessionInput,
} from '@/types/rating'

/** 工具：校验 cycleMonth 是否为当月或上月（格式 'YYYY-MM'） */
function validateCycleMonth(cycleMonth: string) {
  const now = new Date()
  const cur = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
  const prev = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1))

  const parse = (s: string) => {
    const m = /^(\d{4})-(\d{2})$/.exec(s)
    if (!m) return null
    const y = parseInt(m[1], 10)
    const mm = parseInt(m[2], 10) - 1
    return new Date(Date.UTC(y, mm, 1))
  }

  const dt = parse(cycleMonth)
  if (!dt) throw new Error('非法的月份格式，应为 YYYY-MM')

  const sameMonth = (a: Date, b: Date) => a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth()
  if (!sameMonth(dt, cur) && !sameMonth(dt, prev)) {
    throw new Error('仅允许当月或上月的评分')
  }
}

const client = () => createSupabaseClient()

export const ratingService = {
  /**
   * 查询提交者在某月需要评分的执行人列表
   * 说明：应根据当月“完成”的协作需求聚合，返回执行人及其部门/岗位信息（去重）
   * 返回结构仅示例，实际需与需求服务/数据库视图对接
   */
  async getMonthlyExecutorsForRequester(params: {
    requesterId: string
    cycleMonth: string // 'YYYY-MM'
  }): Promise<Array<{ executorId: string; department: string; position: string; executorName?: string; executorTitle?: string; executorPosition?: string }>> {
    validateCycleMonth(params.cycleMonth)

    // 计算该月份起止 ISO 时间窗口 [start, nextMonthStart)
    const [yStr, mStr] = params.cycleMonth.split('-')
    const y = parseInt(yStr, 10)
    const m = parseInt(mStr, 10) - 1
    const start = new Date(Date.UTC(y, m, 1))
    const next = new Date(Date.UTC(y, m + 1, 1))
    const startIso = start.toISOString()
    const nextIso = next.toISOString()

    const sb = client()

    // 1) 查询当月该提交者已完成的需求
    const { data: reqs, error: reqErr } = await sb
      .from('requirements')
      .select('id, assignee_id')
      .eq('status', 'completed')
      .eq('created_by', params.requesterId)
      .gte('completed_at', startIso)
      .lt('completed_at', nextIso)

    if (reqErr) throw reqErr
    const requirementIds = (reqs || []).map(r => r.id)
    if (requirementIds.length === 0) return []

    // 2) 收集可能的执行人：单字段 assignee_id + 多执行人表 requirement_assignees
    const singleAssignees = (reqs || [])
      .map(r => r.assignee_id)
      .filter((v): v is string => !!v)

    const { data: assigneeRows, error: assErr } = await sb
      .from('requirement_assignees')
      .select('user_id, user_position')
      .in('requirement_id', requirementIds)

    if (assErr) throw assErr

    const multiAssignees = (assigneeRows || []).map(a => (a as any).user_id).filter((v): v is string => !!v)

    // 合并去重
    const executorSet = new Set<string>([...singleAssignees, ...multiAssignees])
    const executorIds = Array.from(executorSet)
    if (executorIds.length === 0) return []

    // 3) 查询用户的部门/岗位（优先 code，无则名称）
    const { data: users, error: usersErr } = await sb
      .from('users')
      .select('id, full_name, title, department, position, department_code, position_code')
      .in('id', executorIds)

    if (usersErr) throw usersErr

    // 3.1) 规范化：对缺少 code 的用户，用名称反查部门/岗位表得到 code（仅用于匹配模板）
    const missingDeptNames = Array.from(
      new Set(
        (users || [])
          .filter((u: any) => !u.department_code && u.department)
          .map((u: any) => u.department as string)
      )
    )
    const missingPosNames = Array.from(
      new Set([
        ...((users || [])
          .filter((u: any) => !u.position_code && u.position)
          .map((u: any) => u.position as string)),
        ...((assigneeRows || [])
          .map((r: any) => r.user_position)
          .filter((x: any) => !!x))
      ])
    )

    let deptNameToCode: Record<string, string> = {}
    let posNameToCode: Record<string, string> = {}

    if (missingDeptNames.length > 0) {
      const { data: depts } = await sb
        .from('departments')
        .select('name, code')
        .in('name', missingDeptNames)
      for (const d of depts || []) {
        deptNameToCode[(d as any).name] = (d as any).code
      }
    }
    if (missingPosNames.length > 0) {
      const { data: poss } = await sb
        .from('positions')
        .select('name, code')
        .in('name', missingPosNames)
      for (const p of poss || []) {
        posNameToCode[(p as any).name] = (p as any).code
      }
    }

    // 基于当月协作记录，按执行人汇总岗位代码兜底
    const posCodeFromAssignees: Record<string, string> = {}
    for (const r of (assigneeRows || []) as any[]) {
      const uid = r.user_id
      const code = r.user_position ? posNameToCode[r.user_position] : undefined
      if (!code) continue
      // 简单采用“先到先得”；如需更精准，可统计众数
      if (!posCodeFromAssignees[uid]) posCodeFromAssignees[uid] = code
    }

    const result: Array<{ executorId: string; department: string; position: string; executorName?: string; executorTitle?: string; executorPosition?: string }> = (users || []).map(u => {
      // 优先使用 users.department / users.position（均为代码），仅在缺失时回退
      const deptCode = (u as any).department || (u as any).department_code || deptNameToCode[(u as any).department] || 'general'
      const posCodePrimary = (u as any).position || (u as any).position_code || posNameToCode[(u as any).position] || undefined
      const posCode = posCodePrimary || posCodeFromAssignees[(u as any).id] || 'general'
      return {
        executorId: (u as any).id,
        department: deptCode,   // 用 code 参与模板匹配
        position: posCode,      // 用 code 参与模板匹配（含协作记录兜底）
        executorName: (u as any).full_name || '',
        executorTitle: (u as any).title || undefined,        // 仅展示
        executorPosition: (u as any).position || undefined,  // 展示中文名
      }
    })

    // 4) 可能存在用户被停用或被删除导致未查到的 id，这里补齐占位（使用默认 general）
    const foundIds = new Set(result.map(r => r.executorId))
    for (const miss of executorIds) {
      if (!foundIds.has(miss)) {
        result.push({
          executorId: miss,
          department: 'general',
          position: 'general',
          executorName: '',
          executorTitle: undefined,
          executorPosition: undefined,
        })
      }
    }

    return result
  },

  /**
   * 按部门/岗位严格获取当前启用的最新模板
   * 若无命中，抛错，前端据此提示“未配置模板”
   */
  async getApplicableTemplateStrict(params: {
    department: string
    position: string
  }): Promise<ApplicableTemplateResult> {
    const sb = client()

    // 允许模板表里存“代码或中文名”，这里把 code 映射为 [code, name] 作为候选
    const deptCandidates = new Set<string>([params.department])
    const posCandidates = new Set<string>([params.position])

    // 部门名映射
    try {
      const { data: deptRow } = await sb
        .from('departments')
        .select('code, name')
        .or(`code.eq.${params.department},name.eq.${params.department}`)
        .maybeSingle()
      if (deptRow) {
        if ((deptRow as any).code) deptCandidates.add((deptRow as any).code)
        if ((deptRow as any).name) deptCandidates.add((deptRow as any).name)
      }
    } catch {}

    // 岗位名映射
    try {
      const { data: posRow } = await sb
        .from('positions')
        .select('code, name')
        .or(`code.eq.${params.position},name.eq.${params.position}`)
        .maybeSingle()
      if (posRow) {
        if ((posRow as any).code) posCandidates.add((posRow as any).code)
        if ((posRow as any).name) posCandidates.add((posRow as any).name)
      }
    } catch {}

    // 用 in 方式同时匹配 code 和中文名，选最新启用版本
    const { data, error } = await sb
      .from('rating_form_templates')
      .select('*')
      .eq('is_active', true)
      .in('department', Array.from(deptCandidates))
      .in('position', Array.from(posCandidates))
      .order('version', { ascending: false })
      .limit(1)

    if (error) throw error
    if (!data || data.length === 0) {
      throw new Error('未配置评分模板')
    }
    return { template: data[0] as unknown as RatingFormTemplate }
  },

  /**
   * 拉取提交者的月度评分会话：
   * - 目标执行人清单
   * - 为每个执行人匹配模板（无模板则 template=null）
   * - 回填已提交实例和答案
   */
  async getRequesterMonthlySession(params: {
    requesterId: string
    cycleMonth: string
  }): Promise<RequesterMonthlySessionItem[]> {
    validateCycleMonth(params.cycleMonth)

    const executors = await this.getMonthlyExecutorsForRequester(params)

    // 为每个执行人查询模板、实例与回答（可以考虑并发批量优化）
    const results: RequesterMonthlySessionItem[] = []
    for (const ex of executors) {
      let template: RatingFormTemplate | null = null
      try {
        const res = await this.getApplicableTemplateStrict({
          department: ex.department,
          position: ex.position,
        })
        template = res.template
      } catch {
        template = null
      }

      // 查询已存在的实例
      const { data: instData, error: instErr } = await client()
        .from('rating_form_instances')
        .select('*')
        .eq('requester_id', params.requesterId)
        .eq('executor_id', ex.executorId)
        .eq('cycle_month', params.cycleMonth)
        .limit(1)
        .maybeSingle()

      if (instErr) throw instErr

      let responses: RatingFormResponse[] | undefined
      if (instData?.id) {
        const { data: respData, error: respErr } = await client()
          .from('rating_form_responses')
          .select('*')
          .eq('instance_id', instData.id)

        if (respErr) throw respErr
        responses = (respData || []) as unknown as RatingFormResponse[]
      }

      results.push({
        executorId: ex.executorId,
        executorName: (ex as any).executorName,
        executorTitle: (ex as any).executorTitle,
        executorPosition: (ex as any).executorPosition,
        template,
        instance: instData as unknown as RatingFormInstance,
        responses,
      })
    }

    return results
  },

  /**
   * 批量提交：提交者对多位执行人的当月综合评分（幂等 upsert）
   * - 校验 cycleMonth 为当月/上月
   * - 对每个 executor 执行：
   *   1) upsert rating_form_instances by (requester_id, executor_id, cycle_month)
   *   2) upsert rating_form_responses by (instance_id, field_id)
   */
  async submitRequesterMonthlySession(payload: SubmitMonthlySessionInput): Promise<void> {
    validateCycleMonth(payload.cycleMonth)

    for (const entry of payload.entries) {
      // 1) upsert 实例
      const { data: upsertInst, error: upsertInstErr } = await client()
        .from('rating_form_instances')
        .upsert(
          {
            requester_id: payload.requesterId,
            executor_id: entry.executorId,
            cycle_month: payload.cycleMonth,
            template_id: entry.templateId,
            submitted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'requester_id,executor_id,cycle_month',
          }
        )
        .select()
        .single()

      if (upsertInstErr) throw upsertInstErr
      const instanceId = upsertInst.id as string

      // 2) upsert 回答（逐条 upsert）
      for (const r of entry.responses) {
        const { error: respErr } = await client()
          .from('rating_form_responses')
          .upsert(
            {
              instance_id: instanceId,
              field_id: r.field_id,
              value_score: r.value_score ?? null,
              value_text: r.value_text ?? null,
            },
            { onConflict: 'instance_id,field_id' }
          )

        if (respErr) throw respErr
      }
    }
  },

  /**
   * 执行人月度统计（整体平均 + 字段平均）
   * - 统计来源：当月所有实例的 rating 字段 value_score
   */
  async getExecutorMonthlyStats(params: {
    executorId: string
    cycleMonth: string
  }): Promise<ExecutorMonthlyStats> {
    validateCycleMonth(params.cycleMonth)

    // 取该执行人该月的所有实例
    const { data: insts, error: instErr } = await client()
      .from('rating_form_instances')
      .select('id')
      .eq('executor_id', params.executorId)
      .eq('cycle_month', params.cycleMonth)

    if (instErr) throw instErr
    const instanceIds = (insts || []).map((i: any) => i.id)
    if (instanceIds.length === 0) {
      return { overall_avg: null, field_avg: {}, rater_count: 0, sample_size: 0 }
    }

    // 拉取所有 responses（仅评分字段会有 value_score）
    const { data: resps, error: respErr } = await client()
      .from('rating_form_responses')
      .select('instance_id, field_id, value_score')
      .in('instance_id', instanceIds)

    if (respErr) throw respErr

    const scores = (resps || []).filter(r => typeof r.value_score === 'number') as Array<{ instance_id: string; field_id: string; value_score: number }>
    const sample_size = scores.length
    if (sample_size === 0) {
      return { overall_avg: null, field_avg: {}, rater_count: 0, sample_size: 0 }
    }

    const sum = scores.reduce((acc, cur) => acc + (cur.value_score || 0), 0)
    const overall_avg = Number((sum / sample_size).toFixed(1))

    // 字段平均
    const fieldSum: Record<string, { s: number; n: number }> = {}
    for (const s of scores) {
      if (!fieldSum[s.field_id]) fieldSum[s.field_id] = { s: 0, n: 0 }
      fieldSum[s.field_id].s += s.value_score || 0
      fieldSum[s.field_id].n += 1
    }
    const field_avg: Record<string, number> = {}
    Object.entries(fieldSum).forEach(([fid, v]) => {
      field_avg[fid] = Number((v.s / v.n).toFixed(1))
    })

    // rater_count：提交过实例的 requester 去重数量
    const { data: instsFull, error: instsFullErr } = await client()
      .from('rating_form_instances')
      .select('requester_id')
      .eq('executor_id', params.executorId)
      .eq('cycle_month', params.cycleMonth)

    if (instsFullErr) throw instsFullErr
    const rater_count = new Set((instsFull || []).map((i: any) => i.requester_id)).size

    return { overall_avg, field_avg, rater_count, sample_size }
  },
}