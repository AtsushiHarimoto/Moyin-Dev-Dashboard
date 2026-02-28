/**
 * Skills API Routes (NEW)
 * Manages skills database and profiles
 */

import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSkillsDatabase } from '../database';
import type { Skill, Profile, SyncSkillsResult } from '../types';

const router = express.Router();

/**
 * Validates profile name to prevent path traversal attacks
 * Only allows alphanumeric characters, hyphens, and underscores
 * @param name - Profile name to validate
 * @returns true if valid, false otherwise
 */
function isValidProfileName(name: string): boolean {
  const profileNameRegex = /^[a-zA-Z0-9_-]+$/;
  return profileNameRegex.test(name) && name.length > 0 && name.length <= 100;
}

// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths configuration
const PROFILES_DIR = path.join(__dirname, '..', '..', '..', 'profiles');
const PROJECT_SKILLS_DIR = path.join(__dirname, '..', '..', '..', '..', '..', '.agent', 'skills-all');

/**
 * GET /api/skills
 * Get all skills from skills.db
 */
router.get('/', (req, res) => {
  try {
    const db = getSkillsDatabase();
    const skills = db.prepare(`
      SELECT
        name,
        description,
        description_zh AS descriptionZh,
        category
      FROM skills
      ORDER BY category, name
    `).all() as Skill[];

    res.json({
      success: true,
      data: skills,
      total: skills.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/skills/categories
 * Get unique categories
 */
router.get('/categories', (req, res) => {
  try {
    const db = getSkillsDatabase();
    const result = db.prepare('SELECT DISTINCT category FROM skills ORDER BY category').all() as Array<{ category: string }>;

    res.json({
      success: true,
      data: result.map(r => r.category),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/skills/profiles
 * List all profiles from profiles/*.json
 */
router.get('/profiles', async (req, res) => {
  try {
    await fs.ensureDir(PROFILES_DIR);

    const files = await fs.readdir(PROFILES_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    const profiles: Array<{ name: string; description: string; skillCount: number }> = [];

    for (const file of jsonFiles) {
      try {
        const filePath = path.join(PROFILES_DIR, file);
        const data = await fs.readJson(filePath) as Profile;
        profiles.push({
          name: data.name,
          description: data.description || '',
          skillCount: data.skills ? data.skills.length : 0,
        });
      } catch (e) {
        console.warn(`⚠️ Failed to read profile: ${file}`, e);
      }
    }

    res.json({
      success: true,
      data: profiles,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/skills/profiles/:name
 * Get specific profile by name
 */
router.get('/profiles/:name', async (req, res) => {
  try {
    const { name } = req.params;

    // Validate profile name
    if (!isValidProfileName(name)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid profile name. Only alphanumeric characters, hyphens, and underscores are allowed.',
      });
    }

    const filePath = path.join(PROFILES_DIR, `${name}.json`);

    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({
        success: false,
        error: `Profile not found: ${name}`,
      });
    }

    const data = await fs.readJson(filePath) as Profile;

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/skills/profiles/:name
 * Save or update a profile
 * Body: Profile object
 */
router.post('/profiles/:name', async (req, res) => {
  try {
    const { name } = req.params;

    // Validate profile name
    if (!isValidProfileName(name)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid profile name. Only alphanumeric characters, hyphens, and underscores are allowed.',
      });
    }

    const profileData: Profile = req.body;

    // Reject prototype pollution keys
    const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];
    const bodyKeys = Object.keys(profileData);
    for (const key of bodyKeys) {
      if (DANGEROUS_KEYS.includes(key)) {
        return res.status(400).json({
          success: false,
          error: `Invalid profile data: forbidden key "${key}"`,
        });
      }
    }

    // Reasonable size limit (500 KB)
    const bodySize = JSON.stringify(profileData).length;
    if (bodySize > 512_000) {
      return res.status(400).json({
        success: false,
        error: 'Invalid profile data: payload too large (max 500 KB)',
      });
    }

    // Validate profile data
    if (!profileData.skills || !Array.isArray(profileData.skills)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid profile data: skills array is required',
      });
    }

    // Validate each skill name in the skills array
    const SKILL_NAME_REGEX = /^[a-zA-Z0-9_\-\.]+$/;
    const MAX_SKILL_NAME_LENGTH = 200;
    for (const skillName of profileData.skills) {
      if (typeof skillName !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Invalid profile data: each skill must be a string',
        });
      }
      if (skillName.length === 0 || skillName.length > MAX_SKILL_NAME_LENGTH) {
        return res.status(400).json({
          success: false,
          error: `Invalid skill name length: "${skillName}" (max ${MAX_SKILL_NAME_LENGTH} chars)`,
        });
      }
      if (!SKILL_NAME_REGEX.test(skillName)) {
        return res.status(400).json({
          success: false,
          error: `Invalid skill name: "${skillName}". Only alphanumeric, hyphens, underscores, and dots are allowed.`,
        });
      }
      if (skillName.includes('..')) {
        return res.status(400).json({
          success: false,
          error: `Invalid skill name: "${skillName}" contains path traversal sequence.`,
        });
      }
    }

    // Validate tool field against known set
    const KNOWN_TOOLS = ['cx', 'cc', 'anti', 'codex', 'claude', 'antigravity'];
    if (profileData.tool && !KNOWN_TOOLS.includes(profileData.tool)) {
      return res.status(400).json({
        success: false,
        error: `Invalid tool: "${profileData.tool}". Must be one of: ${KNOWN_TOOLS.join(', ')}`,
      });
    }

    const filePath = path.join(PROFILES_DIR, `${name}.json`);

    // Ensure profiles directory exists
    await fs.ensureDir(PROFILES_DIR);

    // Write profile
    await fs.writeJson(filePath, profileData, { spaces: 4 });

    res.json({
      success: true,
      message: `Profile saved: ${name}`,
      data: profileData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/skills/profiles/:name
 * Delete a profile
 */
router.delete('/profiles/:name', async (req, res) => {
  try {
    const { name } = req.params;

    // Validate profile name
    if (!isValidProfileName(name)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid profile name. Only alphanumeric characters, hyphens, and underscores are allowed.',
      });
    }

    const filePath = path.join(PROFILES_DIR, `${name}.json`);

    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({
        success: false,
        error: `Profile not found: ${name}`,
      });
    }

    await fs.remove(filePath);

    res.json({
      success: true,
      message: `Profile deleted: ${name}`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/skills/sync
 * Sync skills database from profiles (run sync-db.js logic)
 */
router.post('/sync', async (req, res) => {
  try {
    const result = await syncSkillsDatabase();

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ========== Helper Functions (from legacy/sync-db.js) ==========

interface ExtractedDescriptions {
  description: string | null;
  descriptionZh: string | null;
}

interface SkillRow {
  name: string;
  description: string;
  descriptionZh: string | null;
  category: string;
}

const CJK_PATTERN = /[\u3400-\u9FFF]/;
const ENGLISH_PATTERN = /^[a-zA-Z0-9\s.,!?'"()\-_:;/\\&[\]{}]+$/;

function hasCjkText(text: string | null | undefined): boolean {
  return !!text && CJK_PATTERN.test(text);
}

function isLikelyEnglish(text: string | null | undefined): boolean {
  return !!text && ENGLISH_PATTERN.test(text);
}

async function extractDescription(skillName: string): Promise<ExtractedDescriptions> {
  const searchPaths = [
    path.join(PROJECT_SKILLS_DIR, skillName, 'SKILL.md'),
  ];

  for (const p of searchPaths) {
    if (await fs.pathExists(p)) {
      const content = await fs.readFile(p, 'utf8');

      // Try to extract from frontmatter (supports description + description_zh)
      const descriptionZhMatch = content.match(/description_zh:\s*(.*)/i);
      const descriptionMatch = content.match(/description:\s*(.*)/i);

      const descriptionZh = descriptionZhMatch?.[1]?.trim() || null;
      const description = descriptionMatch?.[1]?.trim() || null;

      if (description || descriptionZh) {
        return { description, descriptionZh };
      }

      // Or extract from first paragraph after H1
      const bodyMatch = content.match(/# .*\n+([\s\S]*?)\n/);
      if (bodyMatch && bodyMatch[1]) {
        const firstParagraph = bodyMatch[1].trim().split('\n')[0];
        return hasCjkText(firstParagraph)
          ? { description: null, descriptionZh: firstParagraph }
          : { description: firstParagraph, descriptionZh: null };
      }
    }
  }

  return { description: null, descriptionZh: null };
}

function autoCategorize(name: string, description: string | null): string {
  const text = (name + (description || '')).toLowerCase();

  if (text.includes('vue') || text.includes('react') || text.includes('frontend') || text.includes('ui') || text.includes('css'))
    return '前端開發';
  if (text.includes('node') || text.includes('backend') || text.includes('server') || text.includes('api'))
    return '後端開發';
  if (text.includes('db') || text.includes('sql') || text.includes('mongo') || text.includes('database'))
    return '資料庫';
  if (text.includes('qa') || text.includes('test') || text.includes('verify'))
    return '測試與驗證';
  if (text.includes('ci') || text.includes('cd') || text.includes('deploy') || text.includes('action') || text.includes('pipeline'))
    return '持續整合';
  if (text.includes('game') || text.includes('godot') || text.includes('unity') || text.includes('unreal'))
    return '遊戲開發';
  if (text.includes('fullstack'))
    return '全棧開發';
  if (text.includes('api') || text.includes('rest') || text.includes('graphql'))
    return '介面與協議';

  return '其它';
}

async function syncSkillsDatabase(): Promise<SyncSkillsResult> {
  const db = getSkillsDatabase();
  await fs.ensureDir(PROFILES_DIR);

  // Collect all skills from profiles
  const files = await fs.readdir(PROFILES_DIR);
  const skillSet = new Set<string>();

  for (const file of files) {
    if (file.endsWith('.json')) {
      try {
        const data = await fs.readJson(path.join(PROFILES_DIR, file)) as Profile;
        if (data.skills) {
          data.skills.forEach(s => skillSet.add(s));
        }
      } catch (e) {
        console.warn(`⚠️ Failed to read profile: ${file}`, e);
      }
    }
  }

  console.log(`📡 Found ${skillSet.size} unique skills in profiles.`);

  const existingSkills = db.prepare(`
    SELECT
      name,
      description,
      description_zh AS descriptionZh,
      category
    FROM skills
  `).all() as SkillRow[];
  const existingMap = new Map(existingSkills.map(s => [s.name, s]));

  const upsertStmt = db.prepare(`
    INSERT INTO skills (name, description, description_zh, category)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      description=excluded.description,
      description_zh=excluded.description_zh,
      category=excluded.category
  `);

  const errors: string[] = [];

  // Phase 1: Collect all skill data asynchronously
  interface SkillUpsertData {
    name: string;
    description: string;
    descriptionZh: string | null;
    category: string;
  }
  const skillRows: SkillUpsertData[] = [];

  for (const skillName of skillSet) {
    try {
      const existing = existingMap.get(skillName);
      let description = existing ? existing.description : '';
      let descriptionZh = existing ? (existing.descriptionZh || '') : '';

      // Backfill legacy Chinese content from description into descriptionZh
      if (!descriptionZh && hasCjkText(description)) {
        descriptionZh = description;
      }

      // Try to extract missing english/chinese descriptions from SKILL.md
      if (!existing || !description || isLikelyEnglish(description) || !descriptionZh) {
        const extracted = await extractDescription(skillName);

        if (extracted.description) {
          description = extracted.description;
        }
        if (extracted.descriptionZh) {
          descriptionZh = extracted.descriptionZh;
        }
      }

      const category = autoCategorize(skillName, description);
      skillRows.push({ name: skillName, description: description || '', descriptionZh: descriptionZh || null, category });
    } catch (error) {
      errors.push(`Failed to sync skill ${skillName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Phase 2: Batch upsert in a single transaction
  const syncTransaction = db.transaction((items: SkillUpsertData[]) => {
    for (const item of items) {
      upsertStmt.run(item.name, item.description, item.descriptionZh, item.category);
    }
  });
  syncTransaction(skillRows);
  const updatedCount = skillRows.length;

  console.log(`✅ Skills sync complete: ${updatedCount} skills updated`);

  return {
    foundSkills: skillSet.size,
    updatedSkills: updatedCount,
    errors,
  };
}

export default router;
