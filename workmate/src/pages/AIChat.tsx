// AI 助手聊天页面
import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../store';
import type { AiModel } from '../types';

// 简易 Markdown 渲染（外层兜底：任何渲染异常都退化为纯文本，避免渲染期抛异常导致整树卸载）
function renderMarkdown(text: string): string {
  try {
    return renderMarkdownInner(text);
  } catch (e) {
    console.error('Markdown 渲染失败，按纯文本显示:', e);
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');
  }
}

function renderMarkdownInner(text: string): string {
  // Step 1: 提取代码块和表格，用占位符保护
  const protectedBlocks: string[] = [];
  const protect = (re: RegExp, fn: (m: string, ...args: string[]) => string) => {
    text = text.replace(re, (...args) => {
      const idx = protectedBlocks.length;
      protectedBlocks.push(fn(args[0], ...args.slice(1)));
      return `%%BLOCK_${idx}%%`;
    });
  };

  // 代码块
  protect(/```(\w*)\n([\s\S]*?)```/g, (_, _lang, code) =>
    `<pre class="bg-gray-100 dark:bg-gray-900 p-3 rounded text-xs overflow-x-auto my-2"><code>${code}</code></pre>`);

  // 表格（注意：正则只有 2 个捕获组 = 表头 + 表体，分隔行未捕获）
  protect(/\n(\|.+\|)\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)/gm, (_m, header, body) => {
    const headers = header.trim().split('|').filter((c: string) => c.trim())
      .map((c: string) => `<th class="border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium bg-gray-50 dark:bg-gray-800">${c.trim()}</th>`).join('');
    const rows = body.trim().split('\n').map((row: string) => {
      const cells = row.split('|').filter((c: string) => c.trim())
        .map((c: string) => `<td class="border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs">${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table class="border-collapse border border-gray-300 dark:border-gray-600 my-2 w-full"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
  });

  // Step 2: 转义 + 行内 markdown
  text = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded text-xs">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h4 class="font-semibold text-sm mt-3 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="font-semibold text-base mt-3 mb-1">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="font-bold text-lg mt-3 mb-1">$1</h2>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    .replace(/\n\n/g, '<br/>')
    .replace(/\n/g, '<br/>');

  // Step 3: 还原受保护的块
  protectedBlocks.forEach((block, i) => {
    text = text.replace(`%%BLOCK_${i}%%`, block);
  });

  return text;
}

interface SummaryData {
  plans: any[];
  records: any[];
  totalPlans: number;
  pendingCount: number;
  completedCount: number;
  overdueCount: number;
  totalRecords: number;
  scope: string;
  dateFrom: string;
  dateTo: string;
}

const QUICK_ACTIONS = [
  { label: '📋 今日工作总结', scope: 'today', prompt: '请帮我总结今天的工作情况，包括完成了哪些任务、有哪些工作记录、还有哪些待办事项。' },
  { label: '📊 本周工作总结', scope: 'week', prompt: '请帮我总结本周的工作情况，分析完成情况和效率。' },
  { label: '📈 本月工作总结', scope: 'month', prompt: '请帮我总结本月的工作，统计各项指标并给出改进建议。' },
  { label: '⚠️ 分析延期任务', scope: 'today', prompt: '请帮我分析所有延期任务，指出哪些任务延期最严重，并给出处理建议。' },
  { label: '📊 统计报告', scope: 'week', prompt: '请根据本周数据生成一份统计报告，包括：完成任务数、新建任务数、工作记录数、优先级分布。' },
];

export default function AIChat() {
  const { chatMessages, addChatMessage, clearChatMessages } = useStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<AiModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadModels(); }, []);

  const loadModels = async () => {
    try {
      const list = await invoke<AiModel[]>('get_ai_models');
      setModels(list);
      const def = list.find(m => m.is_default) || list[0];
      if (def) setSelectedModelId(def.id);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  // 发送消息
  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    if (!selectedModelId) { alert('请先在模型设置中配置并选择默认模型'); return; }

    setInput('');
    addChatMessage('user', text);
    setLoading(true);

    try {
      const reply = await invoke<string>('chat_with_ai', { modelId: selectedModelId, message: text });
      addChatMessage('assistant', reply);
    } catch (e: any) {
      addChatMessage('assistant', '❌ 请求失败: ' + (e?.toString?.() || String(e)));
    } finally {
      setLoading(false);
    }
  };

  // 快捷操作：收集数据 + 发送
  const quickAction = async (action: typeof QUICK_ACTIONS[0]) => {
    if (loading) return;
    setLoading(true);
    try {
      // 收集数据
      const data = await invoke<SummaryData>('get_summary_data', { scope: action.scope });
      // 拼装 prompt
      const dataBlock = JSON.stringify(data, null, 2);
      const fullPrompt = `${action.prompt}\n\n以下是我收集到的数据（JSON格式）：\n\`\`\`json\n${dataBlock}\n\`\`\`\n\n请根据以上数据给出分析和建议。`;
      addChatMessage('user', action.label);
      const reply = await invoke<string>('chat_with_ai', { modelId: selectedModelId, message: fullPrompt });
      addChatMessage('assistant', reply);
    } catch (e: any) {
      addChatMessage('assistant', '❌ 请求失败: ' + (e?.toString?.() || String(e)));
    } finally { setLoading(false); }
  };

  const selectedModel = models.find(m => m.id === selectedModelId);
  const providerLabel = selectedModel?.provider === 'ruru' ? 'Dify' : selectedModel?.provider === 'deepseek' ? 'DeepSeek' : '自定义';

  return (
    <div className="h-full flex flex-col">
      {/* 顶栏：标题 + 模型选择 + 新建对话 */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0 gap-2">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">🤖 AI 助手</h2>
        <div className="flex items-center gap-2">
          <select value={selectedModelId} onChange={e => setSelectedModelId(e.target.value)}
            className="px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-white max-w-[140px]">
            {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          {chatMessages.length > 0 && (
            <button onClick={() => { if (confirm('确定清空当前对话？')) { clearChatMessages(); invoke('reset_ruru_conversation').catch(() => {}); } }}
              className="px-3 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded whitespace-nowrap">🗑️ 新建对话</button>
          )}
        </div>
      </div>

      {/* 快捷按钮 */}
      <div className="flex-shrink-0 flex flex-wrap gap-2 mb-3">
        {QUICK_ACTIONS.map(a => (
          <button key={a.label} onClick={() => quickAction(a)} disabled={loading}
            className="px-3 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50">
            {a.label}
          </button>
        ))}
      </div>

      {/* 聊天区域 */}
      <div className="flex-1 overflow-y-auto mb-3 space-y-3 min-h-0 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
        {chatMessages.length === 0 && (
          <div className="text-center text-gray-400 dark:text-gray-500 py-8">
            <p className="text-4xl mb-3">🤖</p>
            <p className="text-sm">点击上方快捷按钮或输入问题开始对话</p>
            <p className="text-xs mt-2">支持总结、统计、分析等各类问题</p>
          </div>
        )}
        {chatMessages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-4 py-2.5 ${
              m.role === 'user'
                ? 'bg-primary text-white rounded-br-sm'
                : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-bl-sm'
            }`}>
              {m.role === 'assistant'
                ? <div className="text-sm break-words" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                : <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
              }
              <div className={`text-xs mt-1 ${m.role === 'user' ? 'text-blue-100' : 'text-gray-400'}`}>{m.time}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-gray-700 rounded-xl rounded-bl-sm px-4 py-3 border border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-1 text-gray-400">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* 输入栏 */}
      <div className="flex-shrink-0 flex items-center gap-2">
        <span className="text-xs text-gray-400">{providerLabel}</span>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
          placeholder="输入问题，按 Enter 发送..." disabled={loading}
          className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50" />
        <button onClick={() => send(input)} disabled={loading || !input.trim()}
          className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors disabled:opacity-50">发送</button>
      </div>
    </div>
  );
}
