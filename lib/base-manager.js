const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { validateSkillName, validateSkillDirName } = require('./validators');
const { DIR_NAMES, FILE_NAMES, VALIDATION, PLATFORM, SYMLINK_TYPE } = require('./constants');
const { RollbackError, SkillApplicationError, FileSystemError } = require('./error-handler');
const { defaultLogger } = require('./logger');

/**
 * 基础管理器 - 提供通用的 skills 管理功能
 */
class BaseManager {
  constructor(toolName, config) {
    this.toolName = toolName;
    this.config = config;
    this.platform = process.platform;
    this.logger = defaultLogger.child(toolName);
  }

  /**
   * 验证 skill 名称安全性（防止路径遍历攻击）
   */
  validateSkillName(name) {
    return validateSkillName(name);
  }

  /**
   * 验证 skill 目录名安全性（禁止 : 等 Windows 不支持字符）
   */
  validateSkillDirName(name) {
    return validateSkillDirName(name);
  }

  /**
   * 获取工具的 skills 目录路径
   */
  getSkillsPath() {
    throw new Error('getSkillsPath must be implemented by subclass');
  }

  /**
   * 获取 skills 目录配置列表
   * 子类需要重写此方法，返回 { skills, skillsAll } 目录对象数组
   * @returns {Array<{skills: string, skillsAll: string}>}
   */
  getSkillsDirs() {
    throw new Error('getSkillsDirs must be implemented by subclass');
  }

  /**
   * 扫描所有可用的 skills
   */
  async scanSkills() {
    const skillsPath = this.getSkillsPath();

    if (!await fs.pathExists(skillsPath)) {
      return [];
    }

    const entries = await fs.readdir(skillsPath, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory() || entry.isSymbolicLink())
      .map(entry => entry.name);
  }

  /**
   * 扫描所有可用的 skills（从 skills-all 目录）
   * 支持单目录或多目录配置，自动去重
   */
  async scanAllSkills() {
    const skillsDirs = this.getSkillsDirs();
    const skills = [];
    const seenNames = new Set();

    for (const dir of skillsDirs) {
      if (!await fs.pathExists(dir.skillsAll)) {
        continue;
      }

      const entries = await fs.readdir(dir.skillsAll, { withFileTypes: true });
      for (const entry of entries) {
        if ((entry.isDirectory() || entry.isSymbolicLink()) && !seenNames.has(entry.name)) {
          seenNames.add(entry.name);
          skills.push(entry.name);
        }
      }
    }

    return skills;
  }

  /**
   * 备份当前配置
   */
  async backup() {
    const backupDir = path.join(os.homedir(), DIR_NAMES.SKILLS_SWITCH, DIR_NAMES.BACKUPS);
    await fs.ensureDir(backupDir);

    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const backupPath = path.join(backupDir, `${this.toolName}-${timestamp}.json`);

    const currentSkills = await this.scanSkills();
    await fs.writeJson(backupPath, {
      tool: this.toolName,
      timestamp: new Date().toISOString(),
      skills: currentSkills,
      platform: this.platform
    }, { spaces: 2 });

    return backupPath;
  }

  /**
   * 创建符号链接（跨平台，原子操作）
   */
  async createLink(target, link) {
    // 确保目标存在
    if (!await fs.pathExists(target)) {
      throw new FileSystemError('Target does not exist', { target, link });
    }

    // 原子操作：先创建到临时位置，然后重命名（避免 TOCTOU）
    const tempLink = `${link}.tmp.${Date.now()}`;
    let linkCreated = false;
    let usedCopy = false;

    try {
      // 根据平台选择策略
      if (this.platform === PLATFORM.WIN32) {
        // Windows: 使用 junction（不需要管理员权限）
        try {
          await fs.symlink(target, tempLink, SYMLINK_TYPE.JUNCTION);
          linkCreated = true;
        } catch (err) {
          // 如果 junction 失败，使用复制（并记录警告）
          this.logger.warn('Junction creation failed, falling back to copy', {
            link,
            target,
            error: err.message
          });
          await fs.copy(target, tempLink);
          linkCreated = true;
          usedCopy = true;
        }
      } else {
        // Unix-like: 使用符号链接
        await fs.symlink(target, tempLink);
        linkCreated = true;
      }

      // 原子替换：先删除旧链接，然后重命名临时链接
      // 使用 fs.move 的 overwrite 选项确保原子性
      await fs.move(tempLink, link, { overwrite: true });

    } catch (err) {
      // 清理临时文件
      if (linkCreated) {
        await fs.remove(tempLink).catch(() => {});
      }
      throw new FileSystemError('Failed to create link', {
        link,
        target,
        error: err.message
      });
    }

    // 返回使用的策略信息
    return { usedCopy };
  }

