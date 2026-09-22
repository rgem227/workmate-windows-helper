// 定时提醒调度引擎 v3
// 全部 6 种提醒类型 + 节假日智能处理
// 规则：
//   - 过期前/截止临近/指定日期/snooze → 不受节假日影响，照常提醒
//   - 每日/每周/每月提醒 → 遇节假日顺延到下一个工作日
//   - 每周/每月若目标日恰好是节假日 → 顺延到之后第一个工作日
//   - 同一计划 + 同一提醒类型 + 同一周期内仅通知一次
import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import {
  differenceInDays, differenceInMinutes, parseISO, isBefore, isAfter,
  getDay, format,
} from 'date-fns';
import { invoke } from '@tauri-apps/api/core';
import { isWorkday, getWorkdaysBefore } from '../utils/holidays';
import type { Plan } from '../types';

// ---- 通知 key 工具 ----
function makeKey(prefix: string, planId: string, period: string): string {
  return `${prefix}:${planId}:${period}`;
}
function getWeekday(): number { const d = getDay(new Date()); return d === 0 ? 7 : d; }
function getWeekKey(d: Date): string {
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = Math.floor((d.getTime() - start.getTime()) / 86400000);
  return `${d.getFullYear()}-${Math.ceil((diff + start.getDay() + 1) / 7)}`;
}

