const assert = require('assert');
const {
  TOOL_NAMES,
  DIR_NAMES,
  FILE_NAMES,
  VALIDATION,
  PLATFORM,
  SYMLINK_TYPE
} = require('../lib/constants');

describe('Constants', function() {
  describe('TOOL_NAMES', function() {
    it('should export tool name constants', function() {
      assert.strictEqual(TOOL_NAMES.CLAUDE, 'claude');
      assert.strictEqual(TOOL_NAMES.CODEX, 'codex');
      assert.strictEqual(TOOL_NAMES.ANTI, 'anti');
    });
  });

  describe('DIR_NAMES', function() {
    it('should export directory name constants', function() {
      assert.strictEqual(DIR_NAMES.SKILLS, 'skills');
      assert.strictEqual(DIR_NAMES.SKILLS_ALL, 'skills-all');
      assert.strictEqual(DIR_NAMES.SKILLS_SWITCH, '.skills-switch');
      assert.strictEqual(DIR_NAMES.BACKUPS, 'backups');
      assert.strictEqual(DIR_NAMES.CLAUDE_HOME, '.claude');
      assert.strictEqual(DIR_NAMES.CODEX_HOME, '.codex');
      assert.strictEqual(DIR_NAMES.AGENTS_HOME, '.agents');
      assert.strictEqual(DIR_NAMES.PLUGINS, 'plugins');
    });
  });

  describe('FILE_NAMES', function() {
    it('should export file name constants', function() {
      assert.strictEqual(FILE_NAMES.STATE, 'state.json');
      assert.strictEqual(FILE_NAMES.SETTINGS, 'settings.json');
      assert.strictEqual(FILE_NAMES.INSTALLED_PLUGINS, 'installed_plugins.json');
      assert.strictEqual(FILE_NAMES.INSTALLED_PLUGINS_ALL, 'installed_plugins-all.json');
    });
  });

  describe('VALIDATION', function() {
    it('should export validation constants', function() {
      assert.strictEqual(typeof VALIDATION.MAX_NAME_LENGTH, 'number');
      assert.strictEqual(typeof VALIDATION.MAX_HISTORY_ENTRIES, 'number');
      assert.strictEqual(typeof VALIDATION.FAILURE_RATE_THRESHOLD, 'number');
      assert.strictEqual(typeof VALIDATION.MIN_FAILURES_FOR_ROLLBACK, 'number');

      assert.strictEqual(VALIDATION.MAX_NAME_LENGTH, 100);
      assert.strictEqual(VALIDATION.MAX_HISTORY_ENTRIES, 10);
      assert.strictEqual(VALIDATION.FAILURE_RATE_THRESHOLD, 0.5);
      assert.strictEqual(VALIDATION.MIN_FAILURES_FOR_ROLLBACK, 3);
    });

    it('should have reasonable validation thresholds', function() {
      assert.ok(VALIDATION.FAILURE_RATE_THRESHOLD > 0);
      assert.ok(VALIDATION.FAILURE_RATE_THRESHOLD < 1);
      assert.ok(VALIDATION.MIN_FAILURES_FOR_ROLLBACK > 0);
      assert.ok(VALIDATION.MAX_NAME_LENGTH > 0);
      assert.ok(VALIDATION.MAX_HISTORY_ENTRIES > 0);
    });
  });

  describe('PLATFORM', function() {
    it('should export platform constants', function() {
      assert.strictEqual(PLATFORM.WIN32, 'win32');
      assert.strictEqual(PLATFORM.DARWIN, 'darwin');
      assert.strictEqual(PLATFORM.LINUX, 'linux');
    });
  });

  describe('SYMLINK_TYPE', function() {
    it('should export symlink type constants', function() {
      assert.strictEqual(SYMLINK_TYPE.JUNCTION, 'junction');
      assert.strictEqual(SYMLINK_TYPE.DIR, 'dir');
      assert.strictEqual(SYMLINK_TYPE.FILE, 'file');
    });
  });
});
