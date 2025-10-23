import { subscribePush } from '@/services/webpush'

export async function setupPushForUser(userId: string): Promise<boolean> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
  if (!publicKey) {
    console.warn('[WebPush] 缺少 NEXT_PUBLIC_VAPID_PUBLIC_KEY')
    return false
  }
  return await subscribePush(userId, publicKey)
}

export async function sendPushToUsers(userIds: string[], payload: { title: string; body?: string; linkUrl?: string }): Promise<boolean> {
  try {
    const resp = await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=utf-8' },
      body: JSON.stringify({ userIds, ...payload })
    })
    return resp.ok
  } catch {
    return false
  }
}

export async function sendPushToAppUsers(appUserIds: string[], payload: { title: string; body?: string; linkUrl?: string }): Promise<boolean> {
  try {
    const resp = await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=utf-8' },
      body: JSON.stringify({ userIds: appUserIds, ...payload })
    })
    return resp.ok
  } catch {
    return false
  }
}
