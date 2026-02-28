const BaseManager = require('./base-manager');
const path = require('path');
const os = require('os');
const fs = require('fs-extra');
const { TOOL_NAMES, DIR_NAMES, FILE_NAMES, VALIDATION } = require('./constants');

/**
 * Claude Code Skills 管理器
 * 使用目录切换策略（symlink）- 与 Codex 相同
 */
class ClaudeManager extends BaseManager {
  constructor(config) {
    super(TOOL_NAMES.CLAUDE, config);
    this.claudeHome = path.join(os.homedir(), DIR_NAMES.CLAUDE_HOME);
    this.skillsPath = path.join(this.claudeHome, DIR_NAMES.SKILLS);
    this.skillsAllPath = path.join(this.claudeHome, DIR_NAMES.SKILLS_ALL);
    this.settingsPath = path.join(this.claudeHome, FILE_NAMES.SETTINGS);
    // Plugin 管理
    this.pluginsPath = path.join(this.claudeHome, DIR_NAMES.PLUGINS);
    this.installedPluginsPath = path.join(this.pluginsPath, FILE_NAMES.INSTALLED_PLUGINS);
    this.installedPluginsAllPath = path.join(this.pluginsPath, FILE_NAMES.INSTALLED_PLUGINS_ALL);
    // 項目本地 skills 目錄
    this.projectRoot = config.projectRoot || process.cwd();
    this.projectSkillsPath = path.join(this.projectRoot, DIR_NAMES.CLAUDE_HOME, DIR_NAMES.SKILLS);
  }

  getSkillsPath() {
    return this.skillsPath;
  }

  /**
   * 获取 skills 目录配置（单目录模式）
   */
  getSkillsDirs() {
    return [
      {
        skills: this.skillsPath,
        skillsAll: this.skillsAllPath
      }
    ];
  }

  /**
   * 初始化 - 备份所有 skills 到 skills-all
   */
  async init() {
    // 如果 skills-all 不存在，先备份当前的 skills
    if (!await fs.pathExists(this.skillsAllPath)) {
      if (await fs.pathExists(this.skillsPath)) {
        // 复制整个目录（包括符号链接本身，不解析）
        await fs.copy(this.skillsPath, this.skillsAllPath, {
          dereference: false // 保留符号链接
        });
      } else {
        await fs.ensureDir(this.skillsAllPath);
      }
    }

    return {
      skillsAll: await this.scanAllSkills(),
      currentSkills: await this.scanSkills()
    };
  }


  /**
   * 在 skills-all 備份中查找 skill（重寫以支持項目本地 skills）
   * 優先查找 skills-all，找不到再查找項目 .claude/skills/
   */
  async findSkillInBackup(skillName, skillsDirs) {
    // 先查 skills-all（全域備份）
    const result = await super.findSkillInBackup(skillName, skillsDirs);
    if (result) return result;

    // 再查項目本地 .claude/skills/
    if (this.projectSkillsPath) {
      const projectPath = path.join(this.projectSkillsPath, skillName);
      if (await fs.pathExists(projectPath)) {
        return { path: projectPath, dir: skillsDirs[0] };
      }
    }

    return null;
  }

  /**
   * 读取 settings.json
   */
  async readSettings() {
    if (!await fs.pathExists(this.settingsPath)) {
      return {};
    }

    return await fs.readJson(this.settingsPath);
  }

  /**
   * 写入 settings.json
   */
  async writeSettings(settings) {
    await fs.writeJson(this.settingsPath, settings, { spaces: 2 });
  }

  /**
   * 获取启用的 skills（从当前 skills 目录）
   */
  async getEnabledSkills() {
    return await this.scanSkills();
  }


  /**
   * 恢复所有 skills
   */
  async restoreAll() {
    if (!await fs.pathExists(this.skillsAllPath)) {
      throw new Error('skills-all 目录不存在，无法恢复');
    }

    // 清空当前 skills 目录
    if (await fs.pathExists(this.skillsPath)) {
      await fs.remove(this.skillsPath);
    }

    // 复制所有 skills 回来
    await fs.copy(this.skillsAllPath, this.skillsPath, {
      dereference: false
    });

    // 恢复所有 plugins
    await this.restoreAllPlugins();

    // 更新状态
    const allSkills = await this.scanSkills();
    await this.saveState('full', allSkills.length);

    return allSkills.length;
  }

  // ==================== Plugin 管理 ====================

  /**
   * 读取 installed_plugins.json
   */
  async readInstalledPlugins() {
    if (!await fs.pathExists(this.installedPluginsPath)) {
      return { version: 2, plugins: {} };
    }
    return await fs.readJson(this.installedPluginsPath);
  }

  /**
   * 写入 installed_plugins.json
   */
  async writeInstalledPlugins(data) {
    await fs.writeJson(this.installedPluginsPath, data, { spaces: 2 });
  }

  /**
   * 初始化 plugins 备份
   */
  async initPlugins() {
    // 备份完整的 installed_plugins.json
    if (!await fs.pathExists(this.installedPluginsAllPath)) {
      if (await fs.pathExists(this.installedPluginsPath)) {
        await fs.copy(this.installedPluginsPath, this.installedPluginsAllPath);
      }
    }

    return {
      allPlugins: await this.getAllPlugins(),
      currentPlugins: await this.getCurrentPlugins()
    };
  }

