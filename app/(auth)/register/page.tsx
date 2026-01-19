"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Mail, Lock, User, Building2, CheckCircle2 } from 'lucide-react';
import { Department } from '../../../types';
import { getSupabaseClient } from '../../../lib/supabase';

export default function RegisterPage() {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRegistrationAllowed, setIsRegistrationAllowed] = useState(false);
  const [isFlagLoaded, setIsFlagLoaded] = useState(false);
  const [systemName, setSystemName] = useState('');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings/global');
        if (!res.ok) {
          console.error('load global settings in register error', await res.text());
          setIsRegistrationAllowed(false);
          setIsFlagLoaded(true);
          return;
        }
        const json = await res.json();
        setIsRegistrationAllowed(!!json.registrationEnabled);
        if (typeof json.systemName === 'string' && json.systemName.trim()) {
          setSystemName(json.systemName.trim());
        }
      } catch (e) {
        console.error('load global settings in register error', e);
        setIsRegistrationAllowed(false);
      } finally {
        setIsFlagLoaded(true);
      }
    };

    loadSettings();
  }, []);

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const res = await fetch('/api/departments');
        if (!res.ok) {
          console.error('load departments error', await res.text());
          return;
        }
        const json = await res.json();
        const items = (json.items || []) as { id: number; name: string; slug: string | null }[];
        const mapped: Department[] = items.map((d) => ({
          id: String(d.id),
          name: d.name,
          slug: d.slug || '',
        }));
        setDepartments(mapped);
      } catch (e) {
        console.error('load departments error', e);
      }
    };

    loadDepartments();
  }, []);

  useEffect(() => {
    if (!isFlagLoaded) {
      document.title = '正在加载配置 - 注册';
      return;
    }

    if (!isRegistrationAllowed) {
      document.title = `${systemName} - 注册已关闭`;
      return;
    }

    if (submitted) {
      document.title = `${systemName} - 注册申请已提交`;
      return;
    }

    document.title = `${systemName} - 注册`;
  }, [systemName, submitted, isRegistrationAllowed, isFlagLoaded]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) {
      return;
    }
    if (!isRegistrationAllowed) {
      setErrorMessage('当前系统已关闭开放注册，如需开通账号请联系管理员。');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error || !data?.user) {
        setErrorMessage(error?.message || '注册失败，请稍后重试');
        setIsSubmitting(false);
        return;
      }

      try {
        const body: any = {
          email: data.user.email,
          name: fullName,
          authUserId: data.user.id,
        };
        const deptIdValue = departmentId.trim();
        if (deptIdValue) {
          body.departmentId = Number(deptIdValue);
        }
        await fetch('/api/auth/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch (syncError) {
        console.error('sync user after register error', syncError);
      }

      setSubmitted(true);
    } catch (err) {
      console.error('register error', err);
      setErrorMessage('注册过程中出现异常，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isFlagLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-slate-400 text-sm">
        正在加载配置...
      </div>
    );
  }

  if (!isRegistrationAllowed) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 text-center border border-slate-200">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-5 text-slate-500">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">已关闭开放注册</h2>
          <p className="text-slate-500 mb-6 text-sm leading-relaxed">
            当前系统已关闭自助注册功能，如需开通账号，请联系系统管理员由其在“用户管理”中为您创建账号或下发邀请。
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors"
          >
            返回登录
          </Link>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 text-center">
           <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
             <CheckCircle2 className="w-10 h-10" />
           </div>
           <h2 className="text-2xl font-bold text-slate-900 mb-3">注册申请已提交</h2>
           <p className="text-slate-500 mb-8">
             您的账号申请已发送至管理员。审核通过后，我们将通过邮件通知您。
           </p>
           <Link href="/login" className="block w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold transition-colors">
             返回登录页
           </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-3xl shadow-xl overflow-hidden p-8 md:p-12">
         <div className="flex items-center gap-2 text-slate-900 mb-8 justify-center">
            <img
              src="/favicon.png"
              alt="System icon"
              className="w-6 h-6 rounded-lg"
            />
            <span className="font-bold text-xl">{systemName}</span>
         </div>

         <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">注册新账号</h2>
         <p className="text-slate-500 mb-10 text-center">加入 {systemName}，开启高效协作之旅</p>

         {errorMessage && (
           <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm text-center">
             {errorMessage}
           </div>
         )}

         <form onSubmit={handleSubmit} className="space-y-5">
           <div className="space-y-2">
             <label className="text-sm font-bold text-slate-700">真实姓名</label>
             <div className="relative">
               <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
               <input
                 type="text"
                 required
                 value={fullName}
                 onChange={(e) => setFullName(e.target.value)}
                 className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                 placeholder="张三"
               />
             </div>
           </div>

           <div className="space-y-2">
             <label className="text-sm font-bold text-slate-700">企业邮箱</label>
             <div className="relative">
               <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
               <input
                 type="email"
                 required
                 value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                 placeholder="name@company.com"
               />
             </div>
           </div>

           <div className="space-y-2">
             <label className="text-sm font-bold text-slate-700">所属部门</label>
             <div className="relative">
               <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
               <select
                 required
                 value={departmentId}
                 onChange={(e) => setDepartmentId(e.target.value)}
                 className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
               >
                 <option value="">请选择部门</option>
                 {departments.map((d) => (
                   <option key={d.id} value={d.id}>
                     {d.name}
                   </option>
                 ))}
               </select>
             </div>
           </div>

           <div className="space-y-2">
             <label className="text-sm font-bold text-slate-700">密码</label>
             <div className="relative">
               <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
               <input
                 type="password"
                 required
                 value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                 placeholder="••••••••"
               />
             </div>
           </div>

           <button 
             type="submit"
             disabled={isSubmitting}
             className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold text-base shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
           >
             {isSubmitting ? '提交中...' : (
               <>提交申请 <ArrowRight className="w-5 h-5" /></>
             )}
           </button>
         </form>

         <p className="mt-8 text-center text-slate-500 text-sm">
           已有账号? <Link href="/login" className="text-blue-600 font-bold hover:underline">直接登录</Link>
         </p>
      </div>
    </div>
  );
}