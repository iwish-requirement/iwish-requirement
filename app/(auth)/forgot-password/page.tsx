"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2, Mail } from 'lucide-react';
import { getSupabaseClient } from '../../../lib/supabase';
import {
  getPasswordRecoveryRedirectUrl,
  normalizeRecoveryEmail,
} from '../../../lib/passwordRecovery';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.resetPasswordForEmail(
        normalizeRecoveryEmail(email),
        {
          redirectTo: getPasswordRecoveryRedirectUrl(window.location.origin),
        },
      );

      if (error) {
        setErrorMessage('暂时无法发送重置邮件，请稍后重试');
        return;
      }

      setIsSubmitted(true);
    } catch (error) {
      console.error('send password recovery email error', error);
      setErrorMessage('暂时无法发送重置邮件，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 md:p-10 text-center border border-slate-100">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5 text-green-600">
            <CheckCircle2 className="w-8 h-8" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">请检查邮箱</h1>
          <p className="text-slate-500 text-sm leading-relaxed mb-7">
            如果该邮箱已注册，你会收到一封密码重置邮件。请通过邮件中的链接设置新密码。
          </p>
          <button
            type="button"
            onClick={() => setIsSubmitted(false)}
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-colors mb-3"
          >
            重新发送
          </button>
          <Link href="/login" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700">
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            返回登录
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 md:p-10 border border-slate-100">
        <div className="flex items-center gap-2 text-slate-900 mb-8 justify-center">
          <img src="/favicon.png" alt="System icon" className="w-7 h-7 rounded-lg" />
          <span className="font-bold text-xl">找回密码</span>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2 text-center">忘记密码?</h1>
        <p className="text-slate-500 mb-8 text-center text-sm">
          输入你的企业邮箱，我们会发送密码重置链接。
        </p>

        {errorMessage && (
          <div role="alert" className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="recovery-email" className="text-sm font-bold text-slate-700">企业邮箱</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" aria-hidden="true" />
              <input
                id="recovery-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="name@company.com"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? '发送中...' : (
              <>发送重置邮件 <ArrowRight className="w-5 h-5" aria-hidden="true" /></>
            )}
          </button>
        </form>

        <div className="mt-7 text-center">
          <Link href="/login" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700">
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            返回登录
          </Link>
        </div>
      </div>
    </main>
  );
}
