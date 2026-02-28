# 實作計劃：跨設備 Skills 同步

> 依據 `cross-device-sync-guide.md` 方案，在當前 Windows 設備完成首次設置。

## 概覽

共 7 個步驟，依序執行：

| # | 任務 | 類型 | 預估改動 |
|---|------|------|---------|
| 1 | 實作 `env-sync --reverse` | 代碼 | main.js + cli.js |
| 2 | 初始化 Claude config repo | Git 操作 | ~/.claude/ |
| 3 | 初始化 Codex config repo | Git 操作 | ~/.agents/ |
| 4 | 主專案 .gitignore 更新 + 移除追蹤 | Git 操作 | .gitignore |
| 5 | 驗證完整流程 | 測試 | — |
| 6 | 更新 skill-installer 補齊三平台路徑 | 代碼 | install-skill.py + SKILL.md |
| 7 | 建立 skills-sync skill + 加入 common | Skill + 配置 | SKILL.md + common.json |

---

## Step 1: 實作 `env-sync --reverse`

### 1.1 修改 `cli.js`

在 `env-sync` 命令中新增 `--reverse` option：

```js
// 現有
.option('-t, --tool <tool>', 'Specific tool to sync (cc, cx, anti)')
// 新增
.option('-r, --reverse', 'Reverse sync: global → project (.agent/skills-all/)')
```

將 `options.reverse` 傳入 `ss.envSync()`。

### 1.2 修改 `main.js` — `envSync()`

新增反向模式邏輯：

```
envSync(targetTool, { reverse = false } = {})

if reverse:
    for each tool:
        source = 該工具全域 skills-all 路徑（manager.getSkillsDirs()[*].skillsAll）
        target = <projectRoot>/.agent/skills-all/

        for each skill dir in source:
            if skill not exists in target:
                copy source/skill → target/skill
                count++

    return [{ tool, synced: count }]
else:
    （現有正向邏輯不變）
```

**關鍵細節**：
- 反向模式的 target 固定為 `.agent/skills-all/`（Antigravity 專案級路徑）
- source 依 tool 不同：cc → `~/.claude/skills-all/`、cx → `~/.agents/skills-all/`
- 若指定 `-t anti`，source 取 `~/.agents/skills-all/`（因為 Antigravity 自身無全域路徑，借用 Codex 的）
- 只複製不存在的（冪等），不覆蓋已有 skill
- 使用 `fs.copy` + `dereference: true`（解析 symlink 為實體複製）

### 1.3 預期效果

```bash
# 反向同步：全域 → 專案
ss env-sync --reverse -t anti
# ℹ  Processing anti...
# ✓ Environment synchronization completed!
#   anti: Synced 12 skills from global to project.

# 正向同步（現有行為不變）：專案 → 全域
ss env-sync -t cc
```

---

## Step 2: 初始化 Claude Config Repo

在 `~/.claude/` 中執行：

```bash
cd ~/.claude
git init
git remote add origin git@github.com:AtsushiHarimoto/Moyin-Claude-skills-config.git

# 建立 .gitignore（內容見 cross-device-sync-guide.md §2.1）

# 分批 add 以避免過大
git add .gitignore
git add skills-all/
git add plugins/installed_plugins.json plugins/installed_plugins-all.json plugins/known_marketplaces.json
git add config/hooks.json
git add hooks/
git add settings.json

git commit -m "init: Claude Code skills + plugins + hooks + settings"
git branch -M main
git push -u origin main
```

**注意事項**：
- `skills-all/` 有 335 個子目錄，首次 push 較大
- 確認不要 add `plugins/cache/`、`settings.local.json` 等排除項
- hooks 腳本（`.ps1`）目前為 Windows 專用，先追蹤進去，Mac 上再補 `.sh` 版本

---

## Step 3: 初始化 Codex Config Repo

在 `~/.agents/` 中執行：

```bash
cd ~/.agents
git init
git remote add origin git@github.com:AtsushiHarimoto/Moyin-Codex-Skills-config.git

# 建立 .gitignore（排除 skills/）

git add .gitignore
git add skills-all/
git add skills-disabled/

git commit -m "init: Codex skills"
git branch -M main
git push -u origin main
```

---

## Step 4: 主專案 .gitignore 更新

