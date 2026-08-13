// 工作记录页面
import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../store';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO, isValid } from 'date-fns';

type DateRangeType = 'today' | 'thisWeek' | 'thisMonth' | 'halfYear' | 'custom';

export default function WorkRecords() {
  const { records, loadRecords, deleteRecord, plans, openRecordModal } = useStore();
  const [selectedRange, setSelectedRange] = useState<DateRangeType>('today');
  const [customDate, setCustomDate] = useState('');
  const [displayDate, setDisplayDate] = useState(new Date());

  useEffect(() => {
    loadRecordsByRange(selectedRange, customDate);
  }, [selectedRange, customDate, displayDate]);

  const loadRecordsByRange = (range: DateRangeType, custom: string) => {
    const now = displayDate;
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    switch (range) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'thisWeek':
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        endDate = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'thisMonth':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case 'halfYear':
        startDate = subMonths(now, 6);
        endDate = now;
        break;
      case 'custom':
        if (custom) {
          const parsed = parseISO(custom);
          if (isValid(parsed)) {
            startDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
            endDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 23, 59, 59);
          }
        }
        break;
    }

    if (startDate && endDate) {
      loadRecords(format(startDate, 'yyyy-MM-dd'));
    }
  };

  const handlePrev = () => {
    const newDate = new Date(displayDate);
    switch (selectedRange) {
      case 'today':
        newDate.setDate(newDate.getDate() - 1);
        break;
      case 'thisWeek':
        newDate.setDate(newDate.getDate() - 7);
        break;
      case 'thisMonth':
        newDate.setMonth(newDate.getMonth() - 1);
        break;
      case 'halfYear':
      case 'custom':
        newDate.setMonth(newDate.getMonth() - 1);
        break;
    }
    setDisplayDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(displayDate);
    switch (selectedRange) {
      case 'today':
        newDate.setDate(newDate.getDate() + 1);
        break;
      case 'thisWeek':
        newDate.setDate(newDate.getDate() + 7);
        break;
      case 'thisMonth':
        newDate.setMonth(newDate.getMonth() + 1);
        break;
      case 'halfYear':
      case 'custom':
        newDate.setMonth(newDate.getMonth() + 1);
        break;
    }
    setDisplayDate(newDate);
  };

  const handleGoToToday = () => {
    setDisplayDate(new Date());
  };

  const getDisplayText = () => {
    switch (selectedRange) {
      case 'today':
        return format(displayDate, 'yyyy-MM-dd');
      case 'thisWeek':
        return `${format(startOfWeek(displayDate, { weekStartsOn: 1 }), 'MM-dd')} ~ ${format(endOfWeek(displayDate, { weekStartsOn: 1 }), 'MM-dd')}`;
      case 'thisMonth':
        return format(displayDate, 'yyyy年MM月');
      case 'halfYear':
        return `${format(subMonths(displayDate, 6), 'yyyy-MM')} ~ ${format(displayDate, 'yyyy-MM')}`;
      case 'custom':
        return customDate || '选择日期';
    }
  };

  const isToday = format(displayDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  const getPlanTitle = (planId: string | null): string => {
    if (!planId) return '无关联计划';
    const plan = plans.find(p => p.id === planId);
    return plan?.title || '未知计划';
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这条工作记录吗？')) {
      await deleteRecord(id);
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      const recordDate = parseISO(record.record_date);
      if (!isValid(recordDate)) return false;

      switch (selectedRange) {
        case 'today':
          return format(recordDate, 'yyyy-MM-dd') === format(displayDate, 'yyyy-MM-dd');
        case 'thisWeek':
          return isWithinInterval(recordDate, {
            start: startOfWeek(displayDate, { weekStartsOn: 1 }),
            end: endOfWeek(displayDate, { weekStartsOn: 1 })
          });
        case 'thisMonth':
          return format(recordDate, 'yyyy-MM') === format(displayDate, 'yyyy-MM');
        case 'halfYear':
          return recordDate >= subMonths(displayDate, 6) && recordDate <= displayDate;
        case 'custom':
          if (!customDate) return true;
          return format(recordDate, 'yyyy-MM-dd') === customDate;
        default:
          return true;
      }
    });
  }, [records, selectedRange, displayDate, customDate]);

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">工作记录</h2>
        <button
          onClick={() => openRecordModal()}
          className="px-4 py-2 bg-primary dark:bg-primary-dark text-white rounded-lg hover:bg-primary-hover dark:hover:bg-primary-dark-hover transition-colors flex items-center gap-2"
        >
          <span>+</span> 新建记录
        </button>
      </div>

      {/* 时间范围选择 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <select
            value={selectedRange}
            onChange={e => setSelectedRange(e.target.value as DateRangeType)}
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="today">今日</option>
            <option value="thisWeek">本周</option>
            <option value="thisMonth">本月</option>
            <option value="halfYear">近半年</option>
            <option value="custom">指定日期</option>
          </select>

          {selectedRange === 'custom' && (
            <input
              type="date"
              value={customDate}
              onChange={e => setCustomDate(e.target.value)}
              className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            ◀
          </button>
          <div className="flex items-center gap-2 min-w-[200px] justify-center">
            <span className="text-gray-800 dark:text-white font-medium">{getDisplayText()}</span>
            {isToday && selectedRange === 'today' ? (
              <span className="px-2 py-0.5 bg-primary/10 text-primary dark:text-primary-dark rounded-full text-xs">今天</span>
            ) : (
              <button
                onClick={handleGoToToday}
                className="px-2 py-0.5 text-primary dark:text-primary-dark hover:underline text-xs"
              >
                返回今日
              </button>
            )}
          </div>
          <button
            onClick={handleNext}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            ▶
          </button>
        </div>
      </div>

      {/* 记录数量 */}
      <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        共 {filteredRecords.length} 条记录
      </div>

      {/* 记录列表 */}
      <div className="flex-1 overflow-auto space-y-3">
        {filteredRecords.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <p className="text-4xl mb-4">📝</p>
            <p>暂无工作记录</p>
            <button
              onClick={() => openRecordModal()}
              className="mt-4 text-primary dark:text-primary-dark hover:underline"
            >
              添加第一条记录
            </button>
          </div>
        ) : (
          filteredRecords.map(record => (
            <div
              key={record.id}
              className="bg-white dark:bg-surface-card-dark rounded-lg shadow-sm p-4 dark:bg-gray-800"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-lg font-medium text-gray-700 dark:text-gray-300">
                      {format(new Date(record.record_date), 'HH:mm')}
                    </span>
                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full flex items-center gap-1">
                      📎 {getPlanTitle(record.plan_id)}
                    </span>
                  </div>
                  <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                    {record.content}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => openRecordModal(record)}
                    className="p-2 text-gray-400 hover:text-primary dark:hover:text-primary-dark transition-colors"
                    title="编辑"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(record.id)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    title="删除"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
