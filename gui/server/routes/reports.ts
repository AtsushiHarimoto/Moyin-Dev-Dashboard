import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import { markReportAsRead, getAllReadReportIds } from '../database.js';
import { parseInsightsFromMarkdown } from '../analysis/runner.js';
import { REPORTS_ROOT } from '../utils.js';

const router = express.Router();
const ARCHIVE_ROOT = path.join(REPORTS_ROOT, '_archive');

interface ReportListItem {
  id: string;
  name: string;
  relativePath: string;
  ext: string;
  size: number;
  updatedAt: string;
  archived: boolean;
  isRead: boolean;
  snippet: string;
}

function encodeReportId(relativePath: string): string {
  return Buffer.from(relativePath, 'utf8').toString('base64url');
}

function decodeReportId(id: string): string {
  return Buffer.from(id, 'base64url').toString('utf8');
}

function toPosixPath(p: string): string {
  return p.split(path.sep).join('/');
}

function isInsideDirectory(target: string, baseDir: string): boolean {
  let normalizedBase = path.resolve(baseDir);
  let normalizedTarget = path.resolve(target);
  if (process.platform === 'win32') {
    normalizedBase = normalizedBase.toLowerCase();
    normalizedTarget = normalizedTarget.toLowerCase();
  }
  return normalizedTarget === normalizedBase || normalizedTarget.startsWith(`${normalizedBase}${path.sep}`);
}

const SNIPPET_LENGTH = 1500;

async function readSnippet(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return content.slice(0, SNIPPET_LENGTH);
  } catch {
    return '';
  }
}

async function collectReportsFromDir(baseDir: string, archived: boolean): Promise<Omit<ReportListItem, 'isRead'>[]> {
  if (!await fs.pathExists(baseDir)) {
    return [];
  }

  const files: Omit<ReportListItem, 'isRead'>[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!archived && fullPath === ARCHIVE_ROOT) {
          continue;
        }
        await walk(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;

      const stat = await fs.stat(fullPath);
      const relativePath = toPosixPath(path.relative(REPORTS_ROOT, fullPath));
      const snippet = await readSnippet(fullPath);

      files.push({
        id: encodeReportId(relativePath),
        name: entry.name,
        relativePath,
        ext: path.extname(entry.name).toLowerCase(),
        size: stat.size,
        updatedAt: stat.mtime.toISOString(),
        archived,
        snippet,
      });
    }
  }

  await walk(baseDir);

  return files;
}

router.get('/', async (req, res) => {
  try {
    const archived = req.query.archived === 'true';
    const baseDir = archived ? ARCHIVE_ROOT : REPORTS_ROOT;
    const items = await collectReportsFromDir(baseDir, archived);

    // Get read statuses
    const readReportIds = getAllReadReportIds();
    const itemsWithReadStatus = items.map(item => ({
      ...item,
      isRead: readReportIds.has(item.id),
    }));

    // Sort: unread first, then by date
    const sortedItems = itemsWithReadStatus.sort((a, b) => {
      if (a.isRead !== b.isRead) {
        return a.isRead ? 1 : -1; // unread first
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });

    res.json({
      success: true,
      data: sortedItems,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const relativePath = decodeReportId(req.params.id);
    const fullPath = path.resolve(REPORTS_ROOT, relativePath);

    if (!isInsideDirectory(fullPath, REPORTS_ROOT)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid report path',
      });
    }

    if (!await fs.pathExists(fullPath)) {
      return res.status(404).json({
        success: false,
        error: 'Report not found',
      });
    }

    const stat = await fs.stat(fullPath);
    const archived = isInsideDirectory(fullPath, ARCHIVE_ROOT);
    const content = await fs.readFile(fullPath, 'utf8');
    const ext = path.extname(fullPath).toLowerCase();

    // Parse insights from markdown reports
    let insights = null;
    if (ext === '.md') {
      try {
        const parsed = parseInsightsFromMarkdown(content);
        const hasContent = [parsed.items, parsed.adopt, parsed.trial, parsed.assess, parsed.hold].some(arr => arr.length > 0);
        if (hasContent) {
          insights = parsed;
        }
      } catch { /* ignore parse errors */ }
    }

    res.json({
      success: true,
      data: {
        id: req.params.id,
        name: path.basename(fullPath),
        relativePath: toPosixPath(path.relative(REPORTS_ROOT, fullPath)),
        ext,
        size: stat.size,
        updatedAt: stat.mtime.toISOString(),
        archived,
        content,
        insights,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Delete report
router.delete('/:id', async (req, res) => {
  try {
    const relativePath = decodeReportId(req.params.id);
    const fullPath = path.resolve(REPORTS_ROOT, relativePath);

    if (!isInsideDirectory(fullPath, REPORTS_ROOT)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid report path',
      });
    }

    if (!await fs.pathExists(fullPath)) {
      return res.status(404).json({
        success: false,
        error: 'Report not found',
      });
    }

    await fs.remove(fullPath);

    res.json({
      success: true,
      data: { reportId: req.params.id, deletedAt: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Mark report as read
router.post('/:id/read', async (req, res) => {
  try {
    const reportId = req.params.id;
    markReportAsRead(reportId);

    res.json({
      success: true,
      data: { reportId, readAt: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
