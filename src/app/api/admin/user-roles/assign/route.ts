import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const userId: string = body.userId
    const roleId: string = body.roleId
    const assignedBy: string | undefined = body.assignedBy

    if (!userId || !roleId) {
      return NextResponse.json({ error: 'Missing userId or roleId' }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'Server missing Supabase credentials' }, { status: 500 })
    }

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

    // Optional: prevent duplicate assignment
    const { data: existing, error: existErr } = await admin
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role_id', roleId)
      .limit(1)

    if (existErr) {
      return NextResponse.json({ error: existErr.message }, { status: 500 })
    }
    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Role already assigned to user' }, { status: 409 })
    }

    const { data, error } = await admin
      .from('user_roles')
      .insert({ user_id: userId, role_id: roleId, assigned_by: assignedBy || null, is_active: true })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ id: data.id }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 })
  }
}
