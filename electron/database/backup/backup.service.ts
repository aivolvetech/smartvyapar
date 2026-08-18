import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import Database from 'better-sqlite3-multiple-ciphers';
import { getDatabasePath, getBackupPath } from '../database-paths';
import { computeBackupChecksum } from './backup-checksum';
import { BackupManifest } from './backup-manifest';
import { BackupError } from './backup-errors';
import { logInfo, logError } from '../../utils/logger';
import { DATABASE_CONFIG } from '../database-config';

export class BackupService {
  public async createBackup(key: string): Promise<string> {
    const dbPath = getDatabasePath();
    const backupPath = getBackupPath();

    if (!fs.existsSync(dbPath)) {
      throw new BackupError('Active database file does not exist, cannot create backup.');
    }

    logInfo('Backing up SQLCipher database via VACUUM INTO...');
    let conn: Database.Database | null = null;
    
    try {
      // 1. Delete target file if it already exists
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
      
      const backupDir = path.dirname(backupPath);
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // 2. Open temporary connection to active DB and run VACUUM INTO
      conn = new Database(dbPath);
      conn.pragma(`key = '${key}'`);
      
      // Execute vacuum into
      conn.prepare('VACUUM INTO ?').run(backupPath);
      conn.close();
      conn = null;

      // 3. Compute checksum and file size
      const checksum = computeBackupChecksum(backupPath);
      const fileSize = fs.statSync(backupPath).size;

      // 4. Write manifest
      const manifest: BackupManifest = {
        version: '1.0.0',
        appVersion: app.getVersion(),
        timestamp: new Date().toISOString(),
        fileSize,
        checksum,
        cipher: {
          algorithm: 'SQLCipher',
          pageSize: DATABASE_CONFIG.pageSize
        }
      };

      const manifestPath = path.join(backupDir, 'backup-manifest.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

      logInfo(`Encrypted database backup created successfully. Size: ${fileSize} bytes.`);
      return checksum;
    } catch (err: any) {
      logError('Database backup execution failed', err);
      throw new BackupError(err.message || String(err));
    } finally {
      if (conn) {
        try {
          conn.close();
        } catch (e) {}
      }
    }
  }
}
