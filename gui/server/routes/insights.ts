import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

const router = express.Router();

const USAGE_DATA_DIR = path.join(os.homedir(), '.claude', 'usage-data');
const ARCHIVE_DIR = path.join(USAGE_DATA_DIR, 'archive');

interface InsightsListItem {
  id: string;
  name: string;
  generatedAt: string;
  size: number;
  isCurrent: boolean;
}

// Auto-archive: if report.html exists and differs from the latest archive, copy it
async function autoArchive(): Promise<void> {
  const reportPath = path.join(USAGE_DATA_DIR, 'report.html');
  if (!await fs.pathExists(reportPath)) return;

  await fs.ensureDir(ARCHIVE_DIR);
  const stat = await fs.stat(reportPath);
  const content = await fs.readFile(reportPath, 'utf8');

  // Check if latest archive has same content (by size + mtime day)
  const archives = await getArchiveFiles();
  if (archives.length > 0) {
    const latest = archives[0];
    const latestPath = path.join(ARCHIVE_DIR, latest.name);
    const latestStat = await fs.stat(latestPath);
    // Same size and same day → skip
    if (latestStat.size === stat.size && latestStat.mtime.toDateString() === stat.mtime.toDateString()) {
      return;
    }
  }

  // Archive with timestamp
  const ts = stat.mtime.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const archiveName = `insights_${ts}.html`;
  const archivePath = path.join(ARCHIVE_DIR, archiveName);
  if (!await fs.pathExists(archivePath)) {
    await fs.writeFile(archivePath, content, 'utf8');
  }
}

async function getArchiveFiles(): Promise<Array<{ name: string; mtime: Date; size: number }>> {
  if (!await fs.pathExists(ARCHIVE_DIR)) return [];
  const entries = await fs.readdir(ARCHIVE_DIR, { withFileTypes: true });
  const files: Array<{ name: string; mtime: Date; size: number }> = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.html')) continue;
    const stat = await fs.stat(path.join(ARCHIVE_DIR, entry.name));
    files.push({ name: entry.name, mtime: stat.mtime, size: stat.size });
  }
  // Sort newest first
  files.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  return files;
}

// GET /api/insights/list — list all reports (current + archived)
router.get('/list', async (_req, res) => {
  try {
    // Auto-archive before listing
    await autoArchive();

    const items: InsightsListItem[] = [];
    const reportPath = path.join(USAGE_DATA_DIR, 'report.html');

    if (await fs.pathExists(reportPath)) {
      const stat = await fs.stat(reportPath);
      items.push({
        id: 'current',
        name: '最新報告',
        generatedAt: stat.mtime.toISOString(),
        size: stat.size,
        isCurrent: true,
      });
    }

    const archives = await getArchiveFiles();
    for (const file of archives) {
      items.push({
        id: file.name,
        name: file.name.replace('.html', ''),
        generatedAt: file.mtime.toISOString(),
        size: file.size,
        isCurrent: false,
      });
    }

    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// GET /api/insights/report/:id — return a specific report HTML
router.get('/report/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let filePath: string;

    if (id === 'current') {
      filePath = path.join(USAGE_DATA_DIR, 'report.html');
    } else {
      // Validate path traversal via resolve + prefix check
      const resolvedPath = path.resolve(ARCHIVE_DIR, id);
      if (!resolvedPath.startsWith(path.resolve(ARCHIVE_DIR) + path.sep)) {
        return res.status(400).json({ success: false, error: 'Invalid report ID' });
      }
      filePath = resolvedPath;
    }

    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    const stat = await fs.stat(filePath);
    const html = await fs.readFile(filePath, 'utf8');

    res.json({
      success: true,
      data: {
        html,
        generatedAt: stat.mtime.toISOString(),
        size: stat.size,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;
