import fs from 'fs-extra';
import path from 'path';
import { jobManager } from './job-manager';
import type { BatchPreset } from './job-manager';
import { createHermitPurpleClient, callTool, readResource, acquireSharedClient, destroySharedClient, killSharedTransport } from './mcp-client';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { REPORTS_ROOT } from '../utils.js';
import { sendReport, isEmailConfigured, closeEmailTransport } from '../services/email';
import { getAnalysisDatabase, checkpointAnalysisDatabase } from '../database';
import { extractInsightKeywords } from './keyword-presets';

let activeTransport: StdioClientTransport | null = null;

export function killActiveTransport(): void {
  if (activeTransport) {
    try { activeTransport.close(); } catch { /* ignore */ }
    activeTransport = null;
  }
  killSharedTransport();
}

export interface TrendItem {
  name: string;
  ring: 'adopt' | 'trial' | 'assess' | 'hold';
  quadrant: 'techniques' | 'tools' | 'platforms' | 'languages';
  trendDirection: 'rising' | 'stable' | 'declining';
  confidence: number;
  signal: string;
}

export interface ParsedInsights {
  summary: string;
  items: TrendItem[];
  adopt: string[];
  trial: string[];
  assess: string[];
  hold: string[];
}

const RING_MAP: Record<string, TrendItem['ring']> = {
  'adopt': 'adopt',
  '建議採用': 'adopt',
  'trial': 'trial',
  '值得試驗': 'trial',
  'assess': 'assess',
  '持續觀察': 'assess',
  'hold': 'hold',
  '謹慎觀望': 'hold',
};

const QUADRANT_MAP: Record<string, TrendItem['quadrant']> = {
  'techniques': 'techniques',
  '技術': 'techniques',
  'tools': 'tools',
  '工具': 'tools',
  'platforms': 'platforms',
  '平台': 'platforms',
  'languages': 'languages',
  '語言': 'languages',
};

const TREND_MAP: Record<string, TrendItem['trendDirection']> = {
  '↑ rising': 'rising',
  '↑ 上升': 'rising',
  '→ stable': 'stable',
  '→ 穩定': 'stable',
  '→ 持平': 'stable',
  '↓ declining': 'declining',
  '↓ 下降': 'declining',
  'rising': 'rising',
  'stable': 'stable',
  'declining': 'declining',
};

function detectRingFromHeading(line: string): TrendItem['ring'] | null {
  const lower = line.toLowerCase();
  for (const [keyword, ring] of Object.entries(RING_MAP)) {
    if (lower.includes(keyword.toLowerCase())) return ring;
  }
  return null;
}

