// Deprecated: Use department-specific config instead
export enum DemandStatus {
  PENDING = '待处理',
  IN_PROGRESS = '进行中',
  REVIEW = '待确认',
  DONE = '已完成',
  CLOSED = '已关闭',
  DELAYED = '已延期',
  IGNORED = '不处理',
}

// Deprecated: Use department-specific config instead
export enum Priority {
  LOW = '低',
  MEDIUM = '中',
  HIGH = '高',
  CRITICAL = '紧急'
}

// New: Department workflow configuration
export interface PriorityConfig {
  value: string;
  label: string;
  color: string;
  order: number;
}

export interface StatusConfig {
  value: string;
  label: string;
  color: string;
  order: number;
  transitions?: string[]; // Allowed next status values
}

export interface DepartmentWorkflowConfig {
  priorities: PriorityConfig[];
  statuses: StatusConfig[];
}

export interface Department {
  id: string;
  name: string;
  slug: string;
}

export type UserRole = 'Admin' | 'Manager' | 'User' | 'Guest';
export type UserStatus = 'Active' | 'Pending' | 'Disabled';

export interface User {
  id: string;
  name: string;
  email?: string;
  avatar: string;
  departmentId: string;
  role: UserRole;
  status?: UserStatus;
  joinedAt?: string;
}

export interface Demand {
  id: string;
  title: string;
  description: string;
  departmentId: string;
  creatorId: string;
  assigneeId?: string;
  // 更丰富的人员信息（从后端 users 表补充）
  creatorName?: string;
  creatorEmail?: string;
  assigneeName?: string;
  assigneeEmail?: string;
  status: DemandStatus;
  // 显示用状态文案与颜色（来源于部门配置）
  statusLabel?: string;
  statusColor?: string;
  priority: Priority;
  // 显示用优先级文案与颜色（来源于部门配置）
  priorityLabel?: string;
  priorityColor?: string;
  createdAt: string;
  dueDate: string;
  // Dynamic fields simulation
  customFields?: Record<string, string | number | any>;
}


export interface StatMetric {
  label: string;
  value: string | number;
  trend?: number; // percentage
  trendUp?: boolean;
}

export interface ScoreTask {
  id: string;
  targetName: string;
  targetRole: string;
  department: string;
  status: 'Pending' | 'Completed';
  period: string;
}

// Score Period (评分周期配置)
export interface ScorePeriod {
  id: number;
  period: string; // Format: YYYY-MM (服务月)
  scoreWindowStart: string | null; // ISO timestamp
  scoreWindowEnd: string | null; // ISO timestamp
  status: 'planned' | 'open' | 'closed';
  createdAt: string;
  updatedAt?: string;
}

// Score Period Stage (评分阶段 - 基于当前时间判断)
export type ScorePeriodStage = 'not_started' | 'scoring' | 'grace' | 'closed';

// Score Template Item
export interface ScoreTemplateItem {
  label: string;
  max: number;
  required: boolean;
}

// Score Template
export interface ScoreTemplate {
  id: number;
  departmentId: number;
  name: string;
  items: ScoreTemplateItem[];
  isActive: boolean;
  createdAt: string;
}

export type FieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'multiline'
  | 'boolean'
  | 'multi_select'
  | 'url'
  | 'email'
  | 'phone';

export interface FieldDefinition {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[]; // For select type
  placeholder?: string;
  // 是否允许用作高级筛选条件
  filterable?: boolean;
  // 是否默认支持导出到 Excel
  exportable?: boolean;
}

export type AiReportGenerateMode = 'rule' | 'llm';

export interface AiReportMetric {
  id: string;
  label: string;
  value: number;
  unit?: string;
}

export interface AiReportParagraph {
  id: string;
  text: string;
  highlightMetricIds?: string[];
}

export interface AiReportChapter {
  id: string;
  title: string;
  paragraphs: AiReportParagraph[];
}

export interface AiMonthlyReport {
  id?: string;
  departmentId: string;
  departmentName?: string;
  period: string;
  reportType: string;
  mode: AiReportGenerateMode;
  generatedAt: string;
  summaryKeywords: string[];
  chapters: AiReportChapter[];
  metrics: Record<string, AiReportMetric>;
}

export interface DynamicFieldValueStat {
  value: string;
  count: number;
}

export interface DynamicFieldStat {
  fieldId: string;
  fieldLabel: string;
  total: number;
  values: DynamicFieldValueStat[];
}

export interface DepartmentDynamicFieldStats {
  departmentId: number;
  departmentName?: string;
  totalDemands: number;
  fields: DynamicFieldStat[];
}
