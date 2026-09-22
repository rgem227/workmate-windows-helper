import { useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  FileText,
  Link2,
  Plus,
  X,
} from 'lucide-react';
import {
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import type { Plan, WorkRecord } from '../types';

export type CalendarGranularity = 'today' | 'thisWeek' | 'thisMonth' | 'halfYear' | 'thisYear';

interface RecordCalendarProps {
  granularity: CalendarGranularity;
  anchorDate: Date;
  records: WorkRecord[];
  plans: Plan[];
  onCreate: (date: Date) => void;
  onOpen: (record: WorkRecord) => void;
}

interface MonthGridProps {
  month: Date;
  recordsByDay: Map<string, WorkRecord[]>;
  plans: Plan[];
  dense?: boolean;
  showSummaries?: boolean;
  onCreate: (date: Date) => void;
  onOpen: (record: WorkRecord) => void;
}

const weekLabels = ['一', '二', '三', '四', '五', '六', '日'];

function dateKey(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

function getPlanTitle(planId: string | null, plans: Plan[]) {
  if (!planId) return '无关联计划';
  return plans.find(plan => plan.id === planId)?.title || '未知计划';
}

function RecordSummary({ record, dense, onOpen }: {
  record: WorkRecord;
  dense?: boolean;
  onOpen: (record: WorkRecord) => void;
}) {
  const recordDate = parseISO(record.record_date);
  return (
    <button
      type="button"
      onClick={event => {
        event.stopPropagation();
        onOpen(record);
      }}
      className={`group/record flex w-full min-w-0 items-start gap-1.5 rounded-md text-left transition-colors hover:bg-blue-100 dark:hover:bg-blue-950/60 ${dense ? 'px-1 py-0.5' : 'px-2 py-1.5'}`}
      title={record.content}
    >
      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary dark:bg-primary-dark" />
      <span className="min-w-0 flex-1 truncate text-xs leading-5 text-slate-600 dark:text-slate-300">
        {!dense && <span className="mr-1 font-medium text-slate-400 dark:text-slate-500">{format(recordDate, 'HH:mm')}</span>}
        {record.content}
      </span>
      {!dense && <ChevronRight size={13} className="mt-1 shrink-0 text-slate-300 group-hover/record:text-primary dark:text-slate-600" />}
    </button>
  );
}

function DayPopover({ date, records, plans, onCreate, onOpen, onClose }: {
  date: Date;
  records: WorkRecord[];
  plans: Plan[];
  onCreate: (date: Date) => void;
  onOpen: (record: WorkRecord) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute left-1/2 top-full z-40 mt-2 w-64 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-2 text-left shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-800 dark:shadow-black/30">
      <div className="flex items-center justify-between border-b border-slate-100 px-2 pb-2 dark:border-slate-700">
        <div>
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{format(date, 'M月d日')}</p>
          <p className="text-[11px] text-slate-400">{records.length} 条工作记录</p>
        </div>
        <button type="button" title="关闭" aria-label="关闭" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
          <X size={14} />
        </button>
      </div>
      <div className="max-h-48 overflow-auto py-1">
        {records.map(record => (
          <button
            key={record.id}
            type="button"
            onClick={() => onOpen(record)}
            className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-blue-50 dark:hover:bg-slate-700"
          >
            <span className="mt-0.5 shrink-0 text-[11px] text-slate-400">{format(parseISO(record.record_date), 'HH:mm')}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-slate-700 dark:text-slate-200">{record.content}</span>
              <span className="mt-0.5 block truncate text-[11px] text-slate-400">{getPlanTitle(record.plan_id, plans)}</span>
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onCreate(date)}
        className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-blue-200 px-2 py-1.5 text-xs font-medium text-primary hover:bg-blue-50 dark:border-blue-900 dark:text-primary-dark dark:hover:bg-blue-950/30"
      >
        <Plus size={13} /> 新建当天记录
      </button>
    </div>
  );
}

function MonthGrid({ month, recordsByDay, plans, dense = false, showSummaries = false, onCreate, onOpen }: MonthGridProps) {
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const monthStart = startOfMonth(month);
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 ${dense ? 'p-2.5' : 'p-3 sm:p-4'}`}>
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={`font-semibold text-slate-700 dark:text-slate-200 ${dense ? 'text-xs' : 'text-sm'}`}>{format(month, 'yyyy年M月')}</span>
          {!dense && <CalendarDays size={15} className="text-primary dark:text-primary-dark" />}
        </div>
        {dense && <span className="text-[10px] text-slate-400">点击记录查看详情</span>}
      </div>

      <div className="grid grid-cols-7 border-b border-slate-100 pb-1 dark:border-slate-700/70">
        {weekLabels.map((label, index) => (
          <span key={label} className={`text-center text-[10px] font-medium ${index > 4 ? 'text-slate-400' : 'text-slate-500'} dark:text-slate-500`}>{label}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-slate-100 dark:bg-slate-700/70">
        {days.map(day => {
          const key = dateKey(day);
          const dayRecords = recordsByDay.get(key) || [];
          const inMonth = isSameMonth(day, month);
          const today = isToday(day);
          const active = activeDay === key;

          return (
            <div key={key} className={`relative min-w-0 bg-white dark:bg-slate-800 ${dense ? 'min-h-8' : 'min-h-[88px]'} ${!inMonth ? 'opacity-35' : ''}`}>
              <button
                type="button"
                onClick={() => {
                  if (dayRecords.length) setActiveDay(active ? null : key);
                  else onCreate(day);
                }}
                className={`flex w-full items-center gap-1 text-left ${dense ? 'px-1 py-1' : 'px-2 py-2'} ${today ? 'text-primary dark:text-primary-dark' : 'text-slate-500 dark:text-slate-400'} hover:bg-blue-50 dark:hover:bg-blue-950/30`}
                title={dayRecords.length ? '查看当天记录' : '新建当天记录'}
              >
                <span className={`${today ? 'flex h-5 w-5 items-center justify-center rounded-full bg-primary font-semibold text-white dark:bg-primary-dark' : 'font-medium'} ${dense ? 'text-[10px]' : 'text-xs'}`}>
                  {format(day, 'd')}
                </span>
                {dayRecords.length > 0 && <span className="ml-auto rounded-full bg-blue-50 px-1.5 text-[10px] font-medium text-primary dark:bg-blue-950/50 dark:text-primary-dark">{dayRecords.length}</span>}
              </button>

              {!dense && showSummaries && (
                <div className="space-y-0.5 px-1 pb-1">
                  {dayRecords.slice(0, 2).map(record => (
                    <RecordSummary key={record.id} record={record} onOpen={onOpen} />
                  ))}
                  {dayRecords.length > 2 && (
                    <button type="button" onClick={() => setActiveDay(key)} className="px-2 text-[11px] text-primary hover:underline dark:text-primary-dark">
                      还有 {dayRecords.length - 2} 条
                    </button>
                  )}
                </div>
              )}

              {dense && dayRecords.length > 0 && (
                <div className="flex justify-center gap-0.5 pb-1">
                  {dayRecords.slice(0, 3).map(record => <span key={record.id} className="h-1 w-1 rounded-full bg-primary dark:bg-primary-dark" />)}
                </div>
              )}

              {active && dayRecords.length > 0 && (
                <DayPopover
                  date={day}
                  records={dayRecords}
                  plans={plans}
                  onCreate={onCreate}
                  onOpen={record => {
                    setActiveDay(null);
                    onOpen(record);
                  }}
                  onClose={() => setActiveDay(null)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TodayAgenda({ date, records, plans, onCreate, onOpen }: {
  date: Date;
  records: WorkRecord[];
  plans: Plan[];
  onCreate: (date: Date) => void;
  onOpen: (record: WorkRecord) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <button type="button" onClick={() => onCreate(date)} className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-blue-50/60 dark:border-slate-700/70 dark:hover:bg-slate-800">
        <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-blue-50 text-primary dark:bg-blue-950/50 dark:text-primary-dark">
          <span className="text-[10px] font-medium">{format(date, 'M月')}</span>
          <span className="text-lg font-bold leading-5">{format(date, 'd')}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{format(date, 'yyyy年M月d日')}</span>
          <span className="text-xs text-slate-400">点击此处新建当天记录</span>
        </span>
        <Plus size={17} className="text-primary dark:text-primary-dark" />
      </button>

      {records.length === 0 ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
          <FileText size={28} className="mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-500 dark:text-slate-400">今天还没有工作记录</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700/70">
          {records.map(record => (
            <button key={record.id} type="button" onClick={() => onOpen(record)} className="group flex w-full items-start gap-4 px-4 py-4 text-left hover:bg-blue-50/60 dark:hover:bg-slate-800/80">
              <span className="flex w-14 shrink-0 items-center gap-1 pt-0.5 text-xs text-slate-400"><Clock3 size={13} />{format(parseISO(record.record_date), 'HH:mm')}</span>
              <span className="min-w-0 flex-1">
                <span className="block whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 dark:text-slate-200">{record.content}</span>
                <span className="mt-1 flex items-center gap-1 truncate text-xs text-slate-400"><Link2 size={12} />{getPlanTitle(record.plan_id, plans)}</span>
              </span>
              <ChevronRight size={16} className="mt-1 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-primary dark:text-slate-600" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function WeekAgenda({ date, recordsByDay, onCreate, onOpen }: {
  date: Date;
  recordsByDay: Map<string, WorkRecord[]>;
  onCreate: (date: Date) => void;
  onOpen: (record: WorkRecord) => void;
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(date, { weekStartsOn: 1 }),
    end: endOfWeek(date, { weekStartsOn: 1 }),
  });

  return (
    <div className="grid min-w-[720px] grid-cols-7 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-700/70">
      {days.map(day => {
        const dayRecords = recordsByDay.get(dateKey(day)) || [];
        const today = isToday(day);
        return (
          <div key={dateKey(day)} className="min-w-0 bg-white dark:bg-slate-800">
            <button type="button" onClick={() => onCreate(day)} className={`flex w-full flex-col border-b border-slate-100 px-2 py-3 text-center hover:bg-blue-50 dark:border-slate-700/70 dark:hover:bg-slate-700 ${today ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}`}>
              <span className={`text-[11px] ${today ? 'font-semibold text-primary dark:text-primary-dark' : 'text-slate-400'}`}>周{weekLabels[days.indexOf(day)]}</span>
              <span className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${today ? 'bg-primary text-white dark:bg-primary-dark' : 'text-slate-700 dark:text-slate-200'}`}>{format(day, 'd')}</span>
              <span className="mt-1 text-[10px] text-slate-400">{dayRecords.length ? `${dayRecords.length} 条` : '点击新建'}</span>
            </button>
            <div className="min-h-[230px] space-y-1 p-1.5">
              {dayRecords.map(record => <RecordSummary key={record.id} record={record} onOpen={onOpen} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function RecordCalendar({ granularity, anchorDate, records, plans, onCreate, onOpen }: RecordCalendarProps) {
  const recordsByDay = useMemo(() => {
    const map = new Map<string, WorkRecord[]>();
    records.forEach(record => {
      const key = dateKey(parseISO(record.record_date));
      const list = map.get(key) || [];
      list.push(record);
      map.set(key, list);
    });
    return map;
  }, [records]);

  const activeDayCount = recordsByDay.size;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700/70">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-primary dark:bg-blue-950/50 dark:text-primary-dark"><CalendarDays size={15} /></span>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">日历概览</span>
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500">{activeDayCount} 天有记录 · {records.length} 条记录</span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-slate-50/70 p-3 dark:bg-slate-900/20 sm:p-4">
        {granularity === 'today' && <TodayAgenda date={anchorDate} records={records} plans={plans} onCreate={onCreate} onOpen={onOpen} />}
        {granularity === 'thisWeek' && <WeekAgenda date={anchorDate} recordsByDay={recordsByDay} onCreate={onCreate} onOpen={onOpen} />}
        {granularity === 'thisMonth' && <MonthGrid month={anchorDate} recordsByDay={recordsByDay} plans={plans} showSummaries onCreate={onCreate} onOpen={onOpen} />}
        {granularity === 'halfYear' && (
          <div className="grid gap-3 md:grid-cols-2">
            {eachMonthOfInterval({ start: startOfMonth(new Date(anchorDate.getFullYear(), anchorDate.getMonth() - 5, 1)), end: startOfMonth(anchorDate) }).map(month => (
              <MonthGrid key={format(month, 'yyyy-MM')} month={month} recordsByDay={recordsByDay} plans={plans} dense onCreate={onCreate} onOpen={onOpen} />
            ))}
          </div>
        )}
        {granularity === 'thisYear' && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {eachMonthOfInterval({ start: new Date(anchorDate.getFullYear(), 0, 1), end: new Date(anchorDate.getFullYear(), 11, 1) }).map(month => (
              <MonthGrid key={format(month, 'yyyy-MM')} month={month} recordsByDay={recordsByDay} plans={plans} dense onCreate={onCreate} onOpen={onOpen} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
