// Zustand 状态管理
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Plan, WorkRecord, Setting, CreatePlanInput, UpdatePlanInput, CreateRecordInput, UpdateRecordInput, Theme } from '../types';

interface AppState {
  // 主题
  theme: Theme;
  setTheme: (theme: Theme) => void;

  // 页面导航
  currentPage: string;
  setCurrentPage: (page: string) => void;

  // 计划相关
  plans: Plan[];
  pendingPlans: Plan[];
  completedPlans: Plan[];
  overduePlans: Plan[];
  loadPlans: () => Promise<void>;
  createPlan: (input: CreatePlanInput) => Promise<Plan>;
  updatePlan: (input: UpdatePlanInput) => Promise<Plan>;
  deletePlan: (id: string) => Promise<void>;
  completePlan: (id: string) => Promise<Plan>;
  snoozePlan: (id: string) => Promise<void>;

  // 工作记录相关
  records: WorkRecord[];
  recordsRange: { startDate: string | null; endDate: string | null };
  loadRecords: (startDate?: string, endDate?: string) => Promise<void>;
  createRecord: (input: CreateRecordInput) => Promise<WorkRecord>;
  updateRecord: (input: UpdateRecordInput) => Promise<WorkRecord>;
  deleteRecord: (id: string) => Promise<void>;

  // 设置相关
  settings: Record<string, string>;
  loadSettings: () => Promise<void>;
  setSetting: (key: string, value: string) => Promise<void>;

  // UI状态
  isPlanModalOpen: boolean;
  editingPlan: Plan | null;
  openPlanModal: (plan?: Plan) => void;
  closePlanModal: () => void;

  isRecordModalOpen: boolean;
  editingRecord: WorkRecord | null;
  newRecordDate: string | null;
  openRecordModal: (record?: WorkRecord, initialDate?: string) => void;
  closeRecordModal: () => void;

  // Toast通知
  toasts: Array<{ id: string; title: string; body: string; planId?: string }>;
  addToast: (toast: { title: string; body: string; planId?: string }) => void;
  removeToast: (id: string) => void;

  // 激励动画
  animation: { type: 'success' | 'overdue'; show: boolean; message: string; animationType: string };
  showAnimation: (type: 'success' | 'overdue', message: string, animationType: string) => void;
  hideAnimation: () => void;

  // 通知窗口跳转定位
  highlightPlanId: string | null;
  navigateToPlan: (planId: string) => void;
  clearHighlight: () => void;

  // AI 聊天记录
  chatMessages: Array<{ role: 'user' | 'assistant'; content: string; time: string }>;
  addChatMessage: (role: 'user' | 'assistant', content: string) => void;
  clearChatMessages: () => void;
}

// 应用主题到 DOM（'system' 时跟随操作系统深浅色）
export const applyTheme = (theme: Theme) => {
  const dark = theme === 'dark'
    || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
};

