// 工作助手 WorkMate - Tauri 后端服务
// 主要功能：工作计划管理、提醒系统、数据库操作、激励动画触发

use chrono::{DateTime, Datelike, Local};
use directories::ProjectDirs;
use rusqlite::{params, Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use std::fs::OpenOptions;
use std::io::Write;
use std::panic;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Listener, Manager, State,
};
use tracing::info;
use uuid::Uuid;

// ============== 数据模型 ==============

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Plan {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub due_date: Option<String>,
    // 叠加提醒：各类型独立开关
    pub remind_expire_before_enabled: bool,
    pub remind_expire_before_days: i32,
    pub remind_expire_before_time: String,
    pub remind_later_enabled: bool,
    pub remind_later_minutes: i32,
    pub remind_daily_enabled: bool,
    pub remind_daily_time: String,
    pub remind_weekly_enabled: bool,
    pub remind_weekly_day: i32,       // 1=周一, 7=周日
    pub remind_weekly_time: String,
    pub remind_monthly_enabled: bool,
    pub remind_monthly_day: i32,      // 1-31
    pub remind_monthly_time: String,
    pub remind_once_enabled: bool,
    pub remind_once_datetime: Option<String>,
    // 保留旧字段兼容（已废弃）
    #[serde(default)]
    pub remind_type: String,
    #[serde(default)]
    pub remind_before_minutes: i32,
    #[serde(default)]
    pub remind_custom_time: Option<String>,
    pub priority: String,
    pub status: String,
    pub snooze_count: i32,
    pub snooze_last_at: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkRecord {
    pub id: String,
    pub plan_id: Option<String>,
    pub content: String,
    pub record_date: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Setting {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreatePlanInput {
    pub title: String,
    pub description: Option<String>,
    pub due_date: Option<String>,
    pub remind_expire_before_enabled: bool,
    pub remind_expire_before_days: i32,
    pub remind_expire_before_time: String,
    pub remind_later_enabled: bool,
    pub remind_later_minutes: i32,
    pub remind_daily_enabled: bool,
    pub remind_daily_time: String,
    pub remind_weekly_enabled: bool,
    pub remind_weekly_day: i32,
    pub remind_weekly_time: String,
    pub remind_monthly_enabled: bool,
    pub remind_monthly_day: i32,
    pub remind_monthly_time: String,
    pub remind_once_enabled: bool,
    pub remind_once_datetime: Option<String>,
    pub priority: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdatePlanInput {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub due_date: Option<String>,
    pub remind_expire_before_enabled: bool,
    pub remind_expire_before_days: i32,
    pub remind_expire_before_time: String,
    pub remind_later_enabled: bool,
    pub remind_later_minutes: i32,
    pub remind_daily_enabled: bool,
    pub remind_daily_time: String,
    pub remind_weekly_enabled: bool,
    pub remind_weekly_day: i32,
    pub remind_weekly_time: String,
    pub remind_monthly_enabled: bool,
    pub remind_monthly_day: i32,
    pub remind_monthly_time: String,
    pub remind_once_enabled: bool,
    pub remind_once_datetime: Option<String>,
    pub priority: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateRecordInput {
    pub plan_id: Option<String>,
    pub content: String,
    pub record_date: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateRecordInput {
    pub id: String,
    pub plan_id: Option<String>,
    pub content: String,
    pub record_date: String,
}

// ============== AI 模型 ==============

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiModel {
    pub id: String,
    pub name: String,
    pub provider: String,       // "deepseek" | "ruru" | "custom"
    pub api_url: String,
    pub api_key: String,
    pub model_id: String,
    pub temperature: f64,
    pub max_tokens: i32,
    pub system_prompt: Option<String>,
    pub is_default: bool,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveAiModelInput {
    pub id: Option<String>,      // 新建时为 None，编辑时有值
    pub name: String,
    pub provider: String,
    pub api_url: String,
    pub api_key: String,
    pub model_id: String,
    pub temperature: f64,
    pub max_tokens: i32,
    pub system_prompt: Option<String>,
}

// ============== 数据库状态 ==============

pub struct DbState(pub std::sync::Arc<Mutex<Connection>>);

// Dify 会话状态：保存 conversation_id 以支持服务端多轮上下文
pub struct RuruChatState(pub std::sync::Mutex<Option<String>>);

// ============== 数据库初始化 ==============

fn get_db_path() -> String {
    if let Some(proj_dirs) = ProjectDirs::from("com", "workmate", "WorkMate") {
        let data_dir = proj_dirs.data_dir();
        std::fs::create_dir_all(data_dir).ok();
        data_dir.join("data.db").to_string_lossy().to_string()
    } else {
        "workmate.db".to_string()
    }
}

// 取安装目录 = 当前 exe 所在目录（NSIS 默认 %LOCALAPPDATA%\Programs\WorkMate\）
fn get_install_dir() -> PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|x| x.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."))
}

// 把追加一行写到指定日志文件（panic hook 用，绕过 tracing 直接落盘）
fn append_to_log(path: &PathBuf, line: &str) {
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(f, "{}", line);
    }
}

fn init_logging() {
    // 1. 安装目录下建 logs/ 子目录，日志文件 logs/workmate.log
    let install_dir = get_install_dir();
    let logs_dir = install_dir.join("logs");
    let _ = std::fs::create_dir_all(&logs_dir);
    let log_file = logs_dir.join("workmate.log");

    info!("日志文件路径: {}", log_file.display());

    // 2. 注册 panic hook（必须在 tracing init 之前，确保任何阶段崩溃都能落盘）
    let panic_log_path = log_file.clone();
    panic::set_hook(Box::new(move |info| {
        let ts = Local::now().to_rfc3339();
        append_to_log(&panic_log_path, &format!("\n!!! PANIC at {} !!!", ts));
        append_to_log(&panic_log_path, &format!("info: {}", info));
        append_to_log(&panic_log_path, &format!("backtrace:\n{}", std::backtrace::Backtrace::capture()));
    }));

    // 3. tracing 输出到文件（文件打开失败时兜底走 stderr）
    let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));

    match OpenOptions::new().create(true).append(true).open(&log_file) {
        Ok(file) => {
            tracing_subscriber::fmt()
                .with_env_filter(env_filter)
                .with_writer(file)
                .with_ansi(false)
                .init();
        }
        Err(e) => {
            // 文件打不开（如权限），先记一条再退回 stderr
            let _ = std::fs::write(&log_file, format!("[{}] FATAL: 无法打开日志文件用于 tracing: {}\n", Local::now().to_rfc3339(), e));
            tracing_subscriber::fmt()
                .with_env_filter(env_filter)
                .init();
        }
    }
}

fn init_database(conn: &Connection) -> SqlResult<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS plans (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            due_date TEXT,
            remind_expire_before_enabled INTEGER DEFAULT 1,
            remind_expire_before_days INTEGER DEFAULT 7,
            remind_expire_before_time TEXT DEFAULT '09:00',
            remind_later_enabled INTEGER DEFAULT 0,
            remind_later_minutes INTEGER DEFAULT 1440,
            remind_daily_enabled INTEGER DEFAULT 0,
            remind_daily_time TEXT DEFAULT '09:00',
            remind_weekly_enabled INTEGER DEFAULT 0,
            remind_weekly_day INTEGER DEFAULT 1,
            remind_weekly_time TEXT DEFAULT '09:00',
            remind_monthly_enabled INTEGER DEFAULT 0,
            remind_monthly_day INTEGER DEFAULT 1,
            remind_monthly_time TEXT DEFAULT '09:00',
            remind_once_enabled INTEGER DEFAULT 0,
            remind_once_datetime TEXT,
            -- 以下为旧版兼容字段（v2 叠加提醒后废弃）
            remind_type TEXT DEFAULT 'expire_before',
            remind_before_minutes INTEGER DEFAULT 0,
            remind_custom_time TEXT,
            daily_remind_time TEXT DEFAULT '09:00',
            weekly_remind_time TEXT DEFAULT '09:00',
            monthly_remind_time TEXT DEFAULT '09:00',
            priority TEXT DEFAULT 'medium',
            status TEXT DEFAULT 'pending',
            snooze_count INTEGER DEFAULT 0,
            snooze_last_at TEXT,
            completed_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )?;

    // v2 迁移：为旧数据库添加新列（忽略"列已存在"错误）
    migrate_v2(conn);

    // AI 模型表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS ai_models (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            provider TEXT NOT NULL,
            api_url TEXT NOT NULL,
            api_key TEXT NOT NULL DEFAULT '',
            model_id TEXT NOT NULL DEFAULT '',
            temperature REAL DEFAULT 0.7,
            max_tokens INTEGER DEFAULT 4096,
            system_prompt TEXT,
            is_default INTEGER DEFAULT 0,
            sort_order INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )?;

    // 历史数据清理：内置模型曾因"随机 UUID + INSERT OR IGNORE"每次启动重复插入
    dedupe_builtin_models(conn);

    // 初始化内置模型（按名称判重，已存在则跳过）
    init_builtin_models(conn);

    conn.execute(
        "CREATE TABLE IF NOT EXISTS work_records (
            id TEXT PRIMARY KEY,
            plan_id TEXT,
            content TEXT NOT NULL,
            record_date TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )?;

    // 日历视图按日期区间读取记录，索引可避免年度视图扫描整张表。
    // 注意：必须放在 CREATE TABLE work_records 之后，否则新库会因 "no such table" panic。
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_work_records_record_date ON work_records(record_date)",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    // 初始化默认设置
    let default_settings = vec![
        ("auto_start", "false"),
        ("remind_sound", "true"),
        ("remind_sound_file", ""),
        ("expire_before_remind", "true"),
        ("expire_before_days", "7"),
        ("expire_before_time", "09:00"),
        ("daily_remind", "true"),
        ("daily_remind_time", "09:00"),
        ("weekly_remind", "true"),
        ("weekly_remind_time", "09:00"),
        ("monthly_remind", "true"),
        ("monthly_remind_time", "09:00"),
        ("later_remind", "true"),
        ("later_remind_minutes", "1440"),
        ("overdue_remind", "true"),
        ("overdue_remind_time", "09:00"),
        ("overdue_remind_mode", "time"),
        ("overdue_remind_interval", "1"),
        ("toast_duration", "3"),
        ("tray_badge_days", "3"),
        ("theme", "light"),
        ("animation_enabled", "true"),
        ("animation_preference", "mixed"),
        ("api_enabled", "false"),
        ("api_port", "3847"),
        ("model_daily_summary", "true"),
        ("model_daily_time", "18:00"),
        ("model_weekly_summary", "false"),
        ("model_weekly_time", "18:00"),
        ("model_weekly_day", "7"),
        ("model_complete_analysis", "false"),
    ];

    for (key, value) in default_settings {
        conn.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
    }

    info!("数据库初始化完成");
    Ok(())
}

// v2 迁移：添加叠加提醒字段 + 迁移旧数据
fn migrate_v2(conn: &Connection) {
    let new_columns = [
        "ALTER TABLE plans ADD COLUMN remind_expire_before_enabled INTEGER DEFAULT 1",
        "ALTER TABLE plans ADD COLUMN remind_expire_before_days INTEGER DEFAULT 7",
        "ALTER TABLE plans ADD COLUMN remind_later_enabled INTEGER DEFAULT 0",
        "ALTER TABLE plans ADD COLUMN remind_later_minutes INTEGER DEFAULT 1440",
        "ALTER TABLE plans ADD COLUMN remind_daily_enabled INTEGER DEFAULT 0",
        "ALTER TABLE plans ADD COLUMN remind_daily_time TEXT DEFAULT '09:00'",
        "ALTER TABLE plans ADD COLUMN remind_weekly_enabled INTEGER DEFAULT 0",
        "ALTER TABLE plans ADD COLUMN remind_weekly_day INTEGER DEFAULT 1",
        "ALTER TABLE plans ADD COLUMN remind_weekly_time TEXT DEFAULT '09:00'",
        "ALTER TABLE plans ADD COLUMN remind_monthly_enabled INTEGER DEFAULT 0",
        "ALTER TABLE plans ADD COLUMN remind_monthly_day INTEGER DEFAULT 1",
        "ALTER TABLE plans ADD COLUMN remind_monthly_time TEXT DEFAULT '09:00'",
        "ALTER TABLE plans ADD COLUMN remind_once_enabled INTEGER DEFAULT 0",
        "ALTER TABLE plans ADD COLUMN remind_once_datetime TEXT",
    ];

    for col_sql in &new_columns {
        match conn.execute(col_sql, []) {
            Ok(_) => info!("迁移: {}", col_sql),
            Err(e) => {
                // "duplicate column" 是正常的（已迁移过），其他错误需记录
                if !e.to_string().contains("duplicate column") {
                    tracing::warn!("迁移警告: {} -> {}", col_sql, e);
                }
            }
        }
    }

    // 兼容旧表：给 remind_type 加默认值（如果之前是 NOT NULL 且无默认值则会导致 INSERT 失败）
    conn.execute(
        "UPDATE plans SET remind_type = 'expire_before' WHERE remind_type IS NULL OR remind_type = ''",
        [],
    ).ok();

    // 根据旧 remind_type 字段迁移数据到新布尔字段
    conn.execute(
        "UPDATE plans SET remind_expire_before_enabled = 1 WHERE remind_type = 'expire_before'",
        [],
    ).ok();
    conn.execute(
        "UPDATE plans SET remind_later_enabled = 1 WHERE remind_type = 'later'",
        [],
    ).ok();
    conn.execute(
        "UPDATE plans SET remind_daily_enabled = 1 WHERE remind_type = 'daily'",
        [],
    ).ok();
    conn.execute(
        "UPDATE plans SET remind_weekly_enabled = 1 WHERE remind_type = 'weekly'",
        [],
    ).ok();
    conn.execute(
        "UPDATE plans SET remind_monthly_enabled = 1 WHERE remind_type = 'monthly'",
        [],
    ).ok();
    conn.execute(
        "UPDATE plans SET remind_once_enabled = 1 WHERE remind_type = 'once'",
        [],
    ).ok();

    info!("数据库 v2 迁移完成");
}

// 清理重复的内置模型（同名只保留一条，优先保留已配置 api_key 的、最早创建的）
fn dedupe_builtin_models(conn: &Connection) {
    // 更名迁移：旧版本里的「如如」「如如工具链」统一改名为 Dify（去重逻辑会把多余同名行清掉）
    conn.execute("UPDATE ai_models SET name = 'Dify' WHERE name IN ('如如', '如如工具链')", []).ok();

    // 地址迁移：内置 Dify 默认改为本机地址且不内置密钥（只迁移仍指向旧内网地址的行，不动用户自定义配置）
    conn.execute(
        "UPDATE ai_models SET api_url = 'http://127.0.0.1:8000/v1', api_key = '' WHERE provider = 'ruru' AND api_url LIKE 'http://172.16.100.18%'",
        [],
    ).ok();

    let deleted = conn.execute(
        "DELETE FROM ai_models WHERE name IN ('DeepSeek V4 Flash', 'Dify', '自定义模型') AND id NOT IN (
            SELECT id FROM (
                SELECT id, ROW_NUMBER() OVER (
                    PARTITION BY name ORDER BY (api_key <> '') DESC, rowid ASC
                ) AS rn FROM ai_models
                WHERE name IN ('DeepSeek V4 Flash', 'Dify', '自定义模型')
            ) WHERE rn = 1
        )",
        [],
    );
    match deleted {
        Ok(n) if n > 0 => info!("清理重复内置模型 {} 条", n),
        Ok(_) => {}
        Err(e) => tracing::warn!("清理重复内置模型失败: {}", e),
    }

    // is_default 唯一化：只保留一个默认模型（优先有 key 的）
    conn.execute(
        "UPDATE ai_models SET is_default = 0 WHERE is_default = 1 AND id <> (
            SELECT id FROM ai_models WHERE is_default = 1
            ORDER BY (api_key <> '') DESC, rowid ASC LIMIT 1
        )",
        [],
    ).ok();
}