export function useReminder() {
  const showAnimation = useStore(state => state.showAnimation);
  const settings = useStore(state => state.settings);
  const pendingPlans = useStore(state => state.pendingPlans);

  const pendingPlansRef = useRef(pendingPlans);
  pendingPlansRef.current = pendingPlans;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const showAnimRef = useRef(showAnimation);
  showAnimRef.current = showAnimation;

  // 已通知记录
  const notifiedRef = useRef<Set<string>>(new Set());
  // 节假日顺延记录：key = "postpone:weekly:planId:weekKey" → 在原定日期是节假日时设置
  const postponedRef = useRef<Set<string>>(new Set());
  // 今日动画
  const todayAnimRef = useRef('');

  // 清理过期的 key
  const cleanKeys = (todayStr: string) => {
    const keys = Array.from(notifiedRef.current);
    const next = new Set<string>();
    for (const k of keys) {
      if (k.startsWith('once:') || k.includes(todayStr)) {
        next.add(k);
      }
    }
    notifiedRef.current = next;
    // 清理过期的顺延记录（非本周/本月的）
    const postponedKeys = Array.from(postponedRef.current);
    const nextPostponed = new Set<string>();
    const thisWeek = getWeekKey(new Date());
    const thisMonth = format(new Date(), 'yyyy-MM');
    for (const k of postponedKeys) {
      if (k.includes(thisWeek) || k.includes(thisMonth)) {
        nextPostponed.add(k);
      }
    }
    postponedRef.current = nextPostponed;
  };

  // ---- 单个计划检测 ----
  function checkPlan(plan: Plan, now: Date, todayStr: string, isHoliday: boolean): Plan[] {
    const triggered: Plan[] = [];
    if (!plan.due_date) return triggered;

    const dueDate = parseISO(plan.due_date);
    const isOverdue = isBefore(dueDate, now);
    const weekKey = getWeekKey(now);
    const monthKey = format(now, 'yyyy-MM');

    // ==========================================
    // 过期前提醒 — N 个工作日之前提醒（自动跳过节假日）
    // 逻辑：从截止日期往前数 N 个工作日，到那天就提醒
    // 如果中间有长假，自动提前更多天
    // ==========================================
    if (!isOverdue && plan.remind_expire_before_enabled) {
      const workdaysBefore = plan.remind_expire_before_days || 7;
      // 计算 N 个工作日前的日期（自动跳过周末和节假日）
      const targetDate = getWorkdaysBefore(dueDate, workdaysBefore);
      // 到了提醒日且提醒时间已过
      if (isBefore(targetDate, now) || Math.abs(differenceInDays(now, targetDate)) < 1) {
        const remindTime = plan.remind_expire_before_time || '09:00';
        const [h, m] = remindTime.split(':').map(Number);
        const todayRemind = new Date(now);
        todayRemind.setHours(h, m, 0, 0);
        if (isAfter(now, todayRemind)) {
          const key = makeKey('expire_before', plan.id, todayStr);
          if (!notifiedRef.current.has(key)) {
            notifiedRef.current.add(key);
            triggered.push(plan);
          }
        }
      }
    }

    // ==========================================
    // 截止临近提醒 — 不受节假日影响
    // ==========================================
    if (!isOverdue && plan.remind_later_enabled) {
      const minutes = plan.remind_later_minutes || 60;
      const minsUntilDue = differenceInMinutes(dueDate, now);
      if (minsUntilDue > 0 && minsUntilDue <= minutes) {
        const key = makeKey('later', plan.id, todayStr);
        if (!notifiedRef.current.has(key)) {
          notifiedRef.current.add(key);
          triggered.push(plan);
        }
      }
    }

    // ==========================================
    // 每日提醒 — 节假日顺延到下一个工作日
    // ==========================================
    if (plan.remind_daily_enabled) {
      if (!isHoliday) {
        fireTimeBased(plan, plan.remind_daily_time, 'daily', todayStr, now, triggered);
      }
      // 节假日：不触发，也不标记为已通知（下一个工作日自动触发）
    }

    // ==========================================
    // 每周提醒 — 节假日顺延
    // ==========================================
    if (plan.remind_weekly_enabled) {
      const targetDay = plan.remind_weekly_day || 1;
      const todayWeekday = getWeekday();
      const postponeKey = makeKey('postpone_weekly', plan.id, weekKey);

      if (todayWeekday === targetDay) {
        if (isHoliday) {
          // 标记顺延，等下一个工作日触发
          postponedRef.current.add(postponeKey);
        } else {
          fireTimeBased(plan, plan.remind_weekly_time, 'weekly', weekKey, now, triggered);
        }
      } else if (todayWeekday > targetDay && postponedRef.current.has(postponeKey) && !isHoliday) {
        // 顺延触发：之前的目标日被跳过了，今天是之后第一个工作日
        postponedRef.current.delete(postponeKey);
        fireTimeBased(plan, plan.remind_weekly_time, 'weekly', weekKey, now, triggered);
      }
    }

    // ==========================================
    // 每月提醒 — 节假日顺延
    // ==========================================
    if (plan.remind_monthly_enabled) {
      const targetDay = plan.remind_monthly_day || 1;
      const todayDay = now.getDate();
      const postponeKey = makeKey('postpone_monthly', plan.id, monthKey);

      if (todayDay === targetDay) {
        if (isHoliday) {
          postponedRef.current.add(postponeKey);
        } else {
          fireTimeBased(plan, plan.remind_monthly_time, 'monthly', monthKey, now, triggered);
        }
      } else if (todayDay > targetDay && postponedRef.current.has(postponeKey) && !isHoliday) {
        postponedRef.current.delete(postponeKey);
        fireTimeBased(plan, plan.remind_monthly_time, 'monthly', monthKey, now, triggered);
      }
    }

    // ==========================================
    // 指定日期提醒 — 不受节假日影响
    // ==========================================
    if (plan.remind_once_enabled && plan.remind_once_datetime) {
      const onceDate = parseISO(plan.remind_once_datetime);
      if (isBefore(onceDate, now)) {
        const key = makeKey('once', plan.id, 'once');
        if (!notifiedRef.current.has(key)) {
          notifiedRef.current.add(key);
          triggered.push(plan);
        }
      }
    }

    // ==========================================
    // 过期后提醒 — 按过期提醒频率设置
    // ==========================================
    if (isOverdue && settingsRef.current.overdue_remind === 'true') {
      const intervalHours = parseFloat(settingsRef.current.overdue_remind_interval || '1');
      const hourBlock = Math.floor(now.getHours() / Math.max(intervalHours, 0.5));
      const periodKey = `${todayStr}-h${hourBlock}`;

      // 「截止临近提醒」类型任务过期后，按频率提醒
      if (plan.remind_later_enabled) {
        const key = makeKey('overdue_later', plan.id, periodKey);
        if (!notifiedRef.current.has(key)) {
          notifiedRef.current.add(key);
          triggered.push(plan);
        }
      }

      // 其他过期任务也按频率提醒
      if (settingsRef.current.overdue_remind_mode === 'frequency') {
        const freqKey = makeKey('overdue_freq', plan.id, periodKey);
        if (!notifiedRef.current.has(freqKey)) {
          notifiedRef.current.add(freqKey);
          triggered.push(plan);
        }
      }
    }

    // ==========================================
    // snooze 循环 — 按过期提醒频率
    // ==========================================
    if (plan.snooze_last_at) {
      const snoozeTime = parseISO(plan.snooze_last_at);
      const intervalHours = parseFloat(settingsRef.current.overdue_remind_interval || '1');
      const hoursSinceSnooze = differenceInMinutes(now, snoozeTime) / 60;
      if (hoursSinceSnooze >= Math.max(intervalHours, 0.5)) {
        const hourBlock = Math.floor(now.getHours() / Math.max(intervalHours, 0.5));
        const snoozeKey = makeKey('snooze_recur', plan.id, `${todayStr}-h${hourBlock}`);
        if (!notifiedRef.current.has(snoozeKey)) {
          notifiedRef.current.add(snoozeKey);
          triggered.push(plan);
        }
      }
    }

    return triggered;
  }

  // ---- 时间型提醒辅助 ----
  function fireTimeBased(plan: Plan, timeStr: string, type: string, period: string, now: Date, out: Plan[]) {
    const t = timeStr || '09:00';
    const [h, m] = t.split(':').map(Number);
    const remindAt = new Date(now);
    remindAt.setHours(h, m, 0, 0);
    if (isAfter(now, remindAt)) {
      const key = makeKey(type, plan.id, period);
      if (!notifiedRef.current.has(key)) {
        notifiedRef.current.add(key);
        out.push(plan);
      }
    }
  }

  // ---- 发送通知 ----
  function sendNotifications(plans: Plan[]) {
    if (plans.length === 0) return;
    const unique = new Map<string, Plan>();
    for (const p of plans) { if (!unique.has(p.id)) unique.set(p.id, p); }
    const deduped = Array.from(unique.values());

    if (deduped.length === 1) {
      const plan = deduped[0];
      const overdueDays = plan.due_date ? differenceInDays(new Date(), parseISO(plan.due_date)) : 0;
      const body = overdueDays > 0
        ? `${plan.title}\n已延期 ${overdueDays} 天`
        : `${plan.title}\n截止：${plan.due_date?.slice(0, 16) || '未设置'}`;
      invoke('show_notification', { title: '🔔 计划提醒', body, planId: plan.id, count: 1 })
        .catch(e => console.error('通知失败:', e));
    } else {
      invoke('show_notification', {
        title: '🔔 多个计划需要关注',
        body: `您有 ${deduped.length} 个计划需要关注\n请打开主窗口查看详情`,
        planId: null, count: deduped.length,
      }).catch(e => console.error('通知失败:', e));
    }

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    if (settingsRef.current.animation_enabled !== 'false' && todayAnimRef.current !== todayStr) {
      todayAnimRef.current = todayStr;
      showAnimRef.current('overdue', '⏰ 有任务需要关注！', 'seedling');
    }
  }

  // ---- 主循环 ----
  const checkAll = () => {
    const plans = pendingPlansRef.current;
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const holiday = !isWorkday(now);

    cleanKeys(todayStr);

    const allTriggered: Plan[] = [];
    for (const plan of plans) {
      allTriggered.push(...checkPlan(plan, now, todayStr, holiday));
    }
    sendNotifications(allTriggered);
  };

  // ---- 生命周期 ----
  useEffect(() => {
    const initial = setTimeout(() => checkAll(), 3000);
    const interval = setInterval(() => checkAll(), 30_000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, []);
}
