import { app } from 'electron';
import path from 'path';

function isTestEnvironment(): boolean {
  return process.env.SMART_VYAPAR_TEST === 'true';
}

export function getDatabasePath(): string {
  if (isTestEnvironment()) {
    return path.join(process.cwd(), 'test-data', 'primary-integration', 'smart-vyapar.db');
  }
  return path.join(app.getPath('userData'), 'data', 'smart-vyapar.db');
}

export function getBackupPath(): string {
  if (isTestEnvironment()) {
    return path.join(process.cwd(), 'test-data', 'primary-integration', 'backups', 'smart-vyapar.db.bak');
  }
  return path.join(app.getPath('userData'), 'backups', 'smart-vyapar.db.bak');
}

export function getPlainDatabasePath(): string {
  if (isTestEnvironment()) {
    return path.join(process.cwd(), 'test-data', 'primary-integration', 'smart-vyapar.db');
  }
  return path.join(app.getPath('userData'), 'data', 'smart-vyapar.db');
}

export function getImportTempDir(): string {
  if (isTestEnvironment()) {
    return path.join(process.cwd(), 'test-data', 'temp-imports');
  }
  return path.join(app.getPath('userData'), 'temp-imports');
}
