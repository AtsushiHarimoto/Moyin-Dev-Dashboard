import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import { getWikiDatabase } from '../database';
import { WORKSPACE_ROOT, encodePath } from '../utils';

const router = express.Router();

// 定義文檔根目錄
const KNOWLEDGE_ROOT = path.join(WORKSPACE_ROOT, 'workspace', 'knowledge', '00_projects');
const KNOWLEDGE_BASE_ROOT = path.join(WORKSPACE_ROOT, 'workspace', 'knowledge');
const TOOLS_ROOT = path.join(WORKSPACE_ROOT, 'tools');
const ISSUES_ROOT = path.join(WORKSPACE_ROOT, 'workspace', 'issues');
const SKILLS_ALL_ROOT = path.join(WORKSPACE_ROOT, '.agent', 'skills-all');

console.log('📚 Wiki System Paths:');
console.log('   Root:', WORKSPACE_ROOT);
console.log('   Knowledge:', KNOWLEDGE_ROOT);
console.log('   Knowledge Base:', KNOWLEDGE_BASE_ROOT);
console.log('   Tools:', TOOLS_ROOT);
console.log('   Issues:', ISSUES_ROOT);
console.log('   Skills:', SKILLS_ALL_ROOT);

function isSafePath(targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  const normalizedKnowledge = path.resolve(KNOWLEDGE_ROOT);
  const normalizedKnowledgeBase = path.resolve(KNOWLEDGE_BASE_ROOT);
  const normalizedTools = path.resolve(TOOLS_ROOT);
  const normalizedIssues = path.resolve(ISSUES_ROOT);
  const normalizedSkillsAll = path.resolve(SKILLS_ALL_ROOT);
  return (
    resolved === normalizedKnowledge ||
    resolved.startsWith(`${normalizedKnowledge}${path.sep}`) ||
    resolved === normalizedKnowledgeBase ||
    resolved.startsWith(`${normalizedKnowledgeBase}${path.sep}`) ||
    resolved === normalizedTools ||
    resolved.startsWith(`${normalizedTools}${path.sep}`) ||
    resolved === normalizedIssues ||
    resolved.startsWith(`${normalizedIssues}${path.sep}`) ||
    resolved === normalizedSkillsAll ||
    resolved.startsWith(`${normalizedSkillsAll}${path.sep}`)
  );
}

// ========== Sync Logic ==========

async function syncWiki(): Promise<{ projects: number; files: number }> {
  const db = getWikiDatabase();

  // Phase 1: Scan filesystem and collect all data into arrays
  const projectRows: Array<[string, string, string, string, string]> = [];
  const fileRows: Array<[string, string, string, string, string, number, string]> = [];

  // Helper for recursive scan
  async function scanFiles(currentDir: string, projectId: string, rootDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
        const fullEntryPath = path.join(currentDir, entry.name);
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') continue;

        if (entry.isDirectory()) {
            await scanFiles(fullEntryPath, projectId, rootDir);
        } else if (entry.name.endsWith('.md')) {
            const stat = await fs.stat(fullEntryPath);
            const relativePath = path.relative(rootDir, fullEntryPath);
            const fileId = encodePath(fullEntryPath);
            fileRows.push([fileId, projectId, entry.name, relativePath, fullEntryPath, stat.size, stat.mtime.toISOString()]);
        }
    }
  }

  // 1. Scan 00_projects
  if (await fs.pathExists(KNOWLEDGE_ROOT)) {
    const entries = await fs.readdir(KNOWLEDGE_ROOT, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        const fullPath = path.join(KNOWLEDGE_ROOT, entry.name);
        const projectId = encodePath(fullPath);
        const stats = await fs.stat(fullPath);
        const updatedAt = stats.mtime.toISOString();

        projectRows.push([projectId, 'projects', entry.name, fullPath, updatedAt]);

        // Recursively find .md files
        await scanFiles(fullPath, projectId, fullPath);
      }
    }
  }

  // 2. Scan tools
  if (await fs.pathExists(TOOLS_ROOT)) {
    const entries = await fs.readdir(TOOLS_ROOT, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            const fullPath = path.join(TOOLS_ROOT, entry.name);
            const projectId = encodePath(fullPath);
            const stats = await fs.stat(fullPath);
            const updatedAt = stats.mtime.toISOString();

            projectRows.push([projectId, 'tools', entry.name, fullPath, updatedAt]);

            await scanFiles(fullPath, projectId, fullPath);
        }
    }
  }

  // 3. Scan knowledge base (workspace/knowledge/01_xxx ~ xx_xxx, excluding 00_projects)
  if (await fs.pathExists(KNOWLEDGE_BASE_ROOT)) {
    const entries = await fs.readdir(KNOWLEDGE_BASE_ROOT, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && /^\d+_/.test(entry.name) && entry.name !== '00_projects' && !entry.name.startsWith('.')) {
        const fullPath = path.join(KNOWLEDGE_BASE_ROOT, entry.name);
        const projectId = encodePath(fullPath);
        const stats = await fs.stat(fullPath);
        const updatedAt = stats.mtime.toISOString();
        projectRows.push([projectId, 'knowledge', entry.name, fullPath, updatedAt]);
        await scanFiles(fullPath, projectId, fullPath);
      }
    }
  }

  // 4. Scan issues (workspace/issues/TODO, DOING, DONE)
  if (await fs.pathExists(ISSUES_ROOT)) {
    const categories = ['TODO', 'DOING', 'DONE'];
    for (const category of categories) {
      const categoryPath = path.join(ISSUES_ROOT, category);
      if (await fs.pathExists(categoryPath)) {
        const entries = await fs.readdir(categoryPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            const fullPath = path.join(categoryPath, entry.name);
            const projectId = encodePath(fullPath);
            // Use folder's actual modification time for sorting
            const stats = await fs.stat(fullPath);
            const updatedAt = stats.mtime.toISOString();
            projectRows.push([projectId, category, entry.name, fullPath, updatedAt]);
            await scanFiles(fullPath, projectId, fullPath);
          }
        }
      }
    }
  }

  // 5. Scan skills-all (.agent/skills-all)
  if (await fs.pathExists(SKILLS_ALL_ROOT)) {
    const entries = await fs.readdir(SKILLS_ALL_ROOT, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        const fullPath = path.join(SKILLS_ALL_ROOT, entry.name);
        const projectId = encodePath(fullPath);
        const stats = await fs.stat(fullPath);
        const updatedAt = stats.mtime.toISOString();
        projectRows.push([projectId, 'skills-all', entry.name, fullPath, updatedAt]);
        await scanFiles(fullPath, projectId, fullPath);
      }
    }
  }

  // Phase 2: UPSERT all data in a single synchronous transaction
  const upsertProject = db.prepare(`
    INSERT INTO wiki_projects (id, category, name, path, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      category = excluded.category,
      name = excluded.name,
      path = excluded.path,
      updated_at = excluded.updated_at
  `);

  const upsertFile = db.prepare(`
    INSERT INTO wiki_files (id, project_id, name, path, full_path, size, last_modified)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      project_id = excluded.project_id,
      name = excluded.name,
      path = excluded.path,
      full_path = excluded.full_path,
      size = excluded.size,
      last_modified = excluded.last_modified
  `);

  let fileCount = 0;

  const writeAll = db.transaction(() => {
    for (const row of projectRows) {
      upsertProject.run(...row);
    }

    for (const row of fileRows) {
      try {
        upsertFile.run(...row);
        fileCount++;
      } catch (e) {
        console.warn(`Skipping duplicate or error file: ${row[4]}`, e);
      }
    }

    // Remove stale records no longer on disk
    if (projectRows.length > 0) {
      const projectIds = projectRows.map(r => r[0]);
      const projectPlaceholders = projectIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM wiki_files WHERE project_id NOT IN (${projectPlaceholders})`).run(...projectIds);
      db.prepare(`DELETE FROM wiki_projects WHERE id NOT IN (${projectPlaceholders})`).run(...projectIds);
    }
    if (fileRows.length > 0) {
      const fileIds = fileRows.map(r => r[0]);
      const filePlaceholders = fileIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM wiki_files WHERE id NOT IN (${filePlaceholders})`).run(...fileIds);
    } else {
      // No files found at all — clear file table
      db.exec('DELETE FROM wiki_files');
    }
  });

  writeAll();

  return { projects: projectRows.length, files: fileCount };
}

