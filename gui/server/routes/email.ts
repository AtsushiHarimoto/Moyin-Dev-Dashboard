import express from 'express';
import { getEmailStatus, sendTestEmail } from '../services/email';
import { sendError } from '../utils';

const router = express.Router();

// GET /api/email/status
router.get('/status', (_req, res) => {
  res.json({ success: true, data: getEmailStatus() });
});

// POST /api/email/test
router.post('/test', async (_req, res) => {
  try {
    await sendTestEmail();
    res.json({ success: true, data: { message: '測試郵件已發送' } });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
