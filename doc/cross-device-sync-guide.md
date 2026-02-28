# Skills 跨設備同步方案

> 適用平台：Windows / macOS / Linux
> 最後更新：2026-02-14

## 1. 架構總覽

三個 AI 工具的 skills 分別存放在不同路徑，透過獨立的 git repo 進行跨設備同步。

```
GitHub Repos                          本機路徑                    工具
─────────────────────────────────     ──────────────────────     ──────────
Moyin-Claude-skills-config.git   ──→  ~/.claude/                 Claude Code
Moyin-Codex-Skills-config.git    ──→  ~/.agents/                 Codex
（主專案 Moyin.git）              ──→  <project>/.agent/          Antigravity
```

### 同步關係

```
~/.claude/skills-all/   ←── git ──→  Moyin-Claude-skills-config.git
~/.agents/skills-all/   ←── git ──→  Moyin-Codex-Skills-config.git

.agent/skills-all/      ←── ss env-sync --reverse ──  ~/.agents/skills-all/
                        （不追蹤在主專案 git 中）
```

### 為什麼 Antigravity 不需要獨立 repo

Antigravity 只讀取專案級 `.agent/skills/`，沒有全域 `~/` 路徑。
因此用 `ss env-sync --reverse` 從 `~/.agents/skills-all/` 複製到 `.agent/skills-all/` 即可。
skills 內容（SKILL.md + references/）在三個工具間通用，不需維護多份。

## 2. Git Repo 結構

### 2.1 Moyin-Claude-skills-config.git

對應本機路徑：`~/.claude/`

```
Moyin-Claude-skills-config/
├── skills-all/                  # 全量 skills（~335 個）
│   ├── 1password/
│   │   ├── SKILL.md
│   │   └── references/
│   ├── find-skills/
│   └── ...
├── plugins/
│   ├── installed_plugins.json   # 已安裝插件清單
│   ├── installed_plugins-all.json
│   └── known_marketplaces.json
├── config/
│   └── hooks.json               # hooks 配置
├── hooks/                       # hook 腳本（平台相關，見注意事項）
├── settings.json                # 全域設定
└── .gitignore
```

#### .gitignore（放在 ~/.claude/.gitignore）

```gitignore
# === 運行時資料（不同步） ===
cache/
debug/
downloads/
file-history/
history.jsonl
ide/
paste-cache/
plans/
projects/
session-env/
shell-snapshots/
statsig/
tasks/
telemetry/
todos/
usage-data/

# === 動態生成（由 ss use 管理） ===
skills/

# === 插件快取 ===
plugins/cache/
plugins/marketplaces/

# === 設備專屬 ===
settings.local.json
config/notification_states.json
learnings-queue.json

# === 平台專屬腳本（按需排除） ===
# 若 hooks 腳本有平台差異，可在此排除
# *.bat
# *.ps1
```

### 2.2 Moyin-Codex-Skills-config.git

對應本機路徑：`~/.agents/`

```
Moyin-Codex-Skills-config/
├── skills-all/                  # 全量 skills（~336 個）
│   ├── 1password/
│   └── ...
├── skills-disabled/             # 手動停用的 skills
└── .gitignore
```

#### .gitignore（放在 ~/.agents/.gitignore）

```gitignore
# 動態生成（由 ss use 管理）
skills/
```

## 3. 初始化（首台設備 → 推送到 GitHub）

在已有完整配置的設備上執行（目前為 Windows）。

### 3.1 Claude Config Repo

```bash
cd ~/.claude

# 初始化 git
git init
git remote add origin git@github.com:AtsushiHarimoto/Moyin-Claude-skills-config.git

# 建立 .gitignore（內容見 2.1 節）
# 確認 .gitignore 已就位後：

git add .gitignore
git add skills-all/
git add plugins/installed_plugins.json
git add plugins/installed_plugins-all.json
git add plugins/known_marketplaces.json
git add config/hooks.json
git add hooks/
git add settings.json
git commit -m "init: Claude Code skills + plugins + settings"
git branch -M main
git push -u origin main
```

### 3.2 Codex Config Repo

```bash
cd ~/.agents

# 初始化 git
git init
git remote add origin git@github.com:AtsushiHarimoto/Moyin-Codex-Skills-config.git

# 建立 .gitignore（內容見 2.2 節）

git add .gitignore
git add skills-all/
git add skills-disabled/
git commit -m "init: Codex skills"
git branch -M main
git push -u origin main
```

### 3.3 主專案 .gitignore 更新

