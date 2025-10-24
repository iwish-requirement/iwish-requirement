import { NextResponse } from 'next/server'
import { createSupabaseServerAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      email,
      full_name,
      department,
      position,
      role = 'employee',
      phone,
      title,
      initialPassword
    } = body || {}

    if (!email || !full_name || !department || !position) {
      return NextResponse.json({ ok: false, error: 'MISSING_FIELDS' }, { status: 400 })
    }

    const admin = createSupabaseServerAdmin()

    // 1) 创建 Auth 用户（管理员创建，无需开放注册）
    const password = initialPassword || process.env.DEFAULT_INITIAL_PASSWORD || '123456'
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, department, position, role, phone, title }
    })
    if (createErr || !created?.user?.id) {
      return NextResponse.json({ ok: false, error: createErr?.message || 'CREATE_AUTH_USER_FAILED' }, { status: 500 })
    }
    const authUserId = created.user.id

    // 2) 写入业务 users 表，使用 Auth 用户 id 作为主键，确保两者同步
    const now = new Date().toISOString()
    const { data: userRow, error: insertErr } = await admin
      .from('users')
      .insert({
        id: authUserId,
        email,
        full_name,
        department,
        position,
        role,
        active: true,
        created_at: now,
        updated_at: now,
        wecom_user_id: null
      })
      .select()
      .single()

    if (insertErr) {
      // 可选回滚：删除刚创建的 Auth 用户，避免脏数据
      try { await admin.auth.admin.deleteUser(authUserId) } catch {}
      return NextResponse.json({ ok: false, error: insertErr.message || 'INSERT_BUSINESS_USER_FAILED' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, user: userRow }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'UNKNOWN_ERROR' }, { status: 500 })
  }
}
