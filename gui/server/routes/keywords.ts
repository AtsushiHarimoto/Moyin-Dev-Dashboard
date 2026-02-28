import express from 'express';
import {
  getAllPresets,
  updateSeedKeywords,
  createPreset,
  deletePreset,
} from '../analysis/keyword-presets';
import { startKeywordRefreshJob } from '../analysis/keyword-refresh-runner';
import { keywordRefreshJobManager } from '../analysis/keyword-refresh-job-manager';
import { sendError } from '../utils';

const router = express.Router();

// GET /api/keywords — list all presets
router.get('/', (_req, res) => {
  try {
    const presets = getAllPresets();
    res.json({ success: true, data: presets });
  } catch (error) {
    sendError(res, error);
  }
});

// GET /api/keywords/refresh/status — get active or latest refresh job
router.get('/refresh/status', (_req, res) => {
  try {
    const job = keywordRefreshJobManager.getCurrentOrLatest();
    res.json({ success: true, data: job });
  } catch (error) {
    sendError(res, error);
  }
});

// GET /api/keywords/refresh/:jobId — get specific refresh job
router.get('/refresh/:jobId', (req, res) => {
  try {
    const jobId = String(req.params.jobId || '');
    const job = keywordRefreshJobManager.getJob(jobId);
    if (!job) {
      res.status(404).json({ success: false, error: 'refresh_job_not_found' });
      return;
    }
    res.json({ success: true, data: job });
  } catch (error) {
    sendError(res, error);
  }
});

// POST /api/keywords/refresh — trigger trending keyword discovery (background job)
router.post('/refresh', (req, res) => {
  try {
    const useAi = req.body?.useAi !== false; // default true
    const { job, existing } = startKeywordRefreshJob(useAi);
    res.status(202).json({
      success: true,
      data: {
        ...job,
        existing,
      },
    });
  } catch (error) {
    sendError(res, error);
  }
});

// PUT /api/keywords/:id — edit seed keywords
router.put('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'invalid_id' });
      return;
    }

    const keywords = String(req.body?.keywords || '').slice(0, 5000);
    if (!keywords.trim()) {
      res.status(400).json({ success: false, error: 'keywords_required' });
      return;
    }

    // Check preset exists before updating
    const existing = getAllPresets().find(p => p.id === id);
    if (!existing) {
      res.status(404).json({ success: false, error: 'preset_not_found' });
      return;
    }

    updateSeedKeywords(id, keywords);
    const updated = getAllPresets().find(p => p.id === id);
    res.json({ success: true, data: updated });
  } catch (error) {
    sendError(res, error);
  }
});

// POST /api/keywords — create new custom preset
router.post('/', (req, res) => {
  try {
    const category = String(req.body?.category || '').trim().slice(0, 100);
    const icon = String(req.body?.icon || '🏷️').slice(0, 4);
    const keywords = String(req.body?.keywords || '').slice(0, 5000);

    if (!category) {
      res.status(400).json({ success: false, error: 'category_required' });
      return;
    }
    if (!keywords.trim()) {
      res.status(400).json({ success: false, error: 'keywords_required' });
      return;
    }

    const preset = createPreset(category, icon, keywords);
    res.json({ success: true, data: preset });
  } catch (error) {
    // Handle UNIQUE constraint violation
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('UNIQUE')) {
      res.status(409).json({ success: false, error: 'category_exists' });
      return;
    }
    sendError(res, error);
  }
});

// DELETE /api/keywords/:id — delete non-builtin preset
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'invalid_id' });
      return;
    }

    const result = deletePreset(id);
    if (result === 'not_found') {
      res.status(404).json({ success: false, error: 'preset_not_found' });
      return;
    }
    if (result === 'builtin') {
      res.status(403).json({ success: false, error: 'cannot_delete_builtin' });
      return;
    }

    res.json({ success: true, data: { id } });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
