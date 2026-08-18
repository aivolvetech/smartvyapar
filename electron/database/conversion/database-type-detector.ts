import fs from 'fs';
import Database from 'better-sqlite3-multiple-ciphers';

export type DatabaseType = 'ABSENT' | 'PLAIN' | 'VALID_ENCRYPTED' | 'WRONG_KEY_ENCRYPTED' | 'CORRUPTED';

export function detectDatabaseType(dbPath: string, key?: string): DatabaseType {
  if (!fs.existsSync(dbPath)) {
    return 'ABSENT';
  }

  // 1. Try opening as plain SQLite (without a key)
  let conn: Database.Database | null = null;
  try {
    conn = new Database(dbPath);
    conn.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    conn.close();
    conn = null;
    return 'PLAIN';
  } catch (err) {
    if (conn) {
      try { conn.close(); } catch (e) {}
      conn = null;
    }
  }

  // 2. Try opening with key to verify if it is valid encrypted
  if (key) {
    try {
      conn = new Database(dbPath);
      conn.pragma(`key = '${key}'`);
      conn.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      conn.close();
      conn = null;
      return 'VALID_ENCRYPTED';
    } catch (err: any) {
      if (conn) {
        try { conn.close(); } catch (e) {}
        conn = null;
      }
      const msg = err.message || '';
      if (msg.includes('file is not a database') || msg.includes('encrypted') || msg.includes('authentication')) {
        return 'WRONG_KEY_ENCRYPTED';
      }
      return 'CORRUPTED';
    }
  }

  return 'WRONG_KEY_ENCRYPTED';
}
