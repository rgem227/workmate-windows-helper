// 进行中看板页面
import { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { invoke } from '@tauri-apps/api/core';
import type { Plan, Priority } from '../types';
import { format, differenceInDays, isToday, isBefore } from 'date-fns';
import { playSound } from '../utils/sound';

type FilterType = 'all' | 'today' | 'within3days' | 'within7days' | 'overdue';
type SortType = 'dueDate' | 'priority' | 'createdAt';

const priorityOrder: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export default function PlansPending() {
  const { pendingPlans, openPlanModal, deletePlan, completePlan, showAnimation, addToast, settings, highlightPlanId, clearHighlight } = useStore();
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortType>('dueDate');
  const planRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // 通知窗口跳转定位：滚动到对应计划并高亮
  useEffect(() => {
    if (highlightPlanId) {
      // 确保筛选条件能看到该计划
      setFilter('all');
      setSearch('');
      // 延迟等 DOM 更新后滚动
      setTimeout(() => {
        const el = planRefs.current[highlightPlanId];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
          setTimeout(() => {
            el.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
          }, 3000);
        }
        clearHighlight();
      }, 100);
    }
  }, [highlightPlanId]);

  const filteredPlans = useMemo(() => {
    let plans = [...pendingPlans];

    // 搜索
    if (search) {
      plans = plans.filter(plan => {
        const titleMatch = plan.title.toLowerCase().includes(search.toLowerCase());
        const descMatch = plan.description?.toLowerCase().includes(search.toLowerCase()) || false;
        return titleMatch || descMatch;
      });
    }

    // 状态筛选
    const now = new Date();
    plans = plans.filter(plan => {
      if (!plan.due_date) return filter === 'all';
      const dueDate = new Date(plan.due_date);

      switch (filter) {
        case 'today':
          return isToday(dueDate);
        case 'within3days':
          return !isBefore(dueDate, now) && differenceInDays(dueDate, now) <= 3;
        case 'within7days':
          return !isBefore(dueDate, now) && differenceInDays(dueDate, now) <= 7;
        case 'overdue':
          return isBefore(dueDate, now) && !isToday(dueDate);
        default:
          return true;
      }
    });

    // 排序
    plans.sort((a, b) => {
      switch (sortBy) {
        case 'dueDate':
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        case 'priority':
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        case 'createdAt':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default:
          return 0;
      }
    });

    return plans;
  }, [pendingPlans, filter, search, sortBy]);

  const getOverdueDays = (plan: Plan): number | null => {
    if (!plan.due_date) return null;
    const dueDate = new Date(plan.due_date);
    const now = new Date();
    if (!isBefore(dueDate, now)) return null;
    return differenceInDays(now, dueDate);
  };

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'medium': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'low': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    }
  };

  const handleComplete = async (plan: Plan) => {
    await completePlan(plan.id);

    // 播放完成提示音
    if (settings.remind_sound === 'true') {
      playSound(settings.remind_sound_file || 'default');
    }

    // 显示完成激励动画
    const messages = [
      '✨ 完成了！继续加油！',
      '🌟 今日份努力，已收入囊中！',
      '💪 搞定！你真行！',
      '🎊 撒花撒花！为今天的你鼓掌！',
      '👍 干得漂亮！',
    ];
    const message = messages[Math.floor(Math.random() * messages.length)];
    showAnimation('success', message, 'confetti');
  };

  const handleDelete = async (plan: Plan) => {
    if (confirm(`确定要删除计划"${plan.title}"吗？删除后不可恢复。`)) {
      await deletePlan(plan.id);
    }
  };

  // 测试通知
  const handleTestNotify = async () => {
    try {
      await invoke('show_notification', {
        title: '🔔 测试通知',
        body: '这是一条测试通知\n用于验证通知窗口功能',
        planId: 'test-001',
        count: 1
      });
      addToast({
        title: '🔔 测试通知',
        body: '这是一条测试通知',
      });
    } catch (e) {
      console.error('测试通知失败:', e);
    }
  };

  // 测试提示音
  const handleTestSound = async () => {
    try {
      playSound(settings.remind_sound_file || 'default');
    } catch (e) {
      console.error('测试声音失败:', e);
    }
  };

  // 测试动画
  const handleTestAnimation = () => {
    showAnimation('success', '🎉 动画测试成功！', 'confetti');
  };

  const filterButtons: { key: FilterType; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'today', label: '今日到期' },
    { key: 'within3days', label: '3天内' },
    { key: 'within7days', label: '7天内' },
    { key: 'overdue', label: '延期中' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">进行中工作</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleTestNotify}
            className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg transition-colors"
            title="测试通知窗口"
          >
            🔔 测试通知
          </button>
          <button
            onClick={handleTestSound}
            className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-sm rounded-lg transition-colors"
            title="测试提示音"
          >
            🔊 测试声音
          </button>
          <button
            onClick={handleTestAnimation}
            className="px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white text-sm rounded-lg transition-colors"
            title="测试动画"
          >
            ✨ 测试动画
          </button>
          <button
            onClick={() => openPlanModal()}
            className="px-3 py-1.5 bg-primary dark:bg-primary-dark text-white text-sm rounded-lg hover:bg-primary-hover dark:hover:bg-primary-dark-hover transition-colors"
          >
            + 新建计划
          </button>
        </div>
      </div>

      {/* 筛选和搜索 */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0 flex-wrap">
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 flex-wrap">
          {filterButtons.map(btn => (
            <button
              key={btn.key}
              onClick={() => setFilter(btn.key)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                filter === btn.key
                  ? 'bg-white dark:bg-gray-700 text-primary dark:text-primary-dark'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              {btn.label}
              {btn.key === 'overdue' && pendingPlans.filter(p => p.due_date && isBefore(new Date(p.due_date), new Date())).length > 0 && (
                <span className="ml-1 text-red-500">
                  ({pendingPlans.filter(p => p.due_date && isBefore(new Date(p.due_date), new Date())).length})
                </span>
              )}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="搜索计划..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
        />

        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as SortType)}
          className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="dueDate">按截止日期</option>
          <option value="priority">按优先级</option>
          <option value="createdAt">按创建时间</option>
        </select>
      </div>

      {/* 计划列表 */}
      <div className="flex-1 overflow-auto space-y-2 min-h-0">
        {filteredPlans.length === 0 ? (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500">
            <p className="text-3xl mb-3">📋</p>
            <p>暂无进行中的工作计划</p>
            <button
              onClick={() => openPlanModal()}
              className="mt-3 text-primary dark:text-primary-dark hover:underline text-sm"
            >
              创建第一个计划
            </button>
          </div>
        ) : (
          filteredPlans.map(plan => {
            const overdueDays = getOverdueDays(plan);
            const isOverdue = overdueDays !== null;

            return (
              <div
                key={plan.id}
                ref={(el) => { planRefs.current[plan.id] = el; }}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 transition-all ${
                  isOverdue ? 'border-l-red-500' : 'border-l-green-500'
                }`}
              >
                {isOverdue && overdueDays && overdueDays > 0 && (
                  <div className="px-3 py-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs rounded-t-lg">
                    ⚠️ 已延期 {overdueDays} 天
                  </div>
                )}
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm text-gray-800 dark:text-white truncate">
                          {plan.title}
                        </h3>
                        <span className={`px-1.5 py-0.5 text-xs rounded-full flex-shrink-0 ${getPriorityColor(plan.priority)}`}>
                          {plan.priority === 'high' ? '高' : plan.priority === 'medium' ? '中' : '低'}
                        </span>
                      </div>
                      {plan.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 line-clamp-1">
                          {plan.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        {plan.due_date && (
                          <span className="flex items-center gap-1">
                            📅 {format(new Date(plan.due_date), 'yyyy-MM-dd HH:mm')}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          🔔 {getRemindTypeLabel(plan)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => openPlanModal(plan)}
                        className="p-1.5 text-gray-400 hover:text-primary dark:hover:text-primary-dark transition-colors"
                        title="编辑"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(plan)}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                        title="删除"
                      >
                        🗑️
                      </button>
                      <button
                        onClick={() => handleComplete(plan)}
                        className={`px-3 py-1 text-xs text-white rounded-lg transition-colors ${
                          isOverdue
                            ? 'bg-orange-500 hover:bg-orange-600'
                            : 'bg-green-500 hover:bg-green-600'
                        }`}
                      >
                        ☐ 完成
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function getRemindTypeLabel(plan: Plan): string {
  const parts: string[] = [];
  if (plan.remind_expire_before_enabled) parts.push(`过期前${plan.remind_expire_before_days || 7}天`);
  if (plan.remind_later_enabled) {
    const m = plan.remind_later_minutes || 1440;
    parts.push(m < 60 ? `稍后${m}分钟` : m < 1440 ? `稍后${m / 60}小时` : '稍后1天');
  }
  if (plan.remind_daily_enabled) parts.push('每日' + (plan.remind_daily_time || '09:00'));
  if (plan.remind_weekly_enabled) {
    const days = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    parts.push('每' + (days[plan.remind_weekly_day] || '周一') + (plan.remind_weekly_time || '09:00'));
  }
  if (plan.remind_monthly_enabled) parts.push(`每月${plan.remind_monthly_day || 1}日`);
  if (plan.remind_once_enabled) parts.push('指定日期');
  if (parts.length === 0) parts.push('不提醒');
  return parts.join(' | ');
}