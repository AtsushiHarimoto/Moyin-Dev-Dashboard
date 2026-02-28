const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const CodexManager = require('./codex-manager');
const ClaudeManager = require('./claude-manager');
const AntiManager = require('./anti-manager');
const ProfileManager = require('./profile-manager');
const AliasInstaller = require('./alias-installer');
const UI = require('./ui');
const { validateBackupId, validatePathInDirectory, validateSkillDirName } = require('./validators');
const { TOOL_NAME_MAP } = require('./constants');

/**
 * Skills Switch 主程序
 */
class SkillsSwitch {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.profilesDir = path.join(this.projectRoot, 'tools', 'skills-switch', 'profiles');
    this.stateDir = path.join(os.homedir(), '.skills-switch');

    // 初始化管理器
    this.codex = new CodexManager({ projectRoot: this.projectRoot });
    this.claude = new ClaudeManager({ projectRoot: this.projectRoot });
    this.anti = new AntiManager({ projectRoot: this.projectRoot });
    this.profileManager = new ProfileManager(this.profilesDir);
    this.aliasInstaller = new AliasInstaller(this.projectRoot);
    this.ui = new UI();
  }

  /**
   * 工具名称映射（长名 -> 短名）
   * Delegates to the single source of truth in constants.js
   */
  static TOOL_NAME_MAP = TOOL_NAME_MAP;

  /**
   * 取得工具長名（用於狀態與歷史記錄）
   *
   * @param {string} tool 工具名稱（短名/長名）
   * @returns {string} 長名，若未知則回傳原值
   */
  getLongToolName(tool) {
    const map = {
      cx: 'codex',
      cc: 'claude',
      anti: 'anti',
      codex: 'codex',
      claude: 'claude'
    };
    return map[tool] || tool;
  }

  /**
   * 获取工具管理器
   */
  getManager(tool) {
    const managers = {
      codex: this.codex,
      cx: this.codex,
      claude: this.claude,
      cc: this.claude,
      anti: this.anti
    };

    return managers[tool];
  }

  /**
   * 获取标准化的工具短名
   */
  getShortToolName(tool) {
    return SkillsSwitch.TOOL_NAME_MAP[tool] || tool;
  }

  /**
   * 加载共通 skills 配置
   */
  async loadCommonSkills() {
    const commonPath = path.join(this.profilesDir, 'common.json');

    if (!await fs.pathExists(commonPath)) {
      return { all: [], cx: [], cc: [], anti: [] };
    }

    try {
      const common = await fs.readJson(commonPath);
      return common.skills || { all: [], cx: [], cc: [], anti: [] };
    } catch (err) {
      console.warn(`Failed to load common.json: ${err.message}`);
      return { all: [], cx: [], cc: [], anti: [] };
    }
  }

  /**
   * 获取工具的共通 skills（合并 all + 工具特定）
   */
  async getCommonSkillsForTool(tool) {
    const common = await this.loadCommonSkills();
    const shortTool = this.getShortToolName(tool);

    // 合并 all 和工具特定的 skills
    const toolSpecific = common[shortTool] || [];
    const allSkills = common.all || [];

    // 去重
    return [...new Set([...allSkills, ...toolSpecific])];
  }

  /**
   * 獲取工具的釘選 plugins（從 common.json 的 plugins 欄位）
   * 切換 profile 時永遠保留，不被移除
   */
  async getPinnedPluginsForTool(tool) {
    const commonPath = path.join(this.profilesDir, 'common.json');
    if (!await fs.pathExists(commonPath)) return [];

    try {
      const common = await fs.readJson(commonPath);
      const shortTool = this.getShortToolName(tool);
      const rawPlugins = common.plugins?.[shortTool] || [];
      // 支持混合格式：字串（所有平台）或 { id, platform }（限定平台）
      const currentPlatform = process.platform;
      return rawPlugins
        .filter(p => {
          if (typeof p === 'string') return true;
          return !p.platform || p.platform === currentPlatform;
        })
        .map(p => typeof p === 'string' ? p : p.id);
    } catch {
      return [];
    }
  }

  /**
   * 初始化
   */
  async init() {
    this.ui.showBanner();
    this.ui.section('1/7 🔍 Detecting environment');

    const platform = process.platform;
    const nodeVersion = process.version;

    this.ui.success(`Platform: ${platform}`);
    this.ui.success(`Node.js: ${nodeVersion}`);
    this.ui.success(`Project: ${this.projectRoot}`);

    this.ui.section('2/7 📂 Locating tool directories');

    const codexInfo = await this.codex.init();
    const claudeInfo = await this.claude.init();
    const antiInfo = await this.anti.init();

    this.ui.success(`Codex: ${this.codex.skillsPath} (${codexInfo.skillsAll?.length || 0} skills)`);
    this.ui.success(`Claude Code: ${this.claude.skillsPath} (${claudeInfo.currentSkills?.length || 0} skills)`);
    this.ui.success(`Antigravity: ${this.anti.skillsPath} (${antiInfo.skillsAll?.length || 0} skills)`);

    this.ui.section('3/7 🔧 Checking platform capabilities');

    const symlinkSupport = platform !== 'win32';
    this.ui.success(`Symlink support: ${symlinkSupport ? 'Yes' : 'No (will use hard links)'}`);
    this.ui.success('File permissions: OK');

    this.ui.section('4/7 📦 Creating directory structure');

    await fs.ensureDir(this.profilesDir);
    await fs.ensureDir(this.stateDir);
    await fs.ensureDir(path.join(this.stateDir, 'backups'));

    this.ui.success(`${this.profilesDir}/`);
    this.ui.success(`${this.stateDir}/`);
    this.ui.success(`${this.stateDir}/backups/`);

    this.ui.section('5/7 💾 Generating initial profiles');

    // 生成 full profiles
    const profiles = await this.generateInitialProfiles({
      codex: codexInfo.skillsAll || [],
      claude: claudeInfo.currentSkills || [],
      anti: antiInfo.skillsAll || []
    });

    for (const profile of profiles) {
      this.ui.success(`${profile.name}.json (${profile.skills.length} skills)`);
    }

    this.ui.info('\nℹ Other profiles need manual configuration');

    this.ui.section('6/7 ⚙️  Configuring global alias');

    const aliasInstalled = await this.aliasInstaller.isInstalled();
    if (!aliasInstalled) {
      this.ui.info('Alias not installed yet');
      this.ui.info('Run: ss alias install');
    } else {
      this.ui.success('Alias already installed');
    }

    this.ui.section('7/7 ✅ Initialization Complete');

    console.log('\n📝 Next Steps:');
    console.log('  1. Install alias: ss alias install (or node cli.js alias install)');
    console.log('  2. Configure profiles: edit profiles/*.json');
    console.log('  3. Switch profile: ss use <profile>');
    console.log('  4. Check status: ss status\n');
  }

  /**
   * 生成初始 profiles（只生成 full profiles）
   */
  async generateInitialProfiles(skills) {
    const profiles = [
      {
        name: 'cx-full',
        description: 'Codex 完整模式 - 所有 skills',
        tool: 'cx',
        skills: skills.codex
      },
      {
        name: 'cc-full',
        description: 'Claude Code 完整模式 - 所有 skills',
        tool: 'cc',
        skills: skills.claude
      },
      {
        name: 'anti-full',
        description: 'Antigravity 完整模式 - 所有 skills',
        tool: 'anti',
        skills: skills.anti
      }
    ];

    for (const profile of profiles) {
      await this.profileManager.save(profile);
    }

    return profiles;
  }

  /**
   * 使用 profile
   */
  async use(profileName, options = {}) {
    const spinner = this.ui.createSpinner(`Switching to ${profileName}...`);
    spinner.start();

    try {
      // 加载 profile
      const profile = await this.profileManager.load(profileName);
      const manager = this.getManager(profile.tool);

      if (!manager) {
        throw new Error(`Unknown tool: ${profile.tool}`);
      }

      // 加载共通 skills 和釘選 plugins 并合并
      spinner.text = 'Loading common skills and pinned plugins...';
      const commonSkills = await this.getCommonSkillsForTool(profile.tool);
      const pinnedPlugins = await this.getPinnedPluginsForTool(profile.tool);

      // 创建合并后的 profile（不修改原 profile）
      const mergedProfile = {
        ...profile,
        skills: [...new Set([...commonSkills, ...profile.skills])],
        _pinnedPlugins: pinnedPlugins
      };

      spinner.text = 'Backing up current config...';
      const result = await manager.applyProfile(mergedProfile);

      // 记录共通 skills 数量
      result.commonSkillsCount = commonSkills.length;

      spinner.succeed('Profile switched successfully!');

      // 显示结果
      this.ui.showSwitchSuccess(profile, {
        before: result.results ?
          (result.results.success.length + result.results.skipped.length + result.results.failed.length) :
          'N/A',
        after: result.skillsCount,
        diff: result.results?.success.length || 0,
        savings: ((result.results?.success.length || 0) * 70).toFixed(0),
        plugins: result.pluginResults || null,
        commonSkills: result.commonSkillsCount || 0,
        skipped: result.results?.skipped || []
      });

      // 显示失败信息
      if (result.results?.failed?.length > 0) {
        this.ui.error(`Failed to link ${result.results.failed.length} skills`);
      }

    } catch (err) {
      spinner.fail('Failed to switch profile');
      this.ui.error(err.message);
      throw err;
    }
  }

  /**
   * 显示状态
   */
  async status() {
    const statePath = path.join(this.stateDir, 'state.json');

    let state = {
      current: {},
      counts: {},
      totals: {}
    };

    if (await fs.pathExists(statePath)) {
      state = await fs.readJson(statePath);
    }

    // 获取总数
    const codexSkills = await this.codex.scanAllSkills?.() || await this.codex.scanSkills();
    const claudeSkills = await this.claude.scanAllSkills?.() || await this.claude.scanSkills();
    const antiSkills = await this.anti.scanAllSkills?.() || await this.anti.scanSkills();

    state.totals = {
      codex: codexSkills.length,
      claude: claudeSkills.length,
      anti: antiSkills.length
    };

    this.ui.showStatus(state);
  }

  /**
   * 列出所有 profiles
   */
  async list() {
    const profiles = await this.profileManager.loadAll();
    const statePath = path.join(this.stateDir, 'state.json');

    let currentState = null;
    if (await fs.pathExists(statePath)) {
      currentState = await fs.readJson(statePath);
    }

    this.ui.showProfiles(profiles, currentState);
  }

  /**
   * 显示差异
   */
  async diff(profileName) {
    const profile = await this.profileManager.load(profileName);
    const manager = this.getManager(profile.tool);

    if (!manager) {
      throw new Error(`Unknown tool: ${profile.tool}`);
    }

    const diff = await manager.getDiff(profile);

    console.log(`\nDiff for ${profile.name}:\n`);

    if (diff.added.length > 0) {
      this.ui.success(`Added (${diff.added.length}):`);
      diff.added.forEach(s => console.log(`  + ${s}`));
    }

    if (diff.removed.length > 0) {
      this.ui.warning(`Removed (${diff.removed.length}):`);
      diff.removed.forEach(s => console.log(`  - ${s}`));
    }

    if (diff.unchanged.length > 0) {
      this.ui.info(`Unchanged (${diff.unchanged.length}) skills`);
    }
  }

  /**
   * 手动备份
   */
  async backup(tool) {
    if (tool && !this.getManager(tool)) {
      throw new Error(`Unknown tool: ${tool}`);
    }
    const results = [];
    const managers = tool
      ? [{ name: tool, manager: this.getManager(tool) }]
      : [
          { name: 'codex', manager: this.codex },
          { name: 'claude', manager: this.claude },
          { name: 'anti', manager: this.anti }
        ];

    for (const { name, manager } of managers) {
      if (manager) {
        const backupPath = await manager.backup();
        results.push({ tool: name, path: backupPath });
      }
    }

    return results;
  }

  /**
   * 从备份恢复
   */
  async restore(backupId, tool) {
    const backupsDir = path.join(this.stateDir, 'backups');
    const normalizedTool = tool ? this.getLongToolName(tool) : null;

    if (tool && !this.getManager(tool)) {
      throw new Error(`Unknown tool: ${tool}`);
    }

    if (backupId) {
      // 验证 backup ID 安全性
      validateBackupId(backupId);

      // 恢复指定的备份
      const backupPath = path.join(backupsDir, backupId);

      // 二次验证：确保路径在 backupsDir 内
      validatePathInDirectory(backupPath, backupsDir);

      if (!await fs.pathExists(backupPath)) {
        throw new Error(`Backup not found: ${backupId}`);
      }
      const backup = await fs.readJson(backupPath);
      const backupTool = this.getLongToolName(backup.tool);
      if (normalizedTool && backupTool !== normalizedTool) {
        throw new Error(`Backup tool mismatch: expected ${normalizedTool}, got ${backupTool}`);
      }

      const manager = this.getManager(backupTool);
      if (!manager) {
        throw new Error(`Unknown tool in backup: ${backup.tool}`);
      }

      if (!Array.isArray(backup.skills)) {
        throw new Error('Invalid backup: skills is not an array');
      }

      // 驗證技能名稱，避免路徑穿越
      backup.skills.forEach(skill => manager.validateSkillName(skill));

      const restoreProfile = {
        name: `restore-${path.basename(backupId, '.json')}`,
        description: `Restore from ${backupId}`,
        tool: backupTool,
        skills: backup.skills
      };

      await manager.applyProfile(restoreProfile);

      return {
        profile: restoreProfile.name,
        tool: backupTool,
        count: backup.skills.length
      };
    } else {
      // 列出可用的备份
      if (!await fs.pathExists(backupsDir)) {
        throw new Error('No backups available');
      }
      const files = await fs.readdir(backupsDir);
      let backups = files.filter(f => f.endsWith('.json'));
      if (normalizedTool) {
        backups = backups.filter(b => b.startsWith(`${normalizedTool}-`));
      }
      if (backups.length === 0) {
        throw new Error('No backups available');
      }
      console.log('\nAvailable backups:');
      backups.slice(0, 10).forEach(b => console.log(`  - ${b}`));
      console.log('\nUse: ss restore <backup-id>');
    }
  }

  /**
   * 回滚到上一个 profile
   */
  async rollback(tool) {
    const statePath = path.join(this.stateDir, 'state.json');

    if (!await fs.pathExists(statePath)) {
      throw new Error('No state file found, cannot rollback');
    }

    const state = await fs.readJson(statePath);

    if (!state.history || state.history.length < 2) {
      throw new Error('No previous profile to rollback to');
    }

    // 找到上一个不同的 profile
    const toolKey = this.getLongToolName(tool || state.history[0]?.tool);
    const currentProfile = state.current?.[toolKey];
    const previousEntry = state.history.find(h =>
      h.tool === toolKey && h.profile !== currentProfile
    );

    if (!previousEntry) {
      throw new Error(`No previous profile found for ${toolKey}`);
    }

    // 切换到上一个 profile
    await this.use(previousEntry.profile);

    return { profile: previousEntry.profile, tool: toolKey };
  }

  /**
   * 添加 skill 到 profile
   */
  async addSkill(skillName, profileName) {
    this.codex.validateSkillName(skillName);

    // 如果没有指定 profile，使用当前激活的 profile
    if (!profileName) {
      const statePath = path.join(this.stateDir, 'state.json');
      if (await fs.pathExists(statePath)) {
        const state = await fs.readJson(statePath);
        // 使用第一个找到的当前 profile
        profileName = state.current?.codex || state.current?.claude || state.current?.anti;
      }
      if (!profileName) {
        throw new Error('Please specify a profile name');
      }
    }

    const profile = await this.profileManager.load(profileName);

    if (profile.skills.includes(skillName)) {
      throw new Error(`Skill '${skillName}' already exists in ${profileName}`);
    }

    profile.skills.push(skillName);
    await this.profileManager.save(profile);

    return { profile: profileName, skill: skillName };
  }

  /**
   * 从 profile 移除 skill
   */
  async removeSkill(skillName, profileName) {
    this.codex.validateSkillName(skillName);

    if (!profileName) {
      const statePath = path.join(this.stateDir, 'state.json');
      if (await fs.pathExists(statePath)) {
        const state = await fs.readJson(statePath);
        profileName = state.current?.codex || state.current?.claude || state.current?.anti;
      }
      if (!profileName) {
        throw new Error('Please specify a profile name');
      }
    }

    const profile = await this.profileManager.load(profileName);

    const index = profile.skills.indexOf(skillName);
    if (index === -1) {
      throw new Error(`Skill '${skillName}' not found in ${profileName}`);
    }

    profile.skills.splice(index, 1);
    await this.profileManager.save(profile);

    return { profile: profileName, skill: skillName };
  }

  /**
   * 同步当前 skills 到 profile
   */
  async sync(profileName, options = {}) {
    if (!profileName) {
      const statePath = path.join(this.stateDir, 'state.json');
      if (await fs.pathExists(statePath)) {
        const state = await fs.readJson(statePath);
        profileName = state.current?.codex || state.current?.claude || state.current?.anti;
      }
      if (!profileName) {
        throw new Error('Please specify a profile name');
      }
    }

    const profile = await this.profileManager.load(profileName);
    const manager = this.getManager(profile.tool);

    if (!manager) {
      throw new Error(`Unknown tool: ${profile.tool}`);
    }

    // 获取当前 skills
    const currentSkills = await manager.scanSkills();

    // 驗證技能名稱，避免存入非法值
    currentSkills.forEach(skill => manager.validateSkillName(skill));

    // 更新 profile
    profile.skills = currentSkills;
    await this.profileManager.save(profile);

    return { profile: profileName, count: currentSkills.length };
  }

  /**
   * 添加 skill 到 common
   */
  static VALID_COMMON_TARGETS = ['all', 'cx', 'cc', 'anti'];

  async addCommonSkill(skillName, tool) {
    this.codex.validateSkillName(skillName);
    if (tool && !SkillsSwitch.VALID_COMMON_TARGETS.includes(tool)) {
      throw new Error(`Invalid tool: ${tool}. Must be one of: ${SkillsSwitch.VALID_COMMON_TARGETS.join(', ')}`);
    }
    const commonPath = path.join(this.profilesDir, 'common.json');
    let common = { skills: { all: [], cx: [], cc: [], anti: [] } };

    if (await fs.pathExists(commonPath)) {
      common = await fs.readJson(commonPath);
    }

    if (!common.skills) {
      common.skills = { all: [], cx: [], cc: [], anti: [] };
    }

    const target = tool || 'all';
    if (!common.skills[target]) {
      common.skills[target] = [];
    }

    if (common.skills[target].includes(skillName)) {
      throw new Error(`Skill '${skillName}' already in common (${target})`);
    }

    common.skills[target].push(skillName);
    await fs.writeJson(commonPath, common, { spaces: 2 });

    return { skill: skillName, target };
  }

  /**
   * 从 common 移除 skill
   */
  async removeCommonSkill(skillName, tool) {
    this.codex.validateSkillName(skillName);
    if (tool && !SkillsSwitch.VALID_COMMON_TARGETS.includes(tool)) {
      throw new Error(`Invalid tool: ${tool}. Must be one of: ${SkillsSwitch.VALID_COMMON_TARGETS.join(', ')}`);
    }
    const commonPath = path.join(this.profilesDir, 'common.json');

    if (!await fs.pathExists(commonPath)) {
      throw new Error('common.json not found');
    }

    const common = await fs.readJson(commonPath);

    if (!common.skills) {
      throw new Error('No skills defined in common.json');
    }

    // 如果指定了工具，只从该工具移除
    if (tool) {
      if (!common.skills[tool]) {
        throw new Error(`No skills defined for ${tool} in common.json`);
      }
      const index = common.skills[tool].indexOf(skillName);
      if (index === -1) {
        throw new Error(`Skill '${skillName}' not found in common (${tool})`);
      }
      common.skills[tool].splice(index, 1);
    } else {
      // 否则从所有位置移除
      let found = false;
      for (const key of ['all', 'cx', 'cc', 'anti']) {
        if (common.skills[key]) {
          const index = common.skills[key].indexOf(skillName);
          if (index !== -1) {
            common.skills[key].splice(index, 1);
            found = true;
          }
        }
      }
      if (!found) {
        throw new Error(`Skill '${skillName}' not found in common`);
      }
    }

    await fs.writeJson(commonPath, common, { spaces: 2 });

    return { skill: skillName, target: tool || 'all' };
  }

  /**
   * 跨平台環境同步：將專案內的技能同步到全域環境
   */
  async envSync(targetTool, { reverse = false } = {}) {
    if (targetTool && !this.getManager(targetTool)) {
      throw new Error(`Unknown tool: ${targetTool}`);
    }

    if (reverse) {
      return this._envSyncReverse(targetTool);
    }

    const results = [];
    const toolsToSync = targetTool
      ? [{ name: targetTool, manager: this.getManager(targetTool) }]
      : [
          { name: 'cc', manager: this.claude },
          { name: 'cx', manager: this.codex },
          { name: 'anti', manager: this.anti }
        ];

    // 專案內的技能庫來源
    const projectSkillsDir = path.join(this.projectRoot, '.agent', 'skills-all');
    if (!await fs.pathExists(projectSkillsDir)) {
      throw new Error(`Project skills directory not found: ${projectSkillsDir}`);
    }

    for (const { name, manager } of toolsToSync) {
      if (!manager) continue;

      this.ui.info(`  Processing ${name}...`);

      // 讀取對應的 full profile 以獲獲取白名單
      const profileName = `${name}-full`;
      let whitelist = [];
      try {
        const profile = await this.profileManager.load(profileName);
        whitelist = profile.skills || [];
      } catch (err) {
        this.ui.warning(`  Could not load profile ${profileName}, syncing all skills from project.`);
        const entries = await fs.readdir(projectSkillsDir, { withFileTypes: true });
        whitelist = entries
          .filter(e => e.isDirectory())
          .map(e => e.name)
          .filter(name => {
            try { manager.validateSkillDirName(name); return true; } catch { return false; }
          });
      }

      let syncedCount = 0;
      const dirs = manager.getSkillsDirs();

      for (const dirInfo of dirs) {
        if (!dirInfo.skillsAll) continue;

        await fs.ensureDir(dirInfo.skillsAll);

        for (const skill of whitelist) {
          // 跳過含 : 的 plugin 標識符（如 superpowers:brainstorming），它們不是目錄名
          if (skill.includes(':')) continue;

          try { manager.validateSkillDirName(skill); } catch { continue; }

          const sourcePath = path.join(projectSkillsDir, skill);
          const targetPath = path.join(dirInfo.skillsAll, skill);

          if (await fs.pathExists(sourcePath)) {
            // 如果全域不存在，則同步（目前僅針對不存在的情況進行同步）
            if (!await fs.pathExists(targetPath)) {
              await fs.copy(sourcePath, targetPath, { dereference: true });
              syncedCount++;
            }
          }
        }
      }

      results.push({ tool: name, synced: syncedCount });
    }

    return results;
  }

  /**
   * 反向同步：全域 skills-all → 專案 .agent/skills-all/
   * 用於 Antigravity（無全域路徑）從其他工具的全域目錄同步 skills
   */
  async _envSyncReverse(targetTool) {
    const results = [];
    const projectSkillsDir = path.join(this.projectRoot, '.agent', 'skills-all');
    await fs.ensureDir(projectSkillsDir);

    // 決定同步來源：anti 無全域路徑，借用 cx 的全域目錄
    const toolsToSync = targetTool === 'anti'
      ? [{ name: 'cx', manager: this.codex }]
      : targetTool
        ? [{ name: targetTool, manager: this.getManager(targetTool) }]
        : [
            { name: 'cc', manager: this.claude },
            { name: 'cx', manager: this.codex }
          ];

    const seenSkills = new Set();
    let totalSynced = 0;

    for (const { name, manager } of toolsToSync) {
      if (!manager) continue;

      this.ui.info(`  Syncing from ${name} global → project...`);

      const dirs = manager.getSkillsDirs();
      let syncedCount = 0;

      for (const dirInfo of dirs) {
        if (!dirInfo.skillsAll || !await fs.pathExists(dirInfo.skillsAll)) continue;

        const entries = await fs.readdir(dirInfo.skillsAll, { withFileTypes: true });

        for (const entry of entries) {
          if (seenSkills.has(entry.name)) continue;
          if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;

          try {
            manager.validateSkillDirName(entry.name);
          } catch {
            continue;
          }

          seenSkills.add(entry.name);

          const sourcePath = path.join(dirInfo.skillsAll, entry.name);
          const targetPath = path.join(projectSkillsDir, entry.name);

          // 安全檢查：驗證 sourcePath 在合法的 skillsAll 目錄內
          try {
            validatePathInDirectory(sourcePath, dirInfo.skillsAll);
          } catch {
            this.ui.warning(`  Skipping ${entry.name}: path escapes skills directory`);
            continue;
          }

          // 安全檢查：如果是 symlink，驗證 target 在合法範圍內
          if (entry.isSymbolicLink()) {
            try {
              const realPath = await fs.realpath(sourcePath);
              validatePathInDirectory(realPath, dirInfo.skillsAll);
            } catch {
              this.ui.warning(`  Skipping ${entry.name}: symlink target outside skills directory`);
              continue;
            }
          }

          if (!await fs.pathExists(targetPath)) {
            try {
              await fs.copy(sourcePath, targetPath, { dereference: true });
              syncedCount++;
            } catch (copyErr) {
              this.ui.warning(`  Failed to sync ${entry.name}: ${copyErr.message}`);
            }
          }
        }
      }

      totalSynced += syncedCount;
    }

    results.push({ tool: targetTool || 'all', synced: totalSynced });
    return results;
  }
}

module.exports = SkillsSwitch;
