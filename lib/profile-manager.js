const fs = require('fs-extra');
const path = require('path');
const { validateProfileName } = require('./validators');

/**
 * Profile 配置管理器
 */
class ProfileManager {
  constructor(profilesDir) {
    this.profilesDir = profilesDir;
  }

  /**
   * 验证名称安全性（防止路径遍历攻击）
   */
  validateName(name) {
    return validateProfileName(name);
  }

  /**
   * 加载所有 profiles
   */
  async loadAll() {
    await fs.ensureDir(this.profilesDir);

    const files = await fs.readdir(this.profilesDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    const profiles = [];
    for (const file of jsonFiles) {
      try {
        const profile = await fs.readJson(path.join(this.profilesDir, file));
        profiles.push(profile);
      } catch (err) {
        console.warn(`Failed to load profile ${file}:`, err.message);
      }
    }

    return profiles;
  }

  /**
   * 加载单个 profile
   */
  async load(name) {
    this.validateName(name);
    const filePath = path.join(this.profilesDir, `${name}.json`);

    if (!await fs.pathExists(filePath)) {
      throw new Error(`Profile not found: ${name}`);
    }

    return await fs.readJson(filePath);
  }

  /**
   * 保存 profile
   */
  async save(profile) {
    this.validateName(profile.name);
    const filePath = path.join(this.profilesDir, `${profile.name}.json`);
    await fs.writeJson(filePath, profile, { spaces: 2 });
  }

  /**
   * 删除 profile
   */
  async delete(name) {
    this.validateName(name);
    const filePath = path.join(this.profilesDir, `${name}.json`);

    if (!await fs.pathExists(filePath)) {
      throw new Error(`Profile not found: ${name}`);
    }

    await fs.remove(filePath);
  }

  /**
   * 创建新 profile
   */
  async create(name, template) {
    const profile = {
      name,
      description: template?.description || '',
      tool: name.split('-')[0],
      skills: template?.skills || [],
      plugins: template?.plugins || [],
      platformSpecific: template?.platformSpecific || {}
    };

    await this.save(profile);
    return profile;
  }

  /**
   * 复制 profile
   */
  async copy(fromName, toName) {
    const source = await this.load(fromName);
    const newProfile = {
      ...source,
      name: toName
    };

    await this.save(newProfile);
    return newProfile;
  }

  /**
   * 按工具分组 profiles
   */
  async groupByTool() {
    const profiles = await this.loadAll();

    return profiles.reduce((acc, profile) => {
      const tool = profile.tool || profile.name.split('-')[0];
      if (!acc[tool]) {
        acc[tool] = [];
      }
      acc[tool].push(profile);
      return acc;
    }, {});
  }

  /**
   * 验证 profile 格式
   */
  validate(profile) {
    const errors = [];

    if (!profile.name) {
      errors.push('Profile name is required');
    }

    if (!profile.skills || !Array.isArray(profile.skills)) {
      errors.push('Profile skills must be an array');
    }

    if (!profile.tool) {
      errors.push('Profile tool is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = ProfileManager;
