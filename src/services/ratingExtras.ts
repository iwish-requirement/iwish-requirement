/**
 * 评分服务扩展：概览与工具（独立于 ratingService，避免对现有对象做大改）
 */
import { createSupabaseClient } from '@/lib/supabase'

/** 工具：当前月 'YYYY-MM' */
export function getCurrentCycleMonth(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/** 工具：上个月 'YYYY-MM' */
export function getPreviousCycleMonth(): string {
  const now = new Date()
  now.setMonth(now.getMonth() - 1)
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/**
 * 执行人月度概览（按 overall_avg 排序）
 * - 参数可选过滤部门/岗位（基于 users 表过滤）
 * - 计算逻辑：聚合 rating_form_instances + rating_form_responses 的 value_score
 */
export async function listExecutorsOverview(params: {
  cycleMonth: string | 'all'
  department?: string
  position?: string
}): Promise<Array<{
  executorId: string
  overall_avg: number
  rater_count: number
  sample_size: number
  executorName?: string
  positionName?: string
  lastSubmitted?: string | null
}>> {
  // 计算月起止（左闭右开）；当 cycleMonth === 'all' 时不计算
  // 注：当前函数未使用 start/next，移除以避免 'all' 时抛错

  const sb = createSupabaseClient()

  // 1) 取实例（支持全部月份）
  let instQuery = sb
    .from('rating_form_instances')
    .select('id, executor_id, requester_id, cycle_month, submitted_at')
  if (params.cycleMonth !== 'all') {
    instQuery = instQuery.eq('cycle_month', params.cycleMonth as string)
  }
  const { data: insts, error: instErr } = await instQuery

  if (instErr) throw instErr
  if (!insts || insts.length === 0) return []

  // 2) 可选按用户表过滤 executor（部门/岗位）
  let executorIds = Array.from(new Set(insts.map(i => i.executor_id)))
  if (params.department || params.position) {
    const q = sb.from('users').select('id, department, position, department_code, position_code')
    let query = q
    if (params.department) {
      query = query.or(`department.eq.${params.department},department_code.eq.${params.department}`)
    }
    if (params.position) {
      query = query.or(`position.eq.${params.position},position_code.eq.${params.position}`)
    }
    const { data: users, error: uErr } = await query
    if (uErr) throw uErr
    const allowed = new Set((users || []).map(u => u.id))
    executorIds = executorIds.filter(id => allowed.has(id))
  }
  if (executorIds.length === 0) return []

  // 3) 取所有这些实例的 responses（仅评分字段有 value_score）
  const { data: resps, error: respErr } = await sb
    .from('rating_form_responses')
    .select('instance_id, value_score')

  if (respErr) throw respErr

  const respByInstance = new Map<string, number[]>()
  ;(resps || []).forEach(r => {
    if (typeof r.value_score === 'number') {
      const arr = respByInstance.get(r.instance_id) || []
      arr.push(r.value_score)
      respByInstance.set(r.instance_id, arr)
    }
  })

  // 4) 聚合：按 executor 汇总
  const scoresByExecutor: Record<string, number[]> = {}
  const ratersByExecutor: Record<string, Set<string>> = {}
  for (const inst of insts) {
    if (!executorIds.includes(inst.executor_id)) continue
    const scores = respByInstance.get(inst.id) || []
    if (!scoresByExecutor[inst.executor_id]) scoresByExecutor[inst.executor_id] = []
    scoresByExecutor[inst.executor_id].push(...scores)

    if (!ratersByExecutor[inst.executor_id]) ratersByExecutor[inst.executor_id] = new Set<string>()
    if (inst.requester_id) ratersByExecutor[inst.executor_id].add(inst.requester_id)
  }

  // 5) 生成结果
  const result: Array<{
    executorId: string; overall_avg: number; rater_count: number; sample_size: number;
    executorName?: string; positionName?: string; lastSubmitted?: string | null
  }> = []
  for (const [execId, arr] of Object.entries(scoresByExecutor)) {
    const n = arr.length
    if (n === 0) continue
    const s = arr.reduce((a, b) => a + b, 0)
    const avg = Number((s / n).toFixed(1))
    result.push({
      executorId: execId,
      overall_avg: avg,
      rater_count: (ratersByExecutor[execId]?.size || 0),
      sample_size: n,
    })
  }

  // 6) 补充用户姓名、岗位（中文/代码原样）与最近提交时间
  try {
    const execIds = result.map(r => r.executorId)
    if (execIds.length > 0) {
      // 用户信息
      const { data: usersRows } = await sb
        .from('users')
        .select('id, full_name, position')
        .in('id', execIds)
      const nameById: Record<string, { full_name?: string; position?: string }> = {}
      const posCodes = new Set<string>()
      for (const u of usersRows || []) {
        const code = (u as any).position as string | undefined
        nameById[(u as any).id] = { full_name: (u as any).full_name, position: code }
        if (code) posCodes.add(code)
      }
      // 岗位编码 -> 中文名映射
      const posMap: Record<string, string> = {}
      if (posCodes.size > 0) {
        const { data: posRows } = await sb
          .from('positions')
          .select('code, name')
          .in('code', Array.from(posCodes))
        for (const p of posRows || []) {
          posMap[(p as any).code] = (p as any).name
        }
      }
      // 最近提交时间：同月实例 submitted_at 的最大值
      let lastQuery = sb
        .from('rating_form_instances')
        .select('executor_id, submitted_at')
        .in('executor_id', execIds)
      if (params.cycleMonth !== 'all') {
        lastQuery = lastQuery.eq('cycle_month', params.cycleMonth as string)
      }
      const { data: instRows } = await lastQuery
      const lastMap: Record<string, string> = {}
      for (const r of instRows || []) {
        const eid = (r as any).executor_id
        const ts = (r as any).submitted_at
        if (!ts) continue
        if (!lastMap[eid] || new Date(ts) > new Date(lastMap[eid])) lastMap[eid] = ts
      }
      // 写回到结果
      result.forEach(r => {
        const code = nameById[r.executorId]?.position
        r.executorName = nameById[r.executorId]?.full_name
        r.positionName = code ? (posMap[code] || code) : undefined
        r.lastSubmitted = lastMap[r.executorId] || null
      })
    }
  } catch {}
  // 7) 排序：overall_avg desc
  result.sort((a, b) => (b.overall_avg - a.overall_avg))
  return result
}