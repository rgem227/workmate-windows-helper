// 侧边栏导航组件
import { useState, useEffect } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { useStore } from '../store';

const navItems = [
  { id: 'pending', icon: '📋', label: '进行中' },
  { id: 'completed', icon: '✅', label: '已完成' },
  { id: 'records', icon: '📝', label: '工作记录' },
  { id: 'ai', icon: '🤖', label: 'AI 助手' },
  { id: 'export', icon: '📤', label: '数据导出' },
  { id: 'settings', icon: '⚙️', label: '设置' },
];

export default function Sidebar() {
  const { currentPage, setCurrentPage, theme, setTheme, pendingPlans, overduePlans } = useStore();
  const [version, setVersion] = useState('');
  useEffect(() => { getVersion().then(setVersion).catch(() => {}); }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <aside className="w-[220px] bg-sidebar dark:bg-sidebar-dark flex flex-col h-full">
      {/* Logo区域 */}
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-2xl">📋</span>
          <span>工作助手</span>
        </h1>
        <p className="text-xs text-sidebar-text dark:text-gray-400 mt-1">WorkMate</p>
      </div>

      {/* 导航列表 */}
      <nav className="flex-1 py-4">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
              currentPage === item.id
                ? 'bg-sidebar-selected dark:bg-sidebar-dark-selected text-white'
                : 'text-sidebar-text hover:bg-gray-700/50'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
            {item.id === 'pending' && pendingPlans.length > 0 && (
              <span className="ml-auto bg-primary dark:bg-primary-dark text-white text-xs px-2 py-0.5 rounded-full">
                {pendingPlans.length}
              </span>
            )}
            {item.id === 'pending' && overduePlans.length > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {overduePlans.length}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* 主题切换 + 版本信息 */}
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={toggleTheme}
          className="w-full px-4 py-2 flex items-center justify-center gap-2 text-sidebar-text hover:bg-gray-700/50 rounded-lg transition-colors"
        >
          <span className="text-xl">{theme === 'dark' ? '☀️' : '🌙'}</span>
          <span className="text-sm">{theme === 'dark' ? '浅色模式' : '深色模式'}</span>
        </button>
        <p className="text-center text-xs text-sidebar-text/50 mt-2 select-none">
          {version && `v${version} · `}如如栈
        </p>
      </div>
    </aside>
  );
}
