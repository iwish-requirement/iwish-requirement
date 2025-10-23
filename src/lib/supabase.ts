import { createClient } from '@supabase/supabase-js'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// 服务端客户端
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 客户端组件客户端
export const  createSupabaseClient = () => createClientComponentClient()

// 数据库类型定义
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          department: string
          position: string
          role: 'super_admin' | 'admin' | 'employee'
          active: boolean
          created_at: string
          updated_at: string
          last_login: string | null
          wecom_user_id: string | null
        }
        Insert: {
          id?: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          department: string
          position: string
          role?: 'super_admin' | 'admin' | 'employee'
          active?: boolean
          created_at?: string
          updated_at?: string
          last_login?: string | null
          wecom_user_id?: string | null
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          department?: string
          position?: string
          role?: 'super_admin' | 'admin' | 'employee'
          active?: boolean
          created_at?: string
          updated_at?: string
          last_login?: string | null
          wecom_user_id?: string | null
        }
      }
      permissions: {
        Row: {
          id: string
          name: string
          code: string
          description: string | null
          category: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          code: string
          description?: string | null
          category: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          code?: string
          description?: string | null
          category?: string
          created_at?: string
        }
      }
      roles: {
        Row: {
          id: string
          name: string
          code: string
          description: string | null
          is_system: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          code: string
          description?: string | null
          is_system?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          code?: string
          description?: string | null
          is_system?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      role_permissions: {
        Row: {
          id: string
          role_id: string
          permission_id: string
          created_at: string
        }
        Insert: {
          id?: string
          role_id: string
          permission_id: string
          created_at?: string
        }
        Update: {
          id?: string
          role_id?: string
          permission_id?: string
          created_at?: string
        }
      }
      form_schemas: {
        Row: {
          id: string
          name: string
          description: string | null
          department: string
          position: string
          fields: any
          is_active: boolean
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          department: string
          position: string
          fields: any
          is_active?: boolean
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          department?: string
          position?: string
          fields?: any
          is_active?: boolean
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      requirements: {
        Row: {
          id: string
          title: string
          description: string | null
          status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'rejected'
          priority: 'high' | 'medium' | 'low'
          submitter_id: string
          submitter_name: string
          submitter_department: string
          submitter_position: string
          assignee_id: string | null
          assignee_name: string | null
          assignee_department: string | null
          assignee_position: string | null
          created_at: string
          updated_at: string
          due_date: string | null
          started_at: string | null
          completed_at: string | null
          form_data: any
          form_schema_id: string
          tags: string[] | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          status?: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'rejected'
          priority?: 'high' | 'medium' | 'low'
          submitter_id: string
          submitter_name: string
          submitter_department: string
          submitter_position: string
          assignee_id?: string | null
          assignee_name?: string | null
          assignee_department?: string | null
          assignee_position?: string | null
          created_at?: string
          updated_at?: string
          due_date?: string | null
          started_at?: string | null
          completed_at?: string | null
          form_data: any
          form_schema_id: string
          tags?: string[] | null
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          status?: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'rejected'
          priority?: 'high' | 'medium' | 'low'
          submitter_id?: string
          submitter_name?: string
          submitter_department?: string
          submitter_position?: string
          assignee_id?: string | null
          assignee_name?: string | null
          assignee_department?: string | null
          assignee_position?: string | null
          created_at?: string
          updated_at?: string
          due_date?: string | null
          started_at?: string | null
          completed_at?: string | null
          form_data?: any
          form_schema_id?: string
          tags?: string[] | null
        }
      }
      comments: {
        Row: {
          id: string
          requirement_id: string
          content: string
          author_id: string
          author_name: string
          author_avatar: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          requirement_id: string
          content: string
          author_id: string
          author_name: string
          author_avatar?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          requirement_id?: string
          content?: string
          author_id?: string
          author_name?: string
          author_avatar?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      navigation_configs: {
        Row: {
          id: string
          name: string
          items: any
          is_active: boolean
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          items: any
          is_active?: boolean
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          items?: any
          is_active?: boolean
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      system_configs: {
        Row: {
          id: string
          key: string
          value: any
          description: string | null
          category: string
          is_public: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          value: any
          description?: string | null
          category: string
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          value?: any
          description?: string | null
          category?: string
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      activity_logs: {
        Row: {
          id: string
          user_id: string
          user_name: string
          action: string
          resource_type: string
          resource_id: string | null
          old_values: any | null
          new_values: any | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          user_name: string
          action: string
          resource_type: string
          resource_id?: string | null
          old_values?: any | null
          new_values?: any | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          user_name?: string
          action?: string
          resource_type?: string
          resource_id?: string | null
          old_values?: any | null
          new_values?: any | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
      }
      rating_dimensions: {
        Row: {
          id: string
          name: string
          display_name: string | null
          description: string | null
          department: string | null
          position: string | null
          weight: string
          min_score: number
          max_score: number
          score_labels: any
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          name: string
          display_name?: string | null
          description?: string | null
          department?: string | null
          position?: string | null
          weight: string
          min_score?: number
          max_score?: number
          score_labels?: any
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          display_name?: string | null
          description?: string | null
          department?: string | null
          position?: string | null
          weight?: string
          min_score?: number
          max_score?: number
          score_labels?: any
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: 'super_admin' | 'admin' | 'employee'
      requirement_status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'rejected'
      requirement_priority: 'high' | 'medium' | 'low'
    }
  }
}