// 初始化内置 AI 模型（按名称判重，避免重复插入）
fn init_builtin_models(conn: &Connection) {
    let now = Local::now().to_rfc3339();

    // (稳定ID, 名称, provider, api_url, api_key, model_id, is_default, sort_order)
    let builtins = [
        ("builtin-deepseek-flash", "DeepSeek V4 Flash", "deepseek", "https://api.deepseek.com/chat/completions", "", "deepseek-v4-flash", 1, 0),
        ("builtin-ruru", "Dify", "ruru", "http://127.0.0.1:8000/v1", "", "", 0, 1),
        ("builtin-custom", "自定义模型", "custom", "", "", "", 0, 2),
    ];

    for (id, name, provider, api_url, api_key, model_id, is_default, sort_order) in builtins {
        conn.execute(
            "INSERT INTO ai_models (id, name, provider, api_url, api_key, model_id, temperature, max_tokens, system_prompt, is_default, sort_order, created_at, updated_at)
             SELECT ?1, ?2, ?3, ?4, ?5, ?6, 0.7, 4096, NULL, ?7, ?8, ?9, ?9
             WHERE NOT EXISTS (SELECT 1 FROM ai_models WHERE name = ?2)",
            params![id, name, provider, api_url, api_key, model_id, is_default, sort_order, now],
        ).ok();
    }

    info!("内置 AI 模型初始化完成");
}

// ============== AI 模型 CRUD ==============

// 安全截断字符串（按字符数截取，避免在 UTF-8 字符边界中间切片导致 panic）
fn truncate_str(s: &str, max_chars: usize) -> String {
    s.chars().take(max_chars).collect()
}

