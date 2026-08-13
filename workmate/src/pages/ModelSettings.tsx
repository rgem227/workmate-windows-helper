// 模型设置页面 — 列表 + 编辑弹窗 + 关于信息
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import type { AiModel } from '../types';

export default function ModelSettings() {
  const [models, setModels] = useState<AiModel[]>([]);
  const [editing, setEditing] = useState<AiModel | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  const loadModels = async () => {
    try { setModels(await invoke<AiModel[]>('get_ai_models')); } catch (e) { console.error(e); }
  };
  useEffect(() => { loadModels(); }, []);

  const handleSetDefault = async (id: string) => {
    await invoke('set_default_ai_model', { id });
    await loadModels();
  };

  const handleDelete = async (m: AiModel) => {
    if (!confirm(`确定删除"${m.name}"吗？`)) return;
    await invoke('delete_ai_model', { id: m.id });
    await loadModels();
  };

  const handleTest = async (m: AiModel) => {
    setTesting(m.id); setTestResult(prev => ({ ...prev, [m.id]: '' }));
    try {
      const result = await invoke<string>('test_ai_model', { id: m.id });
      setTestResult(prev => ({ ...prev, [m.id]: '✅ ' + result }));
    } catch (e: any) {
      setTestResult(prev => ({ ...prev, [m.id]: '❌ ' + (e?.toString?.() || String(e)) }));
    } finally { setTesting(null); }
  };

  const handleAdd = () => {
    // 新建空白模型
    const newModel: AiModel = {
      id: '', name: '', provider: 'custom', api_url: '', api_key: '',
      model_id: '', temperature: 0.7, max_tokens: 4096, system_prompt: null,
      is_default: false, sort_order: 99, created_at: '', updated_at: '',
    };
    setEditing(newModel);
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      {/* 模型列表 */}
      <Section title="🤖 模型列表">
        <div className="space-y-2">
          {models.map(m => (
            <div key={m.id} className={`border rounded-lg p-3 transition-colors ${
              m.is_default ? 'border-primary/50 bg-primary/5 dark:bg-primary/10' : 'border-gray-200 dark:border-gray-700'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${m.is_default ? 'text-primary dark:text-primary-dark' : 'text-gray-800 dark:text-white'}`}>
                    {m.is_default ? '●' : '○'} {m.name}
                  </span>
                  {m.is_default && <span className="text-xs bg-primary/20 text-primary dark:text-primary-dark px-1.5 py-0.5 rounded">默认</span>}
                </div>
                <div className="flex items-center gap-1">
                  {!m.is_default && (
                    <button onClick={() => handleSetDefault(m.id)}
                      className="px-2 py-1 text-xs text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded">设为默认</button>
                  )}
                  <button onClick={() => { setEditing(m); setShowForm(true); }}
                    className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">✏️ 编辑</button>
                  <button onClick={() => handleDelete(m)}
                    className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">🗑️</button>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                <span className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{m.provider}</span>
                <span className="truncate max-w-[300px]">{m.api_url || '未配置'}</span>
                {m.model_id && <span>{m.model_id}</span>}
              </div>
              {/* 测试结果 */}
              {testResult[m.id] && (
                <div className={`mt-2 text-xs p-2 rounded ${testResult[m.id].startsWith('✅') ? 'bg-green-50 dark:bg-green-900/20 text-green-700' : 'bg-red-50 dark:bg-red-900/20 text-red-700'}`}>
                  {testResult[m.id]}
                </div>
              )}
              {/* 操作行 */}
              <div className="mt-2">
                <button onClick={() => handleTest(m)} disabled={testing === m.id}
                  className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-50">
                  {testing === m.id ? '⏳ 测试中...' : '🧪 测试连接'}
                </button>
              </div>
            </div>
          ))}
          <button onClick={handleAdd}
            className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 hover:text-primary hover:border-primary/50 dark:hover:border-primary/50 transition-colors">
            + 添加模型
          </button>
        </div>
      </Section>

      {/* 关于信息 */}
      <AboutSection />

      {/* 编辑弹窗 */}
      {showForm && editing && (
        <ModelForm model={editing} onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={async () => { setShowForm(false); setEditing(null); await loadModels(); }} />
      )}
    </div>
  );
}

