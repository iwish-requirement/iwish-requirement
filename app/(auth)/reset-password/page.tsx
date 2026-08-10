"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Lock } from 'lucide-react';
import { getSupabaseClient } from '../../../lib/supabase';
import { MIN_PASSWORD_LENGTH, validateNewPassword } from '../../../lib/passwordRecovery';

type RecoveryStatus = 'checking' | 'ready' | 'invalid' | 'success';

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<RecoveryStatus>('checking');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    let isActive = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isActive) {
        return;
      }

      if (event === 'PASSWORD_RECOVERY' || session) {
        setStatus('ready');
      } else if (event === 'SIGNED_OUT') {
        setStatus('invalid');
      }
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!isActive) {
        return;
      }

      if (error || !data.session) {
        setStatus('invalid');
        return;
      }

      setStatus('ready');
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateNewPassword(password, passwordConfirmation);

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setErrorMessage('密码更新失败，重置链接可能已过期，请重新申请');
        return;
      }

      await supabase.auth.signOut();
      setStatus('success');
    } catch (error) {
      console.error('reset password error', error);
      setErrorMessage('密码更新失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === 'checking') {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-slate-500 text-sm">
        正在验证重置链接...
      </main>
    );
  }

  if (status === 'invalid') {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 md:p-10 text-center border border-slate-100">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-5 text-amber-600">
            <Lock className="w-8 h-8" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">重置链接无效</h1>
          <p className="text-slate-500 text-sm leading-relaxed mb-7">
            该链接可能已过期或已被使用，请重新申请密码重置邮件。
          </p>
          <Link href="/forgot-password" className="block w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-colors">
            重新申请
          </Link>
        </div>
      </main>
    );
  }

  if (status === 'success') {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 md:p-10 text-center border border-slate-100">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5 text-green-600">
            <CheckCircle2 className="w-8 h-8" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">密码已更新</h1>
          <p className="text-slate-500 text-sm leading-relaxed mb-7">
            请使用新密码重新登录。
          </p>
          <Link href="/login" className="block w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-colors">
            返回登录
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 md:p-10 border border-slate-100">
        <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-5 text-blue-600">
          <Lock className="w-7 h-7" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2 text-center">设置新密码</h1>
        <p className="text-slate-500 mb-8 text-center text-sm">
          新密码至少需要 {MIN_PASSWORD_LENGTH} 个字符。
        </p>

        {errorMessage && (
          <div role="alert" className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="new-password" className="text-sm font-bold text-slate-700">新密码</label>
            <input
              id="new-password"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm-password" className="text-sm font-bold text-slate-700">确认新密码</label>
            <input
              id="confirm-password"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? '更新中...' : '更新密码'}
          </button>
        </form>
      </div>
    </main>
  );
}