fn row_to_ai_model(row: &rusqlite::Row) -> rusqlite::Result<AiModel> {
    Ok(AiModel {
        id: row.get("id")?,
        name: row.get("name")?,
        provider: row.get("provider")?,
        api_url: row.get("api_url")?,
        api_key: row.get("api_key")?,
        model_id: row.get("model_id")?,
        temperature: row.get("temperature")?,
        max_tokens: row.get("max_tokens")?,
        system_prompt: row.get("system_prompt")?,
        is_default: row.get::<_, i32>("is_default").unwrap_or(0) != 0,
        sort_order: row.get("sort_order")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

#[tauri::command]
fn get_ai_models(state: State<DbState>) -> Result<Vec<AiModel>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM ai_models ORDER BY sort_order ASC")
        .map_err(|e| e.to_string())?;
    let models = stmt.query_map([], row_to_ai_model).map_err(|e| e.to_string())?;
    models.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
fn save_ai_model(state: State<DbState>, input: SaveAiModelInput) -> Result<AiModel, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Local::now().to_rfc3339();

    if let Some(existing_id) = &input.id {
        // 更新
        conn.execute(
            "UPDATE ai_models SET name=?2, api_url=?3, api_key=?4, model_id=?5, temperature=?6, max_tokens=?7, system_prompt=?8, updated_at=?9 WHERE id=?1",
            params![existing_id, input.name, input.api_url, input.api_key, input.model_id, input.temperature, input.max_tokens, input.system_prompt, now],
        ).map_err(|e| e.to_string())?;
        // 返回更新后的
        let mut stmt = conn.prepare("SELECT * FROM ai_models WHERE id=?1").map_err(|e| e.to_string())?;
        stmt.query_row(params![existing_id], row_to_ai_model).map_err(|e| e.to_string())
    } else {
        // 新建
        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO ai_models (id, name, provider, api_url, api_key, model_id, temperature, max_tokens, system_prompt, is_default, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0, 10, ?10, ?10)",
            params![id, input.name, input.provider, input.api_url, input.api_key, input.model_id, input.temperature, input.max_tokens, input.system_prompt, now],
        ).map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare("SELECT * FROM ai_models WHERE id=?1").map_err(|e| e.to_string())?;
        stmt.query_row(params![id], row_to_ai_model).map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn delete_ai_model(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM ai_models WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;
    // 如果删除的是默认模型，把第一个剩余模型设为默认
    let count: i32 = conn.query_row("SELECT COUNT(*) FROM ai_models WHERE is_default=1", [], |r| r.get(0)).unwrap_or(0);
    if count == 0 {
        conn.execute("UPDATE ai_models SET is_default=1 WHERE id=(SELECT id FROM ai_models LIMIT 1)", []).ok();
    }
    Ok(())
}

#[tauri::command]
fn set_default_ai_model(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE ai_models SET is_default=0", []).map_err(|e| e.to_string())?;
    conn.execute("UPDATE ai_models SET is_default=1 WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn test_ai_model(id: String, state: State<'_, DbState>) -> Result<String, String> {
    let model = {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare("SELECT * FROM ai_models WHERE id=?1").map_err(|e| e.to_string())?;
        stmt.query_row(params![id], row_to_ai_model).map_err(|e| e.to_string())?
    };

    if model.api_url.is_empty() {
        return Err("请先配置 API 地址".into());
    }
    if model.api_key.is_empty() && model.provider != "custom" {
        return Err("请先配置 API Key".into());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("创建请求客户端失败: {}", e))?;

    if model.provider == "ruru" {
        // Dify：POST /chat-messages
        let url = format!("{}/chat-messages", model.api_url.trim_end_matches('/'));
        let resp = client
            .post(&url)
            .header("Authorization", format!("Bearer {}", model.api_key))
            .header("Content-Type", "application/json")
            .json(&serde_json::json!({
                "query": "你好",
                "inputs": {},
                "response_mode": "blocking",
                "user": "workmate-test"
            }))
            .send().await.map_err(|e| format!("网络错误: {}", e))?;

        let status = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        if status >= 200 && status < 300 {
            // 尝试解析 answer
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&body) {
                if let Some(answer) = val.get("answer").and_then(|a| a.as_str()) {
                    return Ok(format!("连接成功 — 回复: {}", truncate_str(answer, 60)));
                }
            }
            Ok(format!("连接成功 (HTTP {})", status))
        } else {
            Err(format!("HTTP {} — {}", status, truncate_str(&body, 200)))
        }
    } else {
        // DeepSeek / 自定义：OpenAI 兼容 POST
        let resp = client
            .post(&model.api_url)
            .header("Authorization", format!("Bearer {}", model.api_key))
            .header("Content-Type", "application/json")
            .json(&serde_json::json!({
                "model": model.model_id,
                "messages": [
                    {"role": "user", "content": "Hi"}
                ],
                "max_tokens": 10,
                "stream": false
            }))
            .send().await.map_err(|e| format!("网络错误: {}", e))?;

        let status = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        if status >= 200 && status < 300 {
            // 尝试提取回复内容
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&body) {
                if let Some(choices) = val.get("choices").and_then(|c| c.as_array()) {
                    if let Some(first) = choices.first() {
                        if let Some(msg) = first.get("message").and_then(|m| m.get("content")).and_then(|c| c.as_str()) {
                            return Ok(format!("连接成功 — 回复: {}", truncate_str(msg, 60)));
                        }
                    }
                }
            }
            Ok(format!("连接成功 (HTTP {})", status))
        } else {
            Err(format!("HTTP {} — {}", status, truncate_str(&body, 200)))
        }
    }
}

// ============== 计划相关命令 ==============

fn row_to_plan(row: &rusqlite::Row) -> rusqlite::Result<Plan> {
    // 按列名读取（兼容新旧 schema），缺失列使用默认值
    let get_str = |name: &str, default: &str| -> String {
        row.get::<_, String>(name).unwrap_or_else(|_| default.to_string())
    };
    let get_opt_str = |name: &str| -> Option<String> {
        row.get::<_, Option<String>>(name).unwrap_or(None)
    };
    let get_int = |name: &str, default: i32| -> i32 {
        row.get::<_, i32>(name).unwrap_or(default)
    };
    let get_bool = |name: &str, default: bool| -> bool {
        row.get::<_, i32>(name).map(|v| v != 0).unwrap_or(default)
    };

    Ok(Plan {
        id: row.get("id")?,
        title: row.get("title")?,
        description: row.get("description")?,
        due_date: row.get("due_date")?,
        // v2 叠加提醒字段
        remind_expire_before_enabled: get_bool("remind_expire_before_enabled", true),
        remind_expire_before_days: get_int("remind_expire_before_days", 7),
        remind_expire_before_time: get_str("remind_expire_before_time", "09:00"),
        remind_later_enabled: get_bool("remind_later_enabled", false),
        remind_later_minutes: get_int("remind_later_minutes", 1440),
        remind_daily_enabled: get_bool("remind_daily_enabled", false),
        remind_daily_time: get_str("remind_daily_time", "09:00"),
        remind_weekly_enabled: get_bool("remind_weekly_enabled", false),
        remind_weekly_day: get_int("remind_weekly_day", 1),
        remind_weekly_time: get_str("remind_weekly_time", "09:00"),
        remind_monthly_enabled: get_bool("remind_monthly_enabled", false),
        remind_monthly_day: get_int("remind_monthly_day", 1),
        remind_monthly_time: get_str("remind_monthly_time", "09:00"),
        remind_once_enabled: get_bool("remind_once_enabled", false),
        remind_once_datetime: get_opt_str("remind_once_datetime"),
        // 旧兼容字段
        remind_type: get_str("remind_type", "expire_before"),
        remind_before_minutes: get_int("remind_before_minutes", 0),
        remind_custom_time: get_opt_str("remind_custom_time"),
        // 标准字段
        priority: get_str("priority", "medium"),
        status: get_str("status", "pending"),
        snooze_count: get_int("snooze_count", 0),
        snooze_last_at: get_opt_str("snooze_last_at"),
        completed_at: get_opt_str("completed_at"),
        created_at: get_str("created_at", ""),
        updated_at: get_str("updated_at", ""),
    })
}

#[tauri::command]
fn get_plans(state: State<DbState>, status: Option<String>) -> Result<Vec<Plan>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    if let Some(s) = status {
        let mut stmt = conn
            .prepare("SELECT * FROM plans WHERE status = ?1 ORDER BY created_at DESC")
            .map_err(|e| e.to_string())?;
        let plans = stmt.query_map(params![s], row_to_plan).map_err(|e| e.to_string())?;
        plans.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    } else {
        let mut stmt = conn
            .prepare("SELECT * FROM plans WHERE status != 'deleted' ORDER BY created_at DESC")
            .map_err(|e| e.to_string())?;
        let plans = stmt.query_map([], row_to_plan).map_err(|e| e.to_string())?;
        plans.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn get_plan(state: State<DbState>, id: String) -> Result<Plan, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM plans WHERE id = ?1").map_err(|e| e.to_string())?;
    stmt.query_row(params![id], row_to_plan).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_plan(state: State<DbState>, input: CreatePlanInput) -> Result<Plan, String> {
    let now = Local::now().to_rfc3339();
    let id = Uuid::new_v4().to_string();

    {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO plans (id, title, description, due_date,
             remind_expire_before_enabled, remind_expire_before_days, remind_expire_before_time,
             remind_later_enabled, remind_later_minutes,
             remind_daily_enabled, remind_daily_time,
             remind_weekly_enabled, remind_weekly_day, remind_weekly_time,
             remind_monthly_enabled, remind_monthly_day, remind_monthly_time,
             remind_once_enabled, remind_once_datetime,
             remind_type, remind_before_minutes, remind_custom_time,
             daily_remind_time, weekly_remind_time, monthly_remind_time,
             priority, status, snooze_count, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, 'expire_before', 0, NULL, '09:00', '09:00', '09:00', 'pending', 0, ?21, ?21)",
            params![
                id,
                input.title,
                input.description,
                input.due_date,
                input.remind_expire_before_enabled as i32,
                input.remind_expire_before_days,
                input.remind_expire_before_time,
                input.remind_later_enabled as i32,
                input.remind_later_minutes,
                input.remind_daily_enabled as i32,
                input.remind_daily_time,
                input.remind_weekly_enabled as i32,
                input.remind_weekly_day,
                input.remind_weekly_time,
                input.remind_monthly_enabled as i32,
                input.remind_monthly_day,
                input.remind_monthly_time,
                input.remind_once_enabled as i32,
                input.remind_once_datetime,
                input.priority,
                now
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    get_plan(state, id)
}

#[tauri::command]
fn update_plan(state: State<DbState>, input: UpdatePlanInput) -> Result<Plan, String> {
    let now = Local::now().to_rfc3339();

    {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE plans SET title = ?2, description = ?3, due_date = ?4,
             remind_expire_before_enabled = ?5, remind_expire_before_days = ?6, remind_expire_before_time = ?7,
             remind_later_enabled = ?8, remind_later_minutes = ?9,
             remind_daily_enabled = ?10, remind_daily_time = ?11,
             remind_weekly_enabled = ?12, remind_weekly_day = ?13, remind_weekly_time = ?14,
             remind_monthly_enabled = ?15, remind_monthly_day = ?16, remind_monthly_time = ?17,
             remind_once_enabled = ?18, remind_once_datetime = ?19,
             priority = ?20, updated_at = ?21 WHERE id = ?1",
            params![
                input.id,
                input.title,
                input.description,
                input.due_date,
                input.remind_expire_before_enabled as i32,
                input.remind_expire_before_days,
                input.remind_expire_before_time,
                input.remind_later_enabled as i32,
                input.remind_later_minutes,
                input.remind_daily_enabled as i32,
                input.remind_daily_time,
                input.remind_weekly_enabled as i32,
                input.remind_weekly_day,
                input.remind_weekly_time,
                input.remind_monthly_enabled as i32,
                input.remind_monthly_day,
                input.remind_monthly_time,
                input.remind_once_enabled as i32,
                input.remind_once_datetime,
                input.priority,
                now
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    get_plan(state, input.id)
}

#[tauri::command]
fn delete_plan(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE plans SET status = 'deleted' WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn complete_plan(state: State<DbState>, id: String) -> Result<Plan, String> {
    let now = Local::now().to_rfc3339();

    {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE plans SET status = 'completed', completed_at = ?2, updated_at = ?2 WHERE id = ?1",
            params![id, now],
        )
        .map_err(|e| e.to_string())?;
    }

    get_plan(state, id)
}

#[tauri::command]
fn get_pending_plans(state: State<DbState>) -> Result<Vec<Plan>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT * FROM plans WHERE status = 'pending' ORDER BY due_date ASC")
        .map_err(|e| e.to_string())?;
    let plans = stmt.query_map([], row_to_plan).map_err(|e| e.to_string())?;
    plans.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_overdue_plans(state: State<DbState>) -> Result<Vec<Plan>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Local::now().naive_local();

    // SQL 预过滤：仅查 pending 且有截止日期的，减少结果集
    let mut stmt = conn
        .prepare("SELECT * FROM plans WHERE status = 'pending' AND due_date IS NOT NULL ORDER BY due_date ASC")
        .map_err(|e| e.to_string())?;
    let plans = stmt.query_map([], row_to_plan).map_err(|e| e.to_string())?;

    // Rust 精确时间比较（兼容 datetime-local 的 "YYYY-MM-DDTHH:MM" 和 rfc3339 格式）
    let overdue_plans: Vec<Plan> = plans
        .filter_map(|p| p.ok())
        .filter(|p| {
            if let Some(due) = &p.due_date {
                // 尝试 rfc3339 格式解析
                if let Ok(due_dt) = DateTime::parse_from_rfc3339(due) {
                    return due_dt.naive_local() < now;
                }
                // 回退：补齐秒数后再比较（处理 "YYYY-MM-DDTHH:MM" 格式）
                let padded = if due.len() == 16 { format!("{}:00", due) } else { due.clone() };
                return padded < now.format("%Y-%m-%dT%H:%M:%S").to_string();
            }
            false
        })
        .collect();

    Ok(overdue_plans)
}

#[tauri::command]
fn snooze_plan(state: State<DbState>, id: String) -> Result<Plan, String> {
    let now = Local::now().to_rfc3339();

    {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE plans SET snooze_count = snooze_count + 1, snooze_last_at = ?2, updated_at = ?2 WHERE id = ?1",
            params![id, now],
        )
        .map_err(|e| e.to_string())?;
    }

    get_plan(state, id)
}

// ============== 工作记录相关命令 ==============

fn row_to_record(row: &rusqlite::Row) -> rusqlite::Result<WorkRecord> {
    Ok(WorkRecord {
        id: row.get(0)?,
        plan_id: row.get(1)?,
        content: row.get(2)?,
        record_date: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}

#[tauri::command]
fn get_records(
    state: State<DbState>,
    start_date: Option<String>,
    end_date: Option<String>,
) -> Result<Vec<WorkRecord>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    if let (Some(start), Some(end)) = (start_date, end_date) {
        let start_value = format!("{}T00:00:00", start);
        let end_value = format!("{}T23:59:59", end);
        let mut stmt = conn
            .prepare(
                "SELECT * FROM work_records
                 WHERE record_date >= ?1 AND record_date <= ?2
                 ORDER BY record_date DESC",
            )
            .map_err(|e| e.to_string())?;
        let records = stmt
            .query_map(params![start_value, end_value], row_to_record)
            .map_err(|e| e.to_string())?;
        records.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    } else {
        let mut stmt = conn
            .prepare("SELECT * FROM work_records ORDER BY record_date DESC")
            .map_err(|e| e.to_string())?;
        let records = stmt.query_map([], row_to_record).map_err(|e| e.to_string())?;
        records.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn get_record(state: State<DbState>, id: String) -> Result<WorkRecord, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT * FROM work_records WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    stmt.query_row(params![id], row_to_record).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_record(state: State<DbState>, input: CreateRecordInput) -> Result<WorkRecord, String> {
    let id = Uuid::new_v4().to_string();
    let now = Local::now().to_rfc3339();

    {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO work_records (id, plan_id, content, record_date, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
            params![id, input.plan_id, input.content, input.record_date, now],
        )
        .map_err(|e| e.to_string())?;
    }

    get_record(state, id)
}

#[tauri::command]
fn update_record(state: State<DbState>, input: UpdateRecordInput) -> Result<WorkRecord, String> {
    let now = Local::now().to_rfc3339();

    {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE work_records SET plan_id = ?2, content = ?3, record_date = ?4, updated_at = ?5 WHERE id = ?1",
            params![input.id, input.plan_id, input.content, input.record_date, now],
        )
        .map_err(|e| e.to_string())?;
    }

    get_record(state, input.id)
}

#[tauri::command]
fn delete_record(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM work_records WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ============== 设置相关命令 ==============

#[tauri::command]
fn get_settings(state: State<DbState>) -> Result<Vec<Setting>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT key, value FROM settings")
        .map_err(|e| e.to_string())?;
    let settings = stmt
        .query_map([], |row| {
            Ok(Setting {
                key: row.get(0)?,
                value: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;
    settings.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_setting(state: State<DbState>, key: String) -> Result<String, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |row| row.get(0),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn set_setting(state: State<DbState>, key: String, value: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ============== 数据导出命令 ==============

#[tauri::command]
fn export_data_csv(state: State<DbState>, export_plans: bool, export_records: bool) -> Result<String, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Local::now();
    let timestamp = now.format("%Y%m%d_%H%M%S").to_string();

    let file_path = if let Some(proj_dirs) = ProjectDirs::from("com", "workmate", "WorkMate") {
        let export_dir = proj_dirs.data_dir().join("exports");
        std::fs::create_dir_all(&export_dir).ok();
        export_dir
            .join(format!("WorkMate_导出_{}.csv", timestamp))
            .to_string_lossy()
            .to_string()
    } else {
        format!("WorkMate_导出_{}.csv", timestamp)
    };

    let mut wtr = csv::Writer::from_path(&file_path).map_err(|e| e.to_string())?;

    if export_plans {
        wtr.write_record(&["编号", "标题", "描述", "截止日期", "提醒类型", "优先级", "状态", "创建时间", "完成时间"])
            .map_err(|e| e.to_string())?;

        let mut stmt = conn
            .prepare("SELECT id, title, description, due_date, remind_type, priority, status, created_at, completed_at FROM plans WHERE status != 'deleted'")
            .map_err(|e| e.to_string())?;

        let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
        while let Ok(Some(row)) = rows.next() {
            let id: String = row.get(0).map_err(|e| e.to_string())?;
            let title: String = row.get(1).map_err(|e| e.to_string())?;
            let desc: Option<String> = row.get(2).map_err(|e| e.to_string())?;
            let due: Option<String> = row.get(3).map_err(|e| e.to_string())?;
            let remind: String = row.get(4).map_err(|e| e.to_string())?;
            let pri: String = row.get(5).map_err(|e| e.to_string())?;
            let status: String = row.get(6).map_err(|e| e.to_string())?;
            let created: String = row.get(7).map_err(|e| e.to_string())?;
            let completed: Option<String> = row.get(8).map_err(|e| e.to_string())?;

            wtr.write_record(&[
                &id, &title, &desc.unwrap_or_default(), &due.unwrap_or_default(),
                &remind, &pri, &status, &created, &completed.unwrap_or_default(),
            ]).map_err(|e| e.to_string())?;
        }
    }

    if export_records {
        if export_plans {
            wtr.write_record(&[""]).map_err(|e| e.to_string())?; // 空行分隔
        }
        wtr.write_record(&["编号", "日期时间", "工作内容", "关联计划", "创建时间"])
            .map_err(|e| e.to_string())?;

        let mut stmt = conn
            .prepare("SELECT wr.id, wr.record_date, wr.content, p.title, wr.created_at FROM work_records wr LEFT JOIN plans p ON wr.plan_id = p.id")
            .map_err(|e| e.to_string())?;

        let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
        while let Ok(Some(row)) = rows.next() {
            let id: String = row.get(0).map_err(|e| e.to_string())?;
            let date: String = row.get(1).map_err(|e| e.to_string())?;
            let content: String = row.get(2).map_err(|e| e.to_string())?;
            let plan_title: Option<String> = row.get(3).map_err(|e| e.to_string())?;
            let created: String = row.get(4).map_err(|e| e.to_string())?;

            wtr.write_record(&[
                &id, &date, &content, &plan_title.unwrap_or_default(), &created,
            ]).map_err(|e| e.to_string())?;
        }
    }

    wtr.flush().map_err(|e| e.to_string())?;
    Ok(file_path)
}

// ============== 节假日API ==============

#[tauri::command]
async fn get_holidays(year: i32) -> Result<Vec<String>, String> {
    let url = format!("https://date.nager.at/api/v3/PublicHolidays/{}/CN", year);

    let client = reqwest::Client::new();
    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;

    #[derive(Deserialize)]
    struct Holiday {
        date: String,
    }

    let holidays: Vec<Holiday> = response.json().await.map_err(|e| e.to_string())?;
    Ok(holidays.into_iter().map(|h| h.date).collect())
}

// ============== 声音播放 ==============

#[tauri::command]
fn play_default_sound() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::{Command, Stdio};
        use std::os::windows::process::CommandExt;

        const CREATE_NO_WINDOW: u32 = 0x08000000;
        Command::new("powershell")
            .creation_flags(CREATE_NO_WINDOW)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .args(["-Command", "[System.Media.SystemSounds]::Exclamation.Play()"])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn play_success_sound() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::{Command, Stdio};
        use std::os::windows::process::CommandExt;

        const CREATE_NO_WINDOW: u32 = 0x08000000;
        Command::new("powershell")
            .creation_flags(CREATE_NO_WINDOW)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .args(["-Command", "[System.Media.SystemSounds]::Asterisk.Play()"])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn play_sound(file_path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::{Command, Stdio};
        use std::os::windows::process::CommandExt;

        const CREATE_NO_WINDOW: u32 = 0x08000000;
        Command::new("powershell")
            .creation_flags(CREATE_NO_WINDOW)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .args(["-Command", &format!("[System.Media.SoundPlayer]::new('{}').PlaySync()", file_path)])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = file_path;
    }
    Ok(())
}

// ============== AI 工具系统（通用 Function Calling）==============

const TOOL_SYSTEM_PROMPT: &str = r#"你是工作助手，可以查询本地数据库来回答用户问题。

## 可用工具

通过以下格式调用工具查询数据：
<tool_call>
{"name": "工具名", "arguments": {"参数名": "参数值"}}
</tool_call>

工具列表：
1. query_plans - 查询计划。参数(全可选): status(pending进行中/completed已完成/overdue延期), priority(low/medium/high), keyword(搜索关键词), date_from(YYYY-MM-DD), date_to(YYYY-MM-DD), limit(默认20)。注意：延期任务用status=overdue查询，进行中（未延期）用status=pending查询
2. query_records - 查询工作记录。参数(全可选): date_from, date_to, keyword, limit
3. get_statistics - 获取统计。参数: scope(today/week/month/all)

规则：
- 需要数据时调用工具，获取结果后再回答
- 不要编造数据
- 用中文简洁回答
"#;

// 工具执行：根据名称和参数查询数据库，返回 JSON 字符串
fn execute_tool(name: &str, args: &serde_json::Value, conn: &Connection) -> Result<String, String> {
    match name {
        "query_plans" => {
            let status = args.get("status").and_then(|v| v.as_str());
            let priority = args.get("priority").and_then(|v| v.as_str());
            let keyword = args.get("keyword").and_then(|v| v.as_str());
            let date_from = args.get("date_from").and_then(|v| v.as_str());
            let date_to = args.get("date_to").and_then(|v| v.as_str());
            let limit = args.get("limit").and_then(|v| v.as_i64()).unwrap_or(20);

            let mut conditions = vec!["status != 'deleted'".to_string()];
            match status {
                Some("overdue") => {
                    // 延期 = pending + 截止日期已过
                    conditions.push("status = 'pending'".to_string());
                    conditions.push("due_date IS NOT NULL".to_string());
                    conditions.push(format!("due_date < '{}'", Local::now().format("%Y-%m-%dT%H:%M:%S")));
                }
                Some("pending") => {
                    conditions.push("status = 'pending'".to_string());
                    // 排除延期的（截止日期未到）
                    conditions.push("(due_date IS NULL OR due_date >= datetime('now','localtime'))".to_string());
                }
                Some(s) => { conditions.push(format!("status = '{}'", s)); }
                None => {}
            }
            if let Some(p) = priority { conditions.push(format!("priority = '{}'", p)); }
            if let Some(k) = keyword { conditions.push(format!("(title LIKE '%{}%' OR description LIKE '%{}%')", k, k)); }
            if let Some(d) = date_from { conditions.push(format!("due_date >= '{}'", d)); }
            if let Some(d) = date_to { conditions.push(format!("due_date <= '{}'", d)); }

            let sql = format!("SELECT id, title, description, due_date, priority, status, completed_at, created_at FROM plans WHERE {} ORDER BY due_date ASC LIMIT {}", conditions.join(" AND "), limit);

            let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
            let rows: Vec<serde_json::Value> = stmt.query_map([], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, String>(0)?,
                    "title": row.get::<_, String>(1)?,
                    "description": row.get::<_, Option<String>>(2)?,
                    "due_date": row.get::<_, Option<String>>(3)?,
                    "priority": row.get::<_, String>(4)?,
                    "status": row.get::<_, String>(5)?,
                    "completed_at": row.get::<_, Option<String>>(6)?,
                    "created_at": row.get::<_, String>(7)?,
                }))
            }).map_err(|e| e.to_string())?
            .filter_map(|r| r.ok()).collect();

            Ok(serde_json::json!({"tool": "query_plans", "count": rows.len(), "data": rows}).to_string())
        }
        "query_records" => {
            let date_from = args.get("date_from").and_then(|v| v.as_str());
            let date_to = args.get("date_to").and_then(|v| v.as_str());
            let keyword = args.get("keyword").and_then(|v| v.as_str());
            let limit = args.get("limit").and_then(|v| v.as_i64()).unwrap_or(20);

            let mut conditions: Vec<String> = vec![];
            if let Some(d) = date_from { conditions.push(format!("record_date >= '{}T00:00:00'", d)); }
            if let Some(d) = date_to { conditions.push(format!("record_date <= '{}T23:59:59'", d)); }
            if let Some(k) = keyword { conditions.push(format!("content LIKE '%{}%'", k)); }

            let where_clause = if conditions.is_empty() { "1=1".to_string() } else { conditions.join(" AND ") };
            let sql = format!("SELECT wr.id, wr.record_date, wr.content, wr.plan_id, p.title as plan_title FROM work_records wr LEFT JOIN plans p ON wr.plan_id = p.id WHERE {} ORDER BY wr.record_date DESC LIMIT {}", where_clause, limit);

            let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
            let rows: Vec<serde_json::Value> = stmt.query_map([], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, String>(0)?,
                    "record_date": row.get::<_, String>(1)?,
                    "content": row.get::<_, String>(2)?,
                    "plan_id": row.get::<_, Option<String>>(3)?,
                    "plan_title": row.get::<_, Option<String>>(4)?,
                }))
            }).map_err(|e| e.to_string())?
            .filter_map(|r| r.ok()).collect();

            Ok(serde_json::json!({"tool": "query_records", "count": rows.len(), "data": rows}).to_string())
        }
        "get_statistics" => {
            let scope = args.get("scope").and_then(|v| v.as_str()).unwrap_or("all");
            // 复用 get_summary_data 的逻辑
            let now = Local::now();
            let today = now.format("%Y-%m-%d").to_string();
            let (df, dt) = match scope {
                "today" => (today.clone(), today.clone()),
                "week" => {
                    let start = now.naive_local() - chrono::Duration::days(now.naive_local().weekday().num_days_from_monday() as i64);
                    (start.format("%Y-%m-%d").to_string(), today)
                }
                "month" => { (format!("{}-01", now.format("%Y-%m")), today) }
                _ => ("2000-01-01".to_string(), today),
            };

            let mut stmt = conn.prepare("SELECT status, COUNT(*) as cnt FROM plans WHERE status != 'deleted' GROUP BY status").map_err(|e| e.to_string())?;
            let mut counts = std::collections::HashMap::new();
            let _ = stmt.query_map([], |row| {
                let s: String = row.get(0)?;
                let c: i32 = row.get(1)?;
                counts.insert(s, c);
                Ok(())
            }).map_err(|e| e.to_string())?;

            let total = counts.values().sum::<i32>();
            Ok(serde_json::json!({
                "tool": "get_statistics",
                "scope": scope,
                "dateFrom": df, "dateTo": dt,
                "totalPlans": total,
                "pendingCount": counts.get("pending").unwrap_or(&0),
                "completedCount": counts.get("completed").unwrap_or(&0),
                "overdueCount": counts.get("overdue").unwrap_or(&0),
            }).to_string())
        }
        _ => Err(format!("未知工具: {}", name)),
    }
}

// ============== AI 数据收集 + 对话 ==============

#[derive(Debug, Serialize)]
struct SummaryData {
    plans: Vec<Plan>,
    records: Vec<WorkRecord>,
    total_plans: usize,
    pending_count: usize,
    completed_count: usize,
    overdue_count: usize,
    total_records: usize,
    scope: String,
}

#[tauri::command]
fn get_summary_data(state: State<DbState>, scope: String) -> Result<serde_json::Value, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Local::now();
    let today = now.format("%Y-%m-%d").to_string();

    // 日期范围
    let (date_from, date_to) = match scope.as_str() {
        "today" => (today.clone(), today.clone()),
        "week" => {
            let start = now.naive_local() - chrono::Duration::days(now.naive_local().weekday().num_days_from_monday() as i64);
            (start.format("%Y-%m-%d").to_string(), today)
        }
        "month" => {
            let start = format!("{}-01", now.format("%Y-%m"));
            (start, today)
        }
        _ => ("2000-01-01".to_string(), today),
    };

    // 查询计划
    let mut stmt = conn.prepare("SELECT * FROM plans WHERE status != 'deleted'").map_err(|e| e.to_string())?;
    let all_plans: Vec<Plan> = stmt.query_map([], row_to_plan).map_err(|e| e.to_string())?
        .filter_map(|p| p.ok()).collect();

    // 查询记录
    let mut stmt = conn.prepare(
        "SELECT * FROM work_records WHERE record_date >= ?1 AND record_date <= ?2 ORDER BY record_date DESC"
    ).map_err(|e| e.to_string())?;
    let records: Vec<WorkRecord> = stmt.query_map(params![format!("{}T00:00:00", date_from), format!("{}T23:59:59", date_to)], row_to_record)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok()).collect();

    let pending_count = all_plans.iter().filter(|p| p.status == "pending").count();
    let completed_count = all_plans.iter().filter(|p| p.status == "completed").count();
    let overdue_count = all_plans.iter().filter(|p| p.status == "pending" && p.due_date.as_ref().map_or(false, |d| d < &now.to_rfc3339())).count();

    Ok(serde_json::json!({
        "plans": all_plans.iter().filter(|p| p.status == "pending" || (scope != "today" && scope != "week")).collect::<Vec<_>>(),
        "records": records,
        "totalPlans": all_plans.len(),
        "pendingCount": pending_count,
        "completedCount": completed_count,
        "overdueCount": overdue_count,
        "totalRecords": records.len(),
        "scope": scope,
        "dateFrom": date_from,
        "dateTo": date_to,
    }))
}

#[tauri::command]
async fn chat_with_ai(state: State<'_, DbState>, ruru_state: State<'_, RuruChatState>, model_id: String, message: String) -> Result<String, String> {
    let model = {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare("SELECT * FROM ai_models WHERE id=?1").map_err(|e| e.to_string())?;
        stmt.query_row(params![model_id], row_to_ai_model).map_err(|e| format!("模型未找到: {}", e))?
    };

    if model.api_url.is_empty() { return Err("请先在设置中配置模型 API 地址".into()); }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build().map_err(|e| format!("创建客户端失败: {}", e))?;

    let today = Local::now().format("%Y年%m月%d日 %A").to_string();
    let date_note = format!("今天是{}。", today);

    let sys_prompt = format!("{}\n\n{}\n\n{}", TOOL_SYSTEM_PROMPT, date_note, model.system_prompt.as_deref().unwrap_or(""));

    if model.provider == "ruru" {
        chat_ruru_with_tools(&client, &model, &message, &date_note, state.0.clone(), &ruru_state).await
    } else {
        chat_openai_with_tools(&client, &model, &message, &sys_prompt, state.0.clone()).await
    }
}

// 提取 <tool_call>...</tool_call> 中的 JSON
fn extract_tool_call(text: &str) -> Option<(String, serde_json::Value)> {
    let start = text.find("<tool_call>")?;
    let end = text.find("</tool_call>")?;
    // 防御：闭合标签在起始标签之前时直接放弃（避免范围切片 panic）
    if end < start + 11 {
        return None;
    }
    let json_str = &text[start + 11..end].trim();
    let val: serde_json::Value = serde_json::from_str(json_str).ok()?;
    let name = val.get("name")?.as_str()?.to_string();
    let args = val.get("arguments")?.clone();
    Some((name, args))
}

// Dify 工作流专用工具约定。
// 注意：实测尖括号标签（如 <tool_call>）会被该链路吞掉导致 LLM 返回空，必须用方括号标记。
const RURU_TOOL_PROMPT: &str = r#"请在本次对话中严格遵守以下约定：

当你需要查询用户的本地工作数据时，本轮回复【只能】输出一行如下格式的内容，不要输出任何其他文字：
[[TOOL_CALL]]{"name": "工具名", "args": {参数}}[[/TOOL_CALL]]

可用工具（共3个）：
1. query_plans — 查询工作计划。args(全可选): {"status": "pending进行中|completed已完成|overdue延期", "priority": "low|medium|high", "keyword": "关键词", "date_from": "YYYY-MM-DD", "date_to": "YYYY-MM-DD", "limit": 数量(默认20)}。注意：延期任务用 status=overdue
2. query_records — 查询工作记录。args(全可选): {"date_from", "date_to", "keyword", "limit"}
3. get_statistics — 获取整体统计。args: {"scope": "today|week|month|all"}

规则：
- 需要数据时输出工具调用，之后用户会把工具结果发给你，你再据结果回答
- 不要编造数据，用中文简洁回答
- 不需要查询数据时直接正常回答即可
"#;

// 提取 [[TOOL_CALL]]...[[/TOOL_CALL]] 中的 JSON（Dify 通道专用，方括号标记）
fn extract_ruru_tool_call(text: &str) -> Option<(String, serde_json::Value)> {
    let start = text.find("[[TOOL_CALL]]")?;
    let end = text.find("[[/TOOL_CALL]]")?;
    // 防御：闭合标记在起始标记之前时直接放弃（避免范围切片 panic）
    if end < start + 13 {
        return None;
    }
    let json_str = text[start + 13..end].trim();
    let val: serde_json::Value = serde_json::from_str(json_str).ok()?;
    let name = val.get("name")?.as_str()?.to_string();
    let args = val.get("args").or_else(|| val.get("arguments")).cloned().unwrap_or(serde_json::json!({}));
    Some((name, args))
}

async fn chat_ruru_with_tools(
    client: &reqwest::Client, model: &AiModel, user_msg: &str, date_note: &str,
    db: std::sync::Arc<Mutex<Connection>>, conv_state: &RuruChatState,
) -> Result<String, String> {
    let url = format!("{}/chat-messages", model.api_url.trim_end_matches('/'));
    // 预注入数据快照作为背景兜底（工具查询之外的上下文）
    let data_context = {
        let conn = db.lock().map_err(|e| e.to_string())?;
        let counts = get_stats_snapshot(&conn);
        let plans = get_recent_plans(&conn, 10);
        let records = get_recent_records(&conn, 10);
        format!("数据库状态：{}\n最近计划：\n{}\n最近记录：\n{}", counts, plans, records)
    };
    let sys_prompt = model.system_prompt.as_deref().unwrap_or("");
    let mut query = format!("{}\n\n{}\n\n{}\n\n{}\n\n用户问题：{}", RURU_TOOL_PROMPT, date_note, sys_prompt, data_context, user_msg);

    // 恢复上次的会话 ID，实现跨消息的多轮上下文
    let mut conversation_id: Option<String> = conv_state.0.lock().ok().and_then(|g| g.clone());

    // 客户端 Agent 循环：模型输出 [[TOOL_CALL]] → 本地执行 → 结果回传（同一 conversation_id）
    for _round in 0..3 {
        let body = call_ruru(client, &url, &model.api_key, &query, conversation_id.as_deref()).await?;
        if let Some(cid) = body.get("conversation_id").and_then(|c| c.as_str()) {
            conversation_id = Some(cid.to_string());
        }
        let answer = body.get("answer").and_then(|a| a.as_str()).unwrap_or("").to_string();

        if let Some((tool_name, args)) = extract_ruru_tool_call(&answer) {
            let tool_result = {
                let conn = db.lock().map_err(|e| e.to_string())?;
                execute_tool(&tool_name, &args, &conn).unwrap_or_else(|e| format!("错误: {}", e))
            };
            query = format!("工具 {} 的查询结果如下（JSON）：\n{}\n\n请根据以上数据，用中文回答我之前的问题。", tool_name, tool_result);
            continue;
        }

        // 无工具调用 → 最终回答；保存会话 ID 供后续消息复用
        if let Ok(mut g) = conv_state.0.lock() { *g = conversation_id.clone(); }
        if answer.is_empty() {
            return Err("Dify 返回了空回答，请重试".into());
        }
        return Ok(answer);
    }

    // 3 轮都在调用工具：最后再请求一次强制其回答
    let body = call_ruru(client, &url, &model.api_key, "请根据以上工具结果直接回答，不要再调用工具。", conversation_id.as_deref()).await?;
    if let Some(cid) = body.get("conversation_id").and_then(|c| c.as_str()) {
        if let Ok(mut g) = conv_state.0.lock() { *g = Some(cid.to_string()); }
    }
    let answer = body.get("answer").and_then(|a| a.as_str()).unwrap_or("").to_string();
    if answer.is_empty() { Err("Dify 返回了空回答，请重试".into()) } else { Ok(answer) }
}

// 清空 Dify 会话（前端「新建对话」时调用）
#[tauri::command]
fn reset_ruru_conversation(state: State<'_, RuruChatState>) -> Result<(), String> {
    *state.0.lock().map_err(|e| e.to_string())? = None;
    Ok(())
}

fn get_stats_snapshot(conn: &Connection) -> String {
    let mut stmt = conn.prepare("SELECT status, COUNT(*) FROM plans WHERE status != 'deleted' GROUP BY status").ok();
    let mut pending=0i32; let mut completed=0i32; let mut overdue=0i32;
    if let Some(ref mut s) = stmt {
        if let Ok(rows) = s.query_map([], |row| {
            Ok((row.get::<_,String>(0)?, row.get::<_,i32>(1)?))
        }) {
            for r in rows.flatten() {
                match r.0.as_str() {
                    "pending" => pending = r.1,
                    "completed" => completed = r.1,
                    "overdue" => overdue = r.1,
                    _ => {}
                }
            }
        }
    }
    let rc:i32 = conn.query_row("SELECT COUNT(*) FROM work_records",[],|r|r.get(0)).unwrap_or(0);
    format!("总计{}计划(进行中{} 已完成{} 延期{})，{}条记录", pending+completed+overdue, pending, completed, overdue, rc)
}

fn get_recent_plans(conn: &Connection, limit: i32) -> String {
    let mut lines=vec![];
    if let Ok(mut s) = conn.prepare("SELECT title,priority,status,due_date FROM plans WHERE status!='deleted' ORDER BY updated_at DESC LIMIT ?1") {
        if let Ok(rows) = s.query_map(params![limit], |row| {
            Ok((row.get::<_,String>(0)?, row.get::<_,String>(1)?, row.get::<_,String>(2)?, row.get::<_,Option<String>>(3)?))
        }) {
            for r in rows.flatten() {
                lines.push(format!("- [{}] {} (优先级:{}) 截止:{}", r.2, r.0, r.1, r.3.unwrap_or_default()));
            }
        }
    }
    if lines.is_empty() {"暂无".into()} else {lines.join("\n")}
}

fn get_recent_records(conn: &Connection, limit: i32) -> String {
    let mut lines=vec![];
    if let Ok(mut s) = conn.prepare("SELECT content,record_date FROM work_records ORDER BY record_date DESC LIMIT ?1") {
        if let Ok(rows) = s.query_map(params![limit], |row| {
            Ok((row.get::<_,String>(0)?, row.get::<_,String>(1)?))
        }) {
            for r in rows.flatten() {
                let c = &r.0;
                let d = &r.1;
                lines.push(format!("- {}: {}", truncate_str(d, 16), truncate_str(c, 80)));
            }
        }
    }
    if lines.is_empty() {"暂无".into()} else {lines.join("\n")}
}

async fn chat_openai_with_tools(
    client: &reqwest::Client, model: &AiModel, user_msg: &str, sys_prompt: &str, db: std::sync::Arc<Mutex<Connection>>
) -> Result<String, String> {
    let mut messages: Vec<serde_json::Value> = vec![
        serde_json::json!({"role": "system", "content": sys_prompt}),
        serde_json::json!({"role": "user", "content": user_msg}),
    ];

    for _round in 0..3 {
        let body = call_openai(client, &model.api_url, &model.api_key, &model.model_id, model.temperature, model.max_tokens, &messages).await?;
        let content = body.get("choices").and_then(|c| c.as_array()).and_then(|a| a.first())
            .and_then(|c| c.get("message")).and_then(|m| m.get("content")).and_then(|c| c.as_str()).unwrap_or("").to_string();

        if let Some((tool_name, args)) = extract_tool_call(&content) {
            messages.push(serde_json::json!({"role": "assistant", "content": content}));
            let tool_result = {
                let conn = db.lock().map_err(|e| e.to_string())?;
                execute_tool(&tool_name, &args, &conn).unwrap_or_else(|e| format!("错误: {}", e))
            };
            messages.push(serde_json::json!({"role": "user", "content": format!("工具调用结果：\n```json\n{}\n```\n\n请根据以上数据继续回答。", tool_result)}));
        } else {
            return Ok(content);
        }
    }

    let body = call_openai(client, &model.api_url, &model.api_key, &model.model_id, model.temperature, model.max_tokens, &messages).await?;
    Ok(body.get("choices").and_then(|c| c.as_array()).and_then(|a| a.first())
        .and_then(|c| c.get("message")).and_then(|m| m.get("content")).and_then(|c| c.as_str()).unwrap_or("").to_string())
}

async fn call_ruru(client: &reqwest::Client, url: &str, api_key: &str, query: &str, conversation_id: Option<&str>) -> Result<serde_json::Value, String> {
    let mut payload = serde_json::json!({"query": query, "inputs": {}, "response_mode": "blocking", "user": "workmate"});
    // 传入 conversation_id 让 Dify 服务端延续多轮上下文
    if let Some(cid) = conversation_id {
        payload["conversation_id"] = serde_json::Value::String(cid.to_string());
    }
    let resp = client.post(url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send().await.map_err(|e| format!("请求失败: {}", e))?;
    let body = resp.text().await.unwrap_or_default();
    serde_json::from_str(&body).map_err(|e| format!("解析失败: {} — {}", e, truncate_str(&body, 300)))
}

async fn call_openai(
    client: &reqwest::Client, url: &str, api_key: &str, model_id: &str,
    temperature: f64, max_tokens: i32, messages: &[serde_json::Value],
) -> Result<serde_json::Value, String> {
    let resp = client.post(url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "model": model_id,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": false
        }))
        .send().await.map_err(|e| format!("请求失败: {}", e))?;
    let body = resp.text().await.unwrap_or_default();

    // 检查 API 错误
    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&body) {
        if val.get("error").is_some() {
            let msg = val.get("error").and_then(|e| e.get("message")).and_then(|m| m.as_str()).unwrap_or("未知错误");
            return Err(format!("API 错误: {}", msg));
        }
        return Ok(val);
    }
    Err(format!("解析响应失败: {}", truncate_str(&body, 300)))
}

