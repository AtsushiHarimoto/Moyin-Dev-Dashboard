const path = require('path');
const { VALIDATION } = require('./constants');
const { ValidationError } = require('./error-handler');

/**
 * 统一验证工具模块
 * 集中管理所有验证逻辑，确保一致性和可维护性
 */

/**
 * 验证名称安全性（通用方法）
 * @param {string} name - 要验证的名称
 * @param {Object} options - 验证选项
 * @param {string} options.context - 上下文描述（如 'Skill name', 'Profile name'）
 * @param {number} options.maxLength - 最大长度（默认 VALIDATION.MAX_NAME_LENGTH）
 * @param {RegExp} options.allowedPattern - 允许的字符模式（默认：字母数字和基本符号）
 * @returns {boolean} 验证通过返回 true，失败抛出错误
 */
function validateName(name, options = {}) {
  const {
    context = 'Name',
    maxLength = VALIDATION.MAX_NAME_LENGTH,
    allowedPattern = /^[a-zA-Z0-9._@-]+$/
  } = options;

  // 基本类型检查
  if (!name || typeof name !== 'string') {
    throw new ValidationError(`${context} is required and must be a string`);
  }

  // 路径遍历和危险字符检查
  if (
    name.includes('..') ||
    name.includes('/') ||
    name.includes('\\') ||
    name.includes('\0') ||
    path.isAbsolute(name) ||
    name.startsWith('\\\\')
  ) {
    throw new ValidationError(
      `Invalid ${context.toLowerCase()}: ${name} contains illegal characters or is an absolute path`
    );
  }

  // 长度检查
  if (name.length > maxLength) {
    throw new ValidationError(
      `Invalid ${context.toLowerCase()}: ${name} is too long (max ${maxLength} characters)`
    );
  }

  // 字符模式检查
  if (!allowedPattern.test(name)) {
    throw new ValidationError(
      `Invalid ${context.toLowerCase()}: ${name} contains unsupported characters`
    );
  }

  return true;
}

/**
 * 验证 Skill 名称（含 : 的标识符，如 superpowers:brainstorming）
 * 用于 profile JSON 引用，不用于文件系统路径
 * @param {string} name - Skill 名称
 * @returns {boolean} 验证通过返回 true
 */
function validateSkillName(name) {
  return validateName(name, {
    context: 'Skill name',
    maxLength: VALIDATION.MAX_NAME_LENGTH,
    allowedPattern: /^[a-zA-Z0-9._@:-]+$/
  });
}

/**
 * 验证 Skill 目录名（用于文件系统操作，禁止 : 因 Windows 不支持）
 * @param {string} name - Skill 目录名
 * @returns {boolean} 验证通过返回 true
 */
function validateSkillDirName(name) {
  return validateName(name, {
    context: 'Skill directory name',
    maxLength: VALIDATION.MAX_NAME_LENGTH,
    allowedPattern: /^[a-zA-Z0-9._@-]+$/
  });
}

/**
 * 验证 Profile 名称
 * @param {string} name - Profile 名称
 * @returns {boolean} 验证通过返回 true
 */
function validateProfileName(name) {
  return validateName(name, {
    context: 'Profile name',
    maxLength: VALIDATION.MAX_NAME_LENGTH,
    allowedPattern: /^[a-zA-Z0-9._-]+$/
  });
}

/**
 * 验证备份 ID
 * @param {string} backupId - 备份 ID（文件名）
 * @returns {boolean} 验证通过返回 true
 */
function validateBackupId(backupId) {
  if (!backupId || typeof backupId !== 'string') {
    throw new ValidationError('Backup ID is required and must be a string');
  }

  // 严格的备份 ID 验证
  if (
    backupId.includes('/') ||
    backupId.includes('\\') ||
    backupId.includes('..') ||
    backupId.includes('\0') ||
    path.isAbsolute(backupId) ||
    backupId.startsWith('\\\\') ||
    backupId.includes(':') ||
    !/^[a-zA-Z0-9._-]+\.json$/.test(backupId)
  ) {
    throw new ValidationError(
      'Invalid backup ID: must be a simple filename (alphanumeric, dots, dashes, underscores) ending in .json'
    );
  }

  return true;
}

/**
 * 验证路径是否在指定目录内（防止路径遍历）
 * @param {string} targetPath - 要验证的路径
 * @param {string} baseDir - 基础目录
 * @returns {boolean} 验证通过返回 true
 */
function validatePathInDirectory(targetPath, baseDir) {
  let resolvedTarget = path.resolve(targetPath);
  let resolvedBase = path.resolve(baseDir);

  // Windows 路徑大小寫不敏感，統一轉小寫比較
  if (process.platform === 'win32') {
    resolvedTarget = resolvedTarget.toLowerCase();
    resolvedBase = resolvedBase.toLowerCase();
  }

  if (!resolvedTarget.startsWith(resolvedBase + path.sep) && resolvedTarget !== resolvedBase) {
    throw new ValidationError(
      `Security violation: path ${targetPath} escapes base directory ${baseDir}`
    );
  }

  return true;
}

module.exports = {
  validateName,
  validateSkillName,
  validateSkillDirName,
  validateProfileName,
  validateBackupId,
  validatePathInDirectory
};
