// 工作记录页面：负责时间粒度、周期导航和日历/列表视图切换。
import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
  Plus,
  RotateCcw,
} from 'lucide-react';
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
} from 'date-fns';
import { useStore } from '../store';
import RecordCalendar, { type CalendarGranularity } from '../components/RecordCalendar';
import RecordList from '../components/RecordList';

type ViewMode = 'calendar' | 'list';

const rangeOptions: Array<{ value: CalendarGranularity; label: string }> = [
  { value: 'today', label: '今日' },
  { value: 'thisWeek', label: '本周' },
  { value: 'thisMonth', label: '本月' },
  { value: 'halfYear', label: '近半年' },
  { value: 'thisYear', label: '本年' },
];

const weekdayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function getPeriodBounds(granularity: CalendarGranularity, anchorDate: Date) {
  switch (granularity) {
    case 'today':
      return { start: startOfDay(anchorDate), end: endOfDay(anchorDate) };
    case 'thisWeek':
      return {
        start: startOfWeek(anchorDate, { weekStartsOn: 1 }),
        end: endOfWeek(anchorDate, { weekStartsOn: 1 }),
      };
    case 'thisMonth':
      return { start: startOfMonth(anchorDate), end: endOfMonth(anchorDate) };
    case 'halfYear':
      return {
        start: startOfMonth(subMonths(anchorDate, 5)),
        end: endOfMonth(anchorDate),
      };
    case 'thisYear':
      return { start: startOfYear(anchorDate), end: endOfYear(anchorDate) };
  }
}

function periodTitle(granularity: CalendarGranularity, anchorDate: Date) {
  const bounds = getPeriodBounds(granularity, anchorDate);
  switch (granularity) {
    case 'today':
      return `${format(anchorDate, 'yyyy年M月d日')} ${weekdayLabels[anchorDate.getDay()]}`;
    case 'thisWeek':
      return `${format(bounds.start, 'M月d日')} - ${format(bounds.end, 'M月d日')}`;
    case 'thisMonth':
      return format(anchorDate, 'yyyy年M月');
    case 'halfYear':
      return `${format(bounds.start, 'yyyy年M月')} - ${format(bounds.end, 'yyyy年M月')}`;
    case 'thisYear':
      return format(anchorDate, 'yyyy年');
  }
}

function periodSubline(granularity: CalendarGranularity, anchorDate: Date) {
  switch (granularity) {
    case 'today':
      return '单日工作时间轴';
    case 'thisWeek':
      return '周一至周日';
    case 'thisMonth':
      return '自然月视图';
    case 'halfYear':
      return '连续 6 个自然月';
    case 'thisYear':
      return `${format(startOfYear(anchorDate), 'yyyy')} 年度记录`;
  }
}

function moveAnchor(granularity: CalendarGranularity, anchorDate: Date, direction: -1 | 1) {
  switch (granularity) {
    case 'today':
      return addDays(anchorDate, direction);
    case 'thisWeek':
      return addWeeks(anchorDate, direction);
    case 'thisMonth':
      return addMonths(anchorDate, direction);
    case 'halfYear':
      return addMonths(anchorDate, direction * 6);
    case 'thisYear':
      return addYears(anchorDate, direction);
  }
}

function isCurrentPeriod(granularity: CalendarGranularity, anchorDate: Date) {
  const current = getPeriodBounds(granularity, new Date());
  const selected = getPeriodBounds(granularity, anchorDate);
  return isSameDay(current.start, selected.start) && isSameDay(current.end, selected.end);
}

function defaultDateTime(date: Date) {
  const now = new Date();
  const selected = new Date(date);
  selected.setHours(now.getHours(), now.getMinutes(), 0, 0);
  return format(selected, "yyyy-MM-dd'T'HH:mm");
}

