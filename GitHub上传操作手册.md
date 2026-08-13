# WorkMate 上传到 GitHub · 操作手册

> 本文档配套目录：`D:\GEMFiles\Work\13.航天世纪\19.其他自研\windows小工具`
> 工具：GitHub CLI（已装，`gh 2.97.0`）+ Git 2.9
> 适合第一次上传这个项目的开发者；命令按顺序执行即可。

---

## 0. 前置准备清单

执行前请确认：

| 项 | 说明 |
|---|---|
| [ ] GitHub 账号 | 你自己登录用的账号（owner） |
| [ ] 仓库名 | 想取的名字（建议：`workmate-windows-helper` 或 `workmate`） |
| [ ] 可见性 | Private（推荐）/ Public |
| [ ] 安装包处理 | 走 Releases / 直传 git 仓库 / 不传 |
| [ ] `api接口文档.md` | 内部含硬编码 API key + 内网地址；务必先脱敏或排除 |

---

## 1. 登录 GitHub（用 gh CLI）

```bash
gh auth login
```

交互流程选：
- `GitHub.com` 或 `GitHub Enterprise` —— 一般是前者
- 登录方式：`HTTPS`（推荐，gh 会顺手配 git credential helper）
- 协议认证方式：`Login with a web browser`（更省事）或 `Paste an authentication token`

验证：
```bash
gh auth status
```
看到 `Logged in to github.com as <你的用户名>` 即可。

---

## 2. 创建仓库（两种方式二选一）

### 方式 A：用 gh CLI 直接创建

```bash
# 在项目根目录执行
cd "D:/GEMFiles/Work/13.航天世纪/19.其他自研/windows小工具"

# 私有仓库（推荐）
gh repo create <你的用户名>/<仓库名> --private --source=. --remote=origin --push

# 公开仓库
gh repo create <你的用户名>/<仓库名> --public --source=. --remote=origin --push
```

> ⚠️ `--push` 会要求本地先有 commit；如果下面还没 git init，会失败，所以**优先用方式 B 分两步走**。

### 方式 B：网页创建空仓库 + 本地 push（更可控）

1. 打开 https://github.com/new
2. 填：Repository name（仓库名）、Description（可选）、选 Private 或 Public
3. **不要勾** `Add a README` / `Add .gitignore` / `Choose a license`（本地有现成的）
4. 点 `Create repository`
5. 记下页面给你的远程 URL（形如 `https://github.com/<用户名>/<仓库名>.git`）

---

## 3. 准备 .gitignore（**最重要的一步**）

在项目根目录新建 `.gitignore`，粘贴以下内容：

```gitignore
# ============================================
# 敏感信息
# ============================================
# 内网 API 地址文档（含硬编码 API key、内网 IP）
api接口文档.md

# ============================================
# 依赖和构建产物
# ============================================
node_modules/
dist/
target/
*.exe
*.msi
*.pdb
*.dll
*.lib
*.exp

# ============================================
# Tauri / Rust
# ============================================
src-tauri/target/
src-tauri/Cargo.lock
src-tauri/gen/

# ============================================
# 前端构建产物
# ============================================
workmate/dist/
workmate/node_modules/

# ============================================
# 日志和临时
# ============================================
log/
*.log
*.tmp
*.bak

# ============================================
# 系统文件
# ============================================
Thumbs.db
.DS_Store
desktop.ini
```

**说明**：
- `*.exe / *.msi` 排除后，安装包走 Releases（见第 6 节），不进 git 仓库
- 如果想让 .exe 也进仓库，把对应行注释掉——但不推荐，会让仓库变胖
- `api接口文档.md` **永远不传**，除非你决定脱敏

---

## 4. 敏感文件处理（务必做）

```bash
# 确认 api接口文档.md 已被忽略（应显示 nothing to commit）
cd "D:/GEMFiles/Work/13.航天世纪/19.其他自研/windows小工具"
git check-ignore -v api接口文档.md
```

如果输出带路径，说明已被忽略。

**强烈建议**：把这文件**挪出项目目录**或**改名**到带 `.local.` 后缀（如 `api接口文档.local.md`），物理隔离更安全。

---

## 5. 初始化仓库 + 首次推送

