import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { getBackfillQueue } from './sync';

function setupDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE claude_sessions_win (
      provider TEXT NOT NULL DEFAULT 'claude',
      session_id TEXT PRIMARY KEY,
      full_path TEXT NOT NULL,
      modified_at TEXT NOT NULL,
      message_count INTEGER NOT NULL
    );
    CREATE TABLE claude_messages_win (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL DEFAULT 'claude',
      session_id TEXT NOT NULL
    );
  `);
  return db;
}

describe('getBackfillQueue', () => {
  it('returns only sessions where message_count is greater than actual rows with batch paging', () => {
    const db = setupDb();
    const insertSession = db.prepare(
      'INSERT INTO claude_sessions_win (provider, session_id, full_path, modified_at, message_count) VALUES (?, ?, ?, ?, ?)'
    );
    insertSession.run('claude', 's1', 'p1', '2026-02-11T10:00:00Z', 5);
    insertSession.run('claude', 's2', 'p2', '2026-02-11T11:00:00Z', 1);
    insertSession.run('claude', 's3', 'p3', '2026-02-11T12:00:00Z', 9);
    insertSession.run('claude', 's4', 'p4', '2026-02-11T13:00:00Z', 0);

    const insertMsg = db.prepare('INSERT INTO claude_messages_win (provider, session_id) VALUES (?, ?)');
    insertMsg.run('claude', 's1');
    insertMsg.run('claude', 's1');
    insertMsg.run('claude', 's2');
    for (let i = 0; i < 3; i++) insertMsg.run('claude', 's3');

    const firstBatch = getBackfillQueue(db, 1, 0);
    const secondBatch = getBackfillQueue(db, 1, 1);

    expect(firstBatch.total).toBe(2);
    expect(firstBatch.sessions).toHaveLength(1);
    expect(secondBatch.sessions).toHaveLength(1);

    const allIds = new Set([firstBatch.sessions[0].session_id, secondBatch.sessions[0].session_id]);
    expect(allIds).toEqual(new Set(['s1', 's3']));
  });
});