  /**
   * 验证 skills 是否存在
   */
  async validateSkills(skillNames) {
    const availableSkills = await this.scanSkills();
    const results = {
      available: [],
      missing: []
    };

    skillNames.forEach(skill => {
      if (availableSkills.includes(skill)) {
        results.available.push(skill);
      } else {
        results.missing.push(skill);
      }
    });

    return results;
  }

  /**
   * 获取当前激活的 profile
   */
  async getCurrentProfile() {
    const statePath = path.join(os.homedir(), DIR_NAMES.SKILLS_SWITCH, FILE_NAMES.STATE);

    if (!await fs.pathExists(statePath)) {
      return null;
    }

    const state = await fs.readJson(statePath);
    return state.current?.[this.toolName];
  }

  /**
   * 保存当前状态
   */
  async saveState(profileName, skillsCount) {
    const stateDir = path.join(os.homedir(), DIR_NAMES.SKILLS_SWITCH);
    const statePath = path.join(stateDir, FILE_NAMES.STATE);
    const lockDir = path.join(stateDir, '.state.lock');
    await fs.ensureDir(stateDir);

    // Acquire lock using mkdir (atomic on all platforms)
    const maxRetries = 10;
    const retryDelay = 50; // ms
    let acquired = false;

    for (let i = 0; i < maxRetries; i++) {
      try {
        await fs.mkdir(lockDir);
        acquired = true;
        break;
      } catch (err) {
        if (err.code === 'EEXIST') {
          // Lock held by another process — wait and retry
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          throw err;
        }
      }
    }

    if (!acquired) {
      // Stale lock recovery: remove and retry once
      await fs.remove(lockDir);
      await fs.mkdir(lockDir);
    }

    try {
      let state = {};
      if (await fs.pathExists(statePath)) {
        state = await fs.readJson(statePath);
      }

      if (!state.current) state.current = {};
      if (!state.counts) state.counts = {};
      if (!state.history) state.history = [];

      state.current[this.toolName] = profileName;
      state.counts[this.toolName] = skillsCount;
      state.lastSwitch = new Date().toISOString();
      state.platform = this.platform;

      // 添加到历史
      state.history.unshift({
        tool: this.toolName,
        profile: profileName,
        skillsCount,
        timestamp: new Date().toISOString()
      });

      // 只保留最近 N 条历史
      if (state.history.length > VALIDATION.MAX_HISTORY_ENTRIES) {
        state.history = state.history.slice(0, VALIDATION.MAX_HISTORY_ENTRIES);
      }

      // Atomic write: write to temp file then rename
      const tmpPath = `${statePath}.tmp`;
      await fs.writeJson(tmpPath, state, { spaces: 2 });
      await fs.rename(tmpPath, statePath);
    } finally {
      // Always release lock
      await fs.remove(lockDir).catch(() => {});
    }
  }

  /**
   * 获取当前 skills 与 profile 的差异
   * @param {Object} profile - Profile 对象
   * @returns {Object} { added, removed, unchanged }
   */
  async getDiff(profile) {
    const currentSkills = await this.scanSkills();
    const profileSkills = profile.skills;

    return {
      added: currentSkills.filter(s => !profileSkills.includes(s)),
      removed: profileSkills.filter(s => !currentSkills.includes(s)),
      unchanged: currentSkills.filter(s => profileSkills.includes(s))
    };
  }