在 Moyin 主專案中，將 `.agent/skills-all/` 加入 `.gitignore`：

```gitignore
# Antigravity skills（由 ss env-sync --reverse 從 ~/.agents/ 同步）
.agent/skills-all/
```

## 4. 新設備設置流程

### 4.1 前置條件

- Git + SSH key 已配置（能存取 GitHub private repos）
- Node.js >= 14
- Python >= 3.8（用於 install-skill.py）

### 4.2 Step 1: Clone 配置 repos

#### macOS / Linux

```bash
# Claude Code 配置
cd ~
git clone git@github.com:AtsushiHarimoto/Moyin-Claude-skills-config.git .claude

# Codex 配置
git clone git@github.com:AtsushiHarimoto/Moyin-Codex-Skills-config.git .agents
```

#### Windows

```powershell
# Claude Code 配置
cd $env:USERPROFILE
git clone git@github.com:AtsushiHarimoto/Moyin-Claude-skills-config.git .claude

# Codex 配置
git clone git@github.com:AtsushiHarimoto/Moyin-Codex-Skills-config.git .agents
```

> **注意**：如果 `~/.claude/` 已存在（Claude Code 自動建立），先備份再合併：
> ```bash
> mv ~/.claude ~/.claude-backup
> git clone git@github.com:AtsushiHarimoto/Moyin-Claude-skills-config.git .claude
> # 將 backup 中的運行時資料複製回來（cache, plans, projects 等）
> cp -r ~/.claude-backup/cache ~/.claude/
> cp -r ~/.claude-backup/projects ~/.claude/
> cp -r ~/.claude-backup/plans ~/.claude/
> # ... 其他 .gitignore 中排除的目錄
> rm -rf ~/.claude-backup
> ```

### 4.3 Step 2: Clone 主專案

```bash
git clone git@github.com:AtsushiHarimoto/Moyin.git
cd Moyin
```

### 4.4 Step 3: 安裝 moyin-dev-dashboard 依賴

```bash
cd moyin-dev-dashboard
npm install
cd ..
```

### 4.5 Step 4: 初始化 moyin-dev-dashboard

```bash
node moyin-dev-dashboard/cli.js init
```

### 4.6 Step 5: 同步 Antigravity skills

```bash
node moyin-dev-dashboard/cli.js env-sync --reverse -t anti
```

這會將 `~/.agents/skills-all/` 的內容複製到 `.agent/skills-all/`。

### 4.7 Step 6: 啟用 profile

```bash
# 根據用途選擇 profile
node moyin-dev-dashboard/cli.js use cc-prd
node moyin-dev-dashboard/cli.js use cx-prd
node moyin-dev-dashboard/cli.js use anti-prd
```

### 4.8 Step 7: 驗證

```bash
node moyin-dev-dashboard/cli.js status
```

## 5. 日常同步操作

### 5.1 新增/修改 skill 後推送

```bash
# Claude 配置
cd ~/.claude
git add skills-all/
git commit -m "add: <skill-name>"
git push

# Codex 配置
cd ~/.agents
git add skills-all/
git commit -m "add: <skill-name>"
git push
```

### 5.2 另一台設備拉取

```bash
# 拉取最新配置
cd ~/.claude && git pull
cd ~/.agents && git pull

# 同步 Antigravity
cd <project-root>
node moyin-dev-dashboard/cli.js env-sync --reverse -t anti

# 重新載入當前 profile（刷新 symlinks）
node moyin-dev-dashboard/cli.js use <current-profile>
```

### 5.3 衝突處理

skills 通常只有新增，很少衝突。若出現衝突：

```bash
cd ~/.claude
git pull
# 若衝突，保留較新的 SKILL.md 版本
git checkout --theirs skills-all/<conflicted-skill>/SKILL.md
git add . && git commit -m "resolve: merge skill conflict"
```

## 6. 平台差異注意事項

### 6.1 Hooks 腳本

`~/.claude/hooks/` 中的腳本可能有平台差異：

| 平台 | 腳本格式 |
|------|---------|
| Windows | `.bat`, `.ps1` |
| macOS/Linux | `.sh`（需 `chmod +x`） |

**建議**：hooks 腳本按平台命名，在 `config/hooks.json` 中根據平台引用：

```
hooks/
├── notify-stop.ps1      # Windows
├── notify-stop.sh       # macOS/Linux
```

或在 `.gitignore` 中排除平台專屬腳本，僅追蹤通用配置。

