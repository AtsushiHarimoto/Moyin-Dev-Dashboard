/**
 * 統一常量配置模塊
 * 集中管理所有魔術數字、工具名稱和路徑配置
 */

/**
 * 工具名稱常量
 */
const TOOL_NAMES = {
  CLAUDE: 'claude',
  CODEX: 'codex',
  ANTI: 'anti'
};

/**
 * 目錄名稱常量
 */
const DIR_NAMES = {
  SKILLS: 'skills',
  SKILLS_ALL: 'skills-all',
  SKILLS_SWITCH: '.skills-switch',
  BACKUPS: 'backups',
  CLAUDE_HOME: '.claude',
  CODEX_HOME: '.codex',
  AGENTS_HOME: '.agents',
  PLUGINS: 'plugins'
};

/**
 * 文件名稱常量
 */
const FILE_NAMES = {
  STATE: 'state.json',
  SETTINGS: 'settings.json',
  INSTALLED_PLUGINS: 'installed_plugins.json',
  INSTALLED_PLUGINS_ALL: 'installed_plugins-all.json'
};

/**
 * 驗證相關常量
 */
const VALIDATION = {
  MAX_NAME_LENGTH: 100,
  MAX_HISTORY_ENTRIES: 10,
  FAILURE_RATE_THRESHOLD: 0.5,
  MIN_FAILURES_FOR_ROLLBACK: 3
};

/**
 * 平台相關常量
 */
const PLATFORM = {
  WIN32: 'win32',
  DARWIN: 'darwin',
  LINUX: 'linux'
};

/**
 * 符號鏈接類型常量
 */
const SYMLINK_TYPE = {
  JUNCTION: 'junction',  // Windows
  DIR: 'dir',           // Windows directory symlink
  FILE: 'file'          // File symlink
};

/**
 * 工具名稱映射（長名 -> 短名）
 * Single source of truth used by main.js and ui.js
 */
const TOOL_NAME_MAP = {
  codex: 'cx',
  claude: 'cc',
  anti: 'anti',
  cx: 'cx',
  cc: 'cc'
};

module.exports = {
  TOOL_NAMES,
  DIR_NAMES,
  FILE_NAMES,
  VALIDATION,
  PLATFORM,
  SYMLINK_TYPE,
  TOOL_NAME_MAP
};
