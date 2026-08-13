// 设置页面 — Tab 切换：基本设置 / 模型设置
import { useState } from 'react';
import { useStore } from '../store';
import { playSound } from '../utils/sound';
import { invoke } from '@tauri-apps/api/core';
import ModelSettings from './ModelSettings';
import type { Theme } from '../types';

export default function Settings() {
  const { settings, setSetting, showAnimation } = useStore();
  const [tab, setTab] = useState<'basic' | 'model'>('basic');

  const toggleSetting = async (key: string, currentValue: string) => {
    const newValue = currentValue === 'true' ? 'false' : 'true';
    await setSetting(key, newValue);
    if (key === 'auto_start') {
      try { await invoke('set_auto_start', { enable: newValue === 'true' }); } catch (e) { console.error(e); }
    }
  };

  const handleSelectSound = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ multiple: false, filters: [{ name: '音频文件', extensions: ['wav', 'mp3', 'ogg'] }] });
      if (selected && typeof selected === 'string') await setSetting('remind_sound_file', selected);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-shrink-0 mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">设置</h2>
      </div>

      {/* Tab 切换 */}
      <div className="flex-shrink-0 flex border-b border-gray-200 dark:border-gray-700 mb-4">
        <button onClick={() => setTab('basic')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
            tab === 'basic'
              ? 'border-primary text-primary dark:text-primary-dark'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}>
          基本设置
        </button>
        <button onClick={() => setTab('model')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
            tab === 'model'
              ? 'border-primary text-primary dark:text-primary-dark'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}>
          模型设置
        </button>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto pr-2 min-h-0">
        {tab === 'basic' ? (
          <BasicSettings settings={settings} toggleSetting={toggleSetting} setSetting={setSetting}
            handleSelectSound={handleSelectSound} showAnimation={showAnimation} />
        ) : (
          <ModelSettings />
        )}
      </div>
    </div>
  );
}

