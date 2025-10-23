import { createSupabaseClient } from '@/lib/supabase'
import type { RatingFormTemplate } from '@/types/rating'

const sb = () => createSupabaseClient()

export const ratingTemplateService = {
  async list(params?: { department?: string; position?: string; activeOnly?: boolean }): Promise<RatingFormTemplate[]> {
    let query = sb().from('rating_form_templates').select('*').order('updated_at', { ascending: false })
    if (params?.department) query = query.eq('department', params.department)
    if (params?.position) query = query.eq('position', params.position)
    if (params?.activeOnly) query = query.eq('is_active', true)
    const { data, error } = await query
    if (error) throw error
    return (data || []) as unknown as RatingFormTemplate[]
  },

  async get(id: string): Promise<RatingFormTemplate | null> {
    const { data, error } = await sb().from('rating_form_templates').select('*').eq('id', id).single()
    if (error) throw error
    return data as unknown as RatingFormTemplate
  },

  async create(template: Omit<RatingFormTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<RatingFormTemplate> {
    const client = sb()
    const { data: userRes, error: userErr } = await client.auth.getUser()
    if (userErr) throw userErr
    const uid = userRes?.user?.id
    const payload: any = { ...template, created_by: template['created_by'] || uid || null }
    const { data, error } = await client.from('rating_form_templates').insert(payload).select().single()
    if (error) throw error
    return data as unknown as RatingFormTemplate
  },

  async update(id: string, patch: Partial<Omit<RatingFormTemplate, 'id' | 'created_at' | 'updated_at'>>): Promise<RatingFormTemplate> {
    const { data, error } = await sb()
      .from('rating_form_templates')
      .update(patch)
      .eq('id', id)
      .select()
      .maybeSingle()
    if (error) throw error
    if (!data) {
      throw new Error('更新失败：可能没有权限或记录不存在')
    }
    return data as unknown as RatingFormTemplate
  },

  async remove(id: string): Promise<void> {
    // 先检查是否有评分实例引用该模板，若有则禁止删除并给出友好提示
    const { data: refs, error: refErr } = await sb()
      .from('rating_form_instances')
      .select('id')
      .eq('template_id', id)
      .limit(1)
    if (refErr) throw refErr
    if (refs && refs.length > 0) {
      throw new Error('该模板已被评分记录引用，无法删除。请先停用模板或克隆新版本。')
    }
    const { error } = await sb().from('rating_form_templates').delete().eq('id', id)
    if (error) throw error
  },

  async toggleActive(id: string, is_active: boolean): Promise<RatingFormTemplate> {
    const { data, error } = await sb()
      .from('rating_form_templates')
      .update({ is_active })
      .eq('id', id)
      .select()
      .maybeSingle()
    if (error) throw error
    if (!data) {
      throw new Error('更新失败：可能没有权限或记录不存在（无法切换启用状态）')
    }
    return data as unknown as RatingFormTemplate
  },

  async cloneNewVersion(id: string): Promise<RatingFormTemplate> {
    const { data: origin, error: e1 } = await sb().from('rating_form_templates').select('*').eq('id', id).single()
    if (e1) throw e1
    const nextVersion = (origin.version || 1) + 1
    const insert = {
      name: origin.name,
      department: origin.department,
      position: origin.position,
      is_active: true,
      version: nextVersion,
      schema: origin.schema,
      created_by: origin.created_by || null,
    }
    const { data, error } = await sb().from('rating_form_templates').insert(insert).select().single()
    if (error) throw error
    return data as RatingFormTemplate
  },
}