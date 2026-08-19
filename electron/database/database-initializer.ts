import fs from 'fs';
import path from 'path';
import { getDatabasePath, getPlainDatabasePath } from './database-paths';
import { detectDatabaseType, DatabaseType } from './conversion/database-type-detector';
import { convertPlainToEncrypted } from './conversion/plain-to-encrypted-converter';
import { WindowsDpapiKeyProvider } from '../security/windows-dpapi-key-provider';
import { openDatabaseConnection, closeDatabaseConnection } from './database-connection';
import { runMigrations } from './migrations/migration-runner';
import { checkDatabaseIntegrity } from './database-health';
import { logInfo, logError } from '../utils/logger';
import { DatabaseStatus } from '../../shared/database/database-status';
import { WrongKeyError, DatabaseCorruptedException } from './database-errors';

let dbStatus: DatabaseStatus = 'NOT_INITIALIZED';

export function getDatabaseStatus(): DatabaseStatus {
  return dbStatus;
}

export function setDatabaseStatus(status: DatabaseStatus): void {
  dbStatus = status;
}

export async function initializeDatabase(): Promise<boolean> {

  dbStatus = 'MIGRATING';
  const dbPath = getDatabasePath();
  const plainDbPath = getPlainDatabasePath();
  const keyProvider = new WindowsDpapiKeyProvider();

  try {
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // 1. Retrieve or create DPAPI database key
    let key: string;
    const hasStoredKey = await keyProvider.hasKey();
    if (hasStoredKey) {
      key = await keyProvider.getKey();
    } else {
      key = await keyProvider.createKey();
    }

    // 2. Explicitly detect database state
    let state: DatabaseType = 'ABSENT';
    if (fs.existsSync(dbPath)) {
      state = detectDatabaseType(dbPath, key);
    } else if (fs.existsSync(plainDbPath)) {
      state = 'PLAIN';
    }

    logInfo(`Detected database state: ${state}`);

    // 3. Coordinate conversion or report failure states
    if (state === 'PLAIN') {
      logInfo('Plain database detected. Commencing conversion...');
      await convertPlainToEncrypted(plainDbPath, dbPath, key);
    } else if (state === 'WRONG_KEY_ENCRYPTED') {
      dbStatus = 'WRONG_KEY';
      logError('Database connection rejected: WRONG_KEY', new Error('Wrong Key'));
      return false;
    } else if (state === 'CORRUPTED') {
      dbStatus = 'CORRUPTED';
      logError('Database connection rejected: CORRUPTED', new Error('Corrupted Database'));
      return false;
    }

    // 4. Open connection to active encrypted database
    const db = await openDatabaseConnection(key);

    // 5. Run programmatic migrations
    await runMigrations(db);

    // 5.5 Clean up empty drafts from SQLite database
    try {
      const cleanResult = db.prepare(`
        DELETE FROM SalesInvoice
        WHERE status = 'DRAFT'
          AND grandTotal = 0
          AND paidAmount = 0
          AND id NOT IN (SELECT DISTINCT salesInvoiceId FROM SalesInvoiceLine WHERE salesInvoiceId IS NOT NULL)
          AND id NOT IN (SELECT DISTINCT salesInvoiceId FROM SalesPayment WHERE salesInvoiceId IS NOT NULL)
          AND id NOT IN (SELECT DISTINCT referenceId FROM CustomerLedgerEntry WHERE referenceId IS NOT NULL)
          AND id NOT IN (SELECT DISTINCT referenceId FROM InventoryTransaction WHERE referenceId IS NOT NULL)
      `).run();
      logInfo(`Cleaned up ${cleanResult.changes} empty draft records from database.`);
    } catch (cleanErr) {
      logError('Failed to run empty draft cleanup', cleanErr);
    }

    // 6. Run database health checks
    const isHealthy = checkDatabaseIntegrity(db);
    if (!isHealthy) {
      dbStatus = 'CORRUPTED';
      logError('Database health validation failed.', new Error('Integrity Failure'));
      await closeDatabaseConnection();
      return false;
    }

    dbStatus = 'CONNECTED';
    logInfo('Database initialization completed successfully.');
    logInfo('Database Driver: better-sqlite3-multiple-ciphers');
    logInfo('Database Encryption: SQLCipher enabled');
    logInfo('Prisma Runtime: disabled');
    logInfo(`Database Path: ${dbPath}`);
    logInfo('Key Provider: Windows DPAPI CurrentUser');
    return true;
  } catch (err: any) {
    logError('Database initialization encountered a fatal error', err);
    if (err instanceof WrongKeyError) {
      dbStatus = 'WRONG_KEY';
    } else if (err instanceof DatabaseCorruptedException) {
      dbStatus = 'CORRUPTED';
    } else {
      dbStatus = 'CONNECTION_FAILED';
    }
    await closeDatabaseConnection();
    return false;
  }
}
// Prisma diagnostics decommissioned
