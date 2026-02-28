const assert = require('assert');
const { Logger, LOG_LEVELS, defaultLogger, createLogger } = require('../lib/logger');
const path = require('path');
const os = require('os');
const fs = require('fs-extra');

describe('Logger', function() {
  describe('Logger class', function() {
    it('should create logger with default options', function() {
      const logger = new Logger();

      assert.strictEqual(logger.level, LOG_LEVELS.INFO);
      assert.strictEqual(logger.context, 'SkillsSwitch');
      assert.strictEqual(logger.enableColors, true);
      assert.strictEqual(logger.enableFile, false);
    });

    it('should create logger with custom options', function() {
      const logger = new Logger({
        level: LOG_LEVELS.DEBUG,
        context: 'TestContext',
        enableColors: false,
        enableFile: true,
        logFilePath: '/tmp/test.log'
      });

      assert.strictEqual(logger.level, LOG_LEVELS.DEBUG);
      assert.strictEqual(logger.context, 'TestContext');
      assert.strictEqual(logger.enableColors, false);
      assert.strictEqual(logger.enableFile, true);
      assert.strictEqual(logger.logFilePath, '/tmp/test.log');
    });

    it('should format messages correctly', function() {
      const logger = new Logger({ enableColors: false, context: 'Test' });
      const message = logger.formatMessage(LOG_LEVELS.INFO, 'Test message', { key: 'value' });

      assert.ok(message.includes('[INFO]'));
      assert.ok(message.includes('[Test]'));
      assert.ok(message.includes('Test message'));
      assert.ok(message.includes('"key": "value"'));
    });

    it('should respect log level filtering', function() {
      const logger = new Logger({ level: LOG_LEVELS.WARN });

      // These should not log (level too low)
      let debugLogged = false;
      let infoLogged = false;
      const originalLog = console.log;
      console.log = () => { infoLogged = true; };

      logger.debug('Debug message');
      logger.info('Info message');

      console.log = originalLog;

      assert.strictEqual(debugLogged, false);
      assert.strictEqual(infoLogged, false);
    });

    it('should create child logger with nested context', function() {
      const parent = new Logger({ context: 'Parent' });
      const child = parent.child('Child');

      assert.strictEqual(child.context, 'Parent:Child');
      assert.strictEqual(child.level, parent.level);
      assert.strictEqual(child.enableColors, parent.enableColors);
    });

    it('should write to file when enabled', async function() {
      const testLogPath = path.join(os.tmpdir(), `logger-test-${Date.now()}.log`);
      const logger = new Logger({
        enableFile: true,
        logFilePath: testLogPath,
        level: LOG_LEVELS.DEBUG
      });

      // Log a test message
      logger.info('Test log message', { test: true });

      // Wait a bit for async file write
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check if file exists and contains the message
      const exists = await fs.pathExists(testLogPath);
      assert.ok(exists, 'Log file should exist');

      const content = await fs.readFile(testLogPath, 'utf-8');
      assert.ok(content.includes('Test log message'), 'Log content should include message');

      // Cleanup
      await fs.remove(testLogPath);
    });
  });

  describe('LOG_LEVELS', function() {
    it('should export log level constants', function() {
      assert.strictEqual(typeof LOG_LEVELS.DEBUG, 'number');
      assert.strictEqual(typeof LOG_LEVELS.INFO, 'number');
      assert.strictEqual(typeof LOG_LEVELS.WARN, 'number');
      assert.strictEqual(typeof LOG_LEVELS.ERROR, 'number');
      assert.strictEqual(typeof LOG_LEVELS.SILENT, 'number');

      // Verify ordering
      assert.ok(LOG_LEVELS.DEBUG < LOG_LEVELS.INFO);
      assert.ok(LOG_LEVELS.INFO < LOG_LEVELS.WARN);
      assert.ok(LOG_LEVELS.WARN < LOG_LEVELS.ERROR);
      assert.ok(LOG_LEVELS.ERROR < LOG_LEVELS.SILENT);
    });
  });

  describe('defaultLogger', function() {
    it('should export default logger instance', function() {
      assert.ok(defaultLogger instanceof Logger);
      assert.strictEqual(defaultLogger.context, 'SkillsSwitch');
    });
  });

  describe('createLogger', function() {
    it('should create logger with options', function() {
      const logger = createLogger({ context: 'Custom' });

      assert.ok(logger instanceof Logger);
      assert.strictEqual(logger.context, 'Custom');
    });
  });

  describe('Log methods', function() {
    it('should have debug method', function() {
      const logger = new Logger({ level: LOG_LEVELS.DEBUG });
      assert.strictEqual(typeof logger.debug, 'function');

      // Should not throw
      assert.doesNotThrow(() => {
        logger.debug('Debug message');
      });
    });

    it('should have info method', function() {
      const logger = new Logger();
      assert.strictEqual(typeof logger.info, 'function');

      assert.doesNotThrow(() => {
        logger.info('Info message');
      });
    });

    it('should have warn method', function() {
      const logger = new Logger();
      assert.strictEqual(typeof logger.warn, 'function');

      assert.doesNotThrow(() => {
        logger.warn('Warn message');
      });
    });

    it('should have error method', function() {
      const logger = new Logger();
      assert.strictEqual(typeof logger.error, 'function');

      assert.doesNotThrow(() => {
        logger.error('Error message');
      });
    });
  });
});
