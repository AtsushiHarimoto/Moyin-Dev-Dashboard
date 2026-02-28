import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import { WORKSPACE_ROOT } from '../utils';

const router = express.Router();

const PROJECT_MEMORY_PATH = path.join(WORKSPACE_ROOT, 'workspace', '.context', 'PROJECT_MEMORY.md');

/**
 * GET /api/progress
 * 讀取 PROJECT_MEMORY.md 內容
 */
router.get('/', async (req, res) => {
  try {
    if (!await fs.pathExists(PROJECT_MEMORY_PATH)) {
      return res.status(404).json({ success: false, error: 'PROJECT_MEMORY.md not found' });
    }

    const content = await fs.readFile(PROJECT_MEMORY_PATH, 'utf8');
    const stat = await fs.stat(PROJECT_MEMORY_PATH);

    res.json({
      success: true,
      data: {
        content,
        name: 'PROJECT_MEMORY.md',
        updatedAt: stat.mtime.toISOString(),
        size: stat.size,
      },
    });
  } catch (error) {
    console.error('Progress read error:', error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;
