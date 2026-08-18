import { app } from 'electron';
import { AppInfo } from '../../shared/types/ipc';
import { getDatabaseStatus } from '../database/database-initializer';

export class AppService {
  public getAppInfo(): AppInfo {
    return {
      appName: 'Smart Vyapar',
      appVersion: app.getVersion(),
      platform: process.platform,
      dbStatus: getDatabaseStatus(),
      diagnosticInfo: {
        electronVersion: process.versions.electron || 'N/A',
        nodeVersion: process.versions.node || 'N/A',
        nodeAbi: process.versions.modules || 'N/A',
        prismaVersion: 'disabled',
        prismaEnginePath: 'disabled',
        betterSqlite3Path: 'better-sqlite3-multiple-ciphers',
      },
    };
  }
}
