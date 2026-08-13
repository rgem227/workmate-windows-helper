// 工作助手 WorkMate - 主应用组件
import { useEffect } from 'react';
import { useStore, applyTheme } from './store';
import { useReminder } from './hooks/useReminder';
import Sidebar from './components/Sidebar';
import PlansPending from './pages/PlansPending';
import PlansCompleted from './pages/PlansCompleted';
import WorkRecords from './pages/WorkRecords';
import AIChat from './pages/AIChat';
import DataExport from './pages/DataExport';
import Settings from './pages/Settings';
import PlanModal from './components/PlanModal';
import RecordModal from './components/RecordModal';
import ToastContainer from './components/ToastContainer';
import EncouragementAnim from './components/EncouragementAnim';

function App() {
  const { currentPage, loadSettings, loadPlans, theme, openPlanModal, openRecordModal, setCurrentPage, navigateToPlan } = useStore();

  // 启动定时提醒检测
  useReminder();

  useEffect(() => {
    loadSettings();
    loadPlans();

    // 监听托盘事件和通知窗口事件
    const { listen } = window.__TAURI__?.event || {};
    if (listen) {
      // 托盘菜单事件
      const unlistens: (() => void)[] = [];

      listen('open-new-plan', () => {
        openPlanModal();
      }).then(fn => unlistens.push(fn));

      listen('open-new-record', () => {
        openRecordModal();
      }).then(fn => unlistens.push(fn));

      listen('navigate', (event: { payload: string }) => {
        setCurrentPage(event.payload);
      }).then(fn => unlistens.push(fn));

      // 通知窗口「查看详情」→ 跳转到进行中页面并定位计划
      listen('navigate-to-plan', (event: { payload: string }) => {
        navigateToPlan(event.payload);
      }).then(fn => unlistens.push(fn));

      // 通知窗口操作后刷新数据（稍后提醒 / 完成任务）
      listen('refresh-data', () => {
        loadPlans();
      }).then(fn => unlistens.push(fn));

      return () => {
        unlistens.forEach(fn => fn());
      };
    }
  }, []);

  useEffect(() => {
    applyTheme(theme);
    // 「跟随系统」时监听操作系统深浅色切换
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const renderPage = () => {
    switch (currentPage) {
      case 'pending':
        return <PlansPending />;
      case 'completed':
        return <PlansCompleted />;
      case 'records':
        return <WorkRecords />;
      case 'ai':
        return <AIChat />;
      case 'export':
        return <DataExport />;
      case 'settings':
        return <Settings />;
      default:
        return <PlansPending />;
    }
  };

  return (
    <div className="flex h-screen w-screen bg-surface dark:bg-surface-dark overflow-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 min-h-0">
        {renderPage()}
      </main>
      <PlanModal />
      <RecordModal />
      <ToastContainer />
      <EncouragementAnim />
    </div>
  );
}

export default App;
