const assert = require('assert');
const {
  SkillsSwitchError,
  ValidationError,
  FileSystemError,
  ProfileError,
  RollbackError,
  SkillApplicationError,
  PluginError,
  ERROR_CODES
} = require('../lib/error-handler');

describe('Error Handler', function() {
  describe('SkillsSwitchError', function() {
    it('should create base error with code and details', function() {
      const error = new SkillsSwitchError('Test error', 'TEST_CODE', { key: 'value' });

      assert.strictEqual(error.message, 'Test error');
      assert.strictEqual(error.code, 'TEST_CODE');
      assert.deepStrictEqual(error.details, { key: 'value' });
      assert.ok(error.timestamp);
      assert.ok(error.stack);
      assert.strictEqual(error.name, 'SkillsSwitchError');
    });

    it('should serialize to JSON', function() {
      const error = new SkillsSwitchError('Test error', 'TEST_CODE', { key: 'value' });
      const json = error.toJSON();

      assert.strictEqual(json.name, 'SkillsSwitchError');
      assert.strictEqual(json.code, 'TEST_CODE');
      assert.strictEqual(json.message, 'Test error');
      assert.deepStrictEqual(json.details, { key: 'value' });
      assert.ok(json.timestamp);
      assert.ok(json.stack);
    });
  });

  describe('ValidationError', function() {
    it('should create validation error', function() {
      const error = new ValidationError('Invalid input', { field: 'name' });

      assert.strictEqual(error.message, 'Invalid input');
      assert.strictEqual(error.code, 'VALIDATION_ERROR');
      assert.deepStrictEqual(error.details, { field: 'name' });
      assert.strictEqual(error.name, 'ValidationError');
      assert.ok(error instanceof SkillsSwitchError);
    });
  });

  describe('FileSystemError', function() {
    it('should create filesystem error', function() {
      const error = new FileSystemError('File not found', { path: '/test' });

      assert.strictEqual(error.message, 'File not found');
      assert.strictEqual(error.code, 'FILESYSTEM_ERROR');
      assert.deepStrictEqual(error.details, { path: '/test' });
      assert.strictEqual(error.name, 'FileSystemError');
    });
  });

  describe('ProfileError', function() {
    it('should create profile error', function() {
      const error = new ProfileError('Profile invalid', { profile: 'test' });

      assert.strictEqual(error.message, 'Profile invalid');
      assert.strictEqual(error.code, 'PROFILE_ERROR');
      assert.strictEqual(error.name, 'ProfileError');
    });
  });

  describe('RollbackError', function() {
    it('should create rollback error with nested errors', function() {
      const originalError = new Error('Original failure');
      const rollbackError = new Error('Rollback failure');
      const error = new RollbackError(
        'Rollback failed',
        originalError,
        rollbackError,
        '/backup/path'
      );

      assert.strictEqual(error.code, 'ROLLBACK_ERROR');
      assert.strictEqual(error.name, 'RollbackError');
      assert.strictEqual(error.originalError, originalError);
      assert.strictEqual(error.rollbackError, rollbackError);
      assert.strictEqual(error.backupPath, '/backup/path');
      assert.ok(error.message.includes('Original failure'));
      assert.ok(error.message.includes('Rollback failure'));
    });

    it('should include error details', function() {
      const originalError = new Error('Original failure');
      const rollbackError = new Error('Rollback failure');
      const error = new RollbackError(
        'Rollback failed',
        originalError,
        rollbackError,
        '/backup/path'
      );

      assert.strictEqual(error.details.originalError, 'Original failure');
      assert.strictEqual(error.details.rollbackError, 'Rollback failure');
      assert.strictEqual(error.details.backupPath, '/backup/path');
    });
  });

  describe('SkillApplicationError', function() {
    it('should create skill application error with metrics', function() {
      const error = new SkillApplicationError(5, 10, 'First error', { extra: 'data' });

      assert.strictEqual(error.code, 'SKILL_APPLICATION_ERROR');
      assert.strictEqual(error.name, 'SkillApplicationError');
      assert.ok(error.message.includes('5/10 skills failed'));
      assert.ok(error.message.includes('First error'));
      assert.strictEqual(error.details.failedCount, 5);
      assert.strictEqual(error.details.totalCount, 10);
      assert.strictEqual(error.details.firstError, 'First error');
      assert.strictEqual(error.details.extra, 'data');
    });
  });

  describe('PluginError', function() {
    it('should create plugin error', function() {
      const error = new PluginError('Plugin failed', { plugin: 'test-plugin' });

      assert.strictEqual(error.message, 'Plugin failed');
      assert.strictEqual(error.code, 'PLUGIN_ERROR');
      assert.strictEqual(error.name, 'PluginError');
    });
  });

  describe('ERROR_CODES', function() {
    it('should export all error codes', function() {
      assert.strictEqual(ERROR_CODES.VALIDATION_ERROR, 'VALIDATION_ERROR');
      assert.strictEqual(ERROR_CODES.FILESYSTEM_ERROR, 'FILESYSTEM_ERROR');
      assert.strictEqual(ERROR_CODES.PROFILE_ERROR, 'PROFILE_ERROR');
      assert.strictEqual(ERROR_CODES.ROLLBACK_ERROR, 'ROLLBACK_ERROR');
      assert.strictEqual(ERROR_CODES.SKILL_APPLICATION_ERROR, 'SKILL_APPLICATION_ERROR');
      assert.strictEqual(ERROR_CODES.PLUGIN_ERROR, 'PLUGIN_ERROR');
    });
  });

  describe('Error inheritance', function() {
    it('should properly inherit from base classes', function() {
      const validationError = new ValidationError('test');
      const fileSystemError = new FileSystemError('test');
      const profileError = new ProfileError('test');
      const rollbackError = new RollbackError('test', new Error(), new Error(), '/path');
      const skillError = new SkillApplicationError(1, 1, 'test');
      const pluginError = new PluginError('test');

      assert.ok(validationError instanceof Error);
      assert.ok(validationError instanceof SkillsSwitchError);
      assert.ok(fileSystemError instanceof Error);
      assert.ok(fileSystemError instanceof SkillsSwitchError);
      assert.ok(profileError instanceof Error);
      assert.ok(rollbackError instanceof Error);
      assert.ok(skillError instanceof Error);
      assert.ok(pluginError instanceof Error);
    });
  });
});