// ===================== 关于信息 =====================
function AboutSection() {
  const [version, setVersion] = useState('1.0.0');
  useEffect(() => { getVersion().then(setVersion).catch(() => {}); }, []);

  return (
    <Section title="ℹ️ 关于">
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">应用名称</span>
          <span className="text-gray-800 dark:text-white">工作助手 WorkMate</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">版本</span>
          <span className="text-gray-800 dark:text-white">v{version}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">开发者</span>
          <span className="text-gray-800 dark:text-white">如如栈</span>
        </div>
      </div>
    </Section>
  );
}

// ===================== 编辑弹窗 =====================
function ModelForm({ model, onClose, onSaved }: { model: AiModel; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: model.name,
    provider: model.provider,
    api_url: model.api_url,
    api_key: model.api_key,
    model_id: model.model_id,
    temperature: model.temperature,
    max_tokens: model.max_tokens,
    system_prompt: model.system_prompt || '',
  });
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) { alert('请输入模型名称'); return; }
    setSaving(true);
    try {
      await invoke('save_ai_model', { input: { id: model.id || null, ...form, system_prompt: form.system_prompt || null } });
      onSaved();
    } catch (e: any) { alert('保存失败: ' + (e?.toString?.() || String(e))); }
    finally { setSaving(false); }
  };

  const presetModels = ['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-chat', 'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'claude-3.5-sonnet', 'deepseek-r1', 'qwen-max', 'glm-4'];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{model.id ? `编辑 ${model.name}` : '添加模型'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">✕</button>
        </div>

        <div className="p-4 space-y-4">
          <Field label="显示名称">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" />
          </Field>

          <Field label="模型供应商">
            <select value={form.provider} onChange={e => {
              const p = e.target.value;
              const updates: any = { provider: p };
              if (p === 'deepseek') { updates.api_url = 'https://api.deepseek.com/chat/completions'; updates.model_id = 'deepseek-v4-flash'; }
              else if (p === 'ruru') { updates.api_url = 'http://127.0.0.1:8000/v1'; updates.model_id = ''; }
              setForm({ ...form, ...updates });
            }} className="input">
              <option value="">-- 请选择 --</option>
              <option value="deepseek">DeepSeek</option>
              <option value="ruru">Dify</option>
              <option value="custom">自定义</option>
            </select>
          </Field>

          <Field label="API 地址">
            <input value={form.api_url} onChange={e => setForm({ ...form, api_url: e.target.value })} className="input" placeholder="https://api.deepseek.com/chat/completions" />
          </Field>

          <Field label="API Key">
            <div className="flex gap-2">
              <input type={showKey ? 'text' : 'password'} value={form.api_key}
                onChange={e => setForm({ ...form, api_key: e.target.value })} className="input flex-1" />
              <button onClick={() => setShowKey(!showKey)} className="px-3 py-1 text-xs border rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                {showKey ? '🙈' : '👁️'}
              </button>
            </div>
          </Field>

          <Field label="模型 ID">
            <div className="flex gap-2">
              <input value={form.model_id} onChange={e => setForm({ ...form, model_id: e.target.value })}
                className="input flex-1" placeholder="deepseek-v4-flash" list="preset-models" />
              <datalist id="preset-models">
                {presetModels.map(p => <option key={p} value={p} />)}
              </datalist>
            </div>
          </Field>

          <Field label="Temperature">
            <div className="flex items-center gap-3">
              <input type="range" min="0" max="2" step="0.1" value={form.temperature}
                onChange={e => setForm({ ...form, temperature: parseFloat(e.target.value) })} className="flex-1" />
              <span className="text-sm text-gray-600 dark:text-gray-400 w-8 text-right">{form.temperature.toFixed(1)}</span>
            </div>
          </Field>

          <Field label="Max Tokens">
            <input type="number" value={form.max_tokens} onChange={e => setForm({ ...form, max_tokens: parseInt(e.target.value) || 4096 })}
              className="input" min={100} max={128000} />
          </Field>

          <Field label="系统提示词">
            <textarea value={form.system_prompt} onChange={e => setForm({ ...form, system_prompt: e.target.value })}
              className="input resize-none" rows={3} placeholder="你是一个工作助手..." />
          </Field>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">取消</button>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2 bg-primary hover:bg-primary-hover text-white rounded disabled:opacity-50">
            {saving ? '保存中...' : '💾 保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===================== 子组件 =====================
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
    <h3 className="font-semibold text-sm text-gray-800 dark:text-white mb-3">{title}</h3>
    {children}
  </section>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
    {children}
  </div>;
}
