const assert = require('assert');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const ProfileManager = require('../lib/profile-manager');

// 测试目录
const TEST_DIR = path.join(os.tmpdir(), 'skills-switch-test-' + Date.now());
const PROFILES_DIR = path.join(TEST_DIR, 'profiles');

describe('ProfileManager', function() {
  let profileManager;

  before(async function() {
    await fs.ensureDir(PROFILES_DIR);
    profileManager = new ProfileManager(PROFILES_DIR);
  });

  after(async function() {
    await fs.remove(TEST_DIR);
  });

  describe('validateName', function() {
    it('should accept valid names', function() {
      assert.strictEqual(profileManager.validateName('cx-review'), true);
      assert.strictEqual(profileManager.validateName('cc-frontend-dev'), true);
      assert.strictEqual(profileManager.validateName('anti-full'), true);
    });

    it('should reject names with path traversal', function() {
      assert.throws(() => profileManager.validateName('../etc/passwd'), /illegal characters/);
      assert.throws(() => profileManager.validateName('..\\windows\\system32'), /illegal characters/);
      assert.throws(() => profileManager.validateName('foo/bar'), /illegal characters/);
    });

    it('should reject empty or non-string names', function() {
      assert.throws(() => profileManager.validateName(''), /required/);
      assert.throws(() => profileManager.validateName(null), /required/);
      assert.throws(() => profileManager.validateName(123), /required/);
    });

    it('should reject names that are too long', function() {
      const longName = 'a'.repeat(101);
      assert.throws(() => profileManager.validateName(longName), /too long/);
    });
  });

  describe('save and load', function() {
    it('should save and load a profile', async function() {
      const profile = {
        name: 'test-profile',
        description: 'Test profile',
        tool: 'cx',
        skills: ['skill-a', 'skill-b']
      };

      await profileManager.save(profile);
      const loaded = await profileManager.load('test-profile');

      assert.strictEqual(loaded.name, profile.name);
      assert.strictEqual(loaded.description, profile.description);
      assert.deepStrictEqual(loaded.skills, profile.skills);
    });

    it('should throw error for non-existent profile', async function() {
      await assert.rejects(
        () => profileManager.load('non-existent'),
        /Profile not found/
      );
    });
  });

  describe('delete', function() {
    it('should delete a profile', async function() {
      const profile = {
        name: 'to-delete',
        description: 'Will be deleted',
        tool: 'cc',
        skills: []
      };

      await profileManager.save(profile);
      await profileManager.delete('to-delete');

      await assert.rejects(
        () => profileManager.load('to-delete'),
        /Profile not found/
      );
    });
  });

  describe('validate', function() {
    it('should validate correct profile', function() {
      const result = profileManager.validate({
        name: 'valid',
        tool: 'cx',
        skills: ['a', 'b']
      });
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should reject profile without name', function() {
      const result = profileManager.validate({
        tool: 'cx',
        skills: []
      });
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('name')));
    });

    it('should reject profile without skills array', function() {
      const result = profileManager.validate({
        name: 'test',
        tool: 'cx',
        skills: 'not-an-array'
      });
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('array')));
    });
  });

  describe('loadAll', function() {
    it('should load all profiles', async function() {
      // 创建多个 profiles
      await profileManager.save({ name: 'all-1', tool: 'cx', skills: [] });
      await profileManager.save({ name: 'all-2', tool: 'cc', skills: [] });

      const profiles = await profileManager.loadAll();
      const names = profiles.map(p => p.name);

      assert.ok(names.includes('all-1'));
      assert.ok(names.includes('all-2'));
    });
  });

  describe('groupByTool', function() {
    it('should group profiles by tool', async function() {
      await profileManager.save({ name: 'group-cx', tool: 'cx', skills: [] });
      await profileManager.save({ name: 'group-cc', tool: 'cc', skills: [] });

      const grouped = await profileManager.groupByTool();

      assert.ok(grouped.cx);
      assert.ok(grouped.cc);
      assert.ok(grouped.cx.some(p => p.name === 'group-cx'));
      assert.ok(grouped.cc.some(p => p.name === 'group-cc'));
    });
  });
});
