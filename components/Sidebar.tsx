"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  ListTodo, 
  BarChart3, 
  ClipboardCheck, 
  Settings, 
  LogOut,
  Briefcase,
  X
} from 'lucide-react';

interface SidebarProps {
  className?: string;
  isOpen?: boolean;
  onClose?: () => void;
  canAccessSettings?: boolean;
  canAccessStatistics?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ className, isOpen, onClose, canAccessSettings, canAccessStatistics }) => {
  const pathname = usePathname();

  const isActive = (path: string) => {
    // Ensure pathname exists before checking startsWith
    if (!pathname) return 'text-slate-400 hover:text-white hover:bg-slate-800';

    if (path === '/' && pathname !== '/') return 'text-slate-400 hover:text-white hover:bg-slate-800';
    return pathname === path || (path !== '/' && pathname.startsWith(path)) 
      ? 'bg-blue-600 text-white shadow-md' 
      : 'text-slate-400 hover:text-white hover:bg-slate-800';
  };

  const navItems = [
    { path: '/', label: '工作台', icon: LayoutDashboard },
    { path: '/demands', label: '需求管理', icon: ListTodo },
    { path: '/scoring', label: '评分管理', icon: ClipboardCheck },
    { path: '/statistics', label: '数据统计', icon: BarChart3 },
    { path: '/reports/monthly', label: '月度报告', icon: Briefcase },
    { path: '/settings', label: '系统设置', icon: Settings },
  ];

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('isAuthenticated');
      window.location.href = '/login';
    }
  };

  return (
    <>
      <aside 
        className={`fixed top-0 left-0 z-50 h-screen w-64 bg-slate-900 text-white transition-transform duration-300 ease-in-out shadow-xl flex flex-col
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
          md:translate-x-0 ${className}`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 shrink-0">
          <div className="flex items-center">
            <img
              src="/white-logo.png"
              alt="Company logo"
              className="h-8 w-auto"
            />
          </div>
          <button onClick={onClose} className="md:hidden text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 py-6 flex flex-col px-4 overflow-y-auto">
          <div className="flex flex-col gap-2">
            {navItems.map((item) => {
              if (item.path === '/settings' && canAccessSettings === false) {
                return null;
              }
              if (item.path === '/statistics' && canAccessStatistics === false) {
                return null;
              }

              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => onClose && onClose()}
                  className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 ${isActive(item.path)}`}
                >
                  <item.icon className="w-6 h-6" />
                  <span className="text-base font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="mt-auto pt-6">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-4 w-full px-4 py-3.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-slate-800/50 transition-colors"
            >
              <LogOut className="w-6 h-6" />
              <span className="text-base font-medium">退出登录</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;