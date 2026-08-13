/// <reference types="vite/client" />

// Tauri 类型声明
declare global {
  interface Window {
    __TAURI__?: {
      event?: {
        listen: (event: string, handler: (event: any) => void) => Promise<() => void>;
      };
    };
  }
}

export {};
