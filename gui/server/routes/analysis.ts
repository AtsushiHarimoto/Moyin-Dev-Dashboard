import express from 'express';
import { jobManager } from '../analysis/job-manager';
import { runAnalysis, runBatchAnalysis, killActiveTransport } from '../analysis/runner';
import { sendError } from '../utils';
import type { AnalysisEvent } from '../analysis/job-manager';

const router = express.Router();

// POST /api/analysis/start
router.post('/start', (req, res) => {
  try {
    const keywords = String(req.body?.keywords || 'ai agent, mcp, claude code').slice(0, 500);
    const days = Math.max(1, Math.min(30, Number(req.body?.days) || 3));
    const label = String(req.body?.label || '').slice(0, 100);

    if (jobManager.isRunning) {
      res.status(409).json({
        success: false,
        error: 'analysis_running',
        data: { jobId: jobManager.activeJobId },
      });
      return;
    }

    const job = jobManager.createJob(keywords, days, label);
    runAnalysis(job.keywords, job.days, job.label).catch((err) => {
      console.error('[Analysis] unhandled error:', err);
    });

    res.json({
      success: true,
      data: { jobId: job.id, status: 'starting' },
    });
  } catch (error) {
    sendError(res, error);
  }
});

// GET /api/analysis/status (SSE)
router.get('/status', (req, res) => {
  const onEvent = (event: AnalysisEvent) => {
    res.write(`data: ${JSON.stringify({ type: 'progress', ...event })}\n\n`);
  };

  if (!jobManager.addClient(onEvent)) {
    res.status(503).json({ success: false, error: 'too_many_clients' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (jobManager.activeJobId) {
    res.write(`data: ${JSON.stringify({ type: 'connected', jobId: jobManager.activeJobId })}\n\n`);
  } else {
    res.write(`data: ${JSON.stringify({ type: 'idle' })}\n\n`);
  }

  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    jobManager.removeClient(onEvent);
  });
});

// DELETE /api/analysis/cancel
router.delete('/cancel', (_req, res) => {
  const jobId = jobManager.requestCancel();
  if (!jobId) {
    res.status(404).json({ success: false, error: 'no_active_job' });
    return;
  }

  killActiveTransport();

  res.json({
    success: true,
    data: { jobId, status: 'cancelled' },
  });
});

// POST /api/analysis/batch-start
router.post('/batch-start', (req, res) => {
  try {
    if (jobManager.isRunning || jobManager.isBatchRunning) {
      res.status(409).json({ success: false, error: 'analysis_running' });
      return;
    }

    const days = Math.max(1, Math.min(30, Number(req.body?.days) || 7));
    const presets = req.body?.presets;

    if (!Array.isArray(presets) || presets.length === 0) {
      res.status(400).json({ success: false, error: 'presets_required' });
      return;
    }

    const validated = presets.slice(0, 10).map((p: unknown) => {
      const item = p as { label?: string; keywords?: string };
      return {
        label: String(item.label || '').slice(0, 100),
        keywords: String(item.keywords || '').slice(0, 500),
        days,
      };
    });

    runBatchAnalysis(validated).catch((err) => {
      console.error('[Batch] unhandled error:', err);
    });

    res.json({
      success: true,
      data: { total: validated.length, status: 'starting' },
    });
  } catch (error) {
    sendError(res, error);
  }
});

// DELETE /api/analysis/batch-cancel
router.delete('/batch-cancel', (_req, res) => {
  if (!jobManager.isBatchRunning) {
    res.status(404).json({ success: false, error: 'no_active_batch' });
    return;
  }

  killActiveTransport();
  jobManager.cancelBatch();

  res.json({ success: true, data: { status: 'cancelled' } });
});

// GET /api/analysis/reports
router.get('/reports', (_req, res) => {
  try {
    const jobs = jobManager.getLatestJobs(50);
    res.json({ success: true, data: jobs });
  } catch (error) {
    sendError(res, error);
  }
});

// GET /api/analysis/latest-insights
router.get('/latest-insights', (_req, res) => {
  try {
    const insights = jobManager.getLatestInsights();
    res.json({ success: true, data: insights });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