  /**
   * 同步当前 skills 到 skills-all
   * 支持单目录或多目录配置
   * @returns {Promise<string[]>} 新同步的 skill 名称列表
   */
  async syncToAll() {
    const skillsDirs = this.getSkillsDirs();
    const newSkills = [];

    for (const dir of skillsDirs) {
      if (!await fs.pathExists(dir.skills)) {
        continue;
      }

      const currentEntries = await fs.readdir(dir.skills, { withFileTypes: true });
      const allSkillNames = await fs.pathExists(dir.skillsAll)
        ? await fs.readdir(dir.skillsAll)
        : [];

      for (const entry of currentEntries) {
        if (!allSkillNames.includes(entry.name)) {
          const source = path.join(dir.skills, entry.name);
          const target = path.join(dir.skillsAll, entry.name);

          const stat = await fs.lstat(source);
          if (stat.isSymbolicLink()) {
            const linkTarget = await fs.readlink(source);
            // 如果是指向 skills-all 的链接，复制实际内容
            if (linkTarget.includes(DIR_NAMES.SKILLS_ALL)) {
              await fs.copy(linkTarget, target, { dereference: true });
            } else {
              await fs.symlink(linkTarget, target);
            }
          } else {
            await fs.copy(source, target);
          }

          newSkills.push(entry.name);
        }
      }
    }

    return newSkills;
  }

  /**
   * 应用 profile（模板方法）— 原子交换策略
   * 统一的核心流程，子类通过钩子方法自定义行为
   *
   * Atomic swap flow:
   *   1. Create links in temp dirs  (skills-installing/)
   *   2. Rename current → .skills-old/
   *   3. Rename temp   → current
   *   4. Delete .skills-old/
   * On failure at step 2/3: restore from .skills-old/ and delete temp
   *
   * @param {Object} profile - Profile 对象
   * @param {Object} options - 应用选项
   * @param {boolean} options.skipBackup - 是否跳过备份（用于恢复操作）
   * @returns {Promise<Object>} { backupPath, results, skillsCount, ...extraResults }
   */
  async applyProfile(profile, options = {}) {
    this.logger.info('Applying profile', {
      profile: profile.name,
      skillCount: profile.skills.length
    });

    // 0. 初始化（确保 skills-all 存在）
    await this.init();

    // 1. 备份当前配置
    let backupPath = null;
    if (!options.skipBackup) {
      backupPath = await this.backup();
      this.logger.debug('Backup created', { backupPath });
    }

    const skillsDirs = this.getSkillsDirs();

    // Build temp and old paths alongside each real skills dir
    const dirMapping = skillsDirs.map(dir => {
      const parent = path.dirname(dir.skills);
      const base = path.basename(dir.skills);
      return {
        real: dir.skills,
        skillsAll: dir.skillsAll,
        temp: path.join(parent, `${base}-installing`),
        old: path.join(parent, `.${base}-old`)
      };
    });

    // Clean up any stale temp/old dirs from a previous interrupted run
    for (const m of dirMapping) {
      await fs.remove(m.temp).catch(() => {});
      await fs.remove(m.old).catch(() => {});
    }

    try {
      // 2. Create fresh temp dirs and populate with links
      for (const m of dirMapping) {
        await fs.ensureDir(m.temp);
      }

      // Build targetDirs for createSkillLinks that point to temp dirs
      const tempDirs = dirMapping.map(m => ({
        skills: m.temp,
        skillsAll: m.skillsAll
      }));

      const results = await this.createSkillLinks(profile, tempDirs);

      // 3. 检查失败率（before committing the swap）
      this.checkFailureRate(results, profile.skills.length);

      // 4. Atomic swap: current → old, temp → current
      try {
        for (const m of dirMapping) {
          if (await fs.pathExists(m.real)) {
            await fs.rename(m.real, m.old);
          }
          await fs.rename(m.temp, m.real);
        }
      } catch (swapErr) {
        // Swap failed — restore old dirs back to current
        this.logger.error('Atomic swap failed, restoring previous state', {
          error: swapErr.message
        });
        for (const m of dirMapping) {
          // If real dir was already moved away and old exists, restore it
          if (!await fs.pathExists(m.real) && await fs.pathExists(m.old)) {
            await fs.rename(m.old, m.real).catch(() => {});
          }
          // Clean up temp if it still exists
          await fs.remove(m.temp).catch(() => {});
        }
        throw swapErr;
      }

      // 5. Clean up old dirs (best-effort)
      for (const m of dirMapping) {
        await fs.remove(m.old).catch(() => {});
      }

      // 6. 子类额外处理（如 plugins）
      const extraResults = await this.afterProfileApply(profile, results);

      // 7. 保存状态
      await this.saveState(profile.name, results.success.length);

      this.logger.info('Profile applied successfully', {
        profile: profile.name,
        successCount: results.success.length,
        failedCount: results.failed.length,
        skippedCount: results.skipped.length
      });

      return {
        backupPath,
        results,
        skillsCount: results.success.length,
        ...extraResults
      };

    } catch (err) {
      // Clean up temp dirs on any error
      for (const m of dirMapping) {
        await fs.remove(m.temp).catch(() => {});
      }

      // 自动回滚 from backup
      if (backupPath) {
        this.logger.error('Profile application failed, attempting rollback', {
          profile: profile.name,
          backupPath,
          error: err.message
        });

        try {
          await this.restore(path.basename(backupPath));
          this.logger.info('Rollback completed successfully', { backupPath });
        } catch (rollbackErr) {
          this.logger.error('Rollback failed', {
            originalError: err.message,
            rollbackError: rollbackErr.message,
            backupPath
          });
          throw new RollbackError(
            'Profile application and rollback both failed',
            err,
            rollbackErr,
            backupPath
          );
        }
      }
      throw err;
    }
  }

