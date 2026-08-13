// Toast 通知组件 - 固定显示在右下角
import { useStore } from '../store';

export default function ToastContainer() {
  const toasts = useStore(state => state.toasts);
  const removeToast = useStore(state => state.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] space-y-2 pointer-events-auto">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-80 overflow-hidden animate-slide-in"
        >
          {/* 头部 */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⏰</span>
              <div>
                <span className="font-semibold text-gray-800 dark:text-white">计划提醒</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">点击查看详情</p>
              </div>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* 内容 */}
          <div className="p-4">
            <h4 className="font-semibold text-gray-800 dark:text-white text-lg mb-1">
              {toast.title}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
              {toast.body}
            </p>

            {/* 操作按钮 */}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => removeToast(toast.id)}
                className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                关闭
              </button>
              {toast.planId && (
                <button
                  onClick={() => {
                    useStore.getState().setCurrentPage('pending');
                    removeToast(toast.id);
                  }}
                  className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors"
                >
                  查看详情
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