// ============== 打开数据目录 ==============

#[tauri::command]
fn open_data_folder() -> Result<(), String> {
    if let Some(proj_dirs) = ProjectDirs::from("com", "workmate", "WorkMate") {
        let data_dir = proj_dirs.data_dir();
        std::fs::create_dir_all(data_dir).ok();
        opener::open(data_dir).map_err(|e| format!("打开文件夹失败: {}", e))?;
    }
    Ok(())
}

// ============== 文件写入（供前端 Excel 导出使用）==============

#[tauri::command]
fn save_file_bytes(path: String, bytes: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, bytes).map_err(|e| format!("写入文件失败: {}", e))?;
    info!("文件已保存: {}", path);
    Ok(())
}

// ============== 开机自启动 ==============

#[tauri::command]
fn set_auto_start(enable: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
        let exe_path_str = exe_path.to_string_lossy().to_string();

        if enable {
            // 添加注册表项
            Command::new("reg")
                .args([
                    "add",
                    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                    "/v", "WorkMate",
                    "/t", "REG_SZ",
                    "/d", &exe_path_str,
                    "/f",
                ])
                .output()
                .map_err(|e| format!("设置开机自启动失败: {}", e))?;
            info!("开机自启动已启用");
        } else {
            // 删除注册表项
            Command::new("reg")
                .args([
                    "delete",
                    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                    "/v", "WorkMate",
                    "/f",
                ])
                .output()
                .map_err(|e| format!("取消开机自启动失败: {}", e))?;
            info!("开机自启动已禁用");
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = enable;
    }
    Ok(())
}

