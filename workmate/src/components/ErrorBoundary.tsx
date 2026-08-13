// 全局错误边界：捕获渲染期异常，避免整个组件树卸载导致窗口白屏/卡死
import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: '' };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, error: err?.message || String(err) };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error('渲染异常被 ErrorBoundary 捕获:', err, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center max-w-md px-4">
            <p className="text-4xl mb-3">😵</p>
            <p className="text-gray-700 dark:text-gray-300 font-medium mb-2">界面渲染出错了</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 break-all">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm rounded-lg transition-colors"
            >
              重试
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
