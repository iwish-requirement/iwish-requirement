'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ExecutorMonthlyStats } from '@/types/rating'
import { ratingService } from '@/services/rating'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Props = {
  executorId: string
  defaultCycleMonth?: string
}

export default function ExecutorRatingStats({ executorId, defaultCycleMonth }: Props) {
  const [cycleMonth, setCycleMonth] = useState(defaultCycleMonth || getCycleMonth(new Date()))
  const [stats, setStats] = useState<ExecutorMonthlyStats | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let ignore = false
    const load = async () => {
      setLoading(true)
      try {
        const s = await ratingService.getExecutorMonthlyStats({ executorId, cycleMonth })
        if (!ignore) setStats(s)
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => { ignore = true }
  }, [executorId, cycleMonth])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>评分统计</CardTitle>
          <Select value={cycleMonth} onValueChange={setCycleMonth}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={getCycleMonth(new Date())}>本月</SelectItem>
              <SelectItem value={getCycleMonth(prevMonth(new Date()))}>上月</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading && <div className="text-sm text-muted-foreground">加载中...</div>}
        {!loading && stats && (
          <div className="space-y-2 text-sm">
            <div>总体平均分：{stats.overall_avg ?? '-'}</div>
            <div>评分人数：{stats.rater_count}</div>
            <div>样本量（分数个数）：{stats.sample_size}</div>
            <div className="mt-2">
              <div className="font-medium">按字段平均：</div>
              {Object.keys(stats.field_avg).length === 0 && <div className="text-muted-foreground">暂无</div>}
              {Object.entries(stats.field_avg).map(([fid, avg]) => (
                <div key={fid} className="flex justify-between">
                  <span>{fid}</span>
                  <span>{avg}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function getCycleMonth(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function prevMonth(d: Date) {
  const nd = new Date(d)
  nd.setMonth(nd.getMonth() - 1)
  return nd
}