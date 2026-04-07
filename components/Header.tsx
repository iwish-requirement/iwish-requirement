"use client";

import React, { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Search, Menu, ChevronDown, User, LogOut, Settings, Shield } from 'lucide-react';
import { getSupabaseClient } from '../lib/supabase';
import { hasPermission, type PermissionKey } from '../lib/permissions';
import {
  clearClientBusinessUserCache,
  loadClientBusinessUser,
} from '../lib/clientBusinessUser';

interface HeaderUserInfo {
  id?: number;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  status?: string | null;
  departmentName?: string | null;
  permissions?: PermissionKey[];
}

interface HeaderProps {
  onMenuClick: () => void;
  currentUser?: HeaderUserInfo;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, currentUser }) => {
  const mentionsCacheKey = 'mentions:unread-cache';
  const router = useRouter();
  const pathname = usePathname();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [hasUnreadMentions, setHasUnreadMentions] = useState(false);
  const [businessUser, setBusinessUser] = useState<HeaderUserInfo | null>(currentUser || null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    clearClientBusinessUserCache();
    router.push('/login');
  };

  const handleOpenMentions = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('mentions:lastSeenAt', new Date().toISOString());
    }
    setHasUnreadMentions(false);
    router.push('/mentions');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (currentUser?.id && currentUser?.departmentName && Array.isArray(currentUser.permissions)) {
      setBusinessUser(currentUser);
      return;
    }

    const syncBusinessUser = async () => {
      try {
        const user = await loadClientBusinessUser();
        if (!user) {
          return;
        }
        setBusinessUser({
          id: user.id,
          email: user.email ?? null,
          name: user.name ?? user.email ?? null,
          role: user.role ?? 'user',
          status: user.status ?? 'pending',
          departmentName: user.departmentName ?? null,
          permissions: Array.isArray(user.permissions) ? (user.permissions as PermissionKey[]) : undefined,
        });
      } catch (e) {
        console.error('auth sync error', e);
      }
    };

    syncBusinessUser();
  }, [currentUser]);

  useEffect(() => {
    const loadUnreadMentions = async () => {
      try {
        const storage = typeof globalThis !== 'undefined' ? globalThis.sessionStorage : null;

        if (storage) {
          const cachedRaw = storage.getItem(mentionsCacheKey);
          if (cachedRaw) {
            const cached = JSON.parse(cachedRaw) as { value: boolean; ts: number };
            if (cached && typeof cached.ts === 'number' && Date.now() - cached.ts < 60 * 1000) {
              setHasUnreadMentions(!!cached.value);
              return;
            }
          }
        }

        const supabase = getSupabaseClient();
        const { data } = await supabase.auth.getUser();
        const email = data?.user?.email || '';
        if (!email) return;

        const res = await fetch(`/api/mentions?userEmail=${encodeURIComponent(email)}`);
        if (!res.ok) {
          return;
        }
        const json = await res.json();
        const items = (json.items || []) as { createdAt?: string }[];
        if (!items.length) {
          setHasUnreadMentions(false);
          if (storage) {
            storage.setItem(
              mentionsCacheKey,
              JSON.stringify({ value: false, ts: Date.now() }),
            );
          }
          return;
        }

        if (typeof window === 'undefined') {
          setHasUnreadMentions(true);
          if (storage) {
            storage.setItem(
              mentionsCacheKey,
              JSON.stringify({ value: true, ts: Date.now() }),
            );
          }
          return;
        }

        const lastSeenRaw = window.localStorage.getItem('mentions:lastSeenAt');
        if (!lastSeenRaw) {
          setHasUnreadMentions(true);
          if (storage) {
            storage.setItem(
              mentionsCacheKey,
              JSON.stringify({ value: true, ts: Date.now() }),
            );
          }
          return;
        }
        const lastSeen = new Date(lastSeenRaw);
        if (Number.isNaN(lastSeen.getTime())) {
          setHasUnreadMentions(true);
          return;
        }

        const hasNew = items.some((item) => {
          const createdAtStr = item.createdAt || '';
          if (!createdAtStr) return false;
          const d = new Date(createdAtStr.replace(' ', 'T') + 'Z');
          if (Number.isNaN(d.getTime())) return false;
          return d > lastSeen;
        });
        setHasUnreadMentions(hasNew);
        if (storage) {
          storage.setItem(
            mentionsCacheKey,
            JSON.stringify({ value: hasNew, ts: Date.now() }),
          );
        }
      } catch (e) {
        console.error('load unread mentions error', e);
      }
    };

    loadUnreadMentions();
  }, [pathname]);

  const effectiveUser: HeaderUserInfo | undefined = businessUser || currentUser;
  const displayName = effectiveUser?.name || effectiveUser?.email || '未命名用户';
  const displayRoleKey = (effectiveUser?.role || 'user').toLowerCase();

  let displayRoleLabel = '普通用户';
  if (displayRoleKey === 'admin') {
    displayRoleLabel = '管理员';
  } else if (displayRoleKey === 'dept-admin' || displayRoleKey === 'manager') {
    displayRoleLabel = '部门管理员';
  } else if (displayRoleKey === 'viewer') {
    displayRoleLabel = '只读用户';
  }

  const canAccessSettings = (() => {
    const keys: PermissionKey[] = [
      'settings.access_shell',
      'settings.global.view',
      'settings.global.manage',
      'settings.departments.view',
      'settings.departments.manage',
      'settings.fields.view',
      'settings.fields.manage',
      'settings.scoring.view',
      'settings.scoring.manage',
      'settings.score_periods.view',
      'settings.score_periods.manage',
      'settings.roles.view',
      'settings.roles.manage',
      'settings.webhooks.view',
      'settings.webhooks.manage',
      'settings.wecom.view',
      'settings.wecom.manage',
      'admin.user_manage',
    ];

    return keys.some((key) =>
      hasPermission(effectiveUser?.role || null, key, effectiveUser?.permissions),
    );
  })();
  const canManageUsersAndRoles = hasPermission(
    effectiveUser?.role || null,
    'admin.user_manage',
    effectiveUser?.permissions,
  );

  const departmentLabel = effectiveUser?.departmentName || '部门未配置';
  const avatarText = displayName.trim().charAt(0).toUpperCase() || 'U';

  return (
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 md:px-8 fixed top-0 right-0 left-0 md:left-64 z-30 transition-all duration-300">
      <div className="flex items-center gap-4 w-full md:w-auto">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div className="relative w-full max-w-xs hidden md:block">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="搜索需求、员工或部门..."
            className="w-full pl-10 pr-4 py-2.5 text-base bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
        <button className="md:hidden p-2 text-slate-600">
          <Search className="w-6 h-6" />
        </button>
      </div>

      <div className="flex items-center gap-3 md:gap-6">
        <button
          className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
          onClick={handleOpenMentions}
        >
          <Bell className="w-6 h-6" />
          {hasUnreadMentions && (
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
          )}
        </button>

        <div className="flex items-center gap-3 pl-3 md:pl-6 md:border-l border-slate-200 relative" ref={dropdownRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-3 hover:bg-slate-50 p-1.5 pr-3 rounded-full transition-all border border-transparent hover:border-slate-100"
          >
            <div className="text-right hidden md:block">
              <div className="text-sm font-bold text-slate-800">{displayName}</div>
              <div className="text-xs text-slate-500">{departmentLabel} · {displayRoleLabel}</div>
            </div>
            <div className="w-10 h-10 rounded-full border border-slate-200 shadow-sm bg-slate-900 text-white flex items-center justify-center text-sm font-bold">
              {avatarText}
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 hidden md:block ${isProfileOpen ? 'rotate-180' : ''}`} />
          </button>

          {isProfileOpen && (
            <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right z-50">
              <div className="p-4 border-b border-slate-50 md:hidden">
                <div className="font-bold text-slate-900">{displayName}</div>
                <div className="text-sm text-slate-500">{displayRoleLabel}</div>
              </div>
              <div className="p-2">
                <button
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  onClick={() => {
                    setIsProfileOpen(false);
                    router.push('/profile');
                  }}
                >
                  <User className="w-4 h-4 text-slate-400" /> 个人资料
                </button>
                {canAccessSettings && (
                  <button
                    onClick={() => { setIsProfileOpen(false); router.push('/settings'); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-slate-400" /> 系统设置
                  </button>
                )}
                {canManageUsersAndRoles && (
                  <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
                    <Shield className="w-4 h-4 text-slate-400" /> 权限管理
                  </button>
                )}
              </div>
              <div className="p-2 border-t border-slate-50">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" /> 退出登录
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