export default function WorkRecords() {
  const {
    records,
    loadRecords,
    deleteRecord,
    plans,
    openRecordModal,
  } = useStore();
  const [granularity, setGranularity] = useState<CalendarGranularity>('today');
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));

  const bounds = useMemo(() => getPeriodBounds(granularity, anchorDate), [granularity, anchorDate]);
  const startDate = format(bounds.start, 'yyyy-MM-dd');
  const endDate = format(bounds.end, 'yyyy-MM-dd');
  const current = isCurrentPeriod(granularity, anchorDate);

  useEffect(() => {
    // 以当前周期查询完整数据，日历和列表共享同一份记录集合。
    loadRecords(startDate, endDate);
  }, [loadRecords, startDate, endDate]);

  const handleGranularityChange = (next: CalendarGranularity) => {
    setGranularity(next);
    setAnchorDate(startOfDay(new Date()));
    setViewMode('calendar');
  };

  const handleToday = () => {
    setAnchorDate(startOfDay(new Date()));
  };

  const handleCreate = (date?: Date) => {
    openRecordModal(undefined, defaultDateTime(date || anchorDate));
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这条工作记录吗？')) {
      await deleteRecord(id);
    }
  };

  const renderPeriodButton = (direction: -1 | 1) => (
    <button
      type="button"
      onClick={() => setAnchorDate(moveAnchor(granularity, anchorDate, direction))}
      title={direction < 0 ? '上一个时间段' : '下一个时间段'}
      aria-label={direction < 0 ? '上一个时间段' : '下一个时间段'}
      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
    >
      {direction < 0 ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
    </button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="mb-4 flex shrink-0 items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">工作记录</h2>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-primary dark:bg-blue-950/50 dark:text-primary-dark">记录中心</span>
          </div>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">整理每一天的工作进展</p>
        </div>
        <button
          type="button"
          onClick={() => handleCreate()}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-white shadow-sm shadow-blue-500/20 transition-colors hover:bg-primary-hover dark:bg-primary-dark dark:hover:bg-primary-dark-hover"
        >
          <Plus size={17} />
          新建记录
        </button>
      </header>

      <section className="mb-4 flex shrink-0 items-center gap-3 overflow-x-auto pb-1">
        <div className="flex shrink-0 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          {rangeOptions.map(option => {
            const active = granularity === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleGranularityChange(option.value)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors ${active ? 'bg-slate-900 font-medium text-white shadow-sm dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200'}`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex min-w-[340px] shrink-0 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:min-w-[360px]">
          {renderPeriodButton(-1)}
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{periodTitle(granularity, anchorDate)}</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">{periodSubline(granularity, anchorDate)}</p>
          </div>
          {renderPeriodButton(1)}
          <button
            type="button"
            onClick={handleToday}
            disabled={current}
            title="回到当前时间段"
            className="flex shrink-0 items-center gap-1 rounded-lg border-l border-slate-100 px-2 py-2 text-xs text-primary transition-colors hover:bg-blue-50 disabled:cursor-default disabled:opacity-40 dark:border-slate-700 dark:text-primary-dark dark:hover:bg-blue-950/30"
          >
            <RotateCcw size={13} />
            当前
          </button>
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-3 py-2.5 dark:border-slate-700/70 sm:px-4">
          <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
            <span className="font-medium text-slate-600 dark:text-slate-300">{records.length} 条记录</span>
            <span>·</span>
            <span>{periodTitle(granularity, anchorDate)}</span>
          </div>
          <div className="flex items-center rounded-lg bg-slate-100 p-0.5 dark:bg-slate-900/60" role="tablist" aria-label="记录视图">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'calendar'}
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === 'calendar' ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              <CalendarDays size={14} /> 日历
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'list'}
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === 'list' ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              <List size={14} /> 列表
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          {viewMode === 'calendar' ? (
            <RecordCalendar
              granularity={granularity}
              anchorDate={anchorDate}
              records={records}
              plans={plans}
              onCreate={handleCreate}
              onOpen={record => openRecordModal(record)}
            />
          ) : (
            <div className="h-full overflow-auto">
              <RecordList
                records={records}
                plans={plans}
                grouped={granularity !== 'today'}
                onOpen={record => openRecordModal(record)}
                onDelete={handleDelete}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
