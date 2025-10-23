import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const userId: string = body?.userId
    const subscription: PushSubscriptionJSON = body?.subscription
    if (!userId || !subscription) {
      return NextResponse.json({ ok: false, error: 'INVALID_BODY' }, { status: 400 })
    }

    const row = {
      user_id: userId,
      auth_user_id: userId,
      app_user_id: body?.appUserId || null,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys?.p256dh,
      auth: subscription.keys?.auth,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(row, { onConflict: 'user_id' })

    if (error) {
      return NextResponse.json({ ok: false, error: 'DB_UPSERT_FAILED', detail: String(error.message || error) }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR', detail: String(error) }, { status: 500 })
  }
}

export async function GET() {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('user_id')
  if (error) return NextResponse.json({ ok: false, error: 'DB_QUERY_FAILED', detail: String(error.message || error) }, { status: 500 })
  return NextResponse.json({ ok: true, size: (data || []).length })
}
