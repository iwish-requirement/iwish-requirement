/**
 * 浏览器系统通知服务（无需 Service Worker，标签页打开时可用）
 * - 提供权限检查与请求
 * - 提供通知显示（带点击跳转）
 * - 安全处理 SSR 和权限拒绝场景
 */

export type SystemNotificationPayload = {
  title: string;
  body?: string;
  iconUrl?: string;
  linkUrl?: string;
};

function isBrowserSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * 当前通知权限是否已允许
 */
export function isNotificationGranted(): boolean {
  if (!isBrowserSupported()) return false;
  return Notification.permission === 'granted';
}

/**
 * 当前通知权限是否被拒绝
 */
export function isNotificationDenied(): boolean {
  if (!isBrowserSupported()) return false;
  return Notification.permission === 'denied';
}

/**
 * 主动请求通知权限（需用户交互触发）
 * 返回 true 表示授权成功
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isBrowserSupported()) return false;
  if (Notification.permission === 'granted') return true;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
}

/**
 * 显示系统通知。仅在权限已允许时生效。
 * - 支持点击通知打开链接
 */
export function showSystemNotification(payload: SystemNotificationPayload): void {
  if (!isBrowserSupported()) return;
  if (Notification.permission !== 'granted') return;

  const { title, body, iconUrl, linkUrl } = payload;
  const n = new Notification(title, {
    body: body || '',
    icon: iconUrl || '/favicon.ico'
  });

  if (linkUrl) {
    n.onclick = () => {
      try {
        window.focus();
      } catch {}
      window.open(linkUrl, '_blank');
    };
  }
}

/**
 * 便捷方法：确保权限并显示通知
 * - 若未授权，将尝试申请权限；成功后展示通知
 */
export async function ensureAndNotify(payload: SystemNotificationPayload): Promise<void> {
  if (!isBrowserSupported()) return;
  if (Notification.permission !== 'granted') {
    const ok = await requestNotificationPermission();
    if (!ok) return;
  }
  showSystemNotification(payload);
}

/**
 * 示例：针对需求的通知封装（可在你的业务处调用）
 */
export async function notifyRequirementAssigned(options: {
  title: string;
  requirementId?: string;
  assignees?: string[];
  priorityLabel?: string;
  appBaseUrl?: string;
}): Promise<void> {
  const linkUrl = options.requirementId
    ? `${options.appBaseUrl || ''}/dashboard/requirements/detail/${options.requirementId}`
    : undefined;

  const bodyParts: string[] = [];
  if (options.priorityLabel) bodyParts.push(options.priorityLabel);
  if (options.assignees?.length) bodyParts.push(`执行人：${options.assignees.join(', ')}`);

  await ensureAndNotify({
    title: options.title,
    body: bodyParts.join(' \n'),
    linkUrl
  });
}
