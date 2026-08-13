// 数据导出页面 - 支持 CSV 和 Excel (.xlsx)
import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

export default function DataExport() {
  const [exportPlans, setExportPlans] = useState(true);
  const [exportRecords, setExportRecords] = useState(true);
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel'>('csv');
  const [exporting, setExporting] = useState(false);
  const [lastExportPath, setLastExportPath] = useState<string | null>(null);

  const handleExport = async () => {
    if (!exportPlans && !exportRecords) {
      alert('请至少选择一种数据类型进行导出');
      return;
    }

    setExporting(true);
    try {
      if (exportFormat === 'csv') {
        // CSV 导出：后端生成
        const filePath = await invoke<string>('export_data_csv', { exportPlans, exportRecords });
        setLastExportPath(filePath);
        alert(`导出成功！\n文件位置：${filePath}`);
      } else {
        // Excel 导出：前端用 exceljs 生成
        await exportExcel();
      }
    } catch (e) {
      console.error('导出失败:', e);
      alert(`导出失败：${e}`);
    } finally {
      setExporting(false);
    }
  };

  const exportExcel = async () => {
    // 动态导入 exceljs（仅在需要时加载）
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'WorkMate';

    // ---- 工作计划工作表 ----
    if (exportPlans) {
      const ws = workbook.addWorksheet('工作计划');
      ws.columns = [
        { header: '编号', key: 'id', width: 36 },
        { header: '标题', key: 'title', width: 30 },
        { header: '描述', key: 'description', width: 40 },
        { header: '截止日期', key: 'due_date', width: 20 },
        { header: '优先级', key: 'priority', width: 10 },
        { header: '状态', key: 'status', width: 10 },
        { header: '提醒设置', key: 'remind', width: 30 },
        { header: '创建时间', key: 'created_at', width: 20 },
        { header: '完成时间', key: 'completed_at', width: 20 },
      ];
      // 表头样式
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

      // 获取所有计划
      const plans = await invoke<any[]>('get_plans');
      const filtered = plans.filter((p: any) => p.status !== 'deleted');

      for (const p of filtered) {
        ws.addRow({
          id: p.id,
          title: p.title,
          description: p.description || '',
          due_date: p.due_date || '',
          priority: p.priority === 'high' ? '高' : p.priority === 'medium' ? '中' : '低',
          status: p.status === 'completed' ? '已完成' : p.status === 'pending' ? '进行中' : p.status,
          remind: buildRemindLabel(p),
          created_at: p.created_at?.slice(0, 19) || '',
          completed_at: p.completed_at?.slice(0, 19) || '',
        });
      }
    }

    // ---- 工作记录工作表 ----
    if (exportRecords) {
      const ws = workbook.addWorksheet('工作记录');
      ws.columns = [
        { header: '编号', key: 'id', width: 36 },
        { header: '日期时间', key: 'record_date', width: 20 },
        { header: '工作内容', key: 'content', width: 60 },
        { header: '关联计划', key: 'plan_title', width: 30 },
        { header: '创建时间', key: 'created_at', width: 20 },
      ];
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

      const records = await invoke<any[]>('get_records');
      // 获取计划标题映射
      const plans = await invoke<any[]>('get_plans');
      const planMap: Record<string, string> = {};
      for (const p of plans) {
        planMap[p.id] = p.title;
      }

      for (const r of records) {
        ws.addRow({
          id: r.id,
          record_date: r.record_date?.slice(0, 19) || '',
          content: r.content,
          plan_title: r.plan_id ? (planMap[r.plan_id] || r.plan_id) : '无关联',
          created_at: r.created_at?.slice(0, 19) || '',
        });
      }
    }

    // 生成 Excel 文件
    const buffer = await workbook.xlsx.writeBuffer();
    const bytes = new Uint8Array(buffer);

    // 弹出保存对话框（动态导入避免阻塞启动）
    const { save } = await import('@tauri-apps/plugin-dialog');
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
    const defaultName = `WorkMate_导出_${ts}.xlsx`;

    const filePath = await save({
      defaultPath: defaultName,
      filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }],
    });

    if (!filePath) {
      // 用户取消了保存对话框
      return;
    }

    // 写入文件（将 Uint8Array 转为普通数组传给 Rust）
    await invoke('save_file_bytes', { path: filePath, bytes: Array.from(bytes) });
    setLastExportPath(filePath);
    alert(`导出成功！\n文件位置：${filePath}`);
  };

  // 构建提醒标签（兼容新旧格式）
  function buildRemindLabel(p: any): string {
    const parts: string[] = [];
    if (p.remind_expire_before_enabled) {
      parts.push(`过期前${p.remind_expire_before_days || 7}天`);
    }
    if (p.remind_later_enabled) {
      const m = p.remind_later_minutes || 1440;
      parts.push(m < 60 ? `稍后${m}分钟` : m < 1440 ? `稍后${m / 60}小时` : '稍后1天');
    }
    if (p.remind_daily_enabled) parts.push('每日');
    if (p.remind_weekly_enabled) parts.push('每周');
    if (p.remind_monthly_enabled) parts.push('每月');
    if (p.remind_once_enabled) parts.push('指定日期');
    // 兼容旧数据
    if (parts.length === 0 && p.remind_type) {
      const labels: Record<string, string> = {
        expire_before: '过期前提醒', later: '稍后提醒', daily: '每日提醒',
        weekly: '每周提醒', monthly: '每月提醒', once: '指定日期提醒', no_remind: '不提醒',
      };
      parts.push(labels[p.remind_type] || p.remind_type);
    }
    return parts.join(' | ') || '不提醒';
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">数据导出</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">将您的工作计划和记录导出为文件</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 max-w-xl">
        <h3 className="font-semibold text-gray-800 dark:text-white mb-4">选择导出内容</h3>
        <div className="space-y-3 mb-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={exportPlans} onChange={e => setExportPlans(e.target.checked)}
              className="w-5 h-5 text-primary rounded" />
            <div>
              <span className="text-gray-800 dark:text-white">工作计划</span>
              <p className="text-sm text-gray-500 dark:text-gray-400">包含状态、优先级、完成时间等</p>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={exportRecords} onChange={e => setExportRecords(e.target.checked)}
              className="w-5 h-5 text-primary rounded" />
            <div>
              <span className="text-gray-800 dark:text-white">工作记录</span>
              <p className="text-sm text-gray-500 dark:text-gray-400">包含关联计划、内容、时间等</p>
            </div>
          </label>
        </div>

        <h3 className="font-semibold text-gray-800 dark:text-white mb-4">选择导出格式</h3>
        <div className="flex gap-4 mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="format" value="csv" checked={exportFormat === 'csv'}
              onChange={() => setExportFormat('csv')} className="w-4 h-4 text-primary" />
            <span className="text-gray-800 dark:text-white">CSV 格式</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="format" value="excel" checked={exportFormat === 'excel'}
              onChange={() => setExportFormat('excel')} className="w-4 h-4 text-primary" />
            <span className="text-gray-800 dark:text-white">Excel (.xlsx)</span>
          </label>
        </div>

        <button onClick={handleExport} disabled={exporting || (!exportPlans && !exportRecords)}
          className={`w-full py-3 rounded-lg font-medium transition-colors ${
            exporting || (!exportPlans && !exportRecords)
              ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-primary hover:bg-primary-hover text-white'
          }`}>
          {exporting ? '导出中...' : '📤 导出数据'}
        </button>

        {exportFormat === 'excel' && (
          <p className="text-xs text-gray-400 mt-2">
            Excel 导出将弹出保存对话框，选择保存位置后生成 .xlsx 文件
          </p>
        )}
      </div>

      {lastExportPath && (
        <div className="mt-6 max-w-xl">
          <h3 className="font-semibold text-gray-800 dark:text-white mb-2">最近导出</h3>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 break-all">{lastExportPath}</p>
          </div>
        </div>
      )}
    </div>
  );
}
