"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Mail, Lock } from 'lucide-react';
import { getSupabaseClient } from '../../../lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [systemName, setSystemName] = useState('');



  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings/global');
        if (!res.ok) {
          console.error('load global settings in login error', await res.text());
          return;
        }
        const json = await res.json();
        if (typeof json.systemName === 'string' && json.systemName.trim()) {
          setSystemName(json.systemName.trim());
        }
      } catch (e) {
        console.error('load global settings in login error', e);
      }
    };

    loadSettings();

    // 处理 URL 参数中的提示信息
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const message = params.get("message");
      
      if (message === "wecom_auth_expired") {
        setErrorMessage("企微绑定会话已过期，请重新登录后再进行绑定");
      }
    }
  }, []);

  useEffect(() => {
    if (!systemName) {
      return;
    }
    document.title = `${systemName} - 登录`;
  }, [systemName]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data?.user) {
        setErrorMessage(error?.message || '登录失败，请检查邮箱和密码');
        setIsLoading(false);
        return;
      }

      // 登录成功后，同步到业务 users 表（按邮箱 + Auth 用户 ID）
      try {
        await fetch('/api/auth/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: data.user.email,
            name: data.user.user_metadata?.full_name,
            authUserId: data.user.id,
          }),
        });
      } catch (syncError) {
        console.error('sync user error', syncError);
      }

      // 检查是否有重定向参数
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const redirect = params.get("redirect");
        if (redirect && redirect.startsWith("/")) {
          router.push(redirect);
          return;
        }
      }

      router.push('/');
    } catch (err) {
      setErrorMessage('登录过程出现异常，请稍后重试');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden flex">
        <div className="hidden md:flex w-1/2 bg-slate-900 p-12 flex-col relative overflow-hidden">
           <div className="relative z-10 flex-1 flex flex-col justify-center">
             <div className="flex items-center gap-4 text-white mb-8">
                <img
                  src="/white-logo.png"
                  alt="System logo"
                  className="w-auto h-auto"
                />
             </div>
             <h1 className="text-4xl font-bold text-white mb-6 leading-tight">
             {systemName}
           </h1>

           </div>
           <div className="relative z-10 text-sm text-slate-600 mt-6">
             &copy; 2023 Nexus Corp. All rights reserved.
           </div>

           <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-blue-600 rounded-full blur-[100px] opacity-20"></div>
           <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-60 h-60 bg-purple-600 rounded-full blur-[80px] opacity-20"></div>
        </div>

        <div className="w-full md:w-1/2 p-8 md:p-16 flex flex-col justify-center">
           <div className="md:hidden flex items-center gap-2 text-slate-900 mb-8">
              <img
                src="/favicon.png"
                alt="System icon"
                className="w-6 h-6 rounded-lg"
              />
              <span className="font-bold text-xl">{systemName}</span>
           </div>

           <h2 className="text-2xl font-bold text-slate-900 mb-2">欢迎回来</h2>
           <p className="text-slate-500 mb-10">请输入您的账号信息以继续访问</p>

           {errorMessage && (
             <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm">
               {errorMessage}
             </div>
           )}

           <form onSubmit={handleLogin} className="space-y-6">
             <div className="space-y-2">
               <label className="text-sm font-bold text-slate-700">企业邮箱</label>
               <div className="relative">
                 <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                 <input 
                   type="email" 
                   required
                   value={email}
                   onChange={(e) => setEmail(e.target.value)}
                   className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                   placeholder="name@company.com"
                 />
               </div>
             </div>

             <div className="space-y-2">
               <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-slate-700">密码</label>
                  <a href="#" className="text-xs font-medium text-blue-600 hover:underline">忘记密码?</a>
               </div>
               <div className="relative">
                 <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                 <input 
                   type="password" 
                   required
                   value={password}
                   onChange={(e) => setPassword(e.target.value)}
                   className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                   placeholder="••••••••"
                 />
               </div>
             </div>

             <button 
               type="submit"
               disabled={isLoading}
               className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold text-base shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
             >
               {isLoading ? '登录中...' : (
                 <>登录 <ArrowRight className="w-5 h-5" /></>
               )}
             </button>
           </form>

           <p className="mt-8 text-center text-slate-500 text-sm">
             还没有账号? <Link href="/register" className="text-blue-600 font-bold hover:underline">立即注册</Link>
           </p>
        </div>
      </div>
    </div>
  );
}