function extractAllBacktickTags(lines: string[]): string[] {
  const tags: string[] = [];
  for (const line of lines) {
    const matches = line.matchAll(/`([^`]+)`/g);
    for (const m of matches) {
      tags.push(m[1].trim());
    }
  }
  return tags;
}

export function parseInsightsFromMarkdown(md: string): ParsedInsights {
  const lines = md.split('\n');
  const result: ParsedInsights = {
    summary: '',
    items: [],
    adopt: [],
    trial: [],
    assess: [],
    hold: [],
  };

  // --- Try new Trend Card format first ---
  let currentRing: TrendItem['ring'] | null = null;
  let i = 0;
  let foundTrendCards = false;

  while (i < lines.length) {
    const line = lines[i];

    // Detect ring section from ## or ### headings
    if (/^#{2,3}\s+/.test(line)) {
      const detected = detectRingFromHeading(line);
      if (detected) {
        currentRing = detected;
      } else {
        currentRing = null;
      }
      i++;
      continue;
    }

    // Detect Trend Card: #### [Name](url) `tag` or #### Name
    const cardMatch = line.match(/^####\s+\[([^\]]+)\]/) || line.match(/^####\s+([^`\[\n]+?)\s*(?:`|$)/);
    if (cardMatch && currentRing) {
      foundTrendCards = true;
      const name = cardMatch[1].trim();

      // Collect subsequent lines until next heading; include heading line for inline tags
      const cardLines: string[] = [line];
      i++;
      while (i < lines.length && !/^#{1,4}\s+/.test(lines[i])) {
        cardLines.push(lines[i]);
        i++;
      }

      // Extract quadrant from backtick tags
      const allTags = extractAllBacktickTags(cardLines);
      let quadrant: TrendItem['quadrant'] = 'techniques';
      for (const tag of allTags) {
        const lower = tag.toLowerCase();
        for (const [keyword, q] of Object.entries(QUADRANT_MAP)) {
          if (lower === keyword.toLowerCase()) { quadrant = q; break; }
        }
      }

      // Extract trend direction from backtick tags like `↑ Rising`
      let trendDirection: TrendItem['trendDirection'] = 'stable';
      for (const tag of allTags) {
        const lower = tag.toLowerCase();
        for (const [keyword, td] of Object.entries(TREND_MAP)) {
          if (lower === keyword.toLowerCase()) { trendDirection = td; break; }
        }
      }

      // Extract confidence from backtick tags like `⬤ 0.9`
      let confidence = 0;
      for (const tag of allTags) {
        const confMatch = tag.match(/⬤\s*([\d.]+)/);
        if (confMatch) {
          confidence = parseFloat(confMatch[1]);
          break;
        }
      }

      // Extract signal from **信號**: or **Signal**: line
      let signal = '';
      for (const cl of cardLines) {
        const sigMatch = cl.match(/\*\*(?:信號|Signal)\*\*\s*[:：]\s*(.*)/i);
        if (sigMatch) {
          signal = sigMatch[1].trim();
          break;
        }
      }

      const item: TrendItem = { name, ring: currentRing, quadrant, trendDirection, confidence, signal };
      result.items.push(item);
      result[currentRing].push(name);
      continue;
    }

    i++;
  }

  // --- Fallback: legacy bullet-point format (backward compatibility) ---
  if (!foundTrendCards) {
    let legacySection: '' | 'adopt' | 'trial' | 'assess' | 'hold' | 'drop' = '';
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (/^#{2,3}\s+/.test(line)) {
        if (lower.includes('adopt') || lower.includes('建議採用')) legacySection = 'adopt';
        else if (lower.includes('trial') || lower.includes('值得試驗')) legacySection = 'trial';
        else if (lower.includes('assess') || lower.includes('持續觀察')) legacySection = 'assess';
        else if (lower.includes('hold') || lower.includes('觀望') || lower.includes('謹慎觀望')) legacySection = 'hold';
        else if (lower.includes('drop') || lower.includes('放棄') || lower.includes('淘汰')) legacySection = 'drop';
        else legacySection = '';
        continue;
      }

      const listMatch = line.match(/^[-*]\s+(?:\*\*(.+?)\*\*|([^:–\-]+))[:–\-]?\s*(.*)/);
      if (listMatch && legacySection && legacySection !== 'drop') {
        const name = (listMatch[1] ?? listMatch[2] ?? '').trim();
        if (name) {
          result[legacySection].push(name);
          result.items.push({
            name,
            ring: legacySection,
            quadrant: 'techniques',
            trendDirection: 'stable',
            confidence: 0,
            signal: '',
          });
        }
      }
    }
  }

  // --- Extract summary ---
  let inContent = false;
  for (const line of lines) {
    if (line.startsWith('#')) { inContent = true; continue; }
    if (inContent && line.trim() && !line.startsWith('-') && !line.startsWith('*') && !line.startsWith('|') && !line.startsWith('####')) {
      result.summary = line.trim();
      break;
    }
  }

  return result;
}

interface RunAnalysisOptions {
  client?: Client;
  transport?: StdioClientTransport;
}

export async function runAnalysis(keywords: string, days: number, label: string = '', options?: RunAnalysisOptions): Promise<void> {
  const isShared = Boolean(options?.client);
  let ownTransport: StdioClientTransport | null = null;

  try {
    jobManager.updateStatus('starting', 0, '正在連接 Hermit Purple...', 5);

    let client: Client;
    if (options?.client) {
      client = options.client;
    } else {
      const conn = await createHermitPurpleClient();
      client = conn.client;
      ownTransport = conn.transport;
      activeTransport = conn.transport;
    }

    if (jobManager.isCancelRequested()) {
      jobManager.updateStatus('cancelled', 0, '已取消', 0);
      return;
    }

    // Step 1: Scrape (may take several minutes for web crawling)
    jobManager.updateStatus('step_1_scraping', 1, '正在爬取 AI 趨勢數據...', 10);
    const scrapeResultRaw = await callTool(client, 'scrape_ai_trends', { keywords, days, category: label }, 5 * 60_000);
    let scrapeCount = 0;
    try {
      const scrapeResult = JSON.parse(scrapeResultRaw);
      if (!scrapeResult.ok) {
        throw new Error(scrapeResult.error || 'scrape_ai_trends returned failure');
      }
      scrapeCount = scrapeResult.data?.scraped ?? 0;
    } catch (parseErr) {
      if (parseErr instanceof SyntaxError) {
        throw new Error(`scrape_ai_trends result parse failed: ${scrapeResultRaw}`);
      }
      throw parseErr;
    }
    jobManager.updateJobData({ scrapeCount });
    jobManager.updateStatus('step_1_scraping', 1, `爬取完成: ${scrapeCount} 項`, 33);

    if (jobManager.isCancelRequested()) {
      jobManager.updateStatus('cancelled', 1, '已在爬取後取消', 33);
      return;
    }

    // Step 2: Audit (AI processing may take a while)
    jobManager.updateStatus('step_2_auditing', 2, '正在 AI 審計...', 40);
    const auditResultRaw = await callTool(client, 'run_ai_curator', { batch_size: 10 }, 5 * 60_000);
    let auditSucceeded = 0;
    let auditAttempted = 0;
    let auditFailed = 0;
    try {
      const auditResult = JSON.parse(auditResultRaw);
      if (!auditResult.ok) {
        throw new Error(auditResult.error || 'run_ai_curator returned failure');
      }
      auditSucceeded = auditResult.data?.succeeded ?? 0;
      auditAttempted = auditResult.data?.attempted ?? 0;
      auditFailed = auditResult.data?.failed ?? 0;
    } catch (parseErr) {
      if (parseErr instanceof SyntaxError) {
        throw new Error(`run_ai_curator result parse failed: ${auditResultRaw}`);
      }
      throw parseErr;
    }
    jobManager.updateJobData({ auditCount: auditAttempted, auditSucceeded, auditFailed });
    jobManager.updateStatus('step_2_auditing', 2, `審計完成: ${auditSucceeded}/${auditAttempted} 成功`, 66);

    if (jobManager.isCancelRequested()) {
      jobManager.updateStatus('cancelled', 2, '已在審計後取消', 66);
      return;
    }

    // Step 3: Generate Report
    jobManager.updateStatus('step_3_reporting', 3, '正在生成報告...', 70);
    const reportGenResultRaw = await callTool(
      client,
      'generate_weekly_report',
      { keywords, report_title: label || 'AI 趨勢週報' },
      5 * 60_000,
    );
    try {
      const reportGenResult = JSON.parse(reportGenResultRaw);
      if (!reportGenResult.ok) {
        throw new Error(reportGenResult.error || 'generate_weekly_report returned failure');
      }
    } catch (parseErr) {
      if (parseErr instanceof SyntaxError) {
        throw new Error(`generate_weekly_report result parse failed: ${reportGenResultRaw}`);
      }
      throw parseErr;
    }
    jobManager.updateStatus('step_3_reporting', 3, '正在讀取報告結果...', 90);

    let reportMd: string | null = await readResource(client, 'hermit://reports/latest');
    const insights = parseInsightsFromMarkdown(reportMd);
    jobManager.updateJobData({
      reportMd,
      insightsJson: JSON.stringify(insights),
    });

    // Write report file separately — a write failure should not mask a successful analysis
    try {
      const now = new Date();
      const ts = now.toISOString().replace(/[-:T]/g, '').slice(0, 8) + '_' + now.toISOString().slice(11, 16).replace(':', '');
      const safeLabel = label ? '_' + label.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '').slice(0, 30) : '';
      const reportFileName = `analysis${safeLabel}_${ts}.md`;
      await fs.ensureDir(REPORTS_ROOT);
      await fs.writeFile(path.join(REPORTS_ROOT, reportFileName), reportMd, 'utf8');
    } catch (writeErr) {
      const msg = writeErr instanceof Error ? writeErr.message : String(writeErr);
      console.error(`[runner] Failed to write report file: ${msg}`);
    }

    // Release large report string after persisting to DB + disk
    reportMd = null;

    // Auto-extract trending keywords from insights into keyword_presets
    if (label && insights.items.length > 0) {
      try {
        extractInsightKeywords(insights.items, label);
      } catch (extractErr) {
        console.error('[runner] extractInsightKeywords failed:', extractErr);
      }
    }

    jobManager.updateStatus('completed', 3, '分析完成', 100);
  } catch (error) {
    if (jobManager.isCancelRequested()) {
      jobManager.updateStatus('cancelled', 0, '已取消', 0);
    } else {
      const msg = error instanceof Error ? error.message : String(error);
      jobManager.failJob(msg);
    }
  } finally {
    // Only close transport if we own it (standalone mode)
    if (!isShared && ownTransport) {
      try { await ownTransport.close(); } catch { /* ignore */ }
      activeTransport = null;
    }
  }
}

function batchCooldown(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      try { (globalThis as any).gc?.(); } catch { /* --expose-gc not set, ignore */ }
      resolve();
    }, 3_000);
  });
}

export async function runBatchAnalysis(presets: BatchPreset[]): Promise<void> {
  jobManager.startBatch(presets);

  let shared: { client: Client; transport: StdioClientTransport } | null = null;

  try {
    // Acquire a single MCP subprocess for the entire batch
    shared = await acquireSharedClient();
    console.log('[Batch] Shared MCP client acquired — reusing for all items');

    let itemIndex = 0;
    while (true) {
      if (jobManager.isBatchCancelRequested) break;

      const next = jobManager.advanceBatch();
      if (!next) break;

      try {
        const job = jobManager.createJob(next.keywords, next.days, next.label, true);
        await runAnalysis(job.keywords, job.days, job.label, {
          client: shared.client,
          transport: shared.transport,
        });

        // runAnalysis() swallows exceptions internally — check job status to detect failure
        if (job.status === 'failed') {
          console.error(`[Batch] Analysis internally failed for ${next.label}`);
          jobManager.failBatchItem(next.label);

          // Rebuild shared subprocess on internal failure
          try {
            await destroySharedClient();
            shared = await acquireSharedClient();
            console.log('[Batch] Shared MCP client rebuilt after failure');
          } catch (rebuildErr) {
            console.error('[Batch] Failed to rebuild MCP client, aborting batch:', rebuildErr);
            break;
          }
        } else if (job.status === 'cancelled') {
          jobManager.failBatchItem(next.label);
        } else {
          let emailed = false;
          if (isEmailConfigured()) {
            try {
              const db = getAnalysisDatabase();
              let row = db.prepare(
                `SELECT report_md FROM analysis_jobs WHERE id = ? AND report_md IS NOT NULL`
              ).get(job.id) as { report_md: string } | undefined;
              if (row?.report_md) {
                await sendReport(next.label, row.report_md);
                emailed = true;
              }
              // Release DB row memory
              row = undefined;
            } catch (emailErr) {
              console.error(`[Batch] Email failed for ${next.label}:`, emailErr);
            }
          }

          jobManager.completeBatchItem(next.label, emailed);
        }
      } catch (err) {
        console.error(`[Batch] Analysis failed for ${next.label}:`, err);
        jobManager.failBatchItem(next.label);

        // Rebuild shared subprocess on failure so remaining items can continue
        try {
          await destroySharedClient();
          shared = await acquireSharedClient();
          console.log('[Batch] Shared MCP client rebuilt after failure');
        } catch (rebuildErr) {
          console.error('[Batch] Failed to rebuild MCP client, aborting batch:', rebuildErr);
          break;
        }
      }

      // WAL checkpoint after each item
      checkpointAnalysisDatabase();

      // Cooldown between items (skip after last)
      itemIndex++;
      if (itemIndex < presets.length && !jobManager.isBatchCancelRequested) {
        await batchCooldown();
      }
    }
  } catch (err) {
    console.error('[Batch] Fatal batch error:', err);
  } finally {
    await destroySharedClient();
    closeEmailTransport();
    // Ensure batch state converges — if still running (e.g. acquireSharedClient failed before loop)
    if (jobManager.isBatchRunning) {
      // Drain remaining queue items as failed
      let remaining: BatchPreset | null;
      while ((remaining = jobManager.advanceBatch()) !== null) {
        jobManager.failBatchItem(remaining.label);
      }
    }
    console.log('[Batch] Shared MCP client + email transport released');
  }
}
