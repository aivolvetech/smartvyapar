import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3-multiple-ciphers';
import { ConversionError } from './conversion-errors';
import { validateConversion } from './conversion-validator';
import { checkDatabaseIntegrity } from '../database-health';
import { runMigrations } from '../migrations/migration-runner';
import { logInfo, logError } from '../../utils/logger';
import { ConversionManifest } from './conversion-manifest';

export async function convertPlainToEncrypted(
  plainDbPath: string,
  targetDbPath: string,
  key: string
): Promise<void> {
  logInfo(`Converting plain database: ${plainDbPath} to encrypted: ${targetDbPath}`);

  if (!fs.existsSync(plainDbPath)) {
    throw new ConversionError(`Source plain database does not exist: ${plainDbPath}`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safetyBackupPath = plainDbPath + `.safety-backup-${timestamp}`;
  const tempEncryptedPath = targetDbPath + '.convert.tmp';

  // 1. Create timestamped safety copy of plain DB
  fs.copyFileSync(plainDbPath, safetyBackupPath);
  logInfo(`Safety copy of plain DB created at: ${safetyBackupPath}`);

  let plainDb: Database.Database | null = null;
  let encDb: Database.Database | null = null;

  try {
    // 2. Open plain DB connection
    plainDb = new Database(plainDbPath);

    // 3. Create temporary encrypted database
    if (fs.existsSync(tempEncryptedPath)) {
      fs.unlinkSync(tempEncryptedPath);
    }
    encDb = new Database(tempEncryptedPath);
    encDb.pragma(`key = '${key}'`);

    // 4. Apply schema using programmatic runner
    await runMigrations(encDb);

    // 5. Copy supported data transactionally
    let plainShopRows: any[] = [];
    try {
      plainShopRows = plainDb.prepare('SELECT * FROM Shop').all();
    } catch (e) {
      logInfo('Shop table does not exist in plain database, skipping row migration.');
    }

    if (plainShopRows.length > 0) {
      const copyTx = encDb.transaction(() => {
        const stmt = encDb!.prepare(`
          INSERT INTO Shop (id, name, phone, address, gstNumber, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const row of plainShopRows) {
          const createdStr = typeof row.createdAt === 'number'
            ? new Date(row.createdAt).toISOString()
            : row.createdAt;
          const updatedStr = typeof row.updatedAt === 'number'
            ? new Date(row.updatedAt).toISOString()
            : row.updatedAt;

          stmt.run(
            row.id,
            row.name,
            row.phone || null,
            row.address || null,
            row.gstNumber || null,
            createdStr,
            updatedStr
          );
        }
      });
      copyTx();
    }

    // 6. Validate row counts and values
    validateConversion(plainDb, encDb);

    // 7. Run integrity check
    const isEncHealthy = checkDatabaseIntegrity(encDb);
    if (!isEncHealthy) {
      throw new ConversionError('Temporary encrypted database integrity check failed.');
    }

    // 8. Close both databases
    plainDb.close();
    plainDb = null;
    encDb.close();
    encDb = null;

    // 9. Atomically replace active DB
    if (fs.existsSync(targetDbPath)) {
      // In production, targetDbPath is plainDbPath. Close handles first (already closed above).
      try {
        fs.unlinkSync(targetDbPath);
      } catch (err) {
        logInfo(`Note: target path did not exist or could not be unlinked: ${targetDbPath}`);
      }
    }

    // Rename temp encrypted database to target DB path
    fs.renameSync(tempEncryptedPath, targetDbPath);

    if (plainDbPath !== targetDbPath) {
      if (fs.existsSync(plainDbPath)) {
        try {
          fs.unlinkSync(plainDbPath);
        } catch (e) {}
      }
    }
    logInfo('Database conversion succeeded. Encrypted database replaced active path.');

    // 10. Write conversion manifest
    const manifest: ConversionManifest = {
      timestamp: new Date().toISOString(),
      originalSize: fs.statSync(safetyBackupPath).size,
      migratedRows: plainShopRows.length,
      success: true
    };

    const manifestPath = path.join(path.dirname(targetDbPath), 'conversion-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  } catch (err: any) {
    logError('Database conversion failed', err);
    if (plainDb) {
      try { plainDb.close(); } catch (e) {}
    }
    if (encDb) {
      try { encDb.close(); } catch (e) {}
    }
    if (fs.existsSync(tempEncryptedPath)) {
      try { fs.unlinkSync(tempEncryptedPath); } catch (e) {}
    }
    throw err;
  }
}
