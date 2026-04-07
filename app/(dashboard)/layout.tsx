"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import { getSupabaseClient } from "../../lib/supabase";
import { hasPermission, type PermissionKey } from "../../lib/permissions";
import { clearClientBusinessUserCache, loadClientBusinessUser } from "../../lib/clientBusinessUser";

type UserStatus = "pending" | "active" | "disabled";

interface CurrentUser {
  id: number;
  email: string;
  name: string | null;
  department_id: number | null;
  departmentName?: string | null;
  status: UserStatus;
  role: string;
  permissions?: PermissionKey[];
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [accountStatusMessage, setAccountStatusMessage] = useState<string | null>(null);
  const [systemName, setSystemName] = useState("");
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch("/api/settings/global");
        if (!res.ok) {
          console.error("load global settings in dashboard layout error", await res.text());
          return;
        }
        const json = await res.json();
        if (typeof json.systemName === "string" && json.systemName.trim()) {
          setSystemName(json.systemName.trim());
        }
      } catch (e) {
        console.error("load global settings in dashboard layout error", e);
      }
    };

    loadSettings();
  }, []);

  useEffect(() => {
    const checkAuthAndUser = async () => {
      try {
        const businessUser = await loadClientBusinessUser();

        if (!businessUser) {
          const supabase = getSupabaseClient();
          const { data, error } = await supabase.auth.getUser();
          if (error || !data?.user) {
            router.push("/login");
            return;
          }

          setAccountStatusMessage("无法加载当前用户信息，请稍后重试或联系管理员。");
          setIsLoading(false);
          return;
        }

        const nextUser: CurrentUser = {
          id: businessUser.id || 0,
          email: businessUser.email || "",
          name: businessUser.name ?? null,
          department_id: businessUser.departmentId ?? null,
          departmentName: businessUser.departmentName ?? null,
          status: (businessUser.status as UserStatus | undefined) ?? "pending",
          role: businessUser.role || "user",
          permissions: Array.isArray(businessUser.permissions)
            ? (businessUser.permissions as PermissionKey[])
            : undefined,
        };

        setCurrentUser(nextUser);

        if (nextUser.status === "pending") {
          setAccountStatusMessage("您的账号正在审核中，审核通过后即可访问系统各业务页面。");
          setIsLoading(false);
          return;
        }

        if (nextUser.status === "disabled") {
          setAccountStatusMessage("您的账号已被停用，如有疑问请联系管理员。");
          setIsLoading(false);
          return;
        }

        setIsLoading(false);
      } catch (err) {
        router.push("/login");
      }
    };

    checkAuthAndUser();
  }, [router]);

  useEffect(() => {
    if (!systemName) {
      return;
    }

    let pageLabel = "";
    if (!pathname || pathname === "/") {
      pageLabel = "工作台";
    } else if (pathname.startsWith("/demands")) {
      pageLabel = "需求管理";
    } else if (pathname.startsWith("/scoring")) {
      pageLabel = "评分管理";
    } else if (pathname.startsWith("/statistics")) {
      pageLabel = "数据统计";
    } else if (pathname.startsWith("/reports")) {
      pageLabel = "报告中心";
    } else if (pathname.startsWith("/settings")) {
      pageLabel = "系统设置";
    }

    document.title = pageLabel ? `${systemName} - ${pageLabel}` : systemName;
  }, [systemName, pathname]);

  const handleLogout = async () => {
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
      clearClientBusinessUserCache();
    } catch (error) {
      console.error("logout error", error);
    } finally {
      router.push("/login");
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">Loading...</div>;
  }

  if (accountStatusMessage) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">账号暂不可用</h1>
          <p className="text-slate-600 text-sm md:text-base leading-relaxed">{accountStatusMessage}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors"
          >
            返回登录
          </button>
        </div>
      </div>
    );
  }

  const isSettingsPage = pathname === "/settings" || (!!pathname && pathname.startsWith("/settings"));
  const isStatisticsPage = pathname === "/statistics" || (!!pathname && pathname.startsWith("/statistics"));

  const canAccessSettings = (() => {
    if (!currentUser || currentUser.status !== "active") {
      return false;
    }

    const keys: PermissionKey[] = [
      "settings.access_shell",
      "settings.global.view",
      "settings.global.manage",
      "settings.departments.view",
      "settings.departments.manage",
      "settings.fields.view",
      "settings.fields.manage",
      "settings.scoring.view",
      "settings.scoring.manage",
      "settings.score_periods.view",
      "settings.score_periods.manage",
      "settings.roles.view",
      "settings.roles.manage",
      "settings.webhooks.view",
      "settings.webhooks.manage",
      "settings.wecom.view",
      "settings.wecom.manage",
      "admin.user_manage",
    ];

    return keys.some((key) => hasPermission(currentUser.role, key, currentUser.permissions));
  })();

  const canAccessStatistics =
    !!currentUser &&
    currentUser.status === "active" &&
    hasPermission(currentUser.role, "stats.view", currentUser.permissions);

  if (isStatisticsPage && !canAccessStatistics) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">无权访问</h1>
          <p className="text-slate-600 text-sm md:text-base leading-relaxed">
            您当前账号未被授予统计报表访问权限，如需开通请联系管理员。
          </p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-2 inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors"
          >
            返回工作台
          </button>
        </div>
      </div>
    );
  }

  if (isSettingsPage && !canAccessSettings) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">无权访问</h1>
          <p className="text-slate-600 text-sm md:text-base leading-relaxed">
            您当前账号未被授予系统设置访问权限，如需开通请联系管理员。
          </p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-2 inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors"
          >
            返回工作台
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setSidebarOpen(false)}
        canAccessSettings={canAccessSettings}
        canAccessStatistics={canAccessStatistics}
      />

      <div className="flex-1 flex flex-col w-full md:pl-64 transition-all duration-300">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          currentUser={
            currentUser
              ? {
                  id: currentUser.id,
                  name: currentUser.name,
                  email: currentUser.email,
                  role: currentUser.role,
                  status: currentUser.status,
                  departmentName: currentUser.departmentName ?? null,
                  permissions: currentUser.permissions,
                }
              : undefined
          }
        />
        <main className="flex-1 mt-16 p-4 md:p-8 overflow-y-auto overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