### 4.1 修改 `.gitignore`

新增一行：

```gitignore
# Antigravity skills（由 ss env-sync --reverse 從全域同步）
.agent/skills-all/
```

### 4.2 移除 git 追蹤

```bash
git rm -r --cached .agent/skills-all/
git commit -m "chore: stop tracking .agent/skills-all (synced via env-sync --reverse)"
```

> **重要**：`git rm --cached` 只移除追蹤，不刪除本機檔案。

### 4.3 清理 legacy `.codex/`

如果 `.codex/skills-all/` 仍在主專案中，一併清理：

```bash
# 檢查是否追蹤中
git ls-files .codex/

# 若有，移除
git rm -r --cached .codex/
# 加入 .gitignore
echo ".codex/" >> .gitignore
```

---

## Step 5: 驗證

### 5.1 env-sync --reverse 功能測試

```bash
# 先刪除幾個 .agent/skills-all/ 中的 skill 做測試
rm -rf .agent/skills-all/find-skills

# 執行反向同步
node tools/skills-switch/cli.js env-sync --reverse -t anti

# 確認 find-skills 被從 ~/.agents/skills-all/ 複製回來
ls .agent/skills-all/find-skills/
```

### 5.2 Config repo 驗證

```bash
# 確認 ~/.claude/ repo 乾淨
cd ~/.claude && git status

# 確認 ~/.agents/ repo 乾淨
cd ~/.agents && git status
```

### 5.3 主專案驗證

```bash
cd <project>
# 確認 .agent/skills-all/ 不再追蹤
git status
# 應該不會顯示 .agent/skills-all/ 的任何變更

# 確認 skills-switch 正常運作
node tools/skills-switch/cli.js status
```

### 5.4 Profile 切換驗證

```bash
node tools/skills-switch/cli.js use cc-prd
node tools/skills-switch/cli.js status
```

---

## 執行順序與依賴

```
Step 1 (env-sync --reverse)
    ↓
Step 2 (Claude repo)  ──┐
Step 3 (Codex repo)   ──┤── 可並行
    ↓                    │
Step 4 (.gitignore)   ←──┘
    ↓
Step 5 (驗證)
```

Step 1 必須先完成（Step 5 需要用到）。
Step 2 和 Step 3 彼此獨立，可並行。
Step 4 在 repo 推送後執行（確認全域有備份再移除主專案追蹤）。

---

## Step 6: 更新 skill-installer（補齊三平台路徑）

skill-installer 目前只處理 `~/.claude/skills-all/` 和 `.agent/skills-all/`，
缺少 `~/.agents/skills-all/`（Codex）。需同步更新。

### 6.1 修改 `install-skill.py`

#### 6.1.1 新增 Codex 全域路徑常量

```python
# 現有
GLOBAL_SKILLS_ALL = HOME / ".claude" / "skills-all"
GLOBAL_SKILLS_ACTIVE = HOME / ".claude" / "skills"

# 新增
CODEX_SKILLS_ALL = HOME / ".agents" / "skills-all"
CODEX_SKILLS_ACTIVE = HOME / ".agents" / "skills"
```

#### 6.1.2 `search_skills_local()` — 搜尋範圍加入 `~/.agents/skills-all/`

```python
# 現有搜尋順序：PROJECT_SKILLS_ALL → GLOBAL_SKILLS_ALL
# 改為三路搜尋：PROJECT_SKILLS_ALL → GLOBAL_SKILLS_ALL → CODEX_SKILLS_ALL
for base in [PROJECT_SKILLS_ALL, GLOBAL_SKILLS_ALL, CODEX_SKILLS_ALL]:
```

#### 6.1.3 `find_skill_local()` — 同上

```python
for base in [PROJECT_SKILLS_ALL, GLOBAL_SKILLS_ALL, CODEX_SKILLS_ALL]:
```

#### 6.1.4 `cmd_install()` — Step 2 同步到三個位置

現有只同步 `GLOBAL_SKILLS_ALL` 和 `PROJECT_SKILLS_ALL`，新增 `CODEX_SKILLS_ALL`：

