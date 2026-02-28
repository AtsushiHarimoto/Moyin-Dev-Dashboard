/**
 * Issues API Routes
 *
 * 安全策略：Issues 為唯讀模組，所有對實際檔案系統的寫入操作已永久屏蔽。
 * 資料僅透過 wiki sync 錄入 DB，不對 workspace/issues/ 目錄做任何變更。
 */
import express from 'express';

const router = express.Router();

const DISABLED_MSG = 'Issues 模組已設為唯讀，不允許對實際檔案進行變更';

/**
 * POST /api/issues/move — 已屏蔽
 */
router.post('/move', (_req, res) => {
  res.status(403).json({ success: false, error: DISABLED_MSG });
});

/**
 * POST /api/issues/commit — 已屏蔽
 */
router.post('/commit', (_req, res) => {
  res.status(403).json({ success: false, error: DISABLED_MSG });
});

export default router;
