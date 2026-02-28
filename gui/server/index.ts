/**
 * Express API Server for Skills Switch GUI
 * Combines Session Management (from gui-react) + Skills Management (NEW)
 * Port: 38881 (not 33002)
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initSessionsDatabase, initSkillsDatabase, initWikiDatabase, initAnalysisDatabase, closeDatabases } from './database';
// Import route handlers
import sessionsRouter from './routes/sessions';
import messagesRouter from './routes/messages';
import syncRouter from './routes/sync';
import exportRouter from './routes/export';
import skillsRouter from './routes/skills';
import reportsRouter from './routes/reports';
import wikiRouter from './routes/wiki';
import issuesRouter from './routes/issues';
import dashboardRouter from './routes/dashboard';
import progressRouter from './routes/progress';
import analysisRouter from './routes/analysis';
import insightsRouter from './routes/insights';
import emailRouter from './routes/email';
import keywordsRouter from './routes/keywords';
import { seedFromDefaults } from './analysis/keyword-presets';
import { localhostGuard } from './localhostGuard';

const app = express();
const PORT = parseInt(process.env.SKILLS_PORT || '38881', 10);

// Middleware
// CORS configuration - restrict to specific origins
const corsOptions = {
  origin: ['http://localhost:3001', 'http://localhost:38880', 'http://127.0.0.1:3001', 'http://127.0.0.1:38880'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Parse JSON with size limit
app.use(express.json({ limit: '10mb' }));

// Initialize databases
try {
  initSessionsDatabase();
  console.log('✅ Sessions database initialized');

  initSkillsDatabase();
  console.log('✅ Skills database initialized');

  initWikiDatabase();
  console.log('✅ Wiki database initialized');

  initAnalysisDatabase();
  console.log('✅ Analysis database initialized');

  seedFromDefaults();
} catch (error) {
  console.error('❌ Database initialization failed:', error);
  process.exit(1);
}

// localhostGuard: protect all mutation endpoints (POST/PUT/DELETE) from non-localhost requests
const mutationGuard: express.RequestHandler = (req, res, next) => {
  if (req.method === 'GET' || req.method === 'OPTIONS' || req.method === 'HEAD') {
    return next();
  }
  // For POST, PUT, DELETE — enforce localhost origin
  localhostGuard(req, res, next);
};

// ========== Session Management API Routes (from gui-react) ==========
app.use('/api/sessions', sessionsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/sync', mutationGuard, syncRouter);
app.use('/api/export', exportRouter);

// ========== Skills Management API Routes (NEW) ==========
app.use('/api/skills', mutationGuard, skillsRouter);
app.use('/api/reports', mutationGuard, reportsRouter);
app.use('/api/wiki', mutationGuard, wikiRouter);
app.use('/api/issues', issuesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/progress', mutationGuard, progressRouter);

// ========== Analysis API Routes (Hermit Purple integration) ==========
app.use('/api/analysis', mutationGuard, analysisRouter);

// ========== Insights API Routes (Claude Code usage insights) ==========
app.use('/api/insights', insightsRouter);

// ========== Keywords API Routes (dynamic trending keywords) ==========
app.use('/api/keywords', mutationGuard, keywordsRouter);

// ========== Email API Routes (Gmail integration) ==========
app.use('/api/email', mutationGuard, emailRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Skills Switch GUI API',
    version: '1.0.0',
    description: 'Unified API for Claude Code Sessions + Skills Management',
    endpoints: {
      // Session Management
      sessions: '/api/sessions',
      messages: '/api/messages',
      sync: '/api/sync',
      export: '/api/export',

      // Skills Management (NEW)
      skills: '/api/skills',
      profiles: '/api/skills/profiles',
      skillsSync: '/api/skills/sync',
      reports: '/api/reports',
      wiki: '/api/wiki',

      // System
      health: '/health',
    },
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    ...(process.env.NODE_ENV !== 'production' && { message: err.message }),
  });
});

// Start server — 綁定到 127.0.0.1，拒絕外部網路直接存取
const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 Skills Switch GUI API Server started`);
  console.log(`   Address: http://127.0.0.1:${PORT} (localhost only)`);
  console.log(`   Frontend: http://localhost:38880`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`\n📚 Available API endpoints:`);
  console.log(`   Sessions: /api/sessions`);
  console.log(`   Messages: /api/messages`);
  console.log(`   Sync: /api/sync`);
  console.log(`   Export: /api/export`);
  console.log(`   Skills: /api/skills`);
  console.log(`   Profiles: /api/skills/profiles`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Set SKILLS_PORT env variable to use a different port.`);
    process.exit(1);
  }
  throw err;
});

// Graceful shutdown
function handleShutdown(): void {
  console.log('\n Shutting down server...');
  closeDatabases();
  process.exit(0);
}

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
