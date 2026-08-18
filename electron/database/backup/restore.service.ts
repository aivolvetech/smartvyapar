import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3-multiple-ciphers';
import { getDatabasePath, getBackupPath } from '../database-paths';
import { computeBackupChecksum } from './backup-checksum';
import { checkDatabaseIntegrity } from '../database-health';
import { RestoreValidationError, BackupError } from './backup-errors';
import { logInfo, logError } from '../../utils/logger';

export class RestoreService {
  public async restoreBackup(key: string): Promise<void> {
    const dbPath = getDatabasePath();
    const backupPath = getBackupPath();
    const backupDir = path.dirname(backupPath);
    const manifestPath = path.join(backupDir, 'backup-manifest.json');

    if (!fs.existsSync(backupPath)) {
      throw new BackupError('Backup file not found.');
    }

    logInfo('Starting database restore from backup...');

    // 1. Verify manifest checksum
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const calculated = computeBackupChecksum(backupPath);
        if (calculated !== manifest.checksum) {
          throw new RestoreValidationError('Backup file checksum mismatch (file is corrupted).');
        }
      } catch (err: any) {
        if (err instanceof RestoreValidationError) throw err;
        logError('Failed to validate backup manifest checksum', err);
      }
    }

    // 2. Restore to a temporary path first
    const tempRestorePath = dbPath + '.restore.tmp';
    if (fs.existsSync(tempRestorePath)) {
      fs.unlinkSync(tempRestorePath);
    }
    fs.copyFileSync(backupPath, tempRestorePath);

    let tempConn: Database.Database | null = null;
    try {
      // 3. Open using correct key
      tempConn = new Database(tempRestorePath);
      tempConn.pragma(`key = '${key}'`);

      // 4. Run integrity check
      const isHealthy = checkDatabaseIntegrity(tempConn);
      if (!isHealthy) {
        throw new RestoreValidationError('Restored temp database integrity check failed.');
      }

      // 5. Validate required schema
      try {
        const count = tempConn.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='Shop'").get() as { count: number };
        if (count.count === 0) {
          throw new RestoreValidationError('Restored database is missing the required "Shop" schema.');
        }
      } catch (err: any) {
        throw new RestoreValidationError(`Schema validation failed: ${err.message}`);
      }

      // 6. Validate Shop data
      try {
        const countRow = tempConn.prepare('SELECT count(*) as count FROM Shop').get() as { count: number };
        if (countRow.count > 0) {
          const firstShop = tempConn.prepare('SELECT * FROM Shop LIMIT 1').get() as any;
          if (!firstShop.name) {
            throw new RestoreValidationError('Shop record is missing valid name attribute.');
          }
        }
      } catch (err: any) {
        throw new RestoreValidationError(`Shop data validation failed: ${err.message}`);
      }

      tempConn.close();
      tempConn = null;

      // 7. Keep pre-restore backup
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const failedDbPath = dbPath + `.pre-restore-${timestamp}.db`;
      if (fs.existsSync(dbPath)) {
        fs.renameSync(dbPath, failedDbPath);
        logInfo(`Pre-restore database preserved at: ${failedDbPath}`);
      }

      const walFile = dbPath + '-wal';
      const shmFile = dbPath + '-shm';
      if (fs.existsSync(walFile)) {
        try { fs.renameSync(walFile, failedDbPath + '-wal'); } catch (e) {}
      }
      if (fs.existsSync(shmFile)) {
        try { fs.renameSync(shmFile, failedDbPath + '-shm'); } catch (e) {}
      }

      // 8. Atomically replace active database
      fs.renameSync(tempRestorePath, dbPath);
      logInfo('Database restore completed successfully.');
    } catch (err: any) {
      logError('Database restore failed during validation stages', err);
      if (tempConn) {
        try {
          tempConn.close();
        } catch (e) {}
      }
      if (fs.existsSync(tempRestorePath)) {
        try { fs.unlinkSync(tempRestorePath); } catch (e) {}
      }
      throw err;
    }
  }
}
