import fs from 'fs';
import crypto from 'crypto';
import { app } from 'electron';
import Database from 'better-sqlite3-multiple-ciphers';
import { loadMigrations } from './migration-loader';
import { computeFileChecksum } from './migration-checksum';
import { ChecksumMismatchException, MigrationExecutionException } from './migration-errors';
import { logInfo } from '../../utils/logger';

const ACCEPTED_LEGACY_CHECKSUMS: Record<string, string[]> = {
  // Phase 4 inventory foundation was shipped to a test installation before
  // follow-up indexing was moved into its own immutable migration.
  '20260802150000_inventory_foundation': [
    '598b82ec08dd49d257e21695ceb70c240d0383bf29127440f0bcbd1268f15403'
  ]
};

function isAcceptedLegacyChecksum(migrationName: string, checksum: string): boolean {
  return ACCEPTED_LEGACY_CHECKSUMS[migrationName]?.includes(checksum) ?? false;
}

export async function runMigrations(db: Database.Database): Promise<void> {
  // 1. Create AppMigration table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS AppMigration (
      id TEXT PRIMARY KEY,
      migrationName TEXT NOT NULL UNIQUE,
      checksum TEXT NOT NULL,
      appliedAt TEXT NOT NULL,
      applicationVersion TEXT NOT NULL
    );
  `);

  // 2. Load chronological migration files
  const migrations = loadMigrations();
  logInfo(`Found ${migrations.length} bundled migrations.`);

  for (const migration of migrations) {
    const { name, sqlPath } = migration;
    const checksum = computeFileChecksum(sqlPath);

    // Check if already applied
    const row = db.prepare('SELECT checksum FROM AppMigration WHERE migrationName = ?').get(name) as { checksum: string } | undefined;

    if (row) {
      // Validate checksum
      if (row.checksum !== checksum) {
        if (!isAcceptedLegacyChecksum(name, row.checksum)) {
          throw new ChecksumMismatchException(name, row.checksum, checksum);
        }
        logInfo(`Migration already applied with accepted legacy checksum: ${name}`);
        continue;
      }
      logInfo(`Migration already applied: ${name}`);
    } else {
      // Run SQL content transactionally
      logInfo(`Applying pending migration: ${name}`);
      const sqlContent = fs.readFileSync(sqlPath, 'utf8');
      
      try {
        const runTx = db.transaction(() => {
          db.exec(sqlContent);
          db.prepare(`
            INSERT INTO AppMigration (id, migrationName, checksum, appliedAt, applicationVersion)
            VALUES (?, ?, ?, datetime('now'), ?)
          `).run(crypto.randomUUID(), name, checksum, app.getVersion());
        });
        runTx();
      } catch (err: any) {
        throw new MigrationExecutionException(name, err);
      }
      logInfo(`Migration applied successfully: ${name}`);
    }
  }
}
