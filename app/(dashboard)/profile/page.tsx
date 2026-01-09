"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "../../../lib/supabase";
import { authorizedFetch } from "../../../lib/authFetch";

interface ProfileUser {
  id: number;
  email: string;
  name: string | null;
  departmentId: number | null;
  departmentName: string | null;
  status: string;
  role: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [wecomUserId, setWecomUserId] = useState<string>("");
  const [initialWecomUserId, setInitialWecomUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase.auth.getUser();
        const authUser = data?.user;
        if (!authUser || !authUser.email || !authUser.id) {
          router.push("/login");
          return;
        }

        const syncRes = await fetch("/api/auth/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            authUserId: authUser.id,
            email: authUser.email,
            name: (authUser.user_metadata as any)?.full_name,
          }),
        });

        if (!syncRes.ok) {
          const text = await syncRes.text();
          console.error("[profile] sync user error", text);
          if (!cancelled) {
            setError("加载用户信息失败，请稍后重试");
          }
          return;
        }

        const json = await syncRes.json();
        const u = json.user as {
          id: number;
          email: string;
          name: string | null;
          departmentId: number | null;
          departmentName: string | null;
          status: string;
          role: string;
        };

        if (!cancelled) {
          setUser({
            id: u.id,
            email: u.email,
            name: u.name,
            departmentId: u.departmentId,
            departmentName: u.departmentName,
            status: u.status,
            role: u.role,
          });
        }

        const bindRes = await authorizedFetch("/api/wecom/bind");
        if (bindRes.ok) {
          const bindJson = await bindRes.json();
          const current = (bindJson.wecomUserId as string | null) ?? "";
          if (!cancelled) {
            setWecomUserId(current);
            setInitialWecomUserId(current);
          }
        } else {
          const text = await bindRes.text();
          console.error("[profile] load wecom binding error", text);
        }

        // 处理企微绑定回调结果
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const wecomBind = params.get("wecomBind");
          const wecomBindError = params.get("wecomBindError");

          if (wecomBind === "success") {
            if (!cancelled) {
              setSuccess("企业微信绑定成功！");
              // 重新加载绑定信息
              const refreshRes = await authorizedFetch("/api/wecom/bind");
              if (refreshRes.ok) {
                const refreshJson = await refreshRes.json();
                const current = (refreshJson.wecomUserId as string | null) ?? "";
                setWecomUserId(current);
                setInitialWecomUserId(current);
              }
            }
            // 清理 URL 参数
            window.history.replaceState({}, "", "/profile");
          } else if (wecomBindError) {
            if (!cancelled) {
              const errorMessages: Record<string, string> = {
                missing_code: "企微授权失败：缺少授权码",
                config: "企微配置异常，请联系管理员",
                token: "获取企微访问令牌失败",
                userinfo: "获取企微用户信息失败",
                db: "保存绑定信息失败，请稍后重试",
              };
              setError(errorMessages[wecomBindError] || "企微绑定失败，请稍后重试");
            }
            // 清理 URL 参数
            window.history.replaceState({}, "", "/profile");
          }
        }
      } catch (e) {
        console.error("[profile] load profile error", e);
        if (!cancelled) {
          setError("加载个人资料失败，请检查网络后重试");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSaveWecom = async () => {
    if (!user) return;
    const trimmed = wecomUserId.trim();
    setSaving(true);
    setError(null);
    setSuccess(null);
    const res = await authorizedFetch("/api/wecom/bind", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wecomUserId: trimmed || null }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[profile] save wecom binding error", text);
      if (res.status === 401) {
        setError("登录已失效，请重新登录后再试");
      } else if (res.status === 403) {
        setError("当前账号状态异常，暂时无法绑定企业微信，请联系管理员。");
      } else {
        setError("保存企业微信绑定信息失败，请稍后重试");
      }
      setSaving(false);
      return;
    }
    const json = await res.json();
    const next = (json.wecomUserId as string | null) ?? "";
    setWecomUserId(next);
    setInitialWecomUserId(next);
    setSuccess(next ? "已更新企业微信绑定信息" : "已取消企业微信绑定");
    setSaving(false);
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">
        正在加载个人资料...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">
        无法加载个人资料，请稍后重试。
      </div>
    );
  }

  const hasChanged = wecomUserId.trim() !== initialWecomUserId.trim();

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">个人资料</h1>
          <p className="mt-1 text-sm text-slate-500">
            查看和管理您的基础信息与企业微信绑定状态。
          </p>
        </div>
      </div>

      {error && (
        <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg">
          {success}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900 mb-2">基础信息</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-slate-500 mb-1">姓名</div>
            <div className="font-semibold text-slate-900">{user.name || "未设置"}</div>
          </div>
          <div>
            <div className="text-slate-500 mb-1">邮箱</div>
            <div className="font-mono text-slate-900 break-all">{user.email}</div>
          </div>
          <div>
            <div className="text-slate-500 mb-1">所属部门</div>
            <div className="text-slate-900">{user.departmentName || "未分配部门"}</div>
          </div>
          <div>
            <div className="text-slate-500 mb-1">账号状态</div>
            <div className="text-slate-900">
              {user.status === "active" && "已激活"}
              {user.status === "pending" && "待审核"}
              {user.status === "disabled" && "已停用"}
            </div>
          </div>
          <div>
            <div className="text-slate-500 mb-1">角色</div>
            <div className="text-slate-900">{user.role || "普通用户"}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">企业微信绑定</h2>
            <p className="mt-1 text-xs text-slate-500">
              绑定企业微信后，可以在后续版本中接收需求、评分和 AI 报告相关通知。
            </p>
          </div>
        </div>

        <div className="space-y-3 mt-2">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">企微用户 ID</label>
            <input
              type="text"
              value={wecomUserId}
              onChange={(e) => {
                setWecomUserId(e.target.value);
                setError(null);
                setSuccess(null);
              }}
              placeholder="如需手动绑定，可填写企业微信后台中的用户ID"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">
              推荐通过下方「扫码绑定企微」自动获取并绑定企业微信账号；如确有需要，也支持在内部确认后手动录入企微用户 ID。
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={async () => {
                setError(null);
                setSuccess(null);
                const res = await authorizedFetch("/api/wecom/oauth-url");
                if (!res.ok) {
                  const text = await res.text();
                  console.error("[profile] get wecom oauth url error", text);
                  setError("无法发起企微扫码绑定，请稍后重试或联系管理员。");
                  return;
                }
                const json = await res.json();
                const url = (json as any).url as string | undefined;
                if (!url) {
                  setError("企微扫码绑定配置异常，请联系管理员检查企微相关配置。");
                  return;
                }
                window.location.href = url;
              }}
              disabled={saving}
              className="px-4 py-2 text-xs font-bold text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              扫码绑定企微
            </button>
            {initialWecomUserId && (
              <button
                type="button"
                onClick={() => {
                  setWecomUserId("");
                  setError(null);
                  setSuccess(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 rounded-xl hover:bg-slate-100"
              >
                清空
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveWecom}
              disabled={saving || !hasChanged}
              className="px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "保存中..." : "保存绑定"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
