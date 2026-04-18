import path from 'path';
import fs from 'fs';
import { describe, expect, it } from 'vitest';
import { SAFE_EXPORT_ROOT, parseSessionProvider as parseExportProvider, resolveOutputPath, sanitizeSessionIdForFilename } from './export';
import { isSamePathByPlatform, parseSyncProvider } from './sync';
import { isFtsQueryError, parseSessionProvider as parseMessagesProvider } from './messages';
import { parseSessionProvider as parseSessionsProvider } from './sessions';

describe('route hardening helpers', () => {
  it('resolves default export path under SAFE_EXPORT_ROOT', () => {
    const filePath = resolveOutputPath(undefined, 'sample.json');
    expect(filePath).toBe(path.join(SAFE_EXPORT_ROOT, 'sample.json'));
  });

  it('rejects traversal path outside SAFE_EXPORT_ROOT', () => {
    expect(() => resolveOutputPath('../../package.json', 'fallback.json')).toThrow(
      'Invalid output path: Must be within the configured export root'
    );
  });

  it('rejects absolute path outside SAFE_EXPORT_ROOT', () => {
    const outside = path.resolve(process.cwd(), 'package.json');
    expect(() => resolveOutputPath(outside, 'fallback.json')).toThrow(
      'Invalid output path: Must be within the configured export root'
    );
  });

  it('creates parent directories for nested export path', () => {
    const filePath = resolveOutputPath('nested/a/b/sample.json', 'fallback.json');
    expect(filePath).toBe(path.join(SAFE_EXPORT_ROOT, 'nested', 'a', 'b', 'sample.json'));
    expect(fs.existsSync(path.dirname(filePath))).toBe(true);
  });

  it('rejects output path that points to an existing directory', () => {
    const dirPath = path.join(SAFE_EXPORT_ROOT, 'dir-only');
    fs.mkdirSync(dirPath, { recursive: true });
    expect(() => resolveOutputPath('dir-only', 'fallback.json')).toThrow(
      'Invalid output path: file path points to an existing directory'
    );
  });

  it('matches equivalent paths with platform-aware comparison', () => {
    const a = path.resolve('content', 'output', 'skills-switch', 'x.json');
    const b = path.join(process.cwd(), 'content', 'output', 'skills-switch', 'x.json');
    expect(isSamePathByPlatform(a, b)).toBe(true);
  });

  it('classifies FTS query syntax errors', () => {
    expect(isFtsQueryError(new Error('fts5: syntax error near "("'))).toBe(true);
    expect(isFtsQueryError(new Error('Some other runtime error'))).toBe(false);
  });

  it('sanitizes session id for safe filename use', () => {
    const raw = 'codex:abc/def?name=*x|y';
    expect(sanitizeSessionIdForFilename(raw)).toBe('codex_abc_def_name_x_y');
  });

  it('avoids Windows reserved filenames', () => {
    expect(sanitizeSessionIdForFilename('CON')).toBe('_CON');
    expect(sanitizeSessionIdForFilename('NUL.')).toBe('_NUL');
  });

  it('parses only supported sync providers', () => {
    expect(parseSyncProvider(undefined)).toBe('claude');
    expect(parseSyncProvider('claude')).toBe('claude');
    expect(parseSyncProvider('codex')).toBe('codex');
    expect(parseSyncProvider('antigravity')).toBe('antigravity');
    expect(parseSyncProvider('unknown')).toBeNull();
  });

  it('parses only supported providers in export/messages/sessions routes', () => {
    expect(parseExportProvider(undefined)).toBe('claude');
    expect(parseMessagesProvider('codex')).toBe('codex');
    expect(parseSessionsProvider('antigravity')).toBe('antigravity');
    expect(parseExportProvider('unknown')).toBeNull();
    expect(parseMessagesProvider('unknown')).toBeNull();
    expect(parseSessionsProvider('unknown')).toBeNull();
  });
});
