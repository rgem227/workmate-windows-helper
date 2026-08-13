// 工作记录表单弹窗
import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { format } from 'date-fns';
import type { CreateRecordInput } from '../types';

export default function RecordModal() {
  const { isRecordModalOpen, editingRecord, closeRecordModal, createRecord, updateRecord, plans, showAnimation } = useStore();

  const [formData, setFormData] = useState<CreateRecordInput>({
    plan_id: null,
    content: '',
    record_date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingRecord) {
      setFormData({
        plan_id: editingRecord.plan_id,
        content: editingRecord.content,
        record_date: editingRecord.record_date.slice(0, 16),
      });
    } else {
      setFormData({
        plan_id: null,
        content: '',
        record_date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      });
    }
  }, [editingRecord, isRecordModalOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.content.trim()) {
      alert('请输入工作内容');
      return;
    }

    setSaving(true);
    try {
      if (editingRecord) {
        await updateRecord({ ...formData, id: editingRecord.id });
        showAnimation('success', '✏️ 记录已更新！', 'confetti');
      } else {
        await createRecord(formData);
        showAnimation('success', '📝 记录已保存！', 'confetti');
      }
      closeRecordModal();
    } catch (e: any) {
      console.error('保存失败:', e);
      alert('保存失败: ' + (e?.message || e?.toString?.() || String(e)));
    } finally {
      setSaving(false);
    }
  };

  if (!isRecordModalOpen) return null;

  // 只显示进行中的计划
  const activePlans = plans.filter(p => p.status === 'pending');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            {editingRecord ? '编辑记录' : '新建记录'}
          </h3>
          <button
            onClick={closeRecordModal}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* 关联计划 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              关联计划
            </label>
            <select
              value={formData.plan_id || ''}
              onChange={e => setFormData({ ...formData, plan_id: e.target.value || null })}
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">无关联计划</option>
              {activePlans.map(plan => (
                <option key={plan.id} value={plan.id}>
                  {plan.title}
                </option>
              ))}
            </select>
          </div>

          {/* 记录日期时间 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              日期时间
            </label>
            <input
              type="datetime-local"
              value={formData.record_date}
              onChange={e => setFormData({ ...formData, record_date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* 工作内容 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              工作内容 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.content}
              onChange={e => setFormData({ ...formData, content: e.target.value })}
              placeholder="输入工作内容..."
              maxLength={5000}
              rows={6}
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">
              {formData.content.length} / 5000
            </p>
          </div>

          {/* 按钮 */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={closeRecordModal}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-primary dark:bg-primary-dark text-white rounded-lg hover:bg-primary-hover dark:hover:bg-primary-dark-hover transition-colors disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
