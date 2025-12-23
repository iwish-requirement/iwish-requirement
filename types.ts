export enum DemandStatus {
  PENDING = '待处理',
  IN_PROGRESS = '进行中',
  REVIEW = '待确认',
  DONE = '已完成',
  CLOSED = '已关闭',
  DELAYED = '已延期',
  IGNORED = '不处理',
}

export enum Priority {
  LOW = '低',
  MEDIUM = '中',
  HIGH = '高',
  CRITICAL = '紧急'
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
  priority: Priority;
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
