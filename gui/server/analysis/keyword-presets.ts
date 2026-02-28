/**
 * Keyword Presets 業務邏輯
 *
 * 管理種子詞 + AI 發現詞 → 合併去重後供前端使用
 */

import { getAnalysisDatabase } from '../database';
import { DOMAIN_PRESETS, type DomainPreset } from './domain-presets-seed';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { callTool } from './mcp-client';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface KeywordPresetRow {
  id: number;
  category: string;
  icon: string;
  label_key: string | null;
  description_key: string | null;
  seed_keywords: string;
  discovered_keywords: string;
  merged_keywords: string;
  discover_score_json: string | null;
  last_refreshed: string | null;
  is_builtin: number;
  created_at: string;
  updated_at: string;
}

export interface KeywordPresetDTO {
  id: number;
  category: string;
  icon: string;
  labelKey: string | null;
  descriptionKey: string | null;
  seedKeywords: string;
  discoveredKeywords: string;
  mergedKeywords: string;
  discoverScores: DiscoverScore[] | null;
  lastRefreshed: string | null;
  isBuiltin: boolean;
  seedCount: number;
  discoveredCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DiscoverScore {
  keyword: string;
  score: number;
  frequency: number;
  source?: string;
}

export type KeywordRefreshProgressStage =
  | 'starting'
  | 'preset_start'
  | 'preset_done'
  | 'preset_failed'
  | 'completed';

export type KeywordRefreshErrorType = 'parse_error' | 'empty_result' | 'non_array' | 'timeout' | 'mcp_error' | 'ai_api_error' | 'unknown';

/** Shared per-call timeout for keyword refresh MCP calls (ms). */
export const KEYWORD_REFRESH_PER_CALL_TIMEOUT_MS = 180_000;

export interface KeywordRefreshProgressEvent {
  stage: KeywordRefreshProgressStage;
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  category?: string;
  message: string;
  error?: string;
  errorType?: KeywordRefreshErrorType;
}

export interface RefreshFromHermitPurpleOptions {
  perCallTimeoutMs?: number;
  onProgress?: (event: KeywordRefreshProgressEvent) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function countKeywords(csv: string): number {
  if (!csv || !csv.trim()) return 0;
  return csv.split(',').filter(k => k.trim()).length;
}

function rowToDTO(row: KeywordPresetRow): KeywordPresetDTO {
  let scores: DiscoverScore[] | null = null;
  if (row.discover_score_json) {
    try { scores = JSON.parse(row.discover_score_json); } catch { /* ignore */ }
  }
  return {
    id: row.id,
    category: row.category,
    icon: row.icon,
    labelKey: row.label_key,
    descriptionKey: row.description_key,
    seedKeywords: row.seed_keywords,
    discoveredKeywords: row.discovered_keywords,
    mergedKeywords: row.merged_keywords,
    discoverScores: scores,
    lastRefreshed: row.last_refreshed,
    isBuiltin: row.is_builtin === 1,
    seedCount: countKeywords(row.seed_keywords),
    discoveredCount: countKeywords(row.discovered_keywords),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Merge seed + discovered, case-insensitive dedup */
function mergeAndDedup(seed: string, discovered: string): string {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const raw of seed.split(',')) {
    const kw = raw.trim();
    if (!kw) continue;
    const lower = kw.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    merged.push(kw);
  }

  for (const raw of discovered.split(',')) {
    const kw = raw.trim();
    if (!kw) continue;
    const lower = kw.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    merged.push(kw);
  }

  return merged.join(', ');
}

// ── Core Functions ─────────────────────────────────────────────────────────────

/**
 * Seed presets from DOMAIN_PRESETS on first startup.
 * Idempotent — skips if rows already exist.
 */
export function seedFromDefaults(): void {
  const db = getAnalysisDatabase();
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM keyword_presets').get() as { cnt: number };
  if (existing.cnt > 0) return;

  const insert = db.prepare(`
    INSERT INTO keyword_presets (category, icon, label_key, description_key, seed_keywords, merged_keywords, is_builtin)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);

  const tx = db.transaction((presets: DomainPreset[]) => {
    for (const p of presets) {
      const category = p.label ?? p.labelKey ?? 'Unknown';
      insert.run(
        category,
        p.icon,
        p.labelKey ?? null,
        p.descriptionKey ?? null,
        p.keywords,
        p.keywords, // merged = seed initially
      );
    }
  });

  tx(DOMAIN_PRESETS);
  console.log(`✅ Seeded ${DOMAIN_PRESETS.length} keyword presets`);
}

/** Return all presets with computed counts */
export function getAllPresets(): KeywordPresetDTO[] {
  const db = getAnalysisDatabase();
  const rows = db.prepare('SELECT * FROM keyword_presets ORDER BY is_builtin DESC, id ASC').all() as KeywordPresetRow[];
  return rows.map(rowToDTO);
}

/** Merge seed + discovered for one preset and write back */
export function mergeKeywords(id: number): void {
  const db = getAnalysisDatabase();
  const row = db.prepare('SELECT seed_keywords, discovered_keywords FROM keyword_presets WHERE id = ?').get(id) as Pick<KeywordPresetRow, 'seed_keywords' | 'discovered_keywords'> | undefined;
  if (!row) return;

  const merged = mergeAndDedup(row.seed_keywords, row.discovered_keywords);
  db.prepare(`UPDATE keyword_presets SET merged_keywords = ?, updated_at = datetime('now') WHERE id = ?`).run(merged, id);
}

/** Update seed keywords manually */
export function updateSeedKeywords(id: number, keywords: string): void {
  const db = getAnalysisDatabase();
  db.prepare(`UPDATE keyword_presets SET seed_keywords = ?, updated_at = datetime('now') WHERE id = ?`).run(keywords, id);
  mergeKeywords(id);
}

/** Create a new custom preset */
export function createPreset(category: string, icon: string, keywords: string): KeywordPresetDTO {
  const db = getAnalysisDatabase();
  const result = db.prepare(`
    INSERT INTO keyword_presets (category, icon, seed_keywords, merged_keywords, is_builtin)
    VALUES (?, ?, ?, ?, 0)
  `).run(category, icon, keywords, keywords);

  const row = db.prepare('SELECT * FROM keyword_presets WHERE id = ?').get(result.lastInsertRowid) as KeywordPresetRow;
  return rowToDTO(row);
}

/** Delete a non-builtin preset */
export function deletePreset(id: number): 'deleted' | 'not_found' | 'builtin' {
  const db = getAnalysisDatabase();
  const row = db.prepare('SELECT is_builtin FROM keyword_presets WHERE id = ?').get(id) as { is_builtin: number } | undefined;
  if (!row) return 'not_found';
  if (row.is_builtin === 1) return 'builtin';
  db.prepare('DELETE FROM keyword_presets WHERE id = ?').run(id);
  return 'deleted';
}

/**
 * Extract insight keywords from analysis results.
 * Appends new keywords to discovered_keywords of matching preset.
 */
export function extractInsightKeywords(
  items: Array<{ name: string }>,
  label: string,
): void {
  if (!items || items.length === 0) return;

  const db = getAnalysisDatabase();

  // Find matching preset by category name (label)
  let row = db.prepare('SELECT id, discovered_keywords, seed_keywords FROM keyword_presets WHERE category = ?').get(label) as
    Pick<KeywordPresetRow, 'id' | 'discovered_keywords' | 'seed_keywords'> | undefined;

  if (!row) return;

  // Existing keywords (lowercased for dedup)
  const existingSet = new Set<string>();
  for (const kw of (row.seed_keywords + ',' + row.discovered_keywords).split(',')) {
    const t = kw.trim().toLowerCase();
    if (t) existingSet.add(t);
  }

  // Extract new keyword names
  const newKws: string[] = [];
  for (const item of items) {
    const name = item.name.trim();
    if (!name) continue;
    if (existingSet.has(name.toLowerCase())) continue;
    existingSet.add(name.toLowerCase());
    newKws.push(name);
  }

  if (newKws.length === 0) return;

  // Append to discovered_keywords
  const current = row.discovered_keywords.trim();
  const updated = current ? `${current}, ${newKws.join(', ')}` : newKws.join(', ');
  db.prepare(`UPDATE keyword_presets SET discovered_keywords = ?, updated_at = datetime('now') WHERE id = ?`).run(updated, row.id);
  mergeKeywords(row.id);

  console.log(`[keyword-presets] Extracted ${newKws.length} new keywords for "${label}"`);
}

/** Validate and coerce a raw parsed element into a DiscoverScore. Returns null if invalid. */
function coerceDiscoverScore(raw: unknown): DiscoverScore | null {
  if (raw == null || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const keyword = typeof obj.keyword === 'string' ? obj.keyword.trim() : '';
  if (!keyword) return null;
  const score = Number(obj.score);
  const frequency = Number(obj.frequency);
  return {
    keyword,
    score: Number.isFinite(score) ? score : 0,
    frequency: Number.isFinite(frequency) ? frequency : 0,
    ...(typeof obj.source === 'string' ? { source: obj.source } : {}),
  };
}

/** Validate an array of raw parsed elements, returning only valid DiscoverScore items. */
export function validateDiscoverScores(arr: unknown[]): DiscoverScore[] {
  const results: DiscoverScore[] = [];
  for (const item of arr) {
    const coerced = coerceDiscoverScore(item);
    if (coerced) results.push(coerced);
  }
  return results;
}

export type ClassifiedMcpResult =
  | { ok: true; scores: DiscoverScore[] }
  | { ok: false; scores: []; skipReason: string; errorType: KeywordRefreshErrorType };

/** Classify a raw MCP result string into scores or error info. Exported for testability. */
export function classifyMcpResult(result: string): ClassifiedMcpResult {
  // Track the most specific rejection across all candidates
  let lastRejectReason: { reason: string; type: KeywordRefreshErrorType } | null = null;

  /**
   * Try to accept a parsed JSON value as DiscoverScore[].
   * Returns { accepted: true, scores } on success.
   * Returns { accepted: false } and updates lastRejectReason on failure.
   * Special case: returns { accepted: true, scores: [], skipReason, errorType }
   * for error objects that should halt scanning.
   */
  const tryAccept = (parsed: unknown): {
    accepted: true; scores: DiscoverScore[]; skipReason?: string; errorType?: KeywordRefreshErrorType;
  } | { accepted: false } => {
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) {
        lastRejectReason = { reason: 'AI returned empty result', type: 'empty_result' };
        return { accepted: false };
      }
      const valid = validateDiscoverScores(parsed);
      if (valid.length > 0) {
        return { accepted: true, scores: valid };
      }
      lastRejectReason = {
        reason: `Parsed ${parsed.length} elements but no valid DiscoverScore fields`,
        type: 'parse_error',
      };
      return { accepted: false };
    }
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      if (obj.error) {
        // Error response — halt scanning with explicit error
        return {
          accepted: true, scores: [],
          skipReason: `Non-array result (${obj.error})`, errorType: 'non_array',
        };
      }
      lastRejectReason = { reason: 'Non-array result', type: 'non_array' };
      return { accepted: false };
    }
    // Primitive JSON (string, number, boolean, null)
    lastRejectReason = { reason: 'Non-array result (scalar JSON)', type: 'non_array' };
    return { accepted: false };
  };

  // Strategy 1: direct JSON.parse (whole string)
  try {
    const r = tryAccept(JSON.parse(result));
    if (r.accepted) {
      if (r.skipReason || r.errorType) {
        return {
          ok: false,
          scores: [],
          skipReason: r.skipReason ?? 'Non-array result',
          errorType: r.errorType ?? 'unknown',
        };
      }
      return { ok: true, scores: r.scores };
    }
  } catch {
    // Not valid JSON as-is — fall through to candidate scanning
  }

  // Strategy 2: balanced bracket scan — evaluate candidates in text order.
  // This makes earlier error objects win over later arrays, matching "halt on explicit error".
  let scanPos = 0;
  while (scanPos < result.length) {
    const nextArr = result.indexOf('[', scanPos);
    const nextObj = result.indexOf('{', scanPos);
    let idx = -1;
    if (nextArr === -1) idx = nextObj;
    else if (nextObj === -1) idx = nextArr;
    else idx = Math.min(nextArr, nextObj);
    if (idx === -1) break;

    const endIdx = findBalancedJsonEnd(result, idx);
    if (endIdx === -1) {
      scanPos = idx + 1;
      continue;
    }
    try {
      const r = tryAccept(JSON.parse(result.slice(idx, endIdx + 1)));
      if (r.accepted) {
        if (r.skipReason || r.errorType) {
          return {
            ok: false,
            scores: [],
            skipReason: r.skipReason ?? 'Non-array result',
            errorType: r.errorType ?? 'unknown',
          };
        }
        return { ok: true, scores: r.scores };
      }
    } catch { /* try next candidate */ }
    scanPos = idx + 1;
  }

  // No candidate accepted — use most specific rejection or fallback
  if (lastRejectReason) {
    return { ok: false, scores: [], skipReason: lastRejectReason.reason, errorType: lastRejectReason.type };
  }
  return { ok: false, scores: [], skipReason: `JSON parse failed (response length ${result.length})`, errorType: 'parse_error' };
}

/** Extract a balanced JSON value starting from position idx. Returns the end index (inclusive) or -1. */
export function findBalancedJsonEnd(text: string, startIdx: number): number {
  const opener = text[startIdx];
  const closer = opener === '[' ? ']' : '}';
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === opener) depth++;
    if (ch === closer) { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/**
 * Refresh discovered keywords using Hermit Purple MCP discover tool.
 * Updates all presets with new trending keywords.
 */
export async function refreshFromHermitPurple(
  client: Client,
  useAi: boolean = true,
  options?: RefreshFromHermitPurpleOptions,
): Promise<KeywordPresetDTO[]> {
  const db = getAnalysisDatabase();
  const rows = db.prepare('SELECT * FROM keyword_presets ORDER BY id').all() as KeywordPresetRow[];

  // MCP stdio 是單線程串行，每個 preset 依次呼叫
  // 每個 preset: local DB ~1s + AI API ~30-120s，per-call timeout 180s
  // AI影視生成 等大 seed 集的分類需要更長時間
  const PER_CALL_TIMEOUT = options?.perCallTimeoutMs ?? KEYWORD_REFRESH_PER_CALL_TIMEOUT_MS;
  const total = rows.length;
  let completed = 0;
  let succeeded = 0;
  let failed = 0;

  options?.onProgress?.({
    stage: 'starting',
    total,
    completed,
    succeeded,
    failed,
    message: `Preparing to refresh ${total} category keywords`,
  });

  for (const row of rows) {
    options?.onProgress?.({
      stage: 'preset_start',
      total,
      completed,
      succeeded,
      failed,
      category: row.category,
      message: `Refreshing ${row.category}`,
    });

    try {
      console.log(`[keyword-presets] Refreshing "${row.category}"...`);
      const result = await callTool(
        client,
        'discover_trending_keywords',
        {
          category: row.category,
          seed_keywords: row.seed_keywords,
          days: 30,
          top_k: 30,
          use_ai: useAi,
        },
        PER_CALL_TIMEOUT,
      );

      // Parse + classify result (extracted for testability)
      const classified = classifyMcpResult(result);
      let scores: DiscoverScore[] = [];
      let skipReason = '';
      let errorType: KeywordRefreshErrorType | undefined;

      if (classified.ok) {
        scores = classified.scores;
        console.log(`[keyword-presets] ${row.category}: parsed ${scores.length} valid DiscoverScore(s)`);
      } else {
        skipReason = classified.skipReason;
        errorType = classified.errorType;
      }
      if (!classified.ok && classified.errorType === 'parse_error') {
        console.warn(`[keyword-presets] ${row.category}: ${skipReason}, raw length ${result.length}, first 200 chars: ${result.substring(0, 200)}`);
      }

      if (skipReason) {
        console.warn(`[keyword-presets] ${row.category}: ${skipReason}, skipping`);
        completed += 1;
        failed += 1;
        options?.onProgress?.({
          stage: 'preset_failed',
          total,
          completed,
          succeeded,
          failed,
          category: row.category,
          error: skipReason,
          errorType: errorType ?? 'unknown',
          message: `${row.category} skipped: ${skipReason}`,
        });
      } else {
        // Extract discovered keywords
        const discoveredKws = scores.map(s => s.keyword).filter(Boolean);
        const discoveredStr = discoveredKws.join(', ');

        db.prepare(`
          UPDATE keyword_presets
          SET discovered_keywords = ?,
              discover_score_json = ?,
              last_refreshed = datetime('now'),
              updated_at = datetime('now')
          WHERE id = ?
        `).run(discoveredStr, JSON.stringify(scores), row.id);

        mergeKeywords(row.id);
        console.log(`[keyword-presets] ✅ "${row.category}" done (${scores.length} keywords)`);
        completed += 1;
        succeeded += 1;
        options?.onProgress?.({
          stage: 'preset_done',
          total,
          completed,
          succeeded,
          failed,
          category: row.category,
          message: `${row.category} done (${scores.length} keywords)`,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const msgLower = msg.toLowerCase();
      let catchErrorType: KeywordRefreshErrorType = 'unknown';
      if (msgLower.includes('timeout') || msgLower.includes('timed out')) {
        catchErrorType = 'timeout';
      } else if (msgLower.includes('transport') || msgLower.includes('mcp') || msgLower.includes('stdio') || msgLower.includes('econnrefused')) {
        catchErrorType = 'mcp_error';
      } else if (msgLower.includes('api') || msgLower.includes('rate limit') || msgLower.includes('429') || msgLower.includes('401') || msgLower.includes('403')) {
        catchErrorType = 'ai_api_error';
      }
      console.error(`[keyword-presets] ❌ ${row.category} [${catchErrorType}]: ${msg}`);
      completed += 1;
      failed += 1;
      options?.onProgress?.({
        stage: 'preset_failed',
        total,
        completed,
        succeeded,
        failed,
        category: row.category,
        error: msg,
        errorType: catchErrorType,
        message: `${row.category} failed: ${msg}`,
      });
    }
  }

  options?.onProgress?.({
    stage: 'completed',
    total,
    completed,
    succeeded,
    failed,
    message: `Keyword refresh complete (succeeded ${succeeded} / failed ${failed})`,
  });

  return getAllPresets();
}