// ============== 显示主窗口 ==============

#[tauri::command]
fn show_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ============== 通知窗口 ==============

#[tauri::command]
async fn show_notification(
    app: AppHandle,
    title: String,
    body: String,
    plan_id: Option<String>,
    count: Option<i32>,
) -> Result<(), String> {
    use tauri::WebviewWindowBuilder;
    use tauri::WebviewUrl;

    let window_label = format!("notif-{}", Uuid::new_v4());

    // 清理旧的过期通知窗口（保留最近 2 个）
    let existing: Vec<String> = app.webview_windows()
        .keys()
        .filter(|k| k.starts_with("notif-"))
        .cloned()
        .collect();
    // 超过 2 个时，关闭最旧的
    if existing.len() >= 2 {
        for old_label in existing.iter().take(existing.len() - 1) {
            if let Some(w) = app.get_webview_window(old_label) {
                w.close().ok();
            }
        }
    }

    let encoded_title = urlencoding::encode(&title);
    let encoded_body = urlencoding::encode(&body);
    let plan_id_param = plan_id.clone().unwrap_or_default();
    let count_param = count.unwrap_or(1).to_string();
    let url = format!(
        "/notification.html?title={}&body={}&planId={}&count={}",
        encoded_title, encoded_body, plan_id_param, count_param
    );

    // 隐藏创建 + 定位
    let window = WebviewWindowBuilder::new(
        &app,
        &window_label,
        WebviewUrl::App(url.into()),
    )
    .title(&title)
    .inner_size(340.0, 180.0)
    .resizable(false)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .focused(true)
    .visible(false)
    .build()
    .map_err(|e| {
        tracing::error!("创建通知窗口失败: {}", e);
        e.to_string()
    })?;

    // 设置右下角位置
    if let Ok(Some(monitor)) = window.primary_monitor() {
        let monitor_size = monitor.size();
        let scale = window.scale_factor().unwrap_or(1.0);
        let monitor_pos = monitor.position();
        let win_w = (340.0_f64 * scale) as i32;
        let win_h = (180.0_f64 * scale) as i32;
        let pad = (20.0_f64 * scale) as i32;
        let x = monitor_pos.x + monitor_size.width as i32 - win_w - pad;
        let y = monitor_pos.y + monitor_size.height as i32 - win_h - pad;
        window.set_position(tauri::PhysicalPosition::new(x, y)).ok();
    }

    // 发送数据事件
    window.emit("notification-data", serde_json::json!({
        "title": title,
        "body": body,
        "planId": plan_id,
        "count": count
    })).ok();

    // 等待页面渲染就绪后再显示（消除空白闪现）
    let window_ready = window.clone();
    window.listen("notification-ready", move |_| {
        window_ready.show().ok();
    });

    // 兜底：2 秒后强制显示（防止 JS 事件未发出）
    let window_fallback = window.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        window_fallback.show().ok();
    });

    // Rust 端兜底：15 秒后自动关闭通知窗口
    let window_label_close = window_label.clone();
    let app_close = app.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(15)).await;
        if let Some(w) = app_close.get_webview_window(&window_label_close) {
            w.close().ok();
        }
    });

    Ok(())
}

