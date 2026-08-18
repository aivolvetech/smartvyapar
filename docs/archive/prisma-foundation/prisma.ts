import { app, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';
import { logInfo, logError } from '../../utils/logger';

export let prisma: PrismaClient;
export let dbPath = '';
export let backupPath = '';
export let betterSqlite3Path = '';
export let prismaEnginePath = '';

// Check current database status
let dbStatus = 'NOT_INITIALIZED';

export function getDatabaseStatus(): string {
  return dbStatus;
}

export function resolveDatabasePaths() {
  const isDev = !app.isPackaged;
  
  if (isDev) {
    dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
    backupPath = path.join(process.cwd(), 'prisma', 'dev-backup.db.bak');
  } else {
    dbPath = path.join(app.getPath('userData'), 'data', 'smart-vyapar.db');
    backupPath = path.join(app.getPath('userData'), 'backups', 'smart-vyapar.db.bak');
  }

  // Resolve better-sqlite3 native module path for diagnostics
  try {
    betterSqlite3Path = require.resolve('better-sqlite3');
  } catch (err) {
    betterSqlite3Path = 'not-resolved';
  }

  // Resolve Prisma engine path for diagnostics
  const possibleEngineDirs = [
    path.join(process.cwd(), 'node_modules', '.prisma', 'client'),
    path.join(process.resourcesPath, 'node_modules', '.prisma', 'client'),
    path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '.prisma', 'client')
  ];

  for (const dir of possibleEngineDirs) {
    const p = path.join(dir, 'query_engine-windows.dll.node');
    if (fs.existsSync(p)) {
      prismaEnginePath = p;
      // Force Prisma Client to use this engine binary file path
      process.env.PRISMA_QUERY_ENGINE_LIBRARY = p;
      break;
    }
  }
  if (!prismaEnginePath) {
    prismaEnginePath = 'not-found';
  }

  logInfo(`Resolved DB Path: ${dbPath}`);
  logInfo(`Resolved Backup Path: ${backupPath}`);
  logInfo(`Resolved better-sqlite3 Path: ${betterSqlite3Path}`);
  logInfo(`Resolved Prisma Engine Path: ${prismaEnginePath}`);
}

// Compute SHA-256 checksum of a file
function computeFileChecksum(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf8');
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

// Run VACUUM INTO backup
function backupDatabase() {
  if (!fs.existsSync(dbPath)) return;

  logInfo('Backing up SQLite database via VACUUM INTO...');
  let tempDb: Database.Database | null = null;
  try {
    // Delete existing backup file since VACUUM INTO requires the target to not exist
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }
    
    // Ensure backup directory exists
    const backupDir = path.dirname(backupPath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    tempDb = new Database(dbPath);
    tempDb.prepare('VACUUM INTO ?').run(backupPath);
    logInfo('Database backup created successfully.');
  } catch (err) {
    logError('Database backup failed', err);
    throw err;
  } finally {
    if (tempDb) {
      tempDb.close();
    }
  }
}

// Rollback database to backup
function restoreDatabaseBackup(timestamp: string) {
  logInfo('Initiating database restore from backup...');
  try {
    // Rename failed database
    const failedDbPath = dbPath.replace('.db', `.failed-${timestamp}.db`);
    if (fs.existsSync(dbPath)) {
      fs.renameSync(dbPath, failedDbPath);
      logInfo(`Failed DB preserved at: ${failedDbPath}`);
    }

    // Rename WAL and SHM files if present
    const walFile = dbPath + '-wal';
    const shmFile = dbPath + '-shm';
    if (fs.existsSync(walFile)) {
      fs.renameSync(walFile, failedDbPath + '-wal');
    }
    if (fs.existsSync(shmFile)) {
      fs.renameSync(shmFile, failedDbPath + '-shm');
    }

    // Restore backup
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, dbPath);
      logInfo('Database backup file copied back.');
      
      // Verify integrity
      const restoreCheckDb = new Database(dbPath);
      const integrity = (restoreCheckDb.pragma('integrity_check') as any)[0];
      restoreCheckDb.close();
      
      const statusStr = typeof integrity === 'string' ? integrity : (integrity?.integrity_check || 'ok');
      if (statusStr.toLowerCase() === 'ok') {
        logInfo('Restored database integrity check passed.');
      } else {
        throw new Error(`Integrity check failed for restored database: ${JSON.stringify(integrity)}`);
      }
    } else {
      throw new Error('No pre-migration backup file exists to restore!');
    }
  } catch (err) {
    logError('Fatal error during database restoration', err);
    dialog.showErrorBox(
      'Database Restoration Failure',
      'The database migration failed, and the application was unable to restore the backup automatically. Please contact support.'
    );
    app.quit();
  }
}

