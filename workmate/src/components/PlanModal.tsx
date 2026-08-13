// 计划表单弹窗 — v2 叠加提醒（各提醒类型独立开关）
import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { format } from 'date-fns';
import type { CreatePlanInput, Priority } from '../types';

// 默认表单数据
function getDefaultFormData(): CreatePlanInput {
  const now = new Date();
  now.setDate(now.getDate() + 7);
  return {
    title: '',
    description: null,
    due_date: format(now, "yyyy-MM-dd'T'HH:mm"),
    remind_expire_before_enabled: true,
    remind_expire_before_days: 7,
    remind_expire_before_time: '09:00',
    remind_later_enabled: false,
    remind_later_minutes: 1440,
    remind_daily_enabled: false,
    remind_daily_time: '09:00',
    remind_weekly_enabled: false,
    remind_weekly_day: 1,
    remind_weekly_time: '09:00',
    remind_monthly_enabled: false,
    remind_monthly_day: 1,
    remind_monthly_time: '09:00',
    remind_once_enabled: false,
    remind_once_datetime: null,
    priority: 'medium',
  };
}

const WEEKDAY_OPTIONS = [
  { value: 1, label: '周一' }, { value: 2, label: '周二' },
  { value: 3, label: '周三' }, { value: 4, label: '周四' },
  { value: 5, label: '周五' }, { value: 6, label: '周六' },
  { value: 7, label: '周日' },
];

