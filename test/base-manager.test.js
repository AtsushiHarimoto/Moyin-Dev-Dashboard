const assert = require('assert');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const BaseManager = require('../lib/base-manager');

// 测试目录
const TEST_DIR = path.join(os.tmpdir(), 'skills-switch-base-test-' + Date.now());

// 创建一个具体的测试类
class TestManager extends BaseManager {
  constructor(config) {
    super('test', config);
    this.testSkillsPath = path.join(TEST_DIR, 'skills');
    this.testSkillsAllPath = path.join(TEST_DIR, 'skills-all');
  }

  getSkillsPath() {
    return this.testSkillsPath;
  }

  getSkillsDirs() {
    return [
      {
        skills: this.testSkillsPath,
        skillsAll: this.testSkillsAllPath
      }
    ];
  }

  async init() {
    // Simplified init for testing
    if (!await fs.pathExists(this.testSkillsAllPath)) {
      await fs.ensureDir(this.testSkillsAllPath);
    }
    return {
      skillsAll: await this.scanAllSkills(),
      currentSkills: await this.scanSkills()
    };
  }
}

describe('BaseManager', function() {
  let manager;

  before(async function() {
    await fs.ensureDir(TEST_DIR);
    manager = new TestManager({ projectRoot: TEST_DIR });
  });

  after(async function() {
    await fs.remove(TEST_DIR);
  });


  describe('scanSkills', function() {
    before(async function() {
      // 创建测试 skills 目录
      await fs.ensureDir(manager.testSkillsPath);
      await fs.ensureDir(path.join(manager.testSkillsPath, 'skill-a'));
      await fs.ensureDir(path.join(manager.testSkillsPath, 'skill-b'));
      // 创建一个文件（应该被忽略）
      await fs.writeFile(path.join(manager.testSkillsPath, 'not-a-skill.txt'), '');
    });

    it('should return only directories', async function() {
      const skills = await manager.scanSkills();
      assert.ok(skills.includes('skill-a'));
      assert.ok(skills.includes('skill-b'));
      assert.ok(!skills.includes('not-a-skill.txt'));
    });

    it('should return empty array if path does not exist', async function() {
      const emptyManager = new TestManager({ projectRoot: '/nonexistent' });
      emptyManager.testSkillsPath = '/nonexistent/skills';
      const skills = await emptyManager.scanSkills();
      assert.deepStrictEqual(skills, []);
    });
  });

  describe('validateSkills', function() {
    it('should categorize skills correctly', async function() {
      const result = await manager.validateSkills(['skill-a', 'skill-b', 'missing-skill']);

      assert.ok(result.available.includes('skill-a'));
      assert.ok(result.available.includes('skill-b'));
      assert.ok(result.missing.includes('missing-skill'));
    });
  });

  describe('backup', function() {
    it('should create a backup file', async function() {
      const backupPath = await manager.backup();

      assert.ok(backupPath.includes('.skills-switch'));
      assert.ok(backupPath.includes('backups'));
      assert.ok(await fs.pathExists(backupPath));

      const backup = await fs.readJson(backupPath);
      assert.strictEqual(backup.tool, 'test');
      assert.ok(Array.isArray(backup.skills));
      assert.ok(backup.timestamp);
    });
  });

  describe('saveState and getCurrentProfile', function() {
    it('should save and retrieve current profile', async function() {
      await manager.saveState('test-profile', 5);

      const current = await manager.getCurrentProfile();
      assert.strictEqual(current, 'test-profile');
    });
  });

  describe('scanAllSkills', function() {
    before(async function() {
      await fs.ensureDir(manager.testSkillsAllPath);
      await fs.ensureDir(path.join(manager.testSkillsAllPath, 'skill-x'));
      await fs.ensureDir(path.join(manager.testSkillsAllPath, 'skill-y'));
    });

    it('should scan skills from skills-all directory', async function() {
      const skills = await manager.scanAllSkills();

      assert.ok(skills.includes('skill-x'));
      assert.ok(skills.includes('skill-y'));
    });

    it('should return empty array if directory does not exist', async function() {
      const tempManager = new TestManager({ projectRoot: '/nonexistent' });
      tempManager.testSkillsAllPath = '/nonexistent/skills-all';

      const skills = await tempManager.scanAllSkills();
      assert.deepStrictEqual(skills, []);
    });
  });

  describe('getDiff', function() {
    it('should identify added, removed and unchanged skills', async function() {
      const profile = {
        name: 'test',
        skills: ['skill-a', 'skill-x', 'new-skill']
      };

      const diff = await manager.getDiff(profile);

      // skill-b is in current but not in profile (added)
      assert.ok(diff.added.includes('skill-b'));

      // new-skill is in profile but not in current (removed)
      assert.ok(diff.removed.includes('new-skill'));

      // skill-a and skill-x are in both (unchanged)
      assert.ok(diff.unchanged.includes('skill-a'));
    });
  });

  describe('resolveSymlink', function() {
    it('should return file path if not a symlink', async function() {
      const regularFile = path.join(TEST_DIR, 'regular.txt');
      await fs.writeFile(regularFile, 'test');

      const resolved = await manager.resolveSymlink(regularFile);
      assert.strictEqual(resolved, regularFile);

      await fs.remove(regularFile);
    });

    it('should resolve symlink to target', async function() {
      // Note: This test may fail on Windows without elevated privileges
      // Skip on Windows or in CI environments where symlinks aren't supported
      if (process.platform === 'win32') {
        this.skip();
        return;
      }

      const targetFile = path.join(TEST_DIR, 'target.txt');
      const symlinkFile = path.join(TEST_DIR, 'symlink.txt');

      await fs.writeFile(targetFile, 'test');
      await fs.symlink(targetFile, symlinkFile);

      const resolved = await manager.resolveSymlink(symlinkFile);
      assert.strictEqual(resolved, targetFile);

      await fs.remove(symlinkFile);
      await fs.remove(targetFile);
    });
  });

  describe('findSkillInBackup', function() {
    it('should find skill in skills-all', async function() {
      const skillsDirs = manager.getSkillsDirs();
      const result = await manager.findSkillInBackup('skill-x', skillsDirs);

      assert.ok(result);
      assert.ok(result.path.includes('skill-x'));
      assert.strictEqual(result.dir.skillsAll, manager.testSkillsAllPath);
    });

    it('should return null if skill not found', async function() {
      const skillsDirs = manager.getSkillsDirs();
      const result = await manager.findSkillInBackup('nonexistent', skillsDirs);

      assert.strictEqual(result, null);
    });
  });

  describe('createLink', function() {
    it('should create link to target', async function() {
      const target = path.join(TEST_DIR, 'link-target');
      const link = path.join(TEST_DIR, 'link-test');

      await fs.ensureDir(target);

      await manager.createLink(target, link);

      assert.ok(await fs.pathExists(link));

      await fs.remove(target);
      await fs.remove(link);
    });

    it('should throw error if target does not exist', async function() {
      const target = path.join(TEST_DIR, 'nonexistent-target');
      const link = path.join(TEST_DIR, 'link-test2');

      await assert.rejects(
        async () => await manager.createLink(target, link),
        /Target does not exist/
      );
    });
  });
});
