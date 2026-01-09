"use client";

import React, { useEffect, useState } from "react";
import { Plus, Trash2, RefreshCcw, Activity } from "lucide-react";
import Modal from "../../../components/ui/Modal";
import { authorizedFetch } from "../../../lib/authFetch";

interface WebhookSubscription {
  id: number;
  eventType: string;
  url: string;
  secret?: string | null;
  provider?: string | null;
  enabled: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface WebhookEventLogItem {
  id: number;
  subscriptionId: number;
  eventType: string;
  requestId: string;
  status: string;
  attemptCount: number;
  lastError: string | null;
  createdAt: string | null;
  lastAttemptAt: string | null;
  deliveredAt: string | null;
}

interface Props {
  canManage: boolean;
}

const WebhookSettings: React.FC<Props> = ({ canManage }) => {
  const [subscriptions, setSubscriptions] = useState<WebhookSubscription[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [errorSubs, setErrorSubs] = useState<string | null>(null);

  const [selectedSubId, setSelectedSubId] = useState<number | null>(null);
  const [events, setEvents] = useState<WebhookEventLogItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [errorEvents, setErrorEvents] = useState<string | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<WebhookSubscription> | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);

  const loadSubscriptions = async () => {
    try {
      setLoadingSubs(true);
      setErrorSubs(null);
      const res = await authorizedFetch("/api/webhooks");
      if (!res.ok) {
        const text = await res.text();
        console.error("[WebhookSettings] load subscriptions error", text);
        setErrorSubs("加载 Webhook 订阅列表失败，请稍后重试");
        setSubscriptions([]);
        return;
      }
      const json = await res.json();
      const items = (json.items || []) as WebhookSubscription[];
      setSubscriptions(items);
      if (items.length > 0 && selectedSubId == null) {
        setSelectedSubId(items[0].id);
      }
    } catch (e) {
      console.error("[WebhookSettings] load subscriptions error", e);
      setErrorSubs("加载 Webhook 订阅列表失败，请检查网络后重试");
      setSubscriptions([]);
    } finally {
      setLoadingSubs(false);
    }
  };

  const loadEvents = async (subscriptionId: number | null) => {
    if (!subscriptionId) {
      setEvents([]);
      return;
    }
    try {
      setLoadingEvents(true);
      setErrorEvents(null);
      const params = new URLSearchParams();
      params.set("subscriptionId", String(subscriptionId));
      const res = await authorizedFetch(`/api/webhooks/events?${params.toString()}`);
      if (!res.ok) {
        const text = await res.text();
        console.error("[WebhookSettings] load events error", text);
        setErrorEvents("加载事件日志失败，请稍后重试");
        setEvents([]);
        return;
      }
      const json = await res.json();
      const items = (json.items || []) as WebhookEventLogItem[];
      setEvents(items);
    } catch (e) {
      console.error("[WebhookSettings] load events error", e);
      setErrorEvents("加载事件日志失败，请检查网络后重试");
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    loadSubscriptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadEvents(selectedSubId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubId]);

  const openCreateModal = () => {
    if (!canManage) return;
    setEditing({
      id: undefined,
      eventType: "demand.created",
      url: "",
      enabled: true,
      provider: "generic",
    });
    setIsEditModalOpen(true);
  };

  const openEditModal = (sub: WebhookSubscription) => {
    if (!canManage) return;
    setEditing({ ...sub });
    setIsEditModalOpen(true);
  };

  const handleSave = async () => {
    if (!canManage || !editing) return;
    const eventType = (editing.eventType || "").trim();
    const url = (editing.url || "").trim();
    if (!eventType || !url) {
      setErrorSubs("请填写事件类型和回调 URL");
      return;
    }

    try {
      setSaving(true);
      setErrorSubs(null);
      const payload: any = {
        id: editing.id ?? undefined,
        eventType,
        url,
        provider: editing.provider || "generic",
        enabled: editing.enabled !== false,
      };
      if (editing.secret !== undefined) {
        payload.secret = editing.secret;
      }

      const res = await authorizedFetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("[WebhookSettings] save subscription error", text);
        setErrorSubs("保存 Webhook 订阅失败，请稍后重试");
        return;
      }
      await loadSubscriptions();
      setIsEditModalOpen(false);
      setEditing(null);
    } catch (e) {
      console.error("[WebhookSettings] save subscription error", e);
      setErrorSubs("保存 Webhook 订阅失败，请检查网络后重试");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sub: WebhookSubscription) => {
    if (!canManage) return;
    try {
      setDeletingId(sub.id);
      setErrorSubs(null);
      const res = await authorizedFetch("/api/webhooks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sub.id }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("[WebhookSettings] delete subscription error", text);
        setErrorSubs("删除 Webhook 订阅失败，请稍后重试");
        return;
      }
      const nextSubs = subscriptions.filter((s) => s.id !== sub.id);
      setSubscriptions(nextSubs);
      if (selectedSubId === sub.id) {
        setSelectedSubId(nextSubs.length ? nextSubs[0].id : null);
      }
    } catch (e) {
      console.error("[WebhookSettings] delete subscription error", e);
      setErrorSubs("删除 Webhook 订阅失败，请检查网络后重试");
    } finally {
      setDeletingId(null);
    }
  };

  const handleRetry = async (eventId: number) => {
    if (!canManage) return;
    try {
      setRetryingId(eventId);
      const res = await authorizedFetch("/api/webhooks/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("[WebhookSettings] retry event error", text);
        setErrorEvents("重试事件推送失败，请稍后重试");
        return;
      }
      if (selectedSubId) {
        await loadEvents(selectedSubId);
      }
    } catch (e) {
      console.error("[WebhookSettings] retry event error", e);
      setErrorEvents("重试事件推送失败，请检查网络后重试");
    } finally {
      setRetryingId(null);
    }
  };

  const currentSub = subscriptions.find((s) => s.id === selectedSubId) || null;

  return (
    <div className="space-y-6">
      {!canManage && (
        <div className="mb-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
          当前为只读权限，可查看 Webhook 列表与日志，但无法新增、编辑或删除订阅，也无法重试事件推送。
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-500" /> Webhook 管理
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            通过订阅关键事件，将需求、评分等业务变化推送到企业微信机器人或内部系统。
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          disabled={!canManage}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" /> 新增订阅
        </button>
      </div>

      {errorSubs && (
        <div className="mb-2 text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
          {errorSubs}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900">订阅列表</h3>
            <button
              type="button"
              onClick={loadSubscriptions}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-lg border border-slate-200 text-slate-600 bg-white hover:bg-slate-50"
            >
              <RefreshCcw className="w-3 h-3" /> 刷新
            </button>
          </div>
          {loadingSubs ? (
            <div className="py-4 text-xs text-slate-400">正在加载订阅...</div>
          ) : subscriptions.length === 0 ? (
            <div className="py-4 text-xs text-slate-400">
              暂无 Webhook 订阅，可点击右上角“新增订阅”添加。
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {subscriptions.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setSelectedSubId(sub.id)}
                  className={`w-full text-left py-3 px-2 rounded-xl flex items-start justify-between gap-3 hover:bg-slate-50 transition-colors ${
                    selectedSubId === sub.id ? "bg-slate-50" : "bg-white"
                  }`}
                >
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-slate-900 truncate">
                      {sub.eventType}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500 break-all">
                      {sub.url}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      <span>
                        提供方：{sub.provider || "通用 HTTP"}
                      </span>
                      <span>
                        状态：{sub.enabled ? "已启用" : "已停用"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(sub);
                      }}
                      className="text-[11px] px-2 py-1 rounded-lg border border-slate-200 text-slate-600 bg-white hover:bg-slate-50"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      disabled={!canManage || deletingId === sub.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(sub);
                      }}
                      className="text-[11px] px-2 py-1 rounded-lg border border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {deletingId === sub.id ? "删除中..." : <><Trash2 className="w-3 h-3 inline-block mr-1" /> 删除</>}
                    </button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900">事件发送日志</h3>
            {currentSub && (
              <span className="text-[11px] text-slate-500 truncate max-w-[220px]">
                当前订阅：{currentSub.eventType}
              </span>
            )}
          </div>
          {errorEvents && (
            <div className="mb-2 text-[11px] text-rose-600 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-lg">
              {errorEvents}
            </div>
          )}
          {loadingEvents ? (
            <div className="py-4 text-xs text-slate-400">正在加载事件日志...</div>
          ) : !currentSub ? (
            <div className="py-4 text-xs text-slate-400">请先在左侧选择一个订阅查看事件日志。</div>
          ) : events.length === 0 ? (
            <div className="py-4 text-xs text-slate-400">当前订阅暂时没有事件记录。</div>
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {events.map((e) => (
                <div
                  key={e.id}
                  className="border border-slate-100 rounded-xl px-3 py-2 text-[11px] flex items-start justify-between gap-2 bg-slate-50/40"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-800 truncate">
                        {e.eventType}
                      </span>
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] border ${
                          e.status === "success"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : "bg-amber-50 text-amber-700 border-amber-100"
                        }`}
                      >
                        {e.status === "success" ? "成功" : "失败"} · 尝试 {e.attemptCount} 次
                      </span>
                    </div>
                    <div className="text-slate-500 break-all">
                      <span className="text-slate-400">requestId：</span>
                      {e.requestId}
                    </div>
                    {e.lastError && (
                      <div className="mt-1 text-slate-500 break-all">
                        <span className="text-slate-400">lastError：</span>
                        {e.lastError}
                      </div>
                    )}
                    <div className="mt-1 text-slate-400 flex flex-wrap gap-2">
                      {e.createdAt && <span>创建：{e.createdAt}</span>}
                      {e.lastAttemptAt && <span>最近尝试：{e.lastAttemptAt}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <button
                      type="button"
                      disabled={!canManage || retryingId === e.id}
                      onClick={() => handleRetry(e.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {retryingId === e.id ? (
                        "重试中..."
                      ) : (
                        <>
                          <RefreshCcw className="w-3 h-3" /> 重试
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          if (saving) return;
          setIsEditModalOpen(false);
          setEditing(null);
        }}
        title={editing?.id ? "编辑 Webhook 订阅" : "新增 Webhook 订阅"}
      >
        <div className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">事件类型 (event_type)</label>
            <input
              type="text"
              value={editing?.eventType || ""}
              onChange={(e) =>
                setEditing((prev) => ({ ...(prev || {}), eventType: e.target.value }))
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="例如：demand.created、demand.status_changed、user.approved"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">回调 URL</label>
            <input
              type="text"
              value={editing?.url || ""}
              onChange={(e) => setEditing((prev) => ({ ...(prev || {}), url: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="必须为 HTTPS 地址，例如：https://example.com/webhook"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">提供方 (可选)</label>
            <input
              type="text"
              value={editing?.provider || ""}
              onChange={(e) =>
                setEditing((prev) => ({ ...(prev || {}), provider: e.target.value }))
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="例如：internal / generic"

            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">签名密钥 (可选)</label>
            <input
              type="text"
              value={editing?.secret || ""}
              onChange={(e) => setEditing((prev) => ({ ...(prev || {}), secret: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="用于生成 HMAC-SHA256 签名，对端可据此验签"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={editing?.enabled !== false}
              onChange={(e) =>
                setEditing((prev) => ({ ...(prev || {}), enabled: e.target.checked }))
              }
              className="w-4 h-4 text-blue-600 rounded border-gray-300"
            />
            启用该订阅
          </label>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                if (saving) return;
                setIsEditModalOpen(false);
                setEditing(null);
              }}
              className="px-4 py-2 text-xs font-bold text-slate-600 rounded-lg hover:bg-slate-100"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "保存中..." : "保存订阅"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default WebhookSettings;
