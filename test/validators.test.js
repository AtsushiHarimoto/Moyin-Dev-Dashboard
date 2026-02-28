const assert = require('assert');
const {
  validateName,
  validateSkillName,
  validateSkillDirName,
  validateProfileName,
  validateBackupId,
  validatePathInDirectory
} = require('../lib/validators');
const { ValidationError } = require('../lib/error-handler');
const path = require('path');
const os = require('os');

describe('Validators', function() {
  describe('validateSkillName', function() {
    it('should accept valid skill names', function() {
      assert.strictEqual(validateSkillName('typescript-pro'), true);
      assert.strictEqual(validateSkillName('vue-expert'), true);
      assert.strictEqual(validateSkillName('superpowers'), true);
      assert.strictEqual(validateSkillName('skill_with_underscore'), true);
      assert.strictEqual(validateSkillName('skill.with.dots'), true);
      assert.strictEqual(validateSkillName('skill@scope'), true);
    });

    it('should reject names with path traversal', function() {
      assert.throws(() => validateSkillName('../malicious'), ValidationError);
      assert.throws(() => validateSkillName('..\\hack'), ValidationError);
      assert.throws(() => validateSkillName('path/to/skill'), ValidationError);
      assert.throws(() => validateSkillName('path\\to\\skill'), ValidationError);
    });

    it('should reject empty or non-string names', function() {
      assert.throws(() => validateSkillName(''), ValidationError);
      assert.throws(() => validateSkillName(null), ValidationError);
      assert.throws(() => validateSkillName(undefined), ValidationError);
      assert.throws(() => validateSkillName(123), ValidationError);
    });

    it('should reject names with null bytes', function() {
      assert.throws(() => validateSkillName('skill\0name'), ValidationError);
    });

    it('should accept names with colons (used in skill identifiers)', function() {
      assert.doesNotThrow(() => validateSkillName('skill:name'));
    });

    it('should reject absolute paths', function() {
      assert.throws(() => validateSkillName('/usr/bin/skill'), ValidationError);
      assert.throws(() => validateSkillName('C:\\Windows\\skill'), ValidationError);
    });

    it('should reject UNC paths', function() {
      assert.throws(() => validateSkillName('\\\\server\\share'), ValidationError);
    });

    it('should reject names that are too long', function() {
      const longName = 'x'.repeat(101);
      assert.throws(() => validateSkillName(longName), ValidationError);
      assert.throws(() => validateSkillName(longName), /too long/);
    });
  });

  describe('validateSkillDirName', function() {
    it('should accept valid directory names', function() {
      assert.strictEqual(validateSkillDirName('typescript-pro'), true);
      assert.strictEqual(validateSkillDirName('skill_with_underscore'), true);
      assert.strictEqual(validateSkillDirName('skill.with.dots'), true);
      assert.strictEqual(validateSkillDirName('skill@scope'), true);
    });

    it('should reject names with colons (illegal on Windows)', function() {
      assert.throws(() => validateSkillDirName('superpowers:brainstorming'), ValidationError);
      assert.throws(() => validateSkillDirName('skill:name'), ValidationError);
    });

    it('should reject path traversal', function() {
      assert.throws(() => validateSkillDirName('../malicious'), ValidationError);
      assert.throws(() => validateSkillDirName('path/to/skill'), ValidationError);
    });

    it('should reject empty or non-string names', function() {
      assert.throws(() => validateSkillDirName(''), ValidationError);
      assert.throws(() => validateSkillDirName(null), ValidationError);
    });
  });

  describe('validateProfileName', function() {
    it('should accept valid profile names', function() {
      assert.strictEqual(validateProfileName('cc-full'), true);
      assert.strictEqual(validateProfileName('cx-minimal'), true);
      assert.strictEqual(validateProfileName('anti-full'), true);
      assert.strictEqual(validateProfileName('profile_123'), true);
      assert.strictEqual(validateProfileName('profile.test'), true);
    });

    it('should reject profile names with @ symbol', function() {
      // Profile names use different pattern than skill names
      assert.throws(() => validateProfileName('profile@scope'), ValidationError);
    });

    it('should reject invalid profile names', function() {
      assert.throws(() => validateProfileName('../traverse'), ValidationError);
      assert.throws(() => validateProfileName('profile/slash'), ValidationError);
      assert.throws(() => validateProfileName(''), ValidationError);
    });
  });

  describe('validateBackupId', function() {
    it('should accept valid backup IDs', function() {
      assert.strictEqual(validateBackupId('backup-2024-01-15.json'), true);
      assert.strictEqual(validateBackupId('test_backup.json'), true);
      assert.strictEqual(validateBackupId('my-backup-123.json'), true);
    });

    it('should reject backup IDs without .json extension', function() {
      assert.throws(() => validateBackupId('backup.txt'), ValidationError);
      assert.throws(() => validateBackupId('backup'), ValidationError);
    });

    it('should reject backup IDs with path traversal', function() {
      assert.throws(() => validateBackupId('../backup.json'), ValidationError);
      assert.throws(() => validateBackupId('..\\backup.json'), ValidationError);
    });

    it('should reject backup IDs with slashes', function() {
      assert.throws(() => validateBackupId('path/to/backup.json'), ValidationError);
      assert.throws(() => validateBackupId('path\\to\\backup.json'), ValidationError);
    });

    it('should reject empty backup IDs', function() {
      assert.throws(() => validateBackupId(''), ValidationError);
      assert.throws(() => validateBackupId(null), ValidationError);
    });

    it('should reject absolute paths', function() {
      assert.throws(() => validateBackupId('/tmp/backup.json'), ValidationError);
      assert.throws(() => validateBackupId('C:\\backup.json'), ValidationError);
    });
  });

  describe('validatePathInDirectory', function() {
    const baseDir = path.join(os.tmpdir(), 'test-base');

    it('should accept paths within directory', function() {
      const validPath = path.join(baseDir, 'subdir', 'file.txt');
      assert.strictEqual(validatePathInDirectory(validPath, baseDir), true);
    });

    it('should accept base directory itself', function() {
      assert.strictEqual(validatePathInDirectory(baseDir, baseDir), true);
    });

    it('should reject paths outside directory', function() {
      const outsidePath = path.join(os.tmpdir(), 'other-dir', 'file.txt');
      assert.throws(
        () => validatePathInDirectory(outsidePath, baseDir),
        ValidationError
      );
    });

    it('should reject path traversal attempts', function() {
      const traversalPath = path.join(baseDir, '..', 'escape.txt');
      assert.throws(
        () => validatePathInDirectory(traversalPath, baseDir),
        ValidationError
      );
      assert.throws(
        () => validatePathInDirectory(traversalPath, baseDir),
        /escapes base directory/
      );
    });
  });

  describe('validateName (generic)', function() {
    it('should use custom options', function() {
      const customOptions = {
        context: 'Custom Name',
        maxLength: 10,
        allowedPattern: /^[a-z]+$/
      };

      assert.strictEqual(validateName('abcdef', customOptions), true);

      assert.throws(
        () => validateName('abc123', customOptions),
        ValidationError
      );
      assert.throws(
        () => validateName('abc123', customOptions),
        /Custom Name/i
      );

      assert.throws(
        () => validateName('abcdefghijk', customOptions),
        /too long/
      );
    });
  });
});