// ===================== 基本设置 =====================
function BasicSettings({ settings, toggleSetting, setSetting, handleSelectSound, showAnimation }: any) {
  const { theme, setTheme } = useStore();
  return (
    <div className="space-y-4">
      <Section title="🚀 启动设置">
        <SettingRow label="开机自启动" description="开启后开机自动启动应用">
          <Toggle checked={settings.auto_start === 'true'}
            onChange={() => toggleSetting('auto_start', settings.auto_start || 'false')} />
        </SettingRow>
      </Section>

      <Section title="⏰ 提醒设置">
        <SettingRow label="提醒声音" description="提醒时是否播放声音">
          <Toggle checked={settings.remind_sound === 'true'}
            onChange={() => toggleSetting('remind_sound', settings.remind_sound || 'true')} />
        </SettingRow>
        <SettingRow label="自定义声音文件" description="点击选择 wav/mp3/ogg 文件">
          <div className="flex items-center gap-2">
            <button onClick={handleSelectSound} className="px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded">📁 选择文件</button>
            <button onClick={() => playSound(settings.remind_sound_file || 'default')} className="px-3 py-1 text-xs bg-purple-500 hover:bg-purple-600 text-white rounded">🔊 测试</button>
          </div>
        </SettingRow>
        {settings.remind_sound_file && (
          <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
            <span className="font-medium">已选择：</span>
            <span className="break-all">{settings.remind_sound_file}</span>
            <button onClick={() => setSetting('remind_sound_file', '')} className="ml-2 text-red-500 hover:text-red-700">清除</button>
          </div>
        )}

        <SettingRow label="过期前提醒" description="截止前 N 天提醒一次">
          <Toggle checked={settings.expire_before_remind === 'true'}
            onChange={() => toggleSetting('expire_before_remind', settings.expire_before_remind || 'true')} />
        </SettingRow>
        {settings.expire_before_remind === 'true' && (
          <SettingRow label="过期前提醒提前量">
            <Select value={settings.expire_before_days || '7'} onChange={v => setSetting('expire_before_days', v)}
              options={[{v:'1',l:'1天'},{v:'3',l:'3天'},{v:'7',l:'7天'},{v:'14',l:'14天'}]} />
          </SettingRow>
        )}

        <SettingRow label="每日提醒" description="每天固定时间提醒">
          <Toggle checked={settings.daily_remind === 'true'}
            onChange={() => toggleSetting('daily_remind', settings.daily_remind || 'true')} />
        </SettingRow>
        {settings.daily_remind === 'true' && (
          <SettingRow label="每日提醒时间"><TimeInput value={settings.daily_remind_time || '09:00'} onChange={v => setSetting('daily_remind_time', v)} /></SettingRow>
        )}

        <SettingRow label="每周提醒" description="每周固定时间提醒（周一）">
          <Toggle checked={settings.weekly_remind === 'true'}
            onChange={() => toggleSetting('weekly_remind', settings.weekly_remind || 'true')} />
        </SettingRow>
        {settings.weekly_remind === 'true' && (
          <SettingRow label="每周提醒时间"><TimeInput value={settings.weekly_remind_time || '09:00'} onChange={v => setSetting('weekly_remind_time', v)} /></SettingRow>
        )}

        <SettingRow label="每月提醒" description="每月固定时间提醒（1日）">
          <Toggle checked={settings.monthly_remind === 'true'}
            onChange={() => toggleSetting('monthly_remind', settings.monthly_remind || 'true')} />
        </SettingRow>
        {settings.monthly_remind === 'true' && (
          <SettingRow label="每月提醒时间"><TimeInput value={settings.monthly_remind_time || '09:00'} onChange={v => setSetting('monthly_remind_time', v)} /></SettingRow>
        )}

        <SettingRow label="过期提醒" description="过期任务汇总提醒">
          <Toggle checked={settings.overdue_remind === 'true'}
            onChange={() => toggleSetting('overdue_remind', settings.overdue_remind || 'true')} />
        </SettingRow>
        {settings.overdue_remind === 'true' && (
          <div className="ml-4 space-y-2 pl-3 border-l-2 border-primary/30">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="overdue_mode" checked={(settings.overdue_remind_mode || 'time') === 'time'}
                onChange={() => setSetting('overdue_remind_mode', 'time')} className="text-primary" />
              <span className="text-sm text-gray-700 dark:text-gray-300">提醒时间</span>
              <span className="text-xs text-gray-400">每天固定时间提醒</span>
            </label>
            {(settings.overdue_remind_mode || 'time') === 'time' && (
              <div className="ml-6"><TimeInput value={settings.overdue_remind_time || '09:00'} onChange={v => setSetting('overdue_remind_time', v)} /></div>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="overdue_mode" checked={settings.overdue_remind_mode === 'frequency'}
                onChange={() => setSetting('overdue_remind_mode', 'frequency')} className="text-primary" />
              <span className="text-sm text-gray-700 dark:text-gray-300">提醒频率</span>
              <span className="text-xs text-gray-400">每隔 N 小时提醒一次</span>
            </label>
            {settings.overdue_remind_mode === 'frequency' && (
              <div className="ml-6">
                <Select value={settings.overdue_remind_interval || '1'} onChange={v => setSetting('overdue_remind_interval', v)}
                  options={[{v:'0.5',l:'0.5 小时'},{v:'1',l:'1 小时'},{v:'2',l:'2 小时'},{v:'3',l:'3 小时'},{v:'4',l:'4 小时'},{v:'6',l:'6 小时'},{v:'8',l:'8 小时'},{v:'12',l:'12 小时'}]} />
              </div>
            )}
          </div>
        )}

        <SettingRow label="弹窗显示时长" description="Toast 通知自动消失时间">
          <Select value={settings.toast_duration || '3'} onChange={v => setSetting('toast_duration', v)}
            options={[{v:'0',l:'一直显示'},{v:'3',l:'3秒'},{v:'5',l:'5秒'},{v:'10',l:'10秒'},{v:'30',l:'30秒'}]} />
        </SettingRow>
      </Section>

      <Section title="📌 托盘设置">
        <SettingRow label="托盘角标触发" description="到期前 N 天显示角标">
          <Select value={settings.tray_badge_days || '3'} onChange={v => setSetting('tray_badge_days', v)}
            options={[{v:'0',l:'当天'},{v:'1',l:'1天前'},{v:'3',l:'3天前'},{v:'7',l:'7天前'}]} />
        </SettingRow>
      </Section>

      <Section title="🎨 外观设置">
        <SettingRow label="界面主题">
          <Select value={theme} onChange={v => setTheme(v as Theme)}
            options={[{v:'light',l:'浅色'},{v:'dark',l:'深色'},{v:'system',l:'跟随系统'}]} />
        </SettingRow>
      </Section>

      <Section title="✨ 激励动画">
        <SettingRow label="启用激励动画" description="完成/延期时显示动画">
          <Toggle checked={settings.animation_enabled !== 'false'}
            onChange={() => toggleSetting('animation_enabled', settings.animation_enabled || 'true')} />
        </SettingRow>
        {settings.animation_enabled !== 'false' && (<>
          <SettingRow label="动画偏好">
            <Select value={settings.animation_preference || 'mixed'} onChange={v => setSetting('animation_preference', v)}
              options={[{v:'text',l:'仅文字'},{v:'animation',l:'仅动画'},{v:'mixed',l:'混合'}]} />
          </SettingRow>
          <SettingRow label="动画测试">
            <button onClick={() => showAnimation('success', '🎉 动画测试成功！', 'confetti')} className="px-3 py-1 text-xs bg-pink-500 hover:bg-pink-600 text-white rounded">🎬 测试动画</button>
          </SettingRow>
        </>)}
      </Section>

      <Section title="🔌 API 设置">
        <SettingRow label="启用 API" description="供大模型对接进行工作总结分析">
          <Toggle checked={settings.api_enabled === 'true'}
            onChange={() => toggleSetting('api_enabled', settings.api_enabled || 'false')} />
        </SettingRow>
        {settings.api_enabled === 'true' && (
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-xs space-y-2">
            <p className="text-gray-600 dark:text-gray-300"><span className="font-medium">访问地址：</span>localhost:{settings.api_port || '3847'}</p>
            <div className="text-gray-500 dark:text-gray-400 space-y-1 font-mono text-xs">
              <p>GET /api/health - 健康检查</p>
              <p>GET /api/plans - 获取所有计划</p>
              <p>GET /api/records - 获取工作记录</p>
              <p>POST /api/plans - 创建计划</p>
              <p>PUT /api/plans/:id - 更新计划</p>
              <p>DELETE /api/plans/:id - 删除计划</p>
            </div>
          </div>
        )}
      </Section>

      <Section title="💾 数据信息">
        <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
          <p><span className="font-medium">存储路径：</span>%APPDATA%\WorkMate\data\data.db</p>
          <p><span className="font-medium">数据接口：</span>SQLite 本地数据库</p>
          <p><span className="font-medium">版本：</span>1.0.0</p>
          <button onClick={() => invoke('open_data_folder').catch(console.error)}
            className="mt-2 px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors">📂 打开数据库文件夹</button>
        </div>
      </Section>
    </div>
  );
}

// ===================== 子组件 =====================
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
    <h3 className="font-semibold text-sm text-gray-800 dark:text-white mb-3">{title}</h3>
    <div className="space-y-3">{children}</div>
  </section>;
}
function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3 flex-wrap">
    <div className="flex-1 min-w-[180px]">
      <span className="text-sm text-gray-800 dark:text-white">{label}</span>
      {description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>}
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>;
}
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return <button onClick={onChange} className={`w-10 h-5 rounded-full transition-colors relative ${checked ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}>
    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
  </button>;
}
function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return <select value={value} onChange={e => onChange(e.target.value)}
    className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white">
    {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
  </select>;
}
function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input type="time" value={value} onChange={e => onChange(e.target.value)}
    className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white" />;
}