  /**
   * 获取所有已安装的 plugins（从备份）
   */
  async getAllPlugins() {
    if (!await fs.pathExists(this.installedPluginsAllPath)) {
      const current = await this.readInstalledPlugins();
      return Object.keys(current.plugins || {});
    }
    const all = await fs.readJson(this.installedPluginsAllPath);
    return Object.keys(all.plugins || {});
  }

  /**
   * 获取当前启用的 plugins
   */
  async getCurrentPlugins() {
    const current = await this.readInstalledPlugins();
    return Object.keys(current.plugins || {});
  }

  /**
   * 应用 plugin profile
   * @param {string[]} pluginNames - 要启用的 plugin 名称列表，格式如 "superpowers@claude-plugins-official"
   */
  async applyPlugins(pluginNames) {
    // 确保已初始化
    await this.initPlugins();

    // 读取完整的 plugins 列表
    const allPluginsData = await fs.pathExists(this.installedPluginsAllPath)
      ? await fs.readJson(this.installedPluginsAllPath)
      : await this.readInstalledPlugins();

    // 合併 profile 指定的 plugins + 釘選的基礎設施 plugins（從 common.json）
    const pinnedPlugins = this._currentPinnedPlugins || [];
    const mergedPluginNames = [...new Set([...pluginNames, ...pinnedPlugins])];

    // 创建新的 plugins 配置
    const newPluginsData = {
      version: allPluginsData.version || 2,
      plugins: {}
    };

    const results = {
      enabled: [],
      skipped: [],
      disabled: [],
      pinned: []
    };

    // 添加所有合併後的 plugins
    for (const pluginName of mergedPluginNames) {
      if (allPluginsData.plugins[pluginName]) {
        newPluginsData.plugins[pluginName] = allPluginsData.plugins[pluginName];
        if (pinnedPlugins.includes(pluginName) && !pluginNames.includes(pluginName)) {
          results.pinned.push(pluginName);
        } else {
          results.enabled.push(pluginName);
        }
      } else if (pluginNames.includes(pluginName)) {
        // 只對用戶指定的報告 skipped，釘選的靜默跳過
        results.skipped.push(pluginName);
      }
    }

    // 计算被禁用的 plugins（排除釘選的）
    for (const pluginName of Object.keys(allPluginsData.plugins)) {
      if (!mergedPluginNames.includes(pluginName)) {
        results.disabled.push(pluginName);
      }
    }

    // 写入新配置
    await this.writeInstalledPlugins(newPluginsData);

    return results;
  }

  /**
   * 恢复所有 plugins
   */
  async restoreAllPlugins() {
    if (!await fs.pathExists(this.installedPluginsAllPath)) {
      return 0;
    }

    await fs.copy(this.installedPluginsAllPath, this.installedPluginsPath);
    const all = await this.getAllPlugins();
    return all.length;
  }

  /**
   * 获取 plugin 详情
   */
  async getPluginDetails() {
    const current = await this.readInstalledPlugins();
    const all = await fs.pathExists(this.installedPluginsAllPath)
      ? await fs.readJson(this.installedPluginsAllPath)
      : current;

    const details = [];
    for (const [name, installations] of Object.entries(all.plugins || {})) {
      const isEnabled = !!current.plugins[name];
      const info = installations[0]; // 取第一个安装
      details.push({
        name,
        enabled: isEnabled,
        scope: info.scope,
        version: info.version,
        projectPath: info.projectPath || null
      });
    }
    return details;
  }

  /**
   * Profile 应用后的额外处理（重写以支持 plugins）
   */
  async afterProfileApply(profile, results) {
    // 1. 設定釘選 plugins（從 common.json 傳入），然後應用 plugins
    this._currentPinnedPlugins = profile._pinnedPlugins || [];
    let pluginResults = null;
    const profilePlugins = profile.plugins || [];
    if (profilePlugins.length > 0 || this._currentPinnedPlugins.length > 0) {
      pluginResults = await this.applyPlugins(profilePlugins);
    }

    // 2. 写入 settings.json 记录
    const settings = await this.readSettings();

    // 同步到顶层 enabledPlugins（Claude Code 实际读取的配置）
    // 保留釘選 plugins 的 enabled 狀態，合併而非覆蓋
    if (pluginResults) {
      const allEnabled = [
        ...pluginResults.enabled,
        ...pluginResults.pinned || []
      ];
      if (allEnabled.length > 0) {
        // 保留原有的非 profile 管理的 plugins（如用戶手動啟用的）
        const newEnabledPlugins = { ...settings.enabledPlugins };
        // 先清除被此次切換禁用的
        for (const disabled of pluginResults.disabled) {
          delete newEnabledPlugins[disabled];
        }
        // 加入啟用的和釘選的
        for (const pluginName of allEnabled) {
          newEnabledPlugins[pluginName] = true;
        }
        settings.enabledPlugins = newEnabledPlugins;
      }
    }

    // 保存元数据到 _skillsSwitch
    settings._skillsSwitch = {
      activeProfile: profile.name,
      enabledSkills: results.success,
      enabledPlugins: pluginResults?.enabled || [],
      lastUpdate: new Date().toISOString()
    };

    await this.writeSettings(settings);

    // 3. 返回额外结果
    return {
      pluginResults,
      pluginsCount: pluginResults?.enabled?.length || 0
    };
  }
}

module.exports = ClaudeManager;
