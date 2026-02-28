/**
 * Dashboard API Routes
 * Aggregates statistics from Skills, Sessions, Reports, Issues, and Wiki
 */

import express from 'express';
import path from 'path';
import { getSessionsDatabase, getSkillsDatabase, getWikiDatabase, getAllReadReportIds } from '../database';
import fs from 'fs-extra';
import { WORKSPACE_ROOT, REPORTS_ROOT, encodePath } from '../utils';

const router = express.Router();
const PROFILES_DIR = path.join(WORKSPACE_ROOT, 'tools', 'skills-switch', 'profiles');

/**
 * GET /api/dashboard/stats
 * Returns aggregated statistics for all modules
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = {
      system: getSystemStats(),
      skills: await getSkillsStats(),
      sessions: getSessionsStats(),
      reports: await getReportsStats(),
      issues: getIssuesStats(),
      wiki: getWikiStats(),
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * System health status
 */
function getSystemStats() {
  const sessionsDb = getSessionsDatabase();
  const skillsDb = getSkillsDatabase();
  const wikiDb = getWikiDatabase();

  return {
    status: 'healthy',
    databases: {
      sessions: !!sessionsDb,
      skills: !!skillsDb,
      wiki: !!wikiDb,
    },
    uptime: process.uptime(),
  };
}

/**
 * Skills statistics - by profile
 */
async function getSkillsStats() {
  const db = getSkillsDatabase();

  // Total skills
  const totalSkills = db.prepare('SELECT COUNT(*) as count FROM skills').get() as { count: number };

  // Read all profiles and count skills in each
  const byProfile: Record<string, number> = {};
  let totalEnabled = 0;

  try {
    if (await fs.pathExists(PROFILES_DIR)) {
      const files = await fs.readdir(PROFILES_DIR);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      for (const file of jsonFiles) {
        const profilePath = path.join(PROFILES_DIR, file);
        try {
          const profileData = await fs.readJson(profilePath);
          const profileName = path.basename(file, '.json');

          // Handle different profile formats
          if (profileData && profileData.skills) {
            let skillCount = 0;

            // Array format (most profiles)
            if (Array.isArray(profileData.skills)) {
              skillCount = profileData.skills.length;
            }
            // Object format (common.json with all/cx/cc/anti)
            else if (typeof profileData.skills === 'object') {
              // Skip common.json from byProfile display
              continue;
            }

            byProfile[profileName] = skillCount;
            totalEnabled += skillCount;
          }
        } catch (err) {
          console.warn(`Failed to read profile ${file}:`, err);
        }
      }
    }
  } catch (error) {
    console.warn('Failed to read profiles directory:', error);
  }

  return {
    total: totalSkills.count,
    enabled: totalEnabled,
    byProfile,
  };
}

/**
 * Sessions statistics
 */
function getSessionsStats() {
  const db = getSessionsDatabase();

  const totalSessions = db.prepare('SELECT COUNT(*) as count FROM claude_sessions_win').get() as { count: number };
  const totalMessages = db.prepare('SELECT COUNT(*) as count FROM claude_messages_win').get() as { count: number };

  // Sessions in last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const recentSessions = db.prepare(`
    SELECT COUNT(*) as count
    FROM claude_sessions_win
    WHERE created_at >= ?
  `).get(sevenDaysAgo) as { count: number };

  // Daily trend (last 7 days)
  const dailyTrend = db.prepare(`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM claude_sessions_win
    WHERE created_at >= ?
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `).all(sevenDaysAgo) as Array<{ date: string; count: number }>;

  return {
    totalSessions: totalSessions.count,
    totalMessages: totalMessages.count,
    thisWeek: recentSessions.count,
    trend: dailyTrend.map(d => d.count),
  };
}

/**
 * Reports statistics
 */
async function getReportsStats() {
  if (!await fs.pathExists(REPORTS_ROOT)) {
    return { total: 0, unread: 0, latest: null };
  }

  // 遞歸掃描 REPORTS_ROOT（跳過 _archive），與 reports.ts 保持一致
  const allReports: Array<{ name: string; updatedAt: Date; path: string }> = [];
  const archiveDir = path.join(REPORTS_ROOT, '_archive');

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (fullPath === archiveDir) continue;
        await walk(fullPath);
        continue;
      }
      // 收集所有檔案類型，與 reports.ts 的 collectReportsFromDir 保持一致
      if (!entry.isFile()) continue;
      const stat = await fs.stat(fullPath);
      allReports.push({ name: entry.name, updatedAt: stat.mtime, path: fullPath });
    }
  }
  await walk(REPORTS_ROOT);

  // 使用 database 模組的 getAllReadReportIds，避免重複內聯 SQL
  const readSet = getAllReadReportIds();

  // 使用 utils.encodePath 編碼 ID，與 reports.ts 的 encodeReportId 邏輯一致
  const unreadCount = allReports.filter(r => {
    const relativePath = path.relative(REPORTS_ROOT, r.path).split(path.sep).join('/');
    return !readSet.has(encodePath(relativePath));
  }).length;

  // Latest report
  const latest = allReports.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];

  return {
    total: allReports.length,
    unread: unreadCount,
    latest: latest ? {
      name: latest.name,
      updatedAt: latest.updatedAt.toISOString(),
    } : null,
  };
}

/**
 * Issues statistics
 */
function getIssuesStats() {
  const db = getWikiDatabase();

  const todo = db.prepare('SELECT COUNT(*) as count FROM wiki_projects WHERE category = ?').get('TODO') as { count: number };
  const doing = db.prepare('SELECT COUNT(*) as count FROM wiki_projects WHERE category = ?').get('DOING') as { count: number };
  const done = db.prepare('SELECT COUNT(*) as count FROM wiki_projects WHERE category = ?').get('DONE') as { count: number };

  // Recently moved tasks (last 24 hours)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recentlyMoved = db.prepare(`
    SELECT COUNT(*) as count
    FROM wiki_projects
    WHERE category IN ('TODO', 'DOING', 'DONE') AND updated_at >= ?
  `).get(oneDayAgo) as { count: number };

  return {
    todo: todo.count,
    doing: doing.count,
    done: done.count,
    recentlyMoved: recentlyMoved.count,
  };
}

/**
 * Wiki statistics
 */
function getWikiStats() {
  const db = getWikiDatabase();

  const projects = db.prepare('SELECT COUNT(*) as count FROM wiki_projects WHERE category = ?').get('projects') as { count: number };
  const knowledge = db.prepare('SELECT COUNT(*) as count FROM wiki_projects WHERE category = ?').get('knowledge') as { count: number };
  const skillsDocs = db.prepare('SELECT COUNT(*) as count FROM wiki_projects WHERE category = ?').get('skills-all') as { count: number };

  // Recently updated files
  const recentFiles = db.prepare(`
    SELECT name, last_modified
    FROM wiki_files
    ORDER BY last_modified DESC
    LIMIT 5
  `).all() as Array<{ name: string; last_modified: string }>;

  return {
    projects: projects.count,
    knowledge: knowledge.count,
    skillsDocs: skillsDocs.count,
    recentUpdates: recentFiles.map(f => ({
      name: f.name,
      updatedAt: f.last_modified,
    })),
  };
}

export default router;