// ========== Routes ==========

/**
 * Get Categories
 */
router.get('/categories', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'projects', label: '00_projects', path: KNOWLEDGE_ROOT },
      { id: 'tools', label: 'tools', path: TOOLS_ROOT },
      { id: 'knowledge', label: 'Knowledge Base', path: KNOWLEDGE_BASE_ROOT }
    ]
  });
});

/**
 * Sync Wiki Data
 */
router.post('/sync', async (req, res) => {
  try {
    const result = await syncWiki();
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Wiki sync error:', error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * Get Projects (from DB)
 */
router.get('/projects', (req, res) => {
  try {
    const category = req.query.category as string || 'projects';
    const db = getWikiDatabase();
    
    // For issues (TODO/DOING/DONE), sort by time (newest first)
    // For others (projects/tools/knowledge), sort by name
    const isIssueCategory = ['TODO', 'DOING', 'DONE'].includes(category);
    const orderBy = isIssueCategory ? 'updated_at DESC' : 'name ASC';

    const projects = db.prepare(`SELECT id, name, path FROM wiki_projects WHERE category = ? ORDER BY ${orderBy}`)
      .all(category);

    res.json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * Get Files (from DB)
 */
router.get('/files', (req, res) => {
  try {
    const projectId = req.query.projectId as string;
    if (!projectId) return res.status(400).json({ success: false, error: 'Missing projectId' });

    const db = getWikiDatabase();
    const files = db.prepare('SELECT id, name, path, size, last_modified as updatedAt FROM wiki_files WHERE project_id = ? ORDER BY path ASC')
      .all(projectId);

    res.json({ success: true, data: files });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * Read Content (from FS)
 * We still read content directly from disk to ensure we get the latest version
 */
router.get('/content', async (req, res) => {
  try {
    const fileId = req.query.fileId as string;
    if (!fileId) return res.status(400).json({ success: false, error: 'Missing fileId' });

    const db = getWikiDatabase();
    const row = db
      .prepare('SELECT full_path FROM wiki_files WHERE id = ?')
      .get(fileId) as { full_path: string } | undefined;

    if (!row) {
      return res.status(404).json({ success: false, error: 'File not found in index' });
    }

    const filePath = row.full_path;

    if (!isSafePath(filePath)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (path.extname(filePath).toLowerCase() !== '.md') {
      return res.status(403).json({ success: false, error: 'Only markdown files are allowed' });
    }

    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const content = await fs.readFile(filePath, 'utf8');
    const stat = await fs.stat(filePath);

    res.json({
      success: true,
      data: {
        content,
        name: path.basename(filePath),
        updatedAt: stat.mtime.toISOString(),
        size: stat.size
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;
