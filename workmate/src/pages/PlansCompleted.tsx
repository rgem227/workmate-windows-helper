// 已完成看板页面
import { useState, useMemo } from 'react';
import { useStore } from '../store';
import type { Plan, Priority } from '../types';
import { format } from 'date-fns';
import { formatNearDueReminder } from '../utils/reminders';

export default function PlansCompleted() {
  const { completedPlans, deletePlan } = useStore();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'completedAt' | 'priority' | 'createdAt'>('completedAt');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const filteredPlans = useMemo(() => {
    let plans = [...completedPlans];

    // 搜索
    if (search) {
      plans = plans.filter(plan => {
        const titleMatch = plan.title.toLowerCase().includes(search.toLowerCase());
        const descMatch = plan.description?.toLowerCase().includes(search.toLowerCase()) || false;
        return titleMatch || descMatch;
      });
    }

    // 排序
    const priorityOrder: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
    plans.sort((a, b) => {
      switch (sortBy) {
        case 'completedAt':
          if (!a.completed_at && !b.completed_at) return 0;
          if (!a.completed_at) return 1;
          if (!b.completed_at) return -1;
          return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime();
        case 'priority':
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        case 'createdAt':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default:
          return 0;
      }
    });

    return plans;
  }, [completedPlans, search, sortBy]);

  const handleDelete = async (plan: Plan) => {
    if (confirm(`确定要删除已完成计划"${plan.title}"吗？删除后不可恢复。`)) {
      await deletePlan(plan.id);
    }
  };

  const handleClearAll = async () => {
    if (completedPlans.length === 0) return;
    if (confirm(`确定要清空所有 ${completedPlans.length} 个已完成记录吗？此操作不可恢复。`)) {
      for (const plan of completedPlans) {
        await deletePlan(plan.id);
      }
    }
  };

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'medium': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'low': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    }
  };

  const getRemindTypeLabel = (plan: Plan): string => {
    const parts: string[] = [];
    if (plan.remind_expire_before_enabled) parts.push(`过期前${plan.remind_expire_before_days || 7}天`);
    if (plan.remind_later_enabled) {
      parts.push(formatNearDueReminder(plan.remind_later_minutes));
    }
    if (plan.remind_daily_enabled) parts.push('每日');
    if (plan.remind_weekly_enabled) parts.push('每周');
    if (plan.remind_monthly_enabled) parts.push('每月');
    if (plan.remind_once_enabled) parts.push('指定日期');
    if (parts.length === 0) parts.push('不提醒');
    return parts.join(' | ');
  };

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">已完成工作</h2>
        {completedPlans.length > 0 && (
          <button
            onClick={handleClearAll}
            className="px-4 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            🗑️ 清空已完成
          </button>
        )}
      </div>

      {/* 搜索和排序 */}
      <div className="flex items-center gap-4 mb-4">
        <input
          type="text"
          placeholder="搜索已完成计划..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
        />

        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
          className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="completedAt">按完成时间</option>
          <option value="priority">按优先级</option>
          <option value="createdAt">按创建时间</option>
        </select>
      </div>

      {/* 计划列表 */}
      <div className="flex-1 overflow-auto space-y-3">
        {filteredPlans.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <p className="text-4xl mb-4">✅</p>
            <p>暂无已完成的工作计划</p>
          </div>
        ) : (
          filteredPlans.map(plan => (
            <div
              key={plan.id}
              onClick={() => setSelectedPlan(plan)}
              className="bg-white dark:bg-surface-card-dark rounded-lg shadow-sm border-l-4 border-l-green-500 dark:bg-gray-800 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-gray-800 dark:text-white line-through opacity-75">
                        {plan.title}
                      </h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getPriorityColor(plan.priority)}`}>
                        {plan.priority === 'high' ? '高' : plan.priority === 'medium' ? '中' : '低'}
                      </span>
                    </div>
                    {plan.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">
                        {plan.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      {plan.due_date && (
                        <span className="flex items-center gap-1">
                          📅 截止：{format(new Date(plan.due_date), 'yyyy-MM-dd HH:mm')}
                        </span>
                      )}
                      {plan.completed_at && (
                        <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                          ✅ 完成：{format(new Date(plan.completed_at), 'yyyy-MM-dd HH:mm')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(plan); }}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      title="删除"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 详情弹窗 */}
      {selectedPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedPlan(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white">计划详情</h3>
                <button onClick={() => setSelectedPlan(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">✕</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">标题</label>
                  <p className="text-gray-800 dark:text-white">{selectedPlan.title}</p>
                </div>

                {selectedPlan.description && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">详细描述</label>
                    <p className="text-gray-800 dark:text-white whitespace-pre-wrap">{selectedPlan.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">优先级</label>
                    <p className="text-gray-800 dark:text-white">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getPriorityColor(selectedPlan.priority)}`}>
                        {selectedPlan.priority === 'high' ? '高' : selectedPlan.priority === 'medium' ? '中' : '低'}
                      </span>
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">提醒类型</label>
                    <p className="text-gray-800 dark:text-white">{getRemindTypeLabel(selectedPlan)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">截止日期</label>
                    <p className="text-gray-800 dark:text-white">
                      {selectedPlan.due_date ? format(new Date(selectedPlan.due_date), 'yyyy-MM-dd HH:mm') : '未设置'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">完成时间</label>
                    <p className="text-gray-800 dark:text-white">
                      {selectedPlan.completed_at ? format(new Date(selectedPlan.completed_at), 'yyyy-MM-dd HH:mm') : '未完成'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">创建时间</label>
                    <p className="text-gray-800 dark:text-white">{format(new Date(selectedPlan.created_at), 'yyyy-MM-dd HH:mm')}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">更新时间</label>
                    <p className="text-gray-800 dark:text-white">{format(new Date(selectedPlan.updated_at), 'yyyy-MM-dd HH:mm')}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedPlan(null)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