// ============== 测试用：插入过期任务 ==============

#[tauri::command]
fn insert_test_overdue_plan(state: State<DbState>) -> Result<String, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = chrono::Local::now();
    let past_date = now - chrono::Duration::days(5);
    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO plans (id, title, description, due_date,
         remind_expire_before_enabled, remind_expire_before_days, remind_expire_before_time,
         remind_later_enabled, remind_later_minutes,
         remind_daily_enabled, remind_daily_time,
         remind_weekly_enabled, remind_weekly_day, remind_weekly_time,
         remind_monthly_enabled, remind_monthly_day, remind_monthly_time,
         remind_once_enabled, remind_once_datetime,
         priority, status, snooze_count, created_at, updated_at)
         VALUES (?1, '测试过期任务', '这是一个测试过期任务', ?2, 1, 7, '09:00', 0, 1440, 0, '09:00', 0, 1, '09:00', 0, 1, '09:00', 0, NULL, 'high', 'pending', 0, datetime('now'), datetime('now'))",
        params![id, past_date.to_rfc3339()],
    ).map_err(|e| e.to_string())?;

    Ok(id)
}

// ============== 清理测试数据 ==============

#[tauri::command]
fn clean_test_data(state: State<DbState>) -> Result<usize, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let count = conn.execute("DELETE FROM plans WHERE id LIKE 'test-%' OR title = '测试过期任务'", []).map_err(|e| e.to_string())?;
    Ok(count)
}