```bash
cd "D:/GEMFiles/Work/13.航天世纪/19.其他自研/windows小工具"

# 5.1 初始化
git init
git branch -M main

# 5.2 配置身份（首次必须）
git config user.name "你的名字"
git config user.email "你的邮箱@example.com"

# 5.3 关联远程（替换 <你的用户名>/<仓库名>）
git remote add origin https://github.com/<你的用户名>/<仓库名>.git

# 5.4 查看将要提交的内容（确认没把不该传的文件混进来）
git status
git add -n .          # dry-run，看哪些文件会被 add

# 5.5 真正添加
git add .

# 5.6 再次确认暂存区
git status

# 5.7 提交
git commit -m "feat: 首次提交 - WorkMate v1.0.0 工作助手

- Tauri 2 + React 18 桌面应用
- 计划管理 / 工作记录 / 提醒 / AI 聊天
- 内置 DeepSeek / Dify / 自定义模型
- 详见 SPEC.md"

# 5.8 推送
git push -u origin main
```

> 推送时如果弹认证窗口，按 gh login 时设置的方式走（一般是浏览器）。

---

## 6. 安装包上传到 GitHub Releases（推荐）

源码进 git，3 个安装包（17.5 MB exe + 9 MB msi + 6 MB nsis）走 Release 附件，仓库干净。

### 方式 A：用 gh CLI 创建 Release（最简单）

```bash
cd "D:/GEMFiles/Work/13.航天世纪/19.其他自研/windows小工具"

# 6.1 给当前版本打 tag
git tag v1.0.0
git push origin v1.0.0

# 6.2 创建 Release 并附带 3 个安装包
gh release create v1.0.0 \
  --title "WorkMate v1.0.0" \
  --notes "首次发布。

## 下载
- **WorkMate.exe** —— 绿色版，免安装
- **WorkMate_1.0.0_x64-setup.exe** —— NSIS 安装包（推荐，含卸载）
- **WorkMate_1.0.0_x64_en-US.msi** —— MSI 企业部署用

## 系统要求
- Windows 10 / 11 (x64)
- Dify 服务（如使用 AI 聊天）：本机 127.0.0.1:8000/v1" \
  ./WorkMate.exe \
  ./WorkMate_1.0.0_x64-setup.exe \
  ./WorkMate_1.0.0_x64_en-US.msi
```

### 方式 B：网页手动上传

1. 进入仓库页面 → 右侧 `Releases` → `Create a new release`
2. Choose a tag：填 `v1.0.0` → `Create new tag`
3. Release title：`WorkMate v1.0.0`
4. Description：复制上方 `--notes` 内容
5. Attach binaries：拖入 3 个文件
6. 点 `Publish release`

---

## 7. 后续维护速查

### 更新代码
```bash
git add .
git commit -m "fix: 修复 XX"
git push
```

### 发新版本
```bash
# 改版本号（在 src-tauri/tauri.conf.json 的 version 字段）
# 重新构建 → 替换项目根目录的 3 个安装包
# 然后：
git tag v1.0.1
git push origin v1.0.1
gh release create v1.0.0 ...   # 或网页操作
```

### 拉取协作者改动
```bash
git pull
```

---

## 8. 常见问题

**Q: 推送报 `Permission denied`？**
A: gh auth 没配好，跑 `gh auth login` 重来；或者用 SSH：`gh auth login` 时选 SSH，按提示把公钥加到 GitHub。

**Q: 误提交了敏感文件怎么办？**
A: 立刻：
1. 删除本地文件（不要仅靠 .gitignore，已提交的内容还在历史里）
2. `git rm --cached 文件名` + `git commit`
3. 推送到远端
4. **重要**：去 GitHub 仓库 → Settings → Danger Zone → `Rotate/delete this repository` 不需要，但**该敏感凭据必须作废**（重新生成 API key 等）
5. 高级：用 `git filter-branch` 或 `bfg-repo-cleaner` 清理历史

**Q: 仓库太大推不动？**
A: 大概率是 `node_modules` 或 `target/` 进了仓库。检查 `.gitignore` 是否生效，看 `git status` 确认。

**Q: 想把私有仓库转公开？**
A: 仓库页面 → Settings → 最下方 `Danger Zone` → `Change repository visibility` → `Make public`。**转之前再过一遍敏感文件清单。**

---

## 9. 检查清单（推送前过一遍）

- [ ] `.gitignore` 已创建并生效
- [ ] `api接口文档.md` 不在 `git status` 待提交列表里
- [ ] `workmate/node_modules/` 不在
- [ ] `workmate/src-tauri/target/` 不在
- [ ] `workmate/dist/` 不在
- [ ] 3 个安装包按计划走 Release（不进 git）
- [ ] `git config user.name / user.email` 已配
- [ ] 远程 URL 正确（用户名/仓库名无误）
- [ ] commit message 描述清楚

完成以上后即可安全推送。
