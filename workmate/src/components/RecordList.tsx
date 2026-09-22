import { Clock3, Link2, Pencil, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Plan, WorkRecord } from '../types';

interface RecordListProps {
  records: WorkRecord[];
  plans: Plan[];
  grouped?: boolean;
  onOpen: (record: WorkRecord) => void;
  onDelete: (id: string) => void;
}

const weekdayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function getPlanTitle(planId: string | null, plans: Plan[]) {
  if (!planId) return '无关联计划';
  return plans.find(plan => plan.id === planId)?.title || '未知计划';
}

function RecordCard({ record, plans, showDate, onOpen, onDelete }: {
  record: WorkRecord;
  plans: Plan[];
  showDate: boolean;
  onOpen: (record: WorkRecord) => void;
  onDelete: (id: string) => void;
}) {
  const recordDate = parseISO(record.record_date);

  return (
    <article
      className="group cursor-pointer border-b border-slate-100 px-4 py-3 transition-colors hover:bg-blue-50/60 dark:border-slate-700/70 dark:hover:bg-slate-800/70"
      onClick={() => onOpen(record)}
    >
      <div className="flex items-start gap-3">
        <div className="flex w-16 shrink-0 flex-col items-center pt-0.5 text-slate-500 dark:text-slate-400">
          {showDate && (
            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
              {format(recordDate, 'M月d日')}
            </span>
          )}
          <span className="mt-0.5 flex items-center gap-1 text-xs">
            <Clock3 size={12} />
            {format(recordDate, 'HH:mm')}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 dark:text-slate-200 line-clamp-2">
            {record.content}
          </p>
          <div className="mt-1.5 flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
            <Link2 size={12} />
            <span className="truncate">{getPlanTitle(record.plan_id, plans)}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          <button
            type="button"
            title="编辑记录"
            aria-label="编辑记录"
            onClick={event => {
              event.stopPropagation();
              onOpen(record);
            }}
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-primary dark:hover:bg-slate-700 dark:hover:text-primary-dark"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            title="删除记录"
            aria-label="删除记录"
            onClick={event => {
              event.stopPropagation();
              onDelete(record.id);
            }}
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-red-500 dark:hover:bg-slate-700"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}

export default function RecordList({ records, plans, grouped = false, onOpen, onDelete }: RecordListProps) {
  if (records.length === 0) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-primary dark:bg-blue-950/40 dark:text-primary-dark">
          <Clock3 size={24} />
        </div>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">这个时间段还没有工作记录</p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">点击日历中的日期即可开始记录</p>
      </div>
    );
  }

  if (!grouped) {
    return (
      <div className="divide-y divide-slate-100 dark:divide-slate-700/70">
        {records.map(record => (
          <RecordCard key={record.id} record={record} plans={plans} showDate={false} onOpen={onOpen} onDelete={onDelete} />
        ))}
      </div>
    );
  }

  const groups = records.reduce<Record<string, WorkRecord[]>>((result, record) => {
    const key = format(parseISO(record.record_date), 'yyyy-MM-dd');
    (result[key] ||= []).push(record);
    return result;
  }, {});

  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-700/70">
      {Object.entries(groups).map(([dateKey, dayRecords]) => {
        const date = parseISO(dateKey);
        return (
          <section key={dateKey}>
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-100 bg-white/95 px-4 py-2 text-xs backdrop-blur dark:border-slate-700/70 dark:bg-slate-800/95">
              <span className="font-semibold text-slate-700 dark:text-slate-200">{format(date, 'M月d日')}</span>
              <span className="text-slate-400 dark:text-slate-500">{weekdayLabels[date.getDay()]}</span>
              <span className="ml-auto text-slate-400 dark:text-slate-500">{dayRecords.length} 条</span>
            </div>
            {dayRecords.map(record => (
              <RecordCard key={record.id} record={record} plans={plans} showDate={false} onOpen={onOpen} onDelete={onDelete} />
            ))}
          </section>
        );
      })}
    </div>
  );
}