// Custom migration runner
export function verifyAndMigrateDatabase(): boolean {
  dbStatus = 'MIGRATING';
  const isDev = !app.isPackaged;
  
  // Create directories if missing
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Backup database if it already exists
  const isExistingDb = fs.existsSync(dbPath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  if (isExistingDb) {
    try {
      backupDatabase();
    } catch (err) {
      dbStatus = 'BACKUP_FAILED';
      dialog.showErrorBox(
        'Database Backup Failed',
        'Could not create a safe backup of the database. Startup aborted to prevent potential data loss.'
      );
      app.quit();
      return false;
    }
  }

  // Resolve migrations path
  const migrationsDir = isDev 
    ? path.join(process.cwd(), 'prisma', 'migrations')
    : path.join(process.resourcesPath, 'prisma', 'migrations');

  logInfo(`Loading bundled migrations from: ${migrationsDir}`);

  if (!fs.existsSync(migrationsDir)) {
    logInfo('No migrations folder found. Assuming database is managed externally or already up-to-date.');
    return true;
  }

  // Open migration connection
  let db: Database.Database | null = null;
  try {
    db = new Database(dbPath);
    
    // Enable SQLite safety options
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Create AppMigration table if missing
    db.exec(`
      CREATE TABLE IF NOT EXISTS AppMigration (
        id TEXT PRIMARY KEY,
        migrationName TEXT NOT NULL,
        checksum TEXT NOT NULL,
        appliedAt TEXT NOT NULL,
        applicationVersion TEXT NOT NULL
      );
    `);

    // Get list of migration folders sorted chronologically
    const folders = fs.readdirSync(migrationsDir)
      .filter(f => fs.statSync(path.join(migrationsDir, f)).isDirectory() && f.includes('_'))
      .sort(); // Folder names start with timestamps (e.g. 20260727120000_init), sorting works alphabetically/chronologically

    for (const folder of folders) {
      const sqlPath = path.join(migrationsDir, folder, 'migration.sql');
      if (!fs.existsSync(sqlPath)) continue;

      const checksum = computeFileChecksum(sqlPath);
      const migrationName = folder;

      // Check if migration is already applied
      const row = db.prepare('SELECT checksum FROM AppMigration WHERE migrationName = ?').get(migrationName) as { checksum: string } | undefined;

      if (row) {
        // Verify checksum
        if (row.checksum !== checksum) {
          throw new Error(`Checksum verification failed for migration "${migrationName}". Expected "${row.checksum}", got "${checksum}". The migration file has been modified!`);
        }
        logInfo(`Migration already applied: ${migrationName}`);
      } else {
        // Execute pending migration transactionally
        logInfo(`Applying pending migration: ${migrationName}`);
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');

        // Run execution within a transaction
        const runMigrationTx = db.transaction(() => {
          db!.exec(sqlContent);
          db!.prepare(`
            INSERT INTO AppMigration (id, migrationName, checksum, appliedAt, applicationVersion)
            VALUES (?, ?, ?, datetime('now'), ?)
          `).run(crypto.randomUUID(), migrationName, checksum, app.getVersion());
        });

        runMigrationTx();
        logInfo(`Migration applied successfully: ${migrationName}`);
      }
    }

    db.close();
    db = null;
    logInfo('Database migrations complete.');
    return true;
  } catch (err) {
    dbStatus = 'MIGRATION_FAILED';
    logError('Migration runner failed', err);

    if (db) {
      try {
        db.close();
      } catch (closeErr) {}
    }

    if (isExistingDb) {
      restoreDatabaseBackup(timestamp);
    }

    dialog.showErrorBox(
      'Database Migration Error',
      `The database could not be initialized or migrated. The application was rolled back to its previous state.\n\nDetails: ${err instanceof Error ? err.message : String(err)}`
    );
    
    app.quit();
    return false;
  }
}

// Initialize Prisma Client after migrations succeed
export async function initializePrisma(): Promise<boolean> {
  logInfo('Initializing Prisma Client...');
  try {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: `file:${dbPath}`,
        },
      },
      log: [
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });

    // Pipe Prisma logs to our logger
    const prismaAny = prisma as any;
    prismaAny.$on('info', (e: any) => logInfo(`[Prisma] ${e.message}`));
    prismaAny.$on('warn', (e: any) => logInfo(`[Prisma-WARN] ${e.message}`));
    prismaAny.$on('error', (e: any) => logError('Prisma Engine', new Error(e.message)));

    await prisma.$connect();

    // Verify connectivity and schema integrity
    await prisma.$queryRawUnsafe('SELECT 1');
    
    // Verify Shop table exists
    await prisma.shop.count();

    dbStatus = 'CONNECTED';
    logInfo('Prisma Client connected and database verified.');
    return true;
  } catch (err) {
    dbStatus = 'PRISMA_CONNECTION_FAILED';
    logError('Failed to initialize Prisma Client', err);
    dialog.showErrorBox(
      'Database Connection Error',
      'The local database could not be opened by the application runtime.'
    );
    app.quit();
    return false;
  }
}
