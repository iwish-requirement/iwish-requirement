'use client'

import { useMemo } from 'react'
import type { RatingFormTemplate, RatingFormResponse, RatingResponseInput, RatingField } from '@/types/rating'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Props = {
  template: RatingFormTemplate
  responses?: RatingFormResponse[]
  onChange: (responses: RatingResponseInput[]) => void
}

/**
 * 动态评分表单渲染器
 * - 支持三类字段：
 *   - rating(mode=fixed): 使用 Select 单选（选项 score 作为分数）
 *   - rating(mode=range): 使用 Slider 区间分数（默认 0-10，step=1）
 *   - text: 使用 Textarea
 */
export default function RatingFormRenderer({ template, responses, onChange }: Props) {
  // 将已有 responses 映射为 field_id -> 值
  const valueMap = useMemo(() => {
    const map = new Map<string, { score?: number; text?: string }>()
    ;(responses || []).forEach(r => {
      map.set(r.field_id, { score: r.value_score ?? undefined, text: r.value_text ?? undefined })
    })
    return map
  }, [responses])

  const emit = (fieldId: string, partial: { score?: number; text?: string }) => {
    const current = new Map(valueMap)
    const prev = current.get(fieldId) || {}
    const merged = { ...prev, ...partial }
    current.set(fieldId, merged)
    const arr: RatingResponseInput[] = Array.from(current.entries()).map(([fid, v]) => ({
      field_id: fid,
      value_score: v.score,
      value_text: v.text,
    }))
    onChange(arr)
  }

  const renderField = (f: RatingField) => {
    if (f.type === 'rating' && f.mode === 'fixed') {
      const options = f.options || []
      const current = valueMap.get(f.id)?.score
      return (
        <div key={f.id} className="space-y-2">
          <Label className="font-medium">
            {f.label}{f.required ? ' *' : ''} {f.description ? <span className="text-xs text-muted-foreground ml-2">{f.description}</span> : null}
          </Label>
          <Select
            value={current !== undefined ? String(current) : undefined}
            onValueChange={(v) => emit(f.id, { score: Number(v) })}
          >
            <SelectTrigger>
              <SelectValue placeholder="请选择" />
            </SelectTrigger>
            <SelectContent>
              {options.map(opt => (
                <SelectItem key={`${f.id}-${opt.score}`} value={String(opt.score)}>
                  {opt.label}（{opt.score}）
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )
    }

    if (f.type === 'rating' && f.mode === 'range') {
      const min = f.min ?? 0
      const max = f.max ?? 10
      const step = f.step ?? 1
      const current = valueMap.get(f.id)?.score
      return (
        <div key={f.id} className="space-y-2">
          <Label className="font-medium">
            {f.label}{f.required ? ' *' : ''} {f.description ? <span className="text-xs text-muted-foreground ml-2">{f.description}</span> : null}
          </Label>
          <div className="px-1">
            <Slider
              min={min}
              max={max}
              step={step}
              value={[typeof current === 'number' ? current : min]}
              onValueChange={(vals) => emit(f.id, { score: vals[0] })}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{min}</span>
              <span className="font-medium">{typeof current === 'number' ? current : '-'}</span>
              <span>{max}</span>
            </div>
          </div>
        </div>
      )
    }

    if (f.type === 'text') {
      const current = valueMap.get(f.id)?.text ?? ''
      return (
        <div key={f.id} className="space-y-2">
          <Label className="font-medium">
            {f.label}{f.required ? ' *' : ''} {f.description ? <span className="text-xs text-muted-foreground ml-2">{f.description}</span> : null}
          </Label>
          <Textarea
            value={current}
            onChange={(e) => emit(f.id, { text: e.target.value })}
            rows={4}
            placeholder="请输入反馈..."
          />
        </div>
      )
    }

    // 兜底：未知类型
    return (
      <div key={f.id} className="text-sm text-muted-foreground">
        未支持的字段类型：{f.type}
      </div>
    )
  }

  const fields = [...(template.schema?.fields || [])].sort((a, b) => (a.order || 0) - (b.order || 0))

  return (
    <div className="space-y-4">
      {fields.map(renderField)}
    </div>
  )
}