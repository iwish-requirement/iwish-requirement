/**
 * 评分系统类型（模板驱动，按 提交者-执行人-月份 综合评分）
 * 保持独立文件，避免侵入现有 types/index.ts
 */

export type RatingFieldType = 'rating' | 'text'
export type RatingMode = 'fixed' | 'range' // 仅当 type='rating' 生效

export interface RatingOption {
  label: string
  score: number
  description?: string
}

export interface RatingField {
  id: string
  type: RatingFieldType
  label: string
  description?: string
  required?: boolean
  order: number
  // rating 专属
  mode?: RatingMode
  options?: RatingOption[] // fixed
  min?: number // range，默认 0
  max?: number // range，默认 10
  step?: number // range，默认 1
}

export interface RatingFormTemplate {
  id: string
  name: string
  department: string
  position: string
  is_active: boolean
  version: number
  schema: { fields: RatingField[] }
  created_by?: string
  created_at: string
  updated_at: string
}

export interface RatingFormInstance {
  id: string
  template_id: string
  cycle_month: string // 'YYYY-MM'
  requester_id: string // 评分人（提交者）
  executor_id: string // 被评分人（执行人）
  submitted_at: string | null
  updated_at: string
}

export interface RatingFormResponse {
  id: string
  instance_id: string
  field_id: string
  value_score?: number | null
  value_text?: string | null
}

/** 提交入参（单字段） */
export type RatingResponseInput = {
  field_id: string
  value_score?: number
  value_text?: string
}

/** 提交入参（单执行人） */
export type RatingEntryInput = {
  executorId: string
  templateId: string
  responses: RatingResponseInput[]
}

/** 评分人当月批量提交入参 */
export interface SubmitMonthlySessionInput {
  requesterId: string
  cycleMonth: string // 仅允许当月/上月
  entries: RatingEntryInput[]
}

/** 评分模板选择返回（严格按部门/岗位） */
export interface ApplicableTemplateResult {
  template: RatingFormTemplate
}

/** 月度评分会话项（用于渲染 UI） */
export interface RequesterMonthlySessionItem {
  executorId: string
  executorName?: string
  executorTitle?: string
  executorPosition?: string
  template: RatingFormTemplate | null // 无模板时为 null
  instance?: RatingFormInstance
  responses?: RatingFormResponse[]
}

/** 执行人月度统计 */
export interface ExecutorMonthlyStats {
  overall_avg: number | null
  field_avg: Record<string, number> // field_id -> avg
  rater_count: number
  sample_size: number
}