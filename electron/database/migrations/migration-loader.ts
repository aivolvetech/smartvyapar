import { app } from 'electron';
import path from 'path';
import fs from 'fs';

export interface MigrationFile {
  name: string;
  sqlPath: string;
}

export function getMigrationsDir(): string {
  const isDev = !app.isPackaged;
  return isDev
    ? path.join(process.cwd(), 'prisma', 'migrations')
    : path.join(process.resourcesPath, 'prisma', 'migrations');
}

export function loadMigrations(): MigrationFile[] {
  const migrationsDir = getMigrationsDir();
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  return fs.readdirSync(migrationsDir)
    .filter(f => fs.statSync(path.join(migrationsDir, f)).isDirectory() && f.includes('_'))
    .sort()
    .map(folder => ({
      name: folder,
      sqlPath: path.join(migrationsDir, folder, 'migration.sql')
    }))
    .filter(m => fs.existsSync(m.sqlPath));
}
