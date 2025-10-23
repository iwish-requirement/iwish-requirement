import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .order('updated_at', { ascending: false })
    if (error) {
      return NextResponse.json({ ok: false, error: 'DB_QUERY_FAILED', detail: String(error.message || error) }, { status: 500 })
    }
    return NextResponse.json({ ok: true, rows: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR', detail: String(e) }, { status: 500 })
  }
}
