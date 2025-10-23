'use client'

import { useEffect, useState } from 'react'
import type { RatingFormTemplate, RatingField } from '@/types/rating'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { departmentPositionService } from '@/services/departmentPosition'

type Props = {
  value: RatingFormTemplate
  onChange: (tpl: RatingFormTemplate) => void
}

export default function TemplateEditor({ value, onChange }: Props) {
  const [tpl, setTpl] = useState<RatingFormTemplate>(value)
  const [deptOptions, setDeptOptions] = useState<Array<{ value: string; label: string }>>([])
  const [posOptions, setPosOptions] = useState<Array<{ value: string; label: string }>>([])

  const emit = (next: Partial<RatingFormTemplate>) => {
    const merged = { ...tpl, ...next }
    setTpl(merged)
    onChange(merged)
  }

  useEffect(() => {
    // 加载部门下拉
    departmentPositionService.getDepartmentOptions(false).then(setDeptOptions).catch(() => setDeptOptions([]))
  }, [])
  useEffect(() => {
    // 选择部门后联动加载岗位
    if (tpl.department) {
      departmentPositionService.getPositionOptions(tpl.department).then(setPosOptions).catch(() => setPosOptions([]))
    } else {
      setPosOptions([])
    }
  }, [tpl.department])

  const addField = (type: 'rating' | 'text', mode?: 'fixed' | 'range') => {
    const id = `fld_${Date.now()}`
    const base: RatingField = {
      id,
      type,
      label: '新字段',
      order: (tpl.schema.fields?.length || 0) + 1,
    }
    if (type === 'rating') {
      if (mode === 'fixed') {
        Object.assign(base, { mode: 'fixed', options: [{ label: '优秀', score: 10 }, { label: '良好', score: 8 }, { label: '一般', score: 6 }] })
      } else {
        Object.assign(base, { mode: 'range', min: 0, max: 10, step: 1 })
      }
    }
    const fields = [...(tpl.schema.fields || []), base]
    emit({ schema: { fields } as any })
  }

  const updateField = (fid: string, patch: Partial<RatingField>) => {
    const fields = (tpl.schema.fields || []).map(f => f.id === fid ? { ...f, ...patch } : f)
    emit({ schema: { fields } as any })
  }

  const removeField = (fid: string) => {
    const fields = (tpl.schema.fields || []).filter(f => f.id !== fid)
    emit({ schema: { fields } as any })
  }

  return (
    <div className="space-y-4 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
      <Card>
        <CardHeader><CardTitle>基础信息</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>模板名称</Label>
              <Input value={tpl.name} onChange={e => emit({ name: e.target.value })} />
            </div>
            <div>
              <Label>版本</Label>
              <Input type="number" value={tpl.version} onChange={e => emit({ version: parseInt(e.target.value || '1', 10) })} />
            </div>
            <div>
              <Label>部门</Label>
              <Select value={tpl.department || ''} onValueChange={v => emit({ department: v, position: '' as any })}>
                <SelectTrigger><SelectValue placeholder="选择部门" /></SelectTrigger>
                <SelectContent>
                  {deptOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>岗位</Label>
              <Select value={tpl.position || ''} onValueChange={v => emit({ position: v })} disabled={!tpl.department}>
                <SelectTrigger><SelectValue placeholder={tpl.department ? '选择岗位' : '请先选择部门'} /></SelectTrigger>
                <SelectContent>
                  {posOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>字段配置</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => addField('rating', 'fixed')}>添加评分-固定选项</Button>
            <Button variant="outline" onClick={() => addField('rating', 'range')}>添加评分-区间</Button>
            <Button variant="outline" onClick={() => addField('text')}>添加文本</Button>
          </div>
          <Separator />
          {(tpl.schema.fields || []).map(f => (
            <div key={f.id} className="border rounded p-3 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>标签</Label>
                  <Input value={f.label} onChange={e => updateField(f.id, { label: e.target.value })} />
                </div>
                <div>
                  <Label>必填</Label>
                  <Select value={f.required ? '1' : '0'} onValueChange={v => updateField(f.id, { required: v === '1' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">是</SelectItem>
                      <SelectItem value="0">否</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>排序</Label>
                  <Input type="number" value={f.order || 0} onChange={e => updateField(f.id, { order: parseInt(e.target.value || '0', 10) })} />
                </div>
                <div>
                  <Label>类型</Label>
                  <Input value={f.type + (f.type === 'rating' ? `/${f.mode}` : '')} readOnly />
                </div>
              </div>

              {f.type === 'rating' && f.mode === 'fixed' && (
                <div className="space-y-2">
                  <Label>固定选项</Label>
                  <div className="space-y-2">
                    {(f.options || []).map((opt, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-4">
                          <Input
                            placeholder="标签，如：优秀"
                            value={opt.label}
                            onChange={(e) => {
                              const options = [...(f.options || [])]
                              options[idx] = { ...options[idx], label: e.target.value }
                              updateField(f.id, { options })
                            }}
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            type="number"
                            placeholder="分数，如：10"
                            value={opt.score ?? 0}
                            onChange={(e) => {
                              const options = [...(f.options || [])]
                              options[idx] = { ...options[idx], score: Number(e.target.value || 0) }
                              updateField(f.id, { options })
                            }}
                          />
                        </div>
                        <div className="col-span-4">
                          <Input
                            placeholder="备注（可选）"
                            value={opt.description || ''}
                            onChange={(e) => {
                              const options = [...(f.options || [])]
                              options[idx] = { ...options[idx], description: e.target.value }
                              updateField(f.id, { options })
                            }}
                          />
                        </div>
                        <div className="col-span-2 flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={idx === 0}
                            onClick={() => {
                              const options = [...(f.options || [])]
                              ;[options[idx - 1], options[idx]] = [options[idx], options[idx - 1]]
                              updateField(f.id, { options })
                            }}
                          >
                            上移
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={idx === (f.options?.length || 1) - 1}
                            onClick={() => {
                              const options = [...(f.options || [])]
                              ;[options[idx + 1], options[idx]] = [options[idx], options[idx + 1]]
                              updateField(f.id, { options })
                            }}
                          >
                            下移
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              const options = [...(f.options || [])]
                              options.splice(idx, 1)
                              updateField(f.id, { options })
                            }}
                          >
                            删除
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between">
                      <Button
                        size="sm"
                        onClick={() => {
                          const next = [ ...(f.options || []), { label: '', score: 0 } ]
                          updateField(f.id, { options: next })
                        }}
                      >
                        添加选项
                      </Button>
                      <div className="text-xs text-muted-foreground">
                        可添加任意数量。评分下拉显示“标签（分数）”，分数用于统计。
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {f.type === 'rating' && f.mode === 'range' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label>最小值</Label>
                    <Input type="number" value={f.min ?? 0} onChange={e => updateField(f.id, { min: Number(e.target.value || 0) })} />
                  </div>
                  <div>
                    <Label>最大值</Label>
                    <Input type="number" value={f.max ?? 10} onChange={e => updateField(f.id, { max: Number(e.target.value || 10) })} />
                  </div>
                  <div>
                    <Label>步长</Label>
                    <Input type="number" value={f.step ?? 1} onChange={e => updateField(f.id, { step: Number(e.target.value || 1) })} />
                  </div>
                </div>
              )}

              {f.type === 'text' && (
                <div>
                  <Label>描述</Label>
                  <Input value={f.description || ''} onChange={e => updateField(f.id, { description: e.target.value })} />
                </div>
              )}
              <div className="text-right">
                <Button variant="destructive" onClick={() => removeField(f.id)}>删除字段</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}