// ============== 应用状态 ==============

pub struct AppState {
    pub reminder_running: Mutex<bool>,
}

// ============== 主函数 ==============

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_logging();
    info!("工作助手 WorkMate 启动中...");

    let db_path = get_db_path();
    info!("数据库路径: {}", db_path);

    let conn = Connection::open(&db_path).expect("无法打开数据库");
    init_database(&conn).expect("无法初始化数据库");

    let app_state = AppState {
        reminder_running: Mutex::new(false),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(DbState(std::sync::Arc::new(Mutex::new(conn))))
        .manage(RuruChatState(std::sync::Mutex::new(None)))
        .manage(app_state)
        .setup(|app| {
            info!("Tauri 应用设置中...");

            // 创建系统托盘
            let show_item = MenuItemBuilder::with_id("show", "打开主界面").build(app)?;
            let new_plan_item = MenuItemBuilder::with_id("new_plan", "新建计划").build(app)?;
            let new_record_item = MenuItemBuilder::with_id("new_record", "新建工作记录").build(app)?;
            let settings_item = MenuItemBuilder::with_id("settings", "设置").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "退出").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&show_item)
                .item(&new_plan_item)
                .item(&new_record_item)
                .separator()
                .item(&settings_item)
                .separator()
                .item(&quit_item)
                .build()?;

            let icon = app.default_window_icon().cloned();
            let mut tray_builder = TrayIconBuilder::new().menu(&menu).tooltip("工作助手 WorkMate");

            if let Some(icon) = icon {
                tray_builder = tray_builder.icon(icon);
            }

            let _tray = tray_builder
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                window.show().ok();
                                window.set_focus().ok();
                            }
                        }
                        "new_plan" => {
                            if let Some(window) = app.get_webview_window("main") {
                                window.show().ok();
                                window.set_focus().ok();
                                window.emit("open-new-plan", ()).ok();
                            }
                        }
                        "new_record" => {
                            if let Some(window) = app.get_webview_window("main") {
                                window.show().ok();
                                window.set_focus().ok();
                                window.emit("open-new-record", ()).ok();
                            }
                        }
                        "settings" => {
                            if let Some(window) = app.get_webview_window("main") {
                                window.show().ok();
                                window.set_focus().ok();
                                window.emit("navigate", "settings").ok();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    match event {
                        TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } => {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    window.hide().ok();
                                } else {
                                    window.show().ok();
                                    window.set_focus().ok();
                                }
                            }
                        }
                        TrayIconEvent::DoubleClick { .. } => {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                window.show().ok();
                                window.set_focus().ok();
                            }
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            info!("系统托盘创建完成");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_plans,
            get_plan,
            create_plan,
            update_plan,
            delete_plan,
            complete_plan,
            set_auto_start,
            get_pending_plans,
            get_overdue_plans,
            snooze_plan,
            get_records,
            get_record,
            create_record,
            update_record,
            delete_record,
            get_settings,
            get_setting,
            set_setting,
            export_data_csv,
            save_file_bytes,
            get_ai_models,
            save_ai_model,
            delete_ai_model,
            set_default_ai_model,
            test_ai_model,
            get_summary_data,
            chat_with_ai,
            reset_ruru_conversation,
            open_data_folder,
            get_holidays,
            play_default_sound,
            play_success_sound,
            play_sound,
            show_main_window,
            show_notification,
            insert_test_overdue_plan,
            clean_test_data,
        ])
        .on_window_event(|window, event| {
            // 只有主窗口关闭时隐藏到托盘；通知窗口必须允许真正销毁。
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    window.hide().ok();
                    api.prevent_close();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("启动 Tauri 应用时出错");
}
