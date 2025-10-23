/**
 * 企业微信通知服务
 * - 兼容群机器人 Webhook 通知与企业应用精准推送
 *
 * 环境变量：
 * - 群机器人：NEXT_PUBLIC_WECOM_WEBHOOK_URL、NEXT_PUBLIC_WECOM_WEBHOOK_URL_<DEPT_SUFFIX>
 * - 企业应用：WECOM_CORP_ID、WECOM_AGENT_ID、WECOM_APP_SECRET
 */

import type { Requirement } from '@/types'

type PlainObject = Record<string, any>

type WeComMessageOptions = {
  subject?: string
  title?: string
  department?: string | null
  submitterName?: string | null
  assigneeUserIds?: string[]
  link?: string
  priority?: string | null
  dueDate?: string | null
  extraLines?: string[]
  contentOverride?: string
  messageType?: 'new_requirement' | 'rating_reminder' | 'custom'
}

type AccessTokenCache = {
  token: string
  expiresAt: number
}

const TOKEN_CACHE: AccessTokenCache = {
  token: '',
  expiresAt: 0
}

const DEFAULT_BASE_URL = 'https://qyapi.weixin.qq.com'

function env(name: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return (process.env as PlainObject)[name]
  }
  return undefined
}

function toEnvSuffix(dept?: string | null): string | null {
  if (!dept) return null
  const s = String(dept).trim()
  if (!s) return null
  return s.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase()
}

/**
 * 从环境变量获取企业微信应用配置
 */
function getAppConfig() {
  const corpId = env('WECOM_CORP_ID')
  const agentId = env('WECOM_AGENT_ID')
  const appSecret = env('WECOM_APP_SECRET')
  const baseUrl = env('WECOM_BASE_URL') || DEFAULT_BASE_URL

  if (!corpId || !agentId || !appSecret) {
    return null
  }

  return {
    corpId,
    agentId,
    appSecret,
    baseUrl
  }
}

/**
 * 获取企业微信应用 access_token，缓存 90 分钟
 */
async function getApplicationAccessToken(config: ReturnType<typeof getAppConfig>): Promise<string | null> {
  if (!config) return null

  const now = Date.now()
  if (TOKEN_CACHE.token && TOKEN_CACHE.expiresAt > now + 60 * 1000) {
    return TOKEN_CACHE.token
  }

  try {
    const url = `${config.baseUrl}/cgi-bin/gettoken?corpid=${config.corpId}&corpsecret=${config.appSecret}`
    const res = await fetch(url)
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.warn('[WeCom] 获取 access_token 失败:', res.status, text)
      return null
    }
    const json = await res.json()
    if (json.errcode !== 0) {
      console.warn('[WeCom] 获取 access_token 失败:', json)
      return null
    }
    TOKEN_CACHE.token = json.access_token
    TOKEN_CACHE.expiresAt = now + (json.expires_in || 7200) * 1000
    return TOKEN_CACHE.token
  } catch (error) {
    console.warn('[WeCom] 获取 access_token 异常:', error)
    return null
  }
}

/**
 * 企业应用精准推送
 */
async function sendAppMessage(options: WeComMessageOptions): Promise<void> {
  const wecomEnabled = (env('WECOM_ENABLED') || '').toLowerCase() !== 'false'
  const touser = (options.assigneeUserIds || []).filter(Boolean).join('|')
  // 强制仅使用 Web Push；企微通道暂不生效
  if (true) {
    // 无企微用户ID或显式关闭企微时，直接走 Web Push 精准通知（按应用内用户ID）
    const { sendPushToUsers } = await import('@/services/push-notify')
    await sendPushToUsers((options.assigneeUserIds || []).filter(Boolean), {
      title: options.title || '通知',
      body: options.contentOverride || '',
      linkUrl: options.link
    })
    return
  }

  const priorityLabel = priorityBadge(options.priority)
  const lines = [
    options.subject ? options.subject : `【新的需求】${priorityLabel}`,
    options.title ? `标题：${options.title}` : undefined,
    options.department ? `部门：${options.department}` : undefined,
    options.submitterName ? `提交人：${options.submitterName}` : undefined,
    options.dueDate ? `截止日期：${options.dueDate}` : undefined,
    options.link ? `查看详情：${options.link}` : undefined,
    ...(options.extraLines || [])
  ].filter(Boolean)
  const content = options.contentOverride || lines.join('\n')

  try {
    // 仅当开启企微时才调用企业微信接口
    if (wecomEnabled) {
      const apiUrl = env('NEXT_PUBLIC_WECOM_SEND_API') || '/api/wecom/send'
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json;charset=utf-8' },
        body: JSON.stringify({ assigneeUserIds: (options.assigneeUserIds || []), content, duplicate_check_interval: 600 })
      })
      const result = await resp.json().catch(() => ({}))
      if (!resp.ok || result?.ok === false) {
        console.warn('[WeCom] 精准推送失败（API路由）:', result)
        const { sendPushToUsers } = await import('@/services/push-notify')
        await sendPushToUsers((options.assigneeUserIds || []).filter(Boolean), {
          title: '新的需求已分配',
          body: content,
          linkUrl: options.link
        })
      }
    }
  } catch (error) {
    console.warn('[WeCom] 精准推送异常（API路由）:', error)
    const { sendPushToUsers } = await import('@/services/push-notify')
    await sendPushToUsers((options.assigneeUserIds || []).filter(Boolean), {
      title: '新的需求已分配',
      body: content,
      linkUrl: options.link
    })
  }
}

