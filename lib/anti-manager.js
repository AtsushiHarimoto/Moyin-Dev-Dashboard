const BaseManager = require('./base-manager');
const path = require('path');
const fs = require('fs-extra');
const { TOOL_NAMES, DIR_NAMES, VALIDATION } = require('./constants');

/**
 * Antigravity Skills 管理器
 * 使用目录切换策略（项目级）
 */
class AntiManager extends BaseManager {
  constructor(config) {
    super(TOOL_NAMES.ANTI, config);
    this.projectRoot = config.projectRoot;
    this.skillsPath = path.join(this.projectRoot, '.agent', DIR_NAMES.SKILLS);
    this.skillsAllPath = path.join(this.projectRoot, '.agent', DIR_NAMES.SKILLS_ALL);
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
        await fs.copy(this.skillsPath, this.skillsAllPath);
      } else {
        await fs.ensureDir(this.skillsAllPath);
      }
    }

    return {
      skillsAll: await this.scanAllSkills(),
      currentSkills: await this.scanSkills()
    };
  }



}

module.exports = AntiManager;