  /**
   * 從備份還原配置
   * @param {string} backupId - 備份 ID (文件名)
   */
  async restore(backupId) {
    const backupDir = path.join(os.homedir(), DIR_NAMES.SKILLS_SWITCH, DIR_NAMES.BACKUPS);
    const backupPath = path.join(backupDir, backupId);

    if (!await fs.pathExists(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    const backup = await fs.readJson(backupPath);

    // 驗證工具匹配
    if (this.getLongToolName?.(backup.tool) !== this.toolName && backup.tool !== this.toolName) {
      // 注意：這裡如果 BaseManager 拿不到 getLongToolName，則退而求其次
      this.logger.warn('Tool mismatch during restore, proceeding anyway', {
        backupTool: backup.tool,
        managerTool: this.toolName
      });
    }

    const restoreProfile = {
      name: `restore-${path.basename(backupId, '.json')}`,
      description: `Restore from ${backupId}`,
      tool: this.toolName,
      skills: backup.skills || []
    };

    // 執行應用流程，跳過備份
    return await this.applyProfile(restoreProfile, { skipBackup: true });
  }

  /**
   * 清空所有 skills 目录
   * 子类可以重写以自定义清空逻辑
   */
  async clearSkillsDirs() {
    const skillsDirs = this.getSkillsDirs();

    for (const dir of skillsDirs) {
      if (await fs.pathExists(dir.skills)) {
        await fs.remove(dir.skills);
      }
      await fs.ensureDir(dir.skills);
    }
  }

  /**
   * 创建 skill 链接到指定目录配置
   * @param {Object} profile - Profile 对象
   * @param {Array} [targetDirs] - 目标目录配置数组（默认使用 getSkillsDirs()）
   * @returns {Promise<Object>} { success, failed, skipped }
   */
  async createSkillLinks(profile, targetDirs) {
    const skillsDirs = this.getSkillsDirs();
    const destDirs = targetDirs || skillsDirs;
    const results = {
      success: [],
      failed: [],
      skipped: []
    };

    for (const skillName of profile.skills) {
      this.validateSkillName(skillName);

      // 跳过系统 skills（以 . 开头）或插件提供型 skills（包含 :）
      if (skillName.startsWith('.') || skillName.includes(':')) {
        results.success.push(skillName);
        continue;
      }

      // 查找 skill 在 skills-all 中的位置（always search in real skillsDirs）
      const sourceInfo = await this.findSkillInBackup(skillName, skillsDirs);

      if (!sourceInfo) {
        results.skipped.push(skillName);
        continue;
      }

      // 找到对应的目标目录（匹配 skillsAll 路径）
      const destDir = destDirs.find(d => d.skillsAll === sourceInfo.dir.skillsAll) || destDirs[0];
      const targetPath = path.join(destDir.skills, skillName);

      try {
        // 解析符号链接到实际目标
        const linkTarget = await this.resolveSymlink(sourceInfo.path);

        // 使用跨平台链接策略
        await this.createLink(linkTarget, targetPath);
        results.success.push(skillName);
      } catch (err) {
        results.failed.push({ skill: skillName, error: err.message });
      }
    }

    return results;
  }

  /**
   * 在 skills-all 备份中查找 skill
   * @param {string} skillName - Skill 名称
   * @param {Array} skillsDirs - Skills 目录配置数组
   * @returns {Promise<Object|null>} { path, dir } 或 null
   */
  async findSkillInBackup(skillName, skillsDirs) {
    for (const dir of skillsDirs) {
      const backupPath = path.join(dir.skillsAll, skillName);
      if (await fs.pathExists(backupPath)) {
        return { path: backupPath, dir };
      }
    }
    return null;
  }

  /**
   * 检查失败率是否超过阈值
   * @param {Object} results - { success, failed, skipped }
   * @param {number} totalSkills - 总 skill 数量
   */
  checkFailureRate(results, totalSkills) {
    const totalAttempted = totalSkills - results.skipped.length;
    if (totalAttempted <= 0) return;
    const failureRate = results.failed.length / totalAttempted;

    if (failureRate > VALIDATION.FAILURE_RATE_THRESHOLD &&
        results.failed.length > VALIDATION.MIN_FAILURES_FOR_ROLLBACK) {
      this.logger.error('Skill application failure rate exceeded threshold', {
        failedCount: results.failed.length,
        totalAttempted,
        failureRate,
        threshold: VALIDATION.FAILURE_RATE_THRESHOLD,
        failures: results.failed
      });

      throw new SkillApplicationError(
        results.failed.length,
        totalAttempted,
        results.failed[0]?.error || 'Unknown error',
        { failures: results.failed }
      );
    }
  }

  /**
   * Profile 应用后的额外处理（钩子方法）
   * 子类可以重写以添加额外逻辑（如 plugins 管理）
   * @param {Object} profile - Profile 对象
   * @param {Object} results - createSkillLinks 的结果
   * @returns {Promise<Object>} 额外的返回数据
   */
  async afterProfileApply(profile, results) {
    // 默认无额外处理
    return {};
  }

  /**
   * 解析符号链接到实际目标路径
   * @param {string} filePath - 可能是符号链接的文件路径
   * @returns {Promise<string>} 解析后的实际路径
   */
  async resolveSymlink(filePath) {
    const stat = await fs.lstat(filePath);

    // 如果不是符号链接，直接返回原路径
    if (!stat.isSymbolicLink()) {
      return filePath;
    }

    // 读取符号链接目标
    const target = await fs.readlink(filePath);

    // 如果是绝对路径，直接返回
    if (path.isAbsolute(target)) {
      return target;
    }

    // 如果是相对路径，解析为绝对路径
    return path.resolve(path.dirname(filePath), target);
  }
}

module.exports = BaseManager;
