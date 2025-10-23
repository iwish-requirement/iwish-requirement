'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

import { listExecutorsOverview, getCurrentCycleMonth, getPreviousCycleMonth } from '@/services/ratingExtras'
import { departmentPositionService } from '@/services/departmentPosition'

export default function RatingsStatsPage() {
  const [cycleMonth, setCycleMonth] = useState<string | 'all'>(getCurrentCycleMonth())
  const [department, setDepartment] = useState<string | undefined>(undefined)
  const [position, setPosition] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Array<{
    executorId: string; overall_avg: number; rater_count: number; sample_size: number;
    executorName?: string; positionName?: string; lastSubmitted?: string | null;
  }>>([])

  // 部门/岗位下拉选项（中文显示，值为 code）
  const [deptOptions, setDeptOptions] = useState<Array<{ code: string; name: string }>>([])
  const [posOptions, setPosOptions] = useState<Array<{ code: string; name: string }>>([])

  const load = async () => {
    setLoading(true)
    try {
      const data = await listExecutorsOverview({ cycleMonth, department, position })
      setRows(data)
    } finally {
      setLoading(false)
    }
  }

  // 载入部门选项
  useEffect(() => {
    (async () => {
      const depts = await departmentPositionService.getDepartments(true)
      setDeptOptions((depts || []).map((d: any) => ({ code: d.code, name: d.name })))
    })()
  }, [])

  // 根据部门联动岗位选项；未选部门则列出全部岗位
  useEffect(() => {
    (async () => {
      if (!department) {
        const all = await departmentPositionService.getPositions(undefined, true)
        setPosOptions((all || []).map((p: any) => ({ code: p.code, name: p.name })))
        return
      }
      const poss = await departmentPositionService.getPositions(department, true)
      setPosOptions((poss || []).map((p: any) => ({ code: p.code, name: p.name })))
    })()
  }, [department])

  useEffect(() => { load() }, [cycleMonth, department, position])

  // 导出当前统计为 CSV
  const exportCsv = () => {
    const headers = ['姓名','岗位','均分','评分人数','评分条目数','最近提交时间']
    const lines = rows.map(r => [
      r.executorName || r.executorId,
      r.positionName || '',
      String(r.overall_avg ?? ''),
      String(r.rater_count ?? ''),
      String(r.sample_size ?? ''),
      r.lastSubmitted ? new Date(r.lastSubmitted).toLocaleString() : ''
    ])
    const csv = [headers, ...lines].map(arr => arr.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `评分数据统计_${cycleMonth}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">评分数据统计</h1>
        <div className="flex items-center gap-2">
          <Select value={cycleMonth} onValueChange={setCycleMonth}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value={getCurrentCycleMonth()}>本月</SelectItem>
              <SelectItem value={getPreviousCycleMonth()}>上月</SelectItem>
            </SelectContent>
          </Select>

          {/* 部门筛选（中文显示，值为 code） */}
          <Select value={department ?? 'all'} onValueChange={(v) => { setDepartment(v === 'all' ? undefined : v); setPosition(undefined) }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="部门(可选)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部部门</SelectItem>
              {deptOptions.map(d => (
                <SelectItem key={d.code} value={d.code}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 岗位筛选（随部门联动） */}
          <Select value={position ?? 'all'} onValueChange={(v) => setPosition(v === 'all' ? undefined : v)}>
            <SelectTrigger className="w-48"><SelectValue placeholder="岗位(可选)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部岗位</SelectItem>
              {posOptions.map(p => (
                <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={exportCsv}>
            {cycleMonth === 'all' ? '导出全部统计' : '导出本月统计'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>评分数据统计</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading && <div className="text-sm text-muted-foreground">加载中...</div>}
          {!loading && rows.length === 0 && <div className="text-sm text-muted-foreground">暂无数据</div>}
          {!loading && rows.length > 0 && (
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.executorId} className="flex items-center justify-between border rounded p-2 flex-wrap gap-2">
                  <div className="text-sm">
                    {r.executorName ? r.executorName : `执行人ID：${r.executorId.slice(0,8)}...`}
                    {r.positionName && <span className="ml-2 text-muted-foreground">（{r.positionName}）</span>}
                    {r.lastSubmitted && (
                      <div className="text-xs text-muted-foreground">
                        最近提交：{new Date(r.lastSubmitted).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div className="text-sm">均分：{r.overall_avg}（评分人数：{r.rater_count}，评分条目数：{r.sample_size}）</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}