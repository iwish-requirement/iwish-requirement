/**
 * Web Push 客户端服务
 * - 负责注册 Service Worker、订阅 Push，并上报订阅到后端
 */

export type PushSubscriptionPayload = {
  userId: string;
  // Use broad type here to avoid DOM lib conflicts; server will validate shape
  subscription: any;
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    // 等待 Service Worker 激活
    await navigator.serviceWorker.ready;
    return reg;
  } catch {
    return null;
  }
}

export async function subscribePush(userId: string, vapidPublicKey: string): Promise<boolean> {
  const reg = await registerServiceWorker();
  if (!reg) return false;

  try {
    // 若通知权限尚未授予，尝试申请
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch {}
    }

    const activeReg = await navigator.serviceWorker.ready;
    const existing = await activeReg.pushManager.getSubscription();
    if (existing) {
      try { await existing.unsubscribe(); } catch {}
    }
    const subscription = await activeReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });

    const payload: PushSubscriptionPayload = {
      userId,
      subscription: subscription.toJSON() as any
    };

    const resp = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    return resp.ok;
  } catch (e) {
    console.warn('[WebPush] 订阅失败:', e);
    return false;
  }
}

export async function resetAndSubscribe(userId: string, vapidPublicKey: string): Promise<boolean> {
  const reg = await registerServiceWorker();
  if (!reg) return false;
  try {
    const activeReg = await navigator.serviceWorker.ready;
    const existing = await activeReg.pushManager.getSubscription();
    if (existing) {
      try { await existing.unsubscribe(); } catch {}
    }
    return await subscribePush(userId, vapidPublicKey);
  } catch (e) {
    console.warn('[WebPush] 重置订阅失败:', e);
    return false;
  }
}
