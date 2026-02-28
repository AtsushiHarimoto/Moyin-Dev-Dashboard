const BaseManager = require('./base-manager');
const path = require('path');
const os = require('os');
const fs = require('fs-extra');
const { TOOL_NAMES, DIR_NAMES, VALIDATION } = require('./constants');

/**
 * Codex Skills 管理器
 *
 * Codex 从以下位置加载 skills（官方規範）：
 * 1. ~/.agents/skills（用户级，主要）
 * 2. 项目/.agents/skills（项目级）
 *
 * 已移除：
 * - ~/.codex/skills（legacy，已棄用）
 * - 项目/.codex/skills（legacy，已棄用）
 *
 * 策略：
 * - 所有原始 skills 备份到 skills-all 目录
 * - skills 目录只包含选定 skills 的符号链接（指向 skills-all）
 */
class CodexManager extends BaseManager {
  constructor(config) {
    super(TOOL_NAMES.CODEX, config);
    this.agentsHome = path.join(os.homedir(), DIR_NAMES.AGENTS_HOME);
    this.projectRoot = config.projectRoot || process.cwd();

    // Codex 讀取的 skills 目錄（僅 ~/.agents/）
    this.skillsDirs = [
      {
        name: 'agents',
        skills: path.join(this.agentsHome, DIR_NAMES.SKILLS),
        skillsAll: path.join(this.agentsHome, DIR_NAMES.SKILLS_ALL)
      }
    ];

    // 主要路径（兼容 BaseManager）
    this.skillsPath = this.skillsDirs[0].skills;
  }

  getSkillsPath() {
    return this.skillsPath;
  }

  /**
   * 获取 skills 目录配置（多目录模式）
   */
  getSkillsDirs() {
    return this.skillsDirs.map(dir => ({
      skills: dir.skills,
      skillsAll: dir.skillsAll
    }));
  }

  /**
   * 初始化 - 备份所有 skills 到 skills-all
   */
  async init() {
    for (const dir of this.skillsDirs) {
      // 如果 skills-all 不存在，从 skills 复制
      if (!await fs.pathExists(dir.skillsAll)) {
        if (await fs.pathExists(dir.skills)) {
          // 复制原始内容到 skills-all
          await fs.copy(dir.skills, dir.skillsAll, { dereference: false });
        } else {
          await fs.ensureDir(dir.skillsAll);
        }
      }
    }

    return {
      skillsAll: await this.scanAllSkills(),
      currentSkills: await this.scanSkills()
    };
  }



  /**
   * 扫描当前启用的 skills
   */
  async scanSkills() {
    const skills = [];
    const seenNames = new Set();

    for (const dir of this.skillsDirs) {
      if (!await fs.pathExists(dir.skills)) {
        continue;
      }

      const entries = await fs.readdir(dir.skills, { withFileTypes: true });
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
   * 获取当前启用的 skills
   */
  async getEnabledSkills() {
    return await this.scanSkills();
  }


  /**
   * 恢复所有 skills
   */
  async restoreAll() {
    for (const dir of this.skillsDirs) {
      if (!await fs.pathExists(dir.skillsAll)) {
        continue;
      }

      if (await fs.pathExists(dir.skills)) {
        await fs.remove(dir.skills);
      }

      // 复制所有 skills 回来（保留符号链接）
      await fs.copy(dir.skillsAll, dir.skills, { dereference: false });
    }

    const allSkills = await this.scanSkills();
    await this.saveState('full', allSkills.length);

    return allSkills.length;
  }

}

module.exports = CodexManager;
