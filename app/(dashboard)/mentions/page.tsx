"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { getSupabaseClient } from '../../../lib/supabase';

interface MentionItem {
  id: number;
  content: string;
  createdAt: string;
  authorLabel: string;
  demandCode: string;
  demandTitle: string;
  parentId?: number | null;
  replyToCommentId?: number | null;
}

export default function MentionsPage() {
  const router = useRouter();
  const [items, setItems] = useState<MentionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMentions = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase.auth.getUser();
        const email = data?.user?.email || '';
        if (!email) {
          setError('当前用户信息获取失败，请重新登录后再试');
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/mentions?userEmail=${encodeURIComponent(email)}`);
        if (!res.ok) {
          const text = await res.text();
          console.error('load mentions error', text);
          setError('加载 @ 我的评论失败，请稍后重试');
          setLoading(false);
          return;
        }

        const json = await res.json();
        setItems((json.items || []) as MentionItem[]);
      } catch (e) {
        console.error('load mentions error', e);
        setError('加载 @ 我的评论失败，请检查网络后重试');
      } finally {
        setLoading(false);
      }
    };

    loadMentions();
  }, []);

  const handleBack = () => {
    router.push('/demands');
  };

  const handleOpenMention = (item: MentionItem) => {
    if (!item.demandCode) {
      return;
    }
    router.push(`/demands/${item.demandCode}#comment-${item.id}`);
  };

  return (
    <div className="max-w-5xl mx-auto pb-10 animate-fadeIn">
      <button
        onClick={handleBack}
        className="flex items-center text-slate-500 hover:text-slate-800 mb-6 font-medium transition-colors"
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        返回需求列表
      </button>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              与我相关的 @ 通知
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              聚合所有在评论和回复中 @ 到你的内容，点击可跳转到对应需求。
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-xs text-slate-400">加载中...</div>
        ) : items.length === 0 ? (
          <div className="text-xs text-slate-400">当前还没有人 @ 你，稍后再来看看。</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleOpenMention(item)}
                className="w-full text-left py-3 flex flex-col gap-1 hover:bg-slate-50 px-2 rounded-lg transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium text-[11px]">
                      {item.demandCode || '未知需求'}
                    </span>
                    <span className="text-slate-700 truncate max-w-[220px] md:max-w-[360px]">
                      {item.demandTitle || '未找到需求标题'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">
                    {item.createdAt || ''}
                  </span>
                </div>
                <div className="text-xs text-slate-600 line-clamp-2 mt-0.5">
                  <span className="font-semibold text-slate-800 mr-1">{item.authorLabel}：</span>
                  <span>{item.content}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
