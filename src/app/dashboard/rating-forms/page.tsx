'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { ratingTemplateService } from '@/services/ratingTemplate'
import type { RatingFormTemplate } from '@/types/rating'
import TemplateEditor from '@/components/rating/TemplateEditor'

export default function RatingFormsPage() {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<RatingFormTemplate[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RatingFormTemplate | null>(null)

  const emptyTemplate: RatingFormTemplate = useMemo(() => ({
    id: 'new',
    name: '新模板',
    department: '',
    position: '',
    is_active: true,
    version: 1,
    schema: { fields: [] },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }), [])

  const load = async () => {
    setLoading(true)
    try {
      const data = await ratingTemplateService.list()
      setItems(data)
    } catch (e: any) {
      toast.error(e?.message || '加载模板失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const onCreate = () => {
    setEditing(emptyTemplate)
    setOpen(true)
  }

  const onEdit = (tpl: RatingFormTemplate) => {
    setEditing(tpl)
    setOpen(true)
  }

  const onSave = async () => {
    if (!editing) return
    try {
      setLoading(true)
      if (editing.id === 'new') {
        const { id, created_at, updated_at, ...payload } = editing as any
        await ratingTemplateService.create(payload)
      } else {
        const { id, ...patch } = editing
        await ratingTemplateService.update(id, patch)
      }
      toast.success('已保存')
      setOpen(false)
      setEditing(null)
      await load()
    } catch (e: any) {
      toast.error(e?.message || '保存失败')
    } finally {
      setLoading(false)
    }
  }

  const onToggle = async (tpl: RatingFormTemplate) => {
    try {
      setLoading(true)
      await ratingTemplateService.toggleActive(tpl.id, !tpl.is_active)
      await load()
    } catch (e: any) {
      toast.error(e?.message || '更新状态失败')
    } finally {
      setLoading(false)
    }
  }

  const onClone = async (tpl: RatingFormTemplate) => {
    try {
      setLoading(true)
      await ratingTemplateService.cloneNewVersion(tpl.id)
      await load()
      toast.success('已克隆为新版本')
    } catch (e: any) {
      toast.error(e?.message || '克隆失败')
    } finally {
      setLoading(false)
    }
  }

  const onDelete = async (tpl: RatingFormTemplate) => {
    if (!confirm(`确定删除模板「${tpl.name}」吗？`)) return
    try {
      setLoading(true)
      await ratingTemplateService.remove(tpl.id)
      await load()
      toast.success('已删除')
    } catch (e: any) {
      toast.error(e?.message || '删除失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">评分模板管理</h1>
          <p className="text-muted-foreground">按部门/岗位配置评分表单（无通用模板）</p>
        </div>
        <Button onClick={onCreate}>新建模板</Button>
      </div>

      {loading && <div className="text-sm text-muted-foreground">加载中...</div>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map(tpl => (
          <Card key={tpl.id} className="hover:shadow transition">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{tpl.name} v{tpl.version}</span>
                <span className={`text-xs ${tpl.is_active ? 'text-green-600' : 'text-gray-500'}`}>{tpl.is_active ? '启用' : '停用'}</span>
              </CardTitle>
              <CardDescription>{tpl.department} / {tpl.position}</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => onEdit(tpl)}>编辑</Button>
              <Button size="sm" variant="outline" onClick={() => onToggle(tpl)}>{tpl.is_active ? '停用' : '启用'}</Button>
              <Button size="sm" variant="outline" onClick={() => onClone(tpl)}>克隆新版本</Button>
              <Button size="sm" variant="destructive" onClick={() => onDelete(tpl)}>删除</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editing?.id === 'new' ? '新建模板' : '编辑模板'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <TemplateEditor value={editing} onChange={setEditing as any} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={onSave} disabled={loading}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}