```python
# 新增：同步到 ~/.agents/skills-all/
if not skill_dir_exists(skill, CODEX_SKILLS_ALL):
    if effective_src.resolve() != (CODEX_SKILLS_ALL / skill).resolve():
        shutil.copytree(str(effective_src), str(CODEX_SKILLS_ALL / skill), symlinks=True)
        print(f"  ✓ 已同步到 Codex 全域: {CODEX_SKILLS_ALL / skill}")
```

#### 6.1.5 `cmd_verify()` — 目錄檢查加入 Codex

```python
checks = [
    ("Claude 全域 skills-all", GLOBAL_SKILLS_ALL),
    ("Claude 全域 active", GLOBAL_SKILLS_ACTIVE),
    ("Codex 全域 skills-all", CODEX_SKILLS_ALL),     # 新增
    ("Codex 全域 active", CODEX_SKILLS_ACTIVE),       # 新增
    ("專案 skills-all", PROJECT_SKILLS_ALL),
]
```

#### 6.1.6 `_is_safe_skill_dir()` — 合法範圍加入 Codex

```python
if not (
    target.is_relative_to(GLOBAL_SKILLS_ALL)
    or target.is_relative_to(PROJECT_SKILLS_ALL)
    or target.is_relative_to(CODEX_SKILLS_ALL)      # 新增
):
    return False
```

### 6.2 修改 `.agent/skills-all/skill-installer/SKILL.md`

#### 6.2.1 Phase 2a — 搜尋來源補齊

現有：
> 本地 `.agent/skills-all/` 已安裝 300+ skills

改為：
> 本地三個 skills-all 目錄（`.agent/skills-all/`、`~/.claude/skills-all/`、`~/.agents/skills-all/`）

#### 6.2.2 Phase 4 — 安裝目標補齊

現有 4b 手動建立只提 `~/.claude/skills-all/`，改為：

```
安裝目標（三個位置自動同步）：
├── ~/.claude/skills-all/<skill>/   ← Claude Code 全域
├── ~/.agents/skills-all/<skill>/   ← Codex 全域
└── .agent/skills-all/<skill>/      ← Antigravity 專案級
```

#### 6.2.3 新增 Phase 6 — 跨設備同步提示

在 Phase 5 驗證之後，新增提示：

```
Phase 6  跨設備同步（可選）
   安裝完成後，若需要同步到其他設備：
   1. cd ~/.claude && git add -A && git commit -m "add: <skill>" && git push
   2. cd ~/.agents && git add -A && git commit -m "add: <skill>" && git push
   參考：tools/skills-switch/doc/cross-device-sync-guide.md
```

### 6.3 同步更新 `~/.claude/skills-all/skill-installer/SKILL.md`

`.agent/skills-all/` 和 `~/.claude/skills-all/` 的 SKILL.md 保持一致，
修改完 `.agent/` 版本後複製到 `~/.claude/`。

---

---

## Step 7: 建立 skills-sync Skill + 加入 common

### 7.1 建立 SKILL.md

建立 `.agent/skills-all/skills-sync/SKILL.md`，內容如下：

```markdown
---
name: skills-sync
description: Use when user wants to sync skills across devices, push/pull skill config repos, or run env-sync. Triggers on "sync skills", "push config", "pull skills from remote", "set up skills on new device".
---

# Skills Sync — 跨設備 Skills 同步

引導用戶完成 skills 配置的跨設備同步操作。

## 架構

三個 AI 工具的 skills 由獨立 git repo 管理：

| Repo | 本機路徑 | 工具 |
|------|---------|------|
| Moyin-Claude-skills-config.git | ~/.claude/ | Claude Code |
| Moyin-Codex-Skills-config.git | ~/.agents/ | Codex |
| 主專案 Moyin.git | <project>/.agent/ | Antigravity |

Antigravity 無全域路徑，靠 `ss env-sync --reverse` 從 `~/.agents/skills-all/` 同步。

## 使用時機

- 用戶說「同步 skills」、「推送配置」、「拉取 skills」
- 新設備初次設置 skills 環境
- 安裝新 skill 後需要推送到遠端
- 另一台設備需要拉取最新 skills

## 操作流程

### 場景 A：推送（本機改動後同步到遠端）

適用：安裝了新 skill、修改了 SKILL.md、更新了 profile 之後。

```bash
# 1. 推送 Claude 配置
cd ~/.claude
git add skills-all/ plugins/ settings.json config/ hooks/
git commit -m "add: <描述>"
git push

# 2. 推送 Codex 配置
cd ~/.agents
git add skills-all/ skills-disabled/
git commit -m "add: <描述>"
git push

# 3. 同步 Antigravity（專案級，已在主專案 .gitignore 中排除）
# 若有新 skill 需要同步到 .agent/skills-all/：
cd <project>
node tools/skills-switch/cli.js env-sync --reverse -t anti
```

### 場景 B：拉取（從遠端同步到本機）

適用：另一台設備有新 skill，本機需要更新。

```bash
# 1. 拉取 Claude 配置
cd ~/.claude && git pull

# 2. 拉取 Codex 配置
cd ~/.agents && git pull

# 3. 同步 Antigravity
cd <project>
node tools/skills-switch/cli.js env-sync --reverse -t anti

# 4. 重新載入當前 profile（刷新 symlinks）
node tools/skills-switch/cli.js use <current-profile>
```

### 場景 C：新設備初始化

適用：全新設備首次設置。

前置條件：Git + SSH key 已配置、Node.js >= 14

```bash
# 1. Clone 配置 repos
cd ~
git clone git@github.com:AtsushiHarimoto/Moyin-Claude-skills-config.git .claude
git clone git@github.com:AtsushiHarimoto/Moyin-Codex-Skills-config.git .agents

# 2. Clone 主專案
git clone git@github.com:AtsushiHarimoto/Moyin.git
cd Moyin

# 3. 安裝 skills-switch
cd tools/skills-switch && npm install && cd ../..

# 4. 初始化 + 同步 Antigravity
node tools/skills-switch/cli.js init
node tools/skills-switch/cli.js env-sync --reverse -t anti

# 5. 啟用 profile
node tools/skills-switch/cli.js use cc-prd
```

若 ~/.claude/ 已被 Claude Code 自動建立，需先備份再合併：
```bash
mv ~/.claude ~/.claude-backup
git clone <repo> .claude
cp -r ~/.claude-backup/cache ~/.claude/
cp -r ~/.claude-backup/projects ~/.claude/
cp -r ~/.claude-backup/plans ~/.claude/
rm -rf ~/.claude-backup
```

## 平台差異

| 項目 | Windows | macOS/Linux |
|------|---------|-------------|
| Home | %USERPROFILE% | ~ |
| 連結類型 | Junction | Symlink |
| hooks 腳本 | .bat / .ps1 | .sh |

## 狀態檢查

```bash
# 查看 config repo 狀態
cd ~/.claude && git status && git log --oneline -3
cd ~/.agents && git status && git log --oneline -3

# 查看 skills-switch 狀態
node tools/skills-switch/cli.js status
```

## 參考文件

- `tools/skills-switch/doc/cross-device-sync-guide.md` — 完整方案說明
- `tools/skills-switch/doc/sync-implementation-plan.md` — 實作計劃
```

### 7.2 同步到全域

複製到 `~/.claude/skills-all/skills-sync/` 和 `~/.agents/skills-all/skills-sync/`。

### 7.3 加入 common.json

在 `tools/skills-switch/profiles/common.json` 的 `skills.all` 中新增 `"skills-sync"`：

```json
{
    "skills": {
        "all": [
            "moyin-plan",
            "moyin-verify",
            "moyin-evolve",
            "moyin-spec-explore",
            "skills-sync"
        ]
    }
}
```

加入 `all` 而非特定工具，因為任何工具都可能需要執行同步操作。

### 7.4 同步更新所有 `*-full.json` profiles

`skills-sync` 也需要加入 `cc-full`、`cx-full`、`anti-full` 的 skills 清單中，
確保 full profile 包含此 skill。

---

## 完整執行順序

```
Step 1 (env-sync --reverse)
    ↓
Step 2 (Claude repo)  ──┐
Step 3 (Codex repo)   ──┤── 可並行
    ↓                    │
Step 4 (.gitignore)   ←──┘
    ↓
Step 5 (驗證)
    ↓
Step 6 (skill-installer 補齊三平台)  ──┐
Step 7 (skills-sync skill + common)  ──┤── 可並行
                                       ↓
                                    commit
```

Step 6 和 Step 7 彼此獨立，可並行執行。完成後統一 commit。
