/**
 * 統一錯誤處理模塊
 * 定義自定義錯誤類型，提供結構化錯誤信息
 */

/**
 * 基礎錯誤類
 */
class SkillsSwitchError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

/**
 * 驗證錯誤
 */
class ValidationError extends SkillsSwitchError {
  constructor(message, details = {}) {
    super(message, 'VALIDATION_ERROR', details);
  }
}

/**
 * 文件系統錯誤
 */
class FileSystemError extends SkillsSwitchError {
  constructor(message, details = {}) {
    super(message, 'FILESYSTEM_ERROR', details);
  }
}

/**
 * Profile 錯誤
 */
class ProfileError extends SkillsSwitchError {
  constructor(message, details = {}) {
    super(message, 'PROFILE_ERROR', details);
  }
}

/**
 * 回滾錯誤
 */
class RollbackError extends SkillsSwitchError {
  constructor(message, originalError, rollbackError, backupPath) {
    super(
      `Profile application failed AND rollback failed. Original: ${originalError.message}. Rollback: ${rollbackError.message}`,
      'ROLLBACK_ERROR',
      {
        originalError: originalError.message,
        rollbackError: rollbackError.message,
        backupPath
      }
    );
    this.originalError = originalError;
    this.rollbackError = rollbackError;
    this.backupPath = backupPath;
  }
}

/**
 * Skills 應用失敗錯誤
 */
class SkillApplicationError extends SkillsSwitchError {
  constructor(failedCount, totalCount, firstError, details = {}) {
    super(
      `Profile application failed: ${failedCount}/${totalCount} skills failed. First error: ${firstError}`,
      'SKILL_APPLICATION_ERROR',
      { failedCount, totalCount, firstError, ...details }
    );
  }
}

/**
 * Plugin 錯誤
 */
class PluginError extends SkillsSwitchError {
  constructor(message, details = {}) {
    super(message, 'PLUGIN_ERROR', details);
  }
}

/**
 * 錯誤代碼常量
 */
const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  FILESYSTEM_ERROR: 'FILESYSTEM_ERROR',
  PROFILE_ERROR: 'PROFILE_ERROR',
  ROLLBACK_ERROR: 'ROLLBACK_ERROR',
  SKILL_APPLICATION_ERROR: 'SKILL_APPLICATION_ERROR',
  PLUGIN_ERROR: 'PLUGIN_ERROR'
};

module.exports = {
  SkillsSwitchError,
  ValidationError,
  FileSystemError,
  ProfileError,
  RollbackError,
  SkillApplicationError,
  PluginError,
  ERROR_CODES
};
