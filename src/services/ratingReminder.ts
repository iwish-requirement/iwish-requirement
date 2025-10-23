import { createSupabaseClient } from '@/lib/supabase'
import { wecomNotify } from '@/services/wecom'

/**
 * 评分提醒服务：计算当前用户在某月需要评分但未提交的目标，并发出提醒。
 * 使用方式：
 * - 在页面操作或定时任务中调用 sendReminderForRequester(userId, cycleMonth, link)
 */
export async function sendReminderForRequester(requesterId: string, cycleMonth: string, link: string) {
  const sb = createSupabaseClient()

  // 找到该提交者当月已完成的协作需求 -> 执行人集合
  const [yStr, mStr] = cycleMonth.split('-')
  const y = parseInt(yStr, 10)
  const m = parseInt(mStr, 10) - 1
  const start = new Date(Date.UTC(y, m, 1)).toISOString()
  const next = new Date(Date.UTC(y, m + 1, 1)).toISOString()

  const { data: reqs, error: reqErr } = await sb
    .from('requirements')
    .select('id, assignee_id')
    .eq('status', 'completed')
    .eq('created_by', requesterId)
    .gte('completed_at', start)
    .lt('completed_at', next)
  if (reqErr) throw reqErr
  const requirementIds = (reqs || []).map(r => r.id)
  if (requirementIds.length === 0) return

  const { data: assRows, error: assErr } = await sb
    .from('requirement_assignees')
    .select('user_id')
    .in('requirement_id', requirementIds)
  if (assErr) throw assErr

  const singleAssignees = (reqs || []).map(r => r.assignee_id).filter((x): x is string => !!x)
  const multiAssignees = (assRows || []).map(a => (a as any).user_id).filter((x): x is string => !!x)
  const executorIds = Array.from(new Set([...singleAssignees, ...multiAssignees]))
  if (executorIds.length === 0) return

  // 找到该提交者当月已提交的评分实例
  const { data: insts, error: instErr } = await sb
    .from('rating_form_instances')
    .select('executor_id')
    .eq('requester_id', requesterId)
    .eq('cycle_month', cycleMonth)
  if (instErr) throw instErr

  const doneSet = new Set((insts || []).map(i => (i as any).executor_id).filter(Boolean))
  const pendingExecutorIds = executorIds.filter(id => !doneSet.has(id))
  if (pendingExecutorIds.length === 0) return

  // 拉取待评分执行人的姓名与企微ID
  const { data: users, error: usersErr } = await sb
    .from('users')
    .select('id, full_name, wecom_user_id')
    .in('id', pendingExecutorIds)
  if (usersErr) throw usersErr

  const targets = (users || []).map(u => ({
    executorId: (u as any).id as string,
    executorName: (u as any).full_name as string,
    wecomUserId: (u as any).wecom_user_id as string | undefined,
  }))

  // 当前提交者姓名
  let requesterName = '你'
  try {
    const { data: me } = await sb
      .from('users')
      .select('full_name, email')
      .eq('id', requesterId)
      .maybeSingle()
    requesterName = (me?.full_name || me?.email || requesterName) as string
  } catch {}

  await wecomNotify.notifyRatingReminder({
    cycleMonth,
    requesterName,
    targets,
    link,
  })
}
