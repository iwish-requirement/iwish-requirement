import { NextResponse } from 'next/server'

// 服务端读取企业应用凭证（仅在服务端存在，不使用 NEXT_PUBLIC 前缀）
const WECOM_CORP_ID = process.env.WECOM_CORP_ID
const WECOM_AGENT_ID = process.env.WECOM_AGENT_ID
const WECOM_APP_SECRET = process.env.WECOM_APP_SECRET
const WECOM_BASE_URL = process.env.WECOM_BASE_URL || 'https://qyapi.weixin.qq.com'

async function getAccessToken(): Promise<string | null> {
  if (!WECOM_CORP_ID || !WECOM_APP_SECRET) return null
  try {
    const res = await fetch(`${WECOM_BASE_URL}/cgi-bin/gettoken?corpid=${WECOM_CORP_ID}&corpsecret=${WECOM_APP_SECRET}`)
    const json = await res.json()
    if (json.errcode !== 0) return null
    return json.access_token as string
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  try {
    if (!WECOM_CORP_ID || !WECOM_AGENT_ID || !WECOM_APP_SECRET) {
      return NextResponse.json({ ok: false, error: 'MISSING_CREDENTIALS' }, { status: 400 })
    }

    const body = await req.json()
    const touser: string = (body?.assigneeUserIds || []).filter((x: string) => !!x).join('|')
    const content: string = body?.content || ''
    const duplicateCheckInterval: number = body?.duplicate_check_interval ?? 600

    if (!touser) {
      return NextResponse.json({ ok: false, error: 'EMPTY_RECIPIENTS' }, { status: 400 })
    }
    if (!content) {
      return NextResponse.json({ ok: false, error: 'EMPTY_CONTENT' }, { status: 400 })
    }

    const token = await getAccessToken()
    if (!token) {
      return NextResponse.json({ ok: false, error: 'TOKEN_FETCH_FAILED' }, { status: 500 })
    }

    const payload = {
      touser,
      msgtype: 'text',
      agentid: Number(WECOM_AGENT_ID),
      text: { content },
      duplicate_check_interval: duplicateCheckInterval
    }

    const resp = await fetch(`${WECOM_BASE_URL}/cgi-bin/message/send?access_token=${token}` , {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=utf-8' },
      body: JSON.stringify(payload)
    })
    const result = await resp.json()

    if (result.errcode !== 0) {
      // 简单返回错误，客户端自行记录
      return NextResponse.json({ ok: false, error: 'SEND_FAILED', detail: result }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR', detail: String(error) }, { status: 500 })
  }
}
