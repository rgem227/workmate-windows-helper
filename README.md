# 工作助手 WorkMate

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)]()
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-lightgrey.svg)]()
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-orange.svg)](https://tauri.app)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://react.dev)
[![Rust](https://img.shields.io/badge/Rust-stable-orange.svg)](https://www.rust-lang.org)

一个面向职场人士的 Windows 桌面工作助手，把工作计划、工作记录、定时提醒、AI 助手整合到同一个本地应用里，所有数据存本地 SQLite，不依赖云端。

---

## ✨ 功能特性

### 📋 工作计划管理
- **双看板视图**：进行中 / 已完成独立展示，避免列表混淆
- **快速筛选**：全部 / 今日到期 / 即将到期(3天) / 延期中
- **多维度排序**：截止日期 / 优先级 / 创建时间 / 状态
- **关键词搜索**：匹配标题和描述
- **6 种提醒类型叠加**：过期前提醒 / 稍后提醒 / 每日 / 每周 / 每月 / 指定日期 / 不提醒
- **优先级与延期高亮**：高优先级置顶，延期任务红色左边框 + 「已延期 N 天」

### 📝 每日工作记录
- 按日期分组，支持今日 / 本周 / 本月 / 近半年 / 本年切换
- **列表 / 日历两种视图**
- 列表条目显示星期，工作日一目了然
- 日历视图：当日有工作时显示内容概要，点击查看详情
- 每条记录可选关联计划，留痕更清晰

### ⏰ 智能提醒
- 前端每 30 秒轮询扫描（`src/hooks/useReminder.ts`），不依赖系统服务
- 节假日判断用本地硬编码（`src/utils/holidays.ts`），不联网
- 原生独立小窗口（`public/notification.html`）右下角弹出，不是系统 Toast
- 完成后自动取消后续所有提醒
- 最小化到桌面后，右上角悬浮窗显示今日 / 3 天 / 7 天 / 延期任务（可拖动、可关闭、可调透明度）

### 🤖 AI 助手
- **DeepSeek（V4 Flash）**：原生 OpenAI 兼容协议，开箱即用
- **Dify 兼容**：POST `/chat-messages`，支持工具调用（方括号 `[[TOOL_CALL]]` 约定，最多 3 轮）+ 多轮对话 `conversation_id`
- **自定义模型**：OpenAI 兼容协议都可接入
- 内置模型可被本机工具查询：AI 可调用 SQL 查本地计划/记录，生成工作总结

### 💾 数据本地化
- SQLite 存储：`%APPDATA%\com.workmate.app\WorkMate\data\data.db`
- 软删除（保留误删恢复窗口）
- API 密钥加密保存在本机数据库，**不打包进安装包**

---

## 📸 截图

> 待补：建议放主界面、提醒弹窗、AI 聊天、悬浮窗四张关键截图。

---

## 🚀 下载安装

从 [Releases](../../releases) 页面下载最新版（v1.0.0）：

| 文件 | 说明 |
|---|---|
| `WorkMate.exe` | 绿色版，免安装，双击即用 |
| `WorkMate_1.0.0_x64-setup.exe` | NSIS 安装包（推荐，含卸载） |
| `WorkMate_1.0.0_x64_en-US.msi` | MSI 企业部署包 |

**系统要求**：Windows 10 / 11（x64），无需额外运行时（WebView2 已内嵌）

---

## �️ 技术栈

| 层 | 技术 |
|---|---|
| 框架 | [Tauri 2](https://tauri.app) |
| 前端 | React 18 + TypeScript + Vite 6 |
| 样式 | TailwindCSS 3 |
| 状态 | Zustand 5 |
| 后端 | Rust（`src-tauri/src/lib.rs` 单文件，~1900 行） |
| 数据库 | SQLite（rusqlite） |
| HTTP | reqwest |
| 日期 | date-fns 4 |
| 导出 | exceljs 4 |

---

## �️ 项目结构

```
windows小工具/
├── README.md                  # 本文件
├── SPEC.md                    # 详细需求规格说明书
├── 需求.txt                   # 用户原始需求
├── WorkMate.exe               # 打包产物（不进 git，走 Release）
├── WorkMate_1.0.0_x64-setup.exe
├── WorkMate_1.0.0_x64_en-US.msi
└── workmate/                  # 源代码
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── index.html
    ├── public/
    │   └── notification.html  # 提醒独立小窗口
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── components/        # UI 组件
    │   ├── pages/             # 页面（Dashboard / Plans / Records / AIChat / ModelSettings / ...）
    │   ├── hooks/             # useReminder 等
    │   ├── stores/            # Zustand stores
    │   ├── utils/             # holidays.ts 等
    │   └── types/
    └── src-tauri/
        ├── Cargo.toml
        ├── tauri.conf.json
        ├── build.rs
        ├── icons/
        └── src/
            └── lib.rs         # Rust 后端全部代码（单文件）
```

---

## 🔧 本地开发

### 前置依赖
- Node.js ≥ 18
- Rust ≥ 1.70（含 `rustup`）
- Windows：WebView2 Runtime（Win11 自带，Win10 通常也已装）

### 步骤

```bash
# 1. 安装前端依赖
cd workmate
npm install

# 2. 启动开发模式（热重载）
npm run tauri dev

# 3. 打包生产版本
npm run tauri build
# 产物在 workmate/src-tauri/target/release/{workmate.exe, bundle/}
```

### 调试小贴士
- 前端 dev server: `http://localhost:1420`
- Tauri devtools 默认开启（右键 → Inspect）
- Rust 侧日志：`%APPDATA%\com.workmate.app\WorkMate\logs\`
- 数据库查看工具：DB Browser for SQLite

---

## ⚙️ 配置说明

### 1. AI 模型配置

打开应用 → 「AI 助手」→ 右上角「⚙️ 模型设置」

| 内置模型 | 默认地址 | 密钥 |
|---|---|---|
| DeepSeek V4 Flash | `https://api.deepseek.com/chat/completions` | **需用户填入**（在「API Key」输入框） |
| Dify | `http://127.0.0.1:8000/v1` | **无需密钥** |
| 自定义模型 | 留空 | 由用户填 |

> Dify 默认指向本机 `127.0.0.1:8000/v1`，适配本机启动的 Dify 服务；如需对接内网地址，可在「模型供应商」选「自定义」后填入。

### 2. 提醒调度

- 调度由前端 `useReminder.ts` 每 30 秒扫描实现
- 数据库中每个计划存了下次触发时间，扫描后写回
- 关闭应用时不会触发提醒（这是当前限制，未来可能改为系统级服务）

---

## 🐛 已知问题

- 节假日 API（Nager.Date）已规划但未启用，目前用本地硬编码节假日表维护
- SPEC 2.9 中预留的 RESTful API 服务器（localhost:3847）**未实现**
- 关闭主窗口后提醒功能暂停运行

完整规划见 [SPEC.md](./SPEC.md)

---

## 📜 许可

本项目基于 [MIT License](./LICENSE) 开源。

---

## 🙏 致谢

- [Tauri](https://tauri.app) — 桌面应用框架
- [DeepSeek](https://www.deepseek.com) — AI 模型
- [Dify](https://dify.ai) — AI 应用开发平台