export const useStore = create<AppState>((set, get) => ({
  // 主题
  theme: 'light',
  setTheme: async (theme) => {
    set(state => ({ theme, settings: { ...state.settings, theme } }));
    await invoke('set_setting', { key: 'theme', value: theme });
    applyTheme(theme);
  },

  // 页面导航
  currentPage: 'pending',
  setCurrentPage: (page) => set({ currentPage: page }),

  // 计划相关
  plans: [],
  pendingPlans: [],
  completedPlans: [],
  overduePlans: [],

  loadPlans: async () => {
    try {
      const allPlans = await invoke<Plan[]>('get_plans');
      const pending = allPlans.filter(p => p.status === 'pending');
      const completed = allPlans.filter(p => p.status === 'completed');
      const overdue = pending.filter(p => {
        if (!p.due_date) return false;
        return new Date(p.due_date) < new Date();
      });
      set({
        plans: allPlans,
        pendingPlans: pending,
        completedPlans: completed,
        overduePlans: overdue
      });
    } catch (e) {
      console.error('加载计划失败:', e);
    }
  },

  createPlan: async (input) => {
    const plan = await invoke<Plan>('create_plan', { input });
    await get().loadPlans();
    return plan;
  },

  updatePlan: async (input) => {
    const plan = await invoke<Plan>('update_plan', { input });
    await get().loadPlans();
    return plan;
  },

  deletePlan: async (id) => {
    await invoke('delete_plan', { id });
    await get().loadPlans();
  },

  completePlan: async (id) => {
    const plan = await invoke<Plan>('complete_plan', { id });
    await get().loadPlans();
    return plan;
  },

  snoozePlan: async (id) => {
    await invoke('snooze_plan', { id });
    await get().loadPlans();
  },

  // 工作记录相关
  records: [],
  recordsRange: { startDate: null, endDate: null },

  loadRecords: async (startDate, endDate) => {
    try {
      const records = await invoke<WorkRecord[]>('get_records', {
        startDate: startDate || null,
        endDate: endDate || null,
      });
      set({
        records,
        recordsRange: {
          startDate: startDate || null,
          endDate: endDate || null,
        },
      });
    } catch (e) {
      console.error('加载记录失败:', e);
    }
  },

  createRecord: async (input) => {
    const record = await invoke<WorkRecord>('create_record', { input });
    const { startDate, endDate } = get().recordsRange;
    await get().loadRecords(startDate || undefined, endDate || undefined);
    return record;
  },

  updateRecord: async (input) => {
    const record = await invoke<WorkRecord>('update_record', { input });
    const { startDate, endDate } = get().recordsRange;
    await get().loadRecords(startDate || undefined, endDate || undefined);
    return record;
  },

  deleteRecord: async (id) => {
    await invoke('delete_record', { id });
    const { startDate, endDate } = get().recordsRange;
    await get().loadRecords(startDate || undefined, endDate || undefined);
  },

  // 设置相关
  settings: {},

  loadSettings: async () => {
    try {
      const settings = await invoke<Setting[]>('get_settings');
      const settingsMap: Record<string, string> = {};
      settings.forEach(s => settingsMap[s.key] = s.value);
      set({ settings: settingsMap });

      const theme = settingsMap.theme as Theme || 'light';
      set({ theme });
      applyTheme(theme);
    } catch (e) {
      console.error('加载设置失败:', e);
    }
  },

  setSetting: async (key, value) => {
    await invoke('set_setting', { key, value });
    set(state => ({ settings: { ...state.settings, [key]: value } }));
  },

  // UI状态
  isPlanModalOpen: false,
  editingPlan: null,
  openPlanModal: (plan) => set({ isPlanModalOpen: true, editingPlan: plan || null }),
  closePlanModal: () => set({ isPlanModalOpen: false, editingPlan: null }),

  isRecordModalOpen: false,
  editingRecord: null,
  newRecordDate: null,
  openRecordModal: (record, initialDate) => set({
    isRecordModalOpen: true,
    editingRecord: record || null,
    newRecordDate: record ? null : initialDate || null,
  }),
  closeRecordModal: () => set({
    isRecordModalOpen: false,
    editingRecord: null,
    newRecordDate: null,
  }),

  // Toast通知
  toasts: [],
  addToast: (toast) => {
    const id = Date.now().toString();
    set(state => ({ toasts: [...state.toasts, { ...toast, id }] }));
    // 使用设置中的显示时长（0 = 一直显示不自动关闭）
    const durationSec = parseInt(get().settings.toast_duration || '3', 10);
    const durationMs = durationSec > 0 ? durationSec * 1000 : 999999;
    setTimeout(() => get().removeToast(id), durationMs);
  },
  removeToast: (id) => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),

  // 激励动画
  animation: { type: 'success', show: false, message: '', animationType: '' },
  showAnimation: (type, message, animationType) => set({ animation: { type, show: true, message, animationType } }),
  hideAnimation: () => set({ animation: { type: 'success', show: false, message: '', animationType: '' } }),

  // 通知窗口跳转定位
  highlightPlanId: null,
  navigateToPlan: (planId) => set({ currentPage: 'pending', highlightPlanId: planId }),
  clearHighlight: () => set({ highlightPlanId: null }),

  // AI 聊天记录
  chatMessages: [],
  addChatMessage: (role, content) => set(state => ({
    chatMessages: [...state.chatMessages, { role, content, time: new Date().toLocaleTimeString() }]
  })),
  clearChatMessages: () => set({ chatMessages: [] }),
}));
