/**
 * 統一日誌模塊
 * 提供結構化日誌記錄，支持不同日誌級別和格式化輸出
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

/**
 * 日誌級別
 */
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SILENT: 4
};

/**
 * 日誌級別名稱映射
 */
const LEVEL_NAMES = {
  0: 'DEBUG',
  1: 'INFO',
  2: 'WARN',
  3: 'ERROR',
  4: 'SILENT'
};

/**
 * ANSI 顏色代碼
 */
const COLORS = {
  DEBUG: '\x1b[36m',    // Cyan
  INFO: '\x1b[32m',     // Green
  WARN: '\x1b[33m',     // Yellow
  ERROR: '\x1b[31m',    // Red
  RESET: '\x1b[0m'
};

/**
 * Logger 類
 */
class Logger {
  constructor(options = {}) {
    this.level = options.level ?? LOG_LEVELS.INFO;
    this.enableColors = options.enableColors ?? true;
    this.enableFile = options.enableFile ?? false;
    this.logFilePath = options.logFilePath ?? path.join(
      os.homedir(),
      '.skills-switch',
      'logs',
      'skills-switch.log'
    );
    this.context = options.context ?? 'SkillsSwitch';
  }

  /**
   * 格式化日誌消息
   */
  formatMessage(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const levelName = LEVEL_NAMES[level];
    const color = this.enableColors ? COLORS[levelName] : '';
    const reset = this.enableColors ? COLORS.RESET : '';

    let formatted = `${color}[${timestamp}] [${levelName}] [${this.context}]${reset} ${message}`;

    if (Object.keys(data).length > 0) {
      formatted += `\n${JSON.stringify(data, null, 2)}`;
    }

    return formatted;
  }

  /**
   * 寫入日誌到文件
   */
  async writeToFile(message) {
    if (!this.enableFile) return;

    try {
      await fs.ensureDir(path.dirname(this.logFilePath));
      await fs.appendFile(this.logFilePath, message + '\n');
    } catch (err) {
      console.error('Failed to write log to file:', err.message);
    }
  }

  /**
   * 通用日誌方法
   */
  log(level, message, data = {}) {
    if (level < this.level) return;

    const formatted = this.formatMessage(level, message, data);
    const consoleMethod = level >= LOG_LEVELS.ERROR ? console.error :
                         level >= LOG_LEVELS.WARN ? console.warn :
                         console.log;

    consoleMethod(formatted);

    // 異步寫入文件（不阻塞）
    if (this.enableFile) {
      this.writeToFile(formatted).catch(() => {});
    }
  }

  /**
   * Debug 級別日誌
   */
  debug(message, data = {}) {
    this.log(LOG_LEVELS.DEBUG, message, data);
  }

  /**
   * Info 級別日誌
   */
  info(message, data = {}) {
    this.log(LOG_LEVELS.INFO, message, data);
  }

  /**
   * Warn 級別日誌
   */
  warn(message, data = {}) {
    this.log(LOG_LEVELS.WARN, message, data);
  }

  /**
   * Error 級別日誌
   */
  error(message, data = {}) {
    this.log(LOG_LEVELS.ERROR, message, data);
  }

  /**
   * 創建子 Logger（帶上下文）
   */
  child(context) {
    return new Logger({
      level: this.level,
      enableColors: this.enableColors,
      enableFile: this.enableFile,
      logFilePath: this.logFilePath,
      context: `${this.context}:${context}`
    });
  }
}

/**
 * 默認 Logger 實例
 */
const defaultLogger = new Logger({
  level: process.env.LOG_LEVEL ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] : LOG_LEVELS.INFO,
  enableColors: process.stdout.isTTY,
  enableFile: false
});

module.exports = {
  Logger,
  LOG_LEVELS,
  defaultLogger,
  createLogger: (options) => new Logger(options)
};