### 6.2 settings.json 中的路徑

`settings.json` 中的 `_skillsSwitch` 欄位包含動態狀態，跨設備同步時會自動被 `ss use` 覆寫，不影響。

但 `plugins` 安裝路徑（`installed_plugins.json` 中的 `installPath`）含絕對路徑，拉取後需重新安裝插件：

```bash
# 在新設備上重新安裝插件
claude plugins install superpowers@claude-plugins-official
claude plugins install pyright-lsp@claude-plugins-official
```

### 6.3 Symlinks vs Junctions

`ss use` 在切換 profile 時建立符號連結：

| 平台 | 連結類型 | 是否需要管理員 |
|------|---------|-------------|
| Windows | Junction | 否 |
| macOS/Linux | Symlink | 否 |

moyin-dev-dashboard 已自動處理平台差異，無需手動干預。

### 6.4 路徑對照表

| 項目 | Windows | macOS/Linux |
|------|---------|-------------|
| Claude 全域 | `%USERPROFILE%\.claude\` | `~/.claude/` |
| Codex 全域 | `%USERPROFILE%\.agents\` | `~/.agents/` |
| Antigravity | `<project>\.agent\` | `<project>/.agent/` |
| moyin-dev-dashboard | `<project>\moyin-dev-dashboard\` | `<project>/moyin-dev-dashboard/` |
| Profiles | `moyin-dev-dashboard\profiles\` | `moyin-dev-dashboard/profiles/` |

## 7. `env-sync --reverse` 實作規格

> 此功能待實作，以下為規格說明。

### CLI 介面

```bash
ss env-sync --reverse [-t <tool>]
```

### 行為

| 模式 | 方向 | 說明 |
|------|------|------|
| 正向（現有） | `.agent/skills-all/` → `~/.agents/skills-all/` | 專案 skills 同步到全域 |
| 反向（新增） | `~/.agents/skills-all/` → `.agent/skills-all/` | 全域 skills 同步到專案 |

### 反向模式邏輯

```
for each tool in [cc, cx, anti]:
    source = 該工具的全域 skills-all 路徑
    target = 專案的 .agent/skills-all/

    for each skill in source:
        if skill not exists in target:
            copy skill → target
```

- 對 `anti`（Antigravity）：source = `~/.agents/skills-all/`，target = `.agent/skills-all/`
- 對 `cc`（Claude Code）：source = `~/.claude/skills-all/`，target = `.agent/skills-all/`
- 對 `cx`（Codex）：source = `~/.agents/skills-all/`，target = `.agent/skills-all/`

> 實際上 `--reverse -t anti` 最常用，因為 Antigravity 是唯一沒有全域路徑的工具。

### 冪等性

- 只複製目標中不存在的 skill（不覆蓋已有的）
- 可安全重複執行

## 8. 可用 Profiles 清單

每個工具有 9 個 profile：

| Profile 後綴 | 用途 |
|-------------|------|
| `-prd` | 產品開發（通用） |
| `-frontend-dev` | 前端開發 |
| `-backend-dev` | 後端開發 |
| `-design` | UI/UX 設計 |
| `-game` | 遊戲開發 |
| `-review` | Code Review |
| `-qa` | 品質保證 |
| `-cicd` | CI/CD |
| `-full` | 全量（載入所有 skills） |

前綴：`cc-`（Claude Code）、`cx-`（Codex）、`anti-`（Antigravity）

另有 `common.json` 定義跨 profile 常駐 skills 和 pinned plugins。

## 9. 快速參考卡

```bash
# ─── 初始化（新設備） ───
git clone git@github.com:AtsushiHarimoto/Moyin-Claude-skills-config.git ~/.claude
git clone git@github.com:AtsushiHarimoto/Moyin-Codex-Skills-config.git ~/.agents
cd <project> && node moyin-dev-dashboard/cli.js init
node moyin-dev-dashboard/cli.js env-sync --reverse -t anti
node moyin-dev-dashboard/cli.js use cc-prd

# ─── 日常推送 ───
cd ~/.claude && git add -A && git commit -m "update skills" && git push
cd ~/.agents && git add -A && git commit -m "update skills" && git push

# ─── 日常拉取 ───
cd ~/.claude && git pull
cd ~/.agents && git pull
cd <project> && node moyin-dev-dashboard/cli.js env-sync --reverse -t anti

# ─── 狀態檢查 ───
node moyin-dev-dashboard/cli.js status
node moyin-dev-dashboard/cli.js list
```