const PRIORITY_OPTIONS: { value: Priority; label: string; cls: string }[] = [
  { value: 'low', label: '低', cls: 'border-green-500 bg-green-50 dark:bg-green-900/30' },
  { value: 'medium', label: '中', cls: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/30' },
  { value: 'high', label: '高', cls: 'border-red-500 bg-red-50 dark:bg-red-900/30' },
];

export default function PlanModal() {
  const { isPlanModalOpen, editingPlan, closePlanModal, createPlan, updatePlan } = useStore();
  const [formData, setFormData] = useState<CreatePlanInput>(getDefaultFormData());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingPlan) {
      setFormData({
        title: editingPlan.title,
        description: editingPlan.description,
        due_date: editingPlan.due_date ? editingPlan.due_date.slice(0, 16) : null,
        remind_expire_before_enabled: editingPlan.remind_expire_before_enabled,
        remind_expire_before_days: editingPlan.remind_expire_before_days || 7,
        remind_expire_before_time: editingPlan.remind_expire_before_time || '09:00',
        remind_later_enabled: editingPlan.remind_later_enabled,
        remind_later_minutes: editingPlan.remind_later_minutes || 1440,
        remind_daily_enabled: editingPlan.remind_daily_enabled,
        remind_daily_time: editingPlan.remind_daily_time || '09:00',
        remind_weekly_enabled: editingPlan.remind_weekly_enabled,
        remind_weekly_day: editingPlan.remind_weekly_day || 1,
        remind_weekly_time: editingPlan.remind_weekly_time || '09:00',
        remind_monthly_enabled: editingPlan.remind_monthly_enabled,
        remind_monthly_day: editingPlan.remind_monthly_day || 1,
        remind_monthly_time: editingPlan.remind_monthly_time || '09:00',
        remind_once_enabled: editingPlan.remind_once_enabled,
        remind_once_datetime: editingPlan.remind_once_datetime,
        priority: editingPlan.priority,
      });
    } else {
      setFormData(getDefaultFormData());
    }
  }, [editingPlan, isPlanModalOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) { alert('请输入计划标题'); return; }
    if (!formData.due_date) { alert('请选择截止日期'); return; }

    setSaving(true);
    try {
      if (editingPlan) {
        await updatePlan({ ...formData, id: editingPlan.id });
      } else {
        await createPlan(formData);
      }
      closePlanModal();
    } catch (e: any) {
      console.error('保存失败:', e);
      alert('保存失败: ' + (e?.message || e?.toString?.() || String(e)));
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof CreatePlanInput>(key: K, value: CreatePlanInput[K]) =>
    setFormData(prev => ({ ...prev, [key]: value }));

  if (!isPlanModalOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 rounded-t-xl z-10">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            {editingPlan ? '编辑计划' : '新建计划'}
          </h3>
          <button onClick={closePlanModal} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* 标题 */}
          <Field label="标题" required>
            <input type="text" value={formData.title} onChange={e => update('title', e.target.value)}
              placeholder="输入计划标题..." maxLength={100}
              className="input" />
          </Field>

          {/* 描述 */}
          <Field label="详细描述">
            <textarea value={formData.description || ''} onChange={e => update('description', e.target.value || null)}
              placeholder="输入详细描述（可选）..." maxLength={2000} rows={3}
              className="input resize-none" />
          </Field>

          {/* 截止日期 */}
          <Field label="截止日期时间" required>
            <input type="datetime-local" value={formData.due_date || ''}
              onChange={e => update('due_date', e.target.value || null)} className="input" />
          </Field>

          {/* === 提醒类型（叠加多选）=== */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              提醒设置 <span className="text-red-500">*</span>
              <span className="text-xs text-gray-400 ml-2">可同时开启多种提醒</span>
            </label>
            <div className="space-y-2">
              {/* 过期前提醒 */}
              <ReminderToggle label="过期前提醒" description="截止前 N 天提醒一次"
                enabled={formData.remind_expire_before_enabled}
                onToggle={v => update('remind_expire_before_enabled', v)}>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-gray-500">提前</span>
                  <select value={formData.remind_expire_before_days}
                    onChange={e => update('remind_expire_before_days', Number(e.target.value))}
                    className="input text-xs w-auto">
                    <option value={1}>1天</option><option value={3}>3天</option>
                    <option value={7}>7天</option><option value={14}>14天</option>
                  </select>
                  <span className="text-xs text-gray-500">于</span>
                  <input type="time" value={formData.remind_expire_before_time}
                    onChange={e => update('remind_expire_before_time', e.target.value)} className="input text-xs w-auto" />
                  <span className="text-xs text-gray-500">提醒</span>
                </div>
              </ReminderToggle>

              {/* 稍后提醒 */}
              <ReminderToggle label="稍后提醒" description="截止前 N 分钟提醒一次"
                enabled={formData.remind_later_enabled}
                onToggle={v => update('remind_later_enabled', v)}>
                <select value={formData.remind_later_minutes}
                  onChange={e => update('remind_later_minutes', Number(e.target.value))}
                  className="input text-xs w-auto">
                  <option value={15}>15分钟前</option><option value={30}>30分钟前</option>
                  <option value={60}>1小时前</option><option value={1440}>1天前</option>
                </select>
              </ReminderToggle>

              {/* 每日提醒 */}
              <ReminderToggle label="每日提醒" description="每天固定时间提醒"
                enabled={formData.remind_daily_enabled}
                onToggle={v => update('remind_daily_enabled', v)}>
                <input type="time" value={formData.remind_daily_time}
                  onChange={e => update('remind_daily_time', e.target.value)} className="input text-xs w-auto" />
              </ReminderToggle>

              {/* 每周提醒 */}
              <ReminderToggle label="每周提醒" description="每周固定时间提醒"
                enabled={formData.remind_weekly_enabled}
                onToggle={v => update('remind_weekly_enabled', v)}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-500">每</span>
                  <select value={formData.remind_weekly_day}
                    onChange={e => update('remind_weekly_day', Number(e.target.value))}
                    className="input text-xs w-auto">
                    {WEEKDAY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input type="time" value={formData.remind_weekly_time}
                    onChange={e => update('remind_weekly_time', e.target.value)} className="input text-xs w-auto" />
                </div>
              </ReminderToggle>

              {/* 每月提醒 */}
              <ReminderToggle label="每月提醒" description="每月固定时间提醒"
                enabled={formData.remind_monthly_enabled}
                onToggle={v => update('remind_monthly_enabled', v)}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-500">每月</span>
                  <select value={formData.remind_monthly_day}
                    onChange={e => update('remind_monthly_day', Number(e.target.value))}
                    className="input text-xs w-auto">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d =>
                      <option key={d} value={d}>{d}日</option>
                    )}
                  </select>
                  <input type="time" value={formData.remind_monthly_time}
                    onChange={e => update('remind_monthly_time', e.target.value)} className="input text-xs w-auto" />
                </div>
              </ReminderToggle>

              {/* 指定日期提醒 */}
              <ReminderToggle label="指定日期提醒" description="在指定日期时间提醒一次"
                enabled={formData.remind_once_enabled}
                onToggle={v => update('remind_once_enabled', v)}>
                <input type="datetime-local" value={formData.remind_once_datetime || ''}
                  onChange={e => update('remind_once_datetime', e.target.value || null)} className="input text-xs" />
              </ReminderToggle>
            </div>
          </div>

          {/* 优先级 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">优先级</label>
            <div className="flex gap-4">
              {PRIORITY_OPTIONS.map(opt => (
                <label key={opt.value}
                  className={`flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer transition-colors ${
                    formData.priority === opt.value ? opt.cls : 'border-gray-200 dark:border-gray-700'
                  }`}>
                  <input type="radio" name="priority" value={opt.value}
                    checked={formData.priority === opt.value}
                    onChange={e => update('priority', e.target.value as Priority)} className="text-primary" />
                  <span className="text-sm text-gray-800 dark:text-white">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={closePlanModal}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">取消</button>
            <button type="submit" disabled={saving}
              className="px-6 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg disabled:opacity-50">
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- 子组件 ----

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function ReminderToggle({ label, description, enabled, onToggle, children }: {
  label: string; description: string; enabled: boolean;
  onToggle: (v: boolean) => void; children: React.ReactNode;
}) {
  return (
    <div className={`border rounded-lg p-3 transition-colors ${
      enabled ? 'border-primary/50 bg-primary/5 dark:bg-primary/10' : 'border-gray-200 dark:border-gray-700'
    }`}>
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={enabled} onChange={e => onToggle(e.target.checked)}
          className="w-4 h-4 text-primary rounded" />
        <div className="flex-1">
          <span className="text-sm text-gray-800 dark:text-white">{label}</span>
          <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
        </div>
      </label>
      {enabled && (
        <div className="mt-2 ml-7 pl-3 border-l-2 border-primary/30">
          {children}
        </div>
      )}
    </div>
  );
}