function requirementLink(id: string): string {
  const baseUrl = env('NEXT_PUBLIC_APP_URL') || ''
  const path = `/dashboard/requirements/detail/${id}`
  return baseUrl ? `${baseUrl}${path}` : path
}

function priorityBadge(p?: string | null): string {
  switch ((p || '').toLowerCase()) {
    case 'urgent': return '[紧急]'
    case 'high': return '[高]'
    case 'medium': return '[中]'
    case 'low': return '[低]'
    default: return ''
  }
}

function buildMarkdown(req: Partial<Requirement> & { id: string }): string {
  const priority = priorityBadge((req as any).priority)
  const dept = (req as any).assignee_department || (req as any).department || '-'
  const submitter = (req as any).submitter_name || (req as any).created_by || '-'
  const path = requirementLink(req.id)

  return [
    `**有新的需求** ${priority}`,
    `> 标题：${req.title || '未命名需求'}`,
    `> 部门：${dept}`,
    `> 提交人：${submitter}`,
    req.due_date ? `> 截止：${req.due_date}` : '',
    '',
    `详情：${path}`
  ].filter(Boolean).join('\n')
}

export async function notifyNewRequirement(req: Partial<Requirement> & { id: string; assignee_wecom_ids?: string[]; assignee_user_ids?: string[] }): Promise<void> {
  const content = buildMarkdown(req)
  // 直接走企业微信精准推送；失败将自动回退到 Web Push（在 sendAppMessage 内处理）
  await sendAppMessage({
    title: req.title || '未命名需求',
    department: (req as any).assignee_department || (req as any).department,
    submitterName: (req as any).submitter_name || (req as any).created_by,
    priority: (req as any).priority,
    dueDate: req.due_date as string | undefined,
    link: requirementLink(req.id),
    assigneeUserIds: (req.assignee_wecom_ids || []),
    // 业务上仍保留应用内用户ID，用于 Web Push
    assigneeUserIds: (req.assignee_user_ids || [])
  })
}

export async function notifyRatingReminder(params: {
  cycleMonth: string
  requesterName: string
  targets: Array<{ executorName: string; executorId: string; wecomUserId?: string }>
  link: string
  webhookUrl?: string
}): Promise<void> {
  const count = params.targets.length
  if (count === 0) return

  const head = `**评分提醒**\n> ${params.requesterName}，你在 ${params.cycleMonth} 仍有 ${count} 位同事待评分：`
  const list = params.targets.slice(0, 10).map((t, idx) => `${idx + 1}. ${t.executorName || t.executorId}`).join('\n')
  const more = params.targets.length > 10 ? `\n… 共 ${params.targets.length} 人` : ''
  const tail = `\n\n前往评分：${params.link}`

  await sendAppMessage({
    title: '评分提醒',
    assigneeUserIds: params.targets.map(t => t.wecomUserId).filter(Boolean) as string[],
    assigneeUserIds: params.targets.map(t => t.executorId).filter(Boolean),
    link: params.link,
    department: undefined,
    submitterName: params.requesterName,
    dueDate: undefined,
    priority: undefined
  })
}

export const wecomNotify = {
  notifyNewRequirement,
  notifyRatingReminder,
};
