import Database from 'better-sqlite3-multiple-ciphers';
import { getDatabasePath } from './database-paths';
import { logInfo } from '../utils/logger';
import { DATABASE_CONFIG } from './database-config';
import { DatabaseConnectionError, WrongKeyError, DatabaseCorruptedException } from './database-errors';

let activeConnection: Database.Database | null = null;

export function getDatabaseConnection(): Database.Database {
  if (!activeConnection) {
    throw new Error('Database connection has not been initialized.');
  }
  return activeConnection;
}

export function isConnected(): boolean {
  return activeConnection !== null;
}

export async function openDatabaseConnection(key: string): Promise<Database.Database> {
  const dbPath = getDatabasePath();
  
  try {
    const db = new Database(dbPath);
    
    // 1. Apply key immediately before any queries
    db.pragma(`key = '${key}'`);
    
    // 2. Verify cipher and key unlock
    try {
      db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    } catch (err: any) {
      db.close();
      const msg = err.message || '';
      if (msg.includes('file is not a database') || msg.includes('encrypted') || msg.includes('authentication')) {
        throw new WrongKeyError();
      } else {
        throw new DatabaseCorruptedException();
      }
    }
    
    // 3. Configure standard pragmas
    db.pragma(`page_size = ${DATABASE_CONFIG.pageSize}`);
    db.pragma(`journal_mode = ${DATABASE_CONFIG.journalMode}`);
    db.pragma(`foreign_keys = ${DATABASE_CONFIG.foreignKeys}`);
    db.pragma(`busy_timeout = ${DATABASE_CONFIG.busyTimeout}`);
    
    activeConnection = db;
    logInfo('SQLCipher connection established and verified.');
    return db;
  } catch (err: any) {
    if (err instanceof WrongKeyError || err instanceof DatabaseCorruptedException) {
      throw err;
    }
    throw new DatabaseConnectionError(err.message || String(err));
  }
}

export async function closeDatabaseConnection(): Promise<void> {
  if (activeConnection) {
    activeConnection.close();
    activeConnection = null;
    logInfo('SQLCipher database connection closed.');
  }
}
