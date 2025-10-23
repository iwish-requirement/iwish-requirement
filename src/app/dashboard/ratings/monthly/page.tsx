'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { ratingService } from '@/services/rating'
import RatingFormRenderer from '@/components/rating/RatingFormRenderer'
import type { RequesterMonthlySessionItem, RatingResponseInput } from '@/types/rating'
import { createSupabaseClient } from '@/lib/supabase'

export default function MonthlyRatingsPage() {
  const sb = useMemo(() => createSupabaseClient(), [])
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [cycleMonth, setCycleMonth] = useState<string>(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = `${now.getMonth() + 1}`.padStart(2, '0')
    return `${y}-${m}`
  })

  const [sessionItems, setSessionItems] = useState<RequesterMonthlySessionItem[]>([])
  const [selectedExecutorId, setSelectedExecutorId] = useState<string | null>(null)
  // 暂存不同执行人的填写（field_id -> value）
  const [drafts, setDrafts] = useState<Record<string, RatingResponseInput[]>>({})

  useEffect(() => {
    sb.auth.getUser().then(({ data }) => {
      if (data?.user?.id) setUserId(data.user.id)
    })
  }, [sb])

  useEffect(() => {
    if (!userId) return
    loadSession()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, cycleMonth])

  const loadSession = async () => {
    setLoading(true)
    try {
      const items = await ratingService.getRequesterMonthlySession({
        requesterId: userId!,
        cycleMonth,
      })
      setSessionItems(items)
      if (items.length > 0) {
        setSelectedExecutorId(items[0].executorId)
      } else {
        setSelectedExecutorId(null)
      }
      // 初始化回填到 drafts
      const init: Record<string, RatingResponseInput[]> = {}
      items.forEach(it => {
        if (it.responses?.length) {
          init[it.executorId] = it.responses.map(r => ({
            field_id: r.field_id,
            value_score: r.value_score ?? undefined,
            value_text: r.value_text ?? undefined,
          }))
        }
      })
      setDrafts(init)
    } catch (err: any) {
      toast.error(err?.message || '加载评分会话失败')
    } finally {
      setLoading(false)
    }
  }

  const itemsWithTemplate = sessionItems.filter(i => i.template)
  const itemsWithoutTemplate = sessionItems.filter(i => !i.template)

  const current = sessionItems.find(i => i.executorId === selectedExecutorId) || null
  const currentDraft = (selectedExecutorId && drafts[selectedExecutorId]) ? drafts[selectedExecutorId] : []

  const handleChangeDraft = (executorId: string, responses: RatingResponseInput[]) => {
    setDrafts(prev => ({ ...prev, [executorId]: responses }))
  }

  const submitOne = async (executorId: string) => {
    const item = sessionItems.find(i => i.executorId === executorId)
    if (!item || !item.template) {
      toast.error('该执行人未配置模板，无法提交')
      return
    }
    try {
      setLoading(true)
      await ratingService.submitRequesterMonthlySession({
        requesterId: userId!,
        cycleMonth,
        entries: [
          {
            executorId,
            templateId: item.template.id,
            responses: drafts[executorId] || [],
          }
        ]
      })
      toast.success('已提交')
      await loadSession()
    } catch (err: any) {
      toast.error(err?.message || '提交失败')
    } finally {
      setLoading(false)
    }
  }

  const submitAll = async () => {
    try {
      setLoading(true)
      // 仅提交有模板的执行人
      const entries = itemsWithTemplate.map(it => ({
        executorId: it.executorId,
        templateId: it.template!.id,
        responses: drafts[it.executorId] || [],
      }))
      if (entries.length === 0) {
        toast.message('无可提交项')
        return
      }
      await ratingService.submitRequesterMonthlySession({
        requesterId: userId!,
        cycleMonth,
        entries,
      })
      toast.success('批量提交成功')
      await loadSession()
    } catch (err: any) {
      toast.error(err?.message || '批量提交失败')
    } finally {
      setLoading(false)
    }
  }

  const prevMonth = () => {
    const [y, m] = cycleMonth.split('-').map(n => parseInt(n, 10))
    const d = new Date(y, (m - 1) - 1, 1)
    setCycleMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const nextMonth = () => {
    const [y, m] = cycleMonth.split('-').map(n => parseInt(n, 10))
    const d = new Date(y, (m - 1) + 1, 1)
    setCycleMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">本月评分</h1>
          <p className="text-muted-foreground">提交者按月对合作执行人进行综合评分（仅当月/上月）</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={prevMonth}>{'<'}</Button>
          <Input
            className="w-28"
            value={cycleMonth}
            onChange={(e) => setCycleMonth(e.target.value)}
            placeholder="YYYY-MM"
          />
          <Button variant="outline" onClick={nextMonth}>{'>'}</Button>
          <Button onClick={submitAll} disabled={loading || !userId}>全部提交</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>执行人列表</CardTitle>
            <CardDescription>
              合作执行人：{sessionItems.length}，可提交：{itemsWithTemplate.length}，缺模板：{itemsWithoutTemplate.length}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[70vh] overflow-y-auto">
            {loading && <div className="text-sm text-muted-foreground">加载中...</div>}
            {!loading && sessionItems.length === 0 && (
              <div className="text-sm text-muted-foreground">当月暂无需评分对象</div>
            )}

            {sessionItems.map(it => {
              const hasTemplate = !!it.template
              const done = (it.responses && it.responses.length) ? true : false
              return (
                <div
                  key={it.executorId}
                  onClick={() => setSelectedExecutorId(it.executorId)}
                  className={`p-3 rounded border cursor-pointer ${selectedExecutorId === it.executorId ? 'border-blue-500 bg-blue-50' : 'border-border'}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{it.executorName || (it.executorId.slice(0, 8) + '...')}</div>
                      {(it.executorTitle || it.executorPosition) && (
                        <div className="text-xs text-muted-foreground">
                          {(it.executorTitle || it.executorPosition) as string}
                        </div>
                      )}
                    </div>
                    <div className="text-xs">
                      {hasTemplate ? <span className="text-green-600">可评分</span> : <span className="text-orange-600">缺模板</span>}
                      <span className="mx-1">|</span>
                      {done ? <span className="text-emerald-600">已填写</span> : <span className="text-gray-500">未填写</span>}
                    </div>
                  </div>
                  {hasTemplate ? (
                    <div className="text-xs text-muted-foreground">
                      模板：{it.template!.name} v{it.template!.version}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">请联系管理员配置该岗位模板</div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>评分表单</CardTitle>
            <CardDescription>
              {current?.template ? `${current.template.name}（v${current.template.version}）` : '请选择执行人'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!current && <div className="text-sm text-muted-foreground">请选择左侧执行人</div>}

            {current && !current.template && (
              <div className="text-sm text-orange-600">该执行人缺少模板，无法评分</div>
            )}

            {current && current.template && (
              <>
                {(() => {
                  const renderResponses = (currentDraft && currentDraft.length > 0)
                    ? (currentDraft as any)
                    : (current.responses as any)
                  return (
                    <RatingFormRenderer
                      template={current.template}
                      responses={renderResponses}
                      onChange={(resps) => handleChangeDraft(current.executorId, resps)}
                    />
                  )
                })()}

                {/* 提交回执摘要 */}
                {(() => {
                  const resps = (current?.responses as any[]) || []
                  const scores = resps.filter(r => typeof r?.value_score === 'number')
                  const texts = resps.filter(r => {
                    const t = r?.value_text
                    return t && String(t).trim().length > 0
                  })
                  const sample = scores.length
                  const sum = scores.reduce((a, b) => a + (b?.value_score || 0), 0)
                  const avg = sample > 0 ? Number((sum / sample).toFixed(1)) : null
                  const lastSubmitted = (current?.instance as any)?.submitted_at
                  const lastText = texts.length > 0 ? texts[texts.length - 1]?.value_text : null

                  if (!lastSubmitted && sample === 0 && texts.length === 0) return null

                  return (
                    <div className="rounded border p-3 bg-gray-50">
                      <div className="text-sm text-gray-700">
                        最近提交时间：{lastSubmitted ? new Date(lastSubmitted).toLocaleString() : '—'}
                      </div>
                      <div className="text-sm text-gray-700 mt-1">
                        评分摘要：{sample > 0 ? `样本 ${sample}，均分 ${avg}` : '暂无数值评分'}
                      </div>
                      <div className="text-sm text-gray-700 mt-1">
                        文本反馈：{texts.length > 0 ? `共 ${texts.length} 条` : '暂无'}
                      </div>
                      {lastText && (
                        <div className="text-xs text-gray-600 mt-1">
                          最近反馈：{String(lastText).slice(0, 120)}
                        </div>
                      )}
                    </div>
                  )
                })()}

                <Separator className="my-2" />
                <div className="flex justify-end">
                  <Button onClick={() => submitOne(current.executorId)} disabled={loading || !userId}>
                    提交当前执行人
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}