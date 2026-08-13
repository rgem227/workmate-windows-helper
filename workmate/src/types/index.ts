// 数据类型定义

export interface Plan {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  // v2 叠加提醒：各类型独立开关
  remind_expire_before_enabled: boolean;
  remind_expire_before_days: number;
  remind_expire_before_time: string;
  remind_later_enabled: boolean;
  remind_later_minutes: number;
  remind_daily_enabled: boolean;
  remind_daily_time: string;
  remind_weekly_enabled: boolean;
  remind_weekly_day: number;       // 1=周一, 7=周日
  remind_weekly_time: string;
  remind_monthly_enabled: boolean;
  remind_monthly_day: number;      // 1-31
  remind_monthly_time: string;
  remind_once_enabled: boolean;
  remind_once_datetime: string | null;
  // 旧兼容字段（已废弃）
  remind_type: string;
  remind_before_minutes: number;
  remind_custom_time: string | null;
  priority: Priority;
  status: PlanStatus;
  snooze_count: number;
  snooze_last_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type Priority = 'low' | 'medium' | 'high';

export type PlanStatus = 'pending' | 'completed' | 'overdue' | 'deleted';

export interface WorkRecord {
  id: string;
  plan_id: string | null;
  content: string;
  record_date: string;
  created_at: string;
  updated_at: string;
}

export interface Setting {
  key: string;
  value: string;
}

export interface CreatePlanInput {
  title: string;
  description: string | null;
  due_date: string | null;
  remind_expire_before_enabled: boolean;
  remind_expire_before_days: number;
  remind_expire_before_time: string;
  remind_later_enabled: boolean;
  remind_later_minutes: number;
  remind_daily_enabled: boolean;
  remind_daily_time: string;
  remind_weekly_enabled: boolean;
  remind_weekly_day: number;
  remind_weekly_time: string;
  remind_monthly_enabled: boolean;
  remind_monthly_day: number;
  remind_monthly_time: string;
  remind_once_enabled: boolean;
  remind_once_datetime: string | null;
  priority: Priority;
}

export interface UpdatePlanInput extends CreatePlanInput {
  id: string;
}

export interface CreateRecordInput {
  plan_id: string | null;
  content: string;
  record_date: string;
}

export interface UpdateRecordInput extends CreateRecordInput {
  id: string;
}

export type Theme = 'light' | 'dark' | 'system';

export type AnimationPreference = 'text' | 'animation' | 'mixed';

export interface ToastNotification {
  id: string;
  title: string;
  body: string;
  planId?: string;
  dueDate?: string;
}

// AI 模型
export interface AiModel {
  id: string;
  name: string;
  provider: 'deepseek' | 'ruru' | 'custom';
  api_url: string;
  api_key: string;
  model_id: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string | null;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SaveAiModelInput {
  id?: string | null;
  name: string;
  provider: string;
  api_url: string;
  api_key: string;
  model_id: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string | null;
}
