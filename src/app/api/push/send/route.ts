import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { supabase } from '@/lib/supabase'

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@localhost'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const userIds: string[] = body?.userIds || []
    const title: string = body?.title || '通知'
    const content: string = body?.body || ''
    const linkUrl: string | undefined = body?.linkUrl

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return NextResponse.json({ ok: false, error: 'MISSING_VAPID_KEYS' }, { status: 500 })
    }

    const payload = JSON.stringify({ title, body: content, linkUrl })

    // 从 Supabase 查询目标用户的订阅
    const { data: rows, error } = await supabase
      .from('push_subscriptions')
      .select('user_id, auth_user_id, app_user_id, endpoint, p256dh, auth')
      .or(`user_id.in.(${userIds.join(',')}),auth_user_id.in.(${userIds.join(',')}),app_user_id.in.(${userIds.join(',')})`)

    if (error) {
      return NextResponse.json({ ok: false, error: 'DB_QUERY_FAILED', detail: String(error.message || error) }, { status: 500 })
    }

    const results: Array<{ userId: string; ok: boolean; error?: string }> = []

    for (const row of rows || []) {
      const sub: PushSubscriptionJSON = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth }
      } as any

      try {
        await webpush.sendNotification(sub as any, payload)
        results.push({ userId: row.user_id, ok: true })
      } catch (err: any) {
        let errorDetail: any = undefined
        try {
          const serialize = (e: any) => ({
            name: e?.name,
            message: e?.message,
            statusCode: e?.statusCode,
            headers: e?.headers,
            body: e?.body
          })
          if (Array.isArray(err?.errors) && err.errors.length) {
            errorDetail = { errors: err.errors.map(serialize) }
          } else if (err) {
            errorDetail = serialize(err)
          }
        } catch {}
        console.error('[WebPush] sendNotification error:', err)
        results.push({ userId: row.user_id, ok: false, error: String(err?.message || err), ...(errorDetail ? { detail: errorDetail } : {}) })
      }
    }

    return NextResponse.json({ ok: true, results })
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR', detail: String(error) }, { status: 500 })
  }
}

// 简易 GET 测试入口：
// - GET /api/push/send?userId=<uuid> 仅发送给该用户
// - GET /api/push/send            发送给所有已订阅用户（用于本地快速验证）
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const userId = url.searchParams.get('userId') || undefined
    const title = url.searchParams.get('title') || '测试通知'
    const body = url.searchParams.get('body') || '这是一条 Web Push 测试'
    const linkUrl = url.searchParams.get('linkUrl') || '/dashboard'

    const payload = JSON.stringify({ title, body, linkUrl })

    let query = supabase.from('push_subscriptions').select('user_id, auth_user_id, app_user_id, endpoint, p256dh, auth')
    if (userId) {
      query = query.or(`user_id.eq.${userId},auth_user_id.eq.${userId},app_user_id.eq.${userId}`)
    }
    const { data: rows, error } = await query
    if (error) {
      return NextResponse.json({ ok: false, error: 'DB_QUERY_FAILED', detail: String(error.message || error) }, { status: 500 })
    }

    const results: Array<{ userId: string; ok: boolean; error?: string }> = []
    for (const row of rows || []) {
      const sub: PushSubscriptionJSON = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth }
      } as any
      try {
        await webpush.sendNotification(sub as any, payload)
        results.push({ userId: row.user_id, ok: true })
      } catch (err: any) {
        let errorDetail: any = undefined
        try {
          const serialize = (e: any) => ({
            name: e?.name,
            message: e?.message,
            statusCode: e?.statusCode,
            headers: e?.headers,
            body: e?.body
          })
          if (Array.isArray(err?.errors) && err.errors.length) {
            errorDetail = { errors: err.errors.map(serialize) }
          } else if (err) {
            errorDetail = serialize(err)
          }
        } catch {}
        console.error('[WebPush] sendNotification error:', err)
        results.push({ userId: row.user_id, ok: false, error: String(err?.message || err), ...(errorDetail ? { detail: errorDetail } : {}) })
      }
    }
    return NextResponse.json({ ok: true, results })
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR', detail: String(error) }, { status: 500 })
  }
}
