import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

function boot() {
  const rootEl = document.getElementById("root");
  if (!rootEl) {
    document.body.innerHTML = '<div style="padding:40px;color:red">找不到 #root 元素</div>';
    return;
  }

  try {
    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
  } catch (e: any) {
    console.error("React 启动失败:", e);
    rootEl.innerHTML = `<div style="padding:40px;color:red"><h2>React 启动失败</h2><pre>${e?.message || e}</pre></div>`;
  }
}

// Tauri 环境下等待 DOM + Tauri API 就绪
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
