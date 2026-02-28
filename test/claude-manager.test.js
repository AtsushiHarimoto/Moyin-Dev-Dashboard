const assert = require('assert');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const BaseManager = require('../lib/base-manager');
const { VALIDATION } = require('../lib/constants');
const { SkillApplicationError } = require('../lib/error-handler');

// 测试目录
const TEST_DIR = path.join(os.tmpdir(), 'skills-switch-claude-test-' + Date.now());

/**
 * 构造一个可测试的 Manager 子类
 * 模拟 ClaudeManager 的目录结构但使用临时路径
 */
class TestableManager extends BaseManager {
  constructor(config) {
    super('claude', config);
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
    if (!await fs.pathExists(this.testSkillsAllPath)) {
      await fs.ensureDir(this.testSkillsAllPath);
    }
    if (!await fs.pathExists(this.testSkillsPath)) {
      await fs.ensureDir(this.testSkillsPath);
    }
    return {
      skillsAll: await this.scanAllSkills(),
      currentSkills: await this.scanSkills()
    };
  }
}


describe('ClaudeManager / BaseManager extended features', function() {
  let manager;

  before(async function() {
    await fs.ensureDir(TEST_DIR);
    manager = new TestableManager({ projectRoot: TEST_DIR });
  });

  after(async function() {
    await fs.remove(TEST_DIR);
  });

  // ===================== saveState with file locking =====================

  describe('saveState with file locking', function() {

    it('should acquire lock, write state, and release lock', async function() {
      await manager.init();
      await manager.saveState('test-profile', 3);

      const stateDir = path.join(os.homedir(), '.skills-switch');
      const statePath = path.join(stateDir, 'state.json');

      // 确认 state 文件存在
      assert.ok(await fs.pathExists(statePath));

      const state = await fs.readJson(statePath);
      assert.strictEqual(state.current.claude, 'test-profile');
      assert.strictEqual(state.counts.claude, 3);
      assert.ok(state.lastSwitch);

      // 确认 lock 已被释放（lock dir 不应存在）
      const lockDir = path.join(stateDir, '.state.lock');
      assert.ok(!await fs.pathExists(lockDir), 'Lock directory should be cleaned up');
    });

    it('should perform atomic write via temp file rename', async function() {
      // 验证 state.json.tmp 不残留
      const stateDir = path.join(os.homedir(), '.skills-switch');
      const tmpPath = path.join(stateDir, 'state.json.tmp');

      await manager.saveState('atomic-test', 5);

      // tmp 文件不应残留
      assert.ok(!await fs.pathExists(tmpPath), 'Temp file should not remain after write');
    });

    it('should clean up lock on error', async function() {
      const stateDir = path.join(os.homedir(), '.skills-switch');
      const lockDir = path.join(stateDir, '.state.lock');

      // 强制创建一个 stale lock
      await fs.ensureDir(lockDir);
      assert.ok(await fs.pathExists(lockDir));

      // saveState 应通过 stale lock recovery 成功
      await manager.saveState('recovery-test', 2);

      const state = await fs.readJson(path.join(stateDir, 'state.json'));
      assert.strictEqual(state.current.claude, 'recovery-test');

      // lock 应已被清理
      assert.ok(!await fs.pathExists(lockDir), 'Lock should be released after recovery');
    });

    it('should add entry to history', async function() {
      await manager.saveState('history-test', 4);

      const stateDir = path.join(os.homedir(), '.skills-switch');
      const state = await fs.readJson(path.join(stateDir, 'state.json'));

      assert.ok(Array.isArray(state.history));
      assert.ok(state.history.length > 0);
      assert.strictEqual(state.history[0].tool, 'claude');
      assert.strictEqual(state.history[0].profile, 'history-test');
      assert.strictEqual(state.history[0].skillsCount, 4);
    });

    it('should cap history to MAX_HISTORY_ENTRIES', async function() {
      // 写入足够多的 history 条目
      for (let i = 0; i < VALIDATION.MAX_HISTORY_ENTRIES + 5; i++) {
        await manager.saveState(`cap-test-${i}`, i);
      }

      const stateDir = path.join(os.homedir(), '.skills-switch');
      const state = await fs.readJson(path.join(stateDir, 'state.json'));
      assert.ok(state.history.length <= VALIDATION.MAX_HISTORY_ENTRIES,
        `History length ${state.history.length} should be <= ${VALIDATION.MAX_HISTORY_ENTRIES}`);
    });
  });


  // ===================== applyProfile atomic swap =====================

  describe('applyProfile atomic swap', function() {

    before(async function() {
      // 准备 skills-all 中的 skills
      await fs.ensureDir(path.join(manager.testSkillsAllPath, 'skill-alpha'));
      await fs.writeFile(
        path.join(manager.testSkillsAllPath, 'skill-alpha', 'README.md'),
        '# Alpha'
      );
      await fs.ensureDir(path.join(manager.testSkillsAllPath, 'skill-beta'));
      await fs.writeFile(
        path.join(manager.testSkillsAllPath, 'skill-beta', 'README.md'),
        '# Beta'
      );
    });

    it('should create skills via atomic swap flow', async function() {
      const profile = {
        name: 'test-swap',
        skills: ['skill-alpha', 'skill-beta']
      };

      const { results, skillsCount } = await manager.applyProfile(profile);

      assert.ok(results.success.includes('skill-alpha'));
      assert.ok(results.success.includes('skill-beta'));
      assert.strictEqual(skillsCount, 2);

      // 验证 skills 目录中存在链接/目录
      assert.ok(await fs.pathExists(path.join(manager.testSkillsPath, 'skill-alpha')));
      assert.ok(await fs.pathExists(path.join(manager.testSkillsPath, 'skill-beta')));
    });

    it('should clean up temp dirs on success', async function() {
      const parent = path.dirname(manager.testSkillsPath);
      const base = path.basename(manager.testSkillsPath);
      const tempDir = path.join(parent, `${base}-installing`);
      const oldDir = path.join(parent, `.${base}-old`);

      // 执行 applyProfile
      const profile = {
        name: 'cleanup-test',
        skills: ['skill-alpha']
      };

      await manager.applyProfile(profile);

      // temp 和 old 目录不应存在
      assert.ok(!await fs.pathExists(tempDir), 'Temp dir should be cleaned up');
      assert.ok(!await fs.pathExists(oldDir), 'Old dir should be cleaned up');
    });

    it('should skip missing skills with skipped result', async function() {
      const profile = {
        name: 'partial-test',
        skills: ['skill-alpha', 'nonexistent-skill']
      };

      const { results } = await manager.applyProfile(profile);

      assert.ok(results.success.includes('skill-alpha'));
      assert.ok(results.skipped.includes('nonexistent-skill'));
    });

    it('should create backup before applying', async function() {
      const profile = {
        name: 'backup-test',
        skills: ['skill-alpha']
      };

      const { backupPath } = await manager.applyProfile(profile);

      assert.ok(backupPath);
      assert.ok(await fs.pathExists(backupPath));

      const backup = await fs.readJson(backupPath);
      assert.strictEqual(backup.tool, 'claude');
      assert.ok(Array.isArray(backup.skills));
    });

    it('should skip backup when skipBackup option is true', async function() {
      const profile = {
        name: 'no-backup-test',
        skills: ['skill-alpha']
      };

      const { backupPath } = await manager.applyProfile(profile, { skipBackup: true });

      assert.strictEqual(backupPath, null);
    });
  });


  // ===================== checkFailureRate =====================

  describe('checkFailureRate', function() {

    it('should not throw when failure rate is below threshold', function() {
      const results = {
        success: ['a', 'b', 'c'],
        failed: [{ skill: 'd', error: 'err' }],
        skipped: []
      };

      // 1/4 = 0.25 < 0.5 threshold
      assert.doesNotThrow(() => {
        manager.checkFailureRate(results, 4);
      });
    });

    it('should throw SkillApplicationError when failure rate exceeds threshold', function() {
      const results = {
        success: ['a'],
        failed: [
          { skill: 'b', error: 'err1' },
          { skill: 'c', error: 'err2' },
          { skill: 'd', error: 'err3' },
          { skill: 'e', error: 'err4' }
        ],
        skipped: []
      };

      // 4/5 = 0.8 > 0.5 threshold, and 4 > MIN_FAILURES_FOR_ROLLBACK (3)
      assert.throws(() => {
        manager.checkFailureRate(results, 5);
      }, (err) => {
        assert.ok(err instanceof SkillApplicationError);
        return true;
      });
    });

    it('should not throw when all skills are skipped', function() {
      const results = {
        success: [],
        failed: [],
        skipped: ['a', 'b', 'c']
      };

      // totalAttempted = 3 - 3 = 0, should return early
      assert.doesNotThrow(() => {
        manager.checkFailureRate(results, 3);
      });
    });

    it('should not throw when failures below MIN_FAILURES_FOR_ROLLBACK', function() {
      const results = {
        success: [],
        failed: [
          { skill: 'a', error: 'err1' },
          { skill: 'b', error: 'err2' }
        ],
        skipped: []
      };

      // 2/2 = 1.0 > threshold, but 2 < MIN_FAILURES_FOR_ROLLBACK (3)
      assert.doesNotThrow(() => {
        manager.checkFailureRate(results, 2);
      });
    });

    it('should handle zero total skills', function() {
      const results = {
        success: [],
        failed: [],
        skipped: []
      };

      assert.doesNotThrow(() => {
        manager.checkFailureRate(results, 0);
      });
    });
  });


  // ===================== Rollback behavior =====================

  describe('rollback behavior', function() {

    before(async function() {
      // Ensure skills-all is populated
      await fs.ensureDir(path.join(manager.testSkillsAllPath, 'skill-alpha'));
      await fs.writeFile(
        path.join(manager.testSkillsAllPath, 'skill-alpha', 'README.md'),
        '# Alpha'
      );
    });

    it('should restore state after a successful apply + restore cycle', async function() {
      // First, apply a profile to establish a baseline
      const profile1 = {
        name: 'before-rollback',
        skills: ['skill-alpha']
      };

      const { backupPath } = await manager.applyProfile(profile1);
      assert.ok(backupPath);

      // Now verify current profile
      const current = await manager.getCurrentProfile();
      assert.strictEqual(current, 'before-rollback');

      // Restore from backup
      const backupId = path.basename(backupPath);
      await manager.restore(backupId);

      // After restore, the skills should still be accessible
      const skills = await manager.scanSkills();
      assert.ok(Array.isArray(skills));
    });
  });


  // ===================== createLink =====================

  describe('createLink for skill links', function() {

    it('should create a working link to skill directory', async function() {
      const target = path.join(TEST_DIR, 'link-target-skill');
      const link = path.join(TEST_DIR, 'link-skill');

      await fs.ensureDir(target);
      await fs.writeFile(path.join(target, 'test.md'), '# Test');

      await manager.createLink(target, link);

      // 验证链接可用（能读取内容）
      assert.ok(await fs.pathExists(link));
      const content = await fs.readFile(path.join(link, 'test.md'), 'utf-8');
      assert.strictEqual(content, '# Test');

      await fs.remove(link);
      await fs.remove(target);
    });

    it('should overwrite existing link', async function() {
      const target1 = path.join(TEST_DIR, 'link-target-v1');
      const target2 = path.join(TEST_DIR, 'link-target-v2');
      const link = path.join(TEST_DIR, 'link-overwrite');

      await fs.ensureDir(target1);
      await fs.writeFile(path.join(target1, 'version.txt'), 'v1');
      await fs.ensureDir(target2);
      await fs.writeFile(path.join(target2, 'version.txt'), 'v2');

      // Create first link
      await manager.createLink(target1, link);
      let content = await fs.readFile(path.join(link, 'version.txt'), 'utf-8');
      assert.strictEqual(content, 'v1');

      // Overwrite with second target
      await manager.createLink(target2, link);
      content = await fs.readFile(path.join(link, 'version.txt'), 'utf-8');
      assert.strictEqual(content, 'v2');

      await fs.remove(link);
      await fs.remove(target1);
      await fs.remove(target2);
    });
  });
});
