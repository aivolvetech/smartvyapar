import { ipcMain } from 'electron';
import { AppService } from '../services/app.service';
import { isTrustedSender } from './security';
import { IPC_CHANNELS, IPCResponse, AppInfo } from '../../shared/types/ipc';
import { logError, logInfo } from '../utils/logger';

const appService = new AppService();

export function registerAppIpc() {
  ipcMain.handle(IPC_CHANNELS.APP_GET_INFO, async (event): Promise<IPCResponse<AppInfo>> => {
    if (!isTrustedSender(event)) {
      return { success: false, error: 'Access denied: Untrusted application frame.' };
    }
    
    try {
      logInfo('IPC Invoked: app:getInfo');
      const info = appService.getAppInfo();
      return { success: true, data: info };
    } catch (err) {
      logError('IPC app:getInfo failed', err);
      return { success: false, error: 'Could not retrieve application diagnostics.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.DB_STATUS, async (event): Promise<IPCResponse<{ state: 'CONNECTED' | 'MIGRATING' | 'ERROR'; encrypted: boolean; offline: boolean }>> => {
    if (!isTrustedSender(event)) {
      return { success: false, error: 'Access denied: Untrusted application frame.' };
    }
    try {
      const { getDatabaseStatus } = require('../database/database-initializer');
      const status = getDatabaseStatus();
      let state: 'CONNECTED' | 'MIGRATING' | 'ERROR' = 'ERROR';
      if (status === 'CONNECTED') {
        state = 'CONNECTED';
      } else if (status === 'MIGRATING') {
        state = 'MIGRATING';
      }
      return {
        success: true,
        data: {
          state,
          encrypted: true,
          offline: true
        }
      };
    } catch (err) {
      logError('IPC db:status failed', err);
      return { success: false, error: 'Could not retrieve database status.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.PRINT_WINDOW, async (event): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) {
      return { success: false, error: 'Access denied: Untrusted application frame.' };
    }
    try {
      logInfo('IPC Invoked: app:printWindow');
      const webContents = event.sender;
      return new Promise((resolve) => {
        webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
          if (success) {
            logInfo('Printing succeeded');
            resolve({ success: true });
          } else {
            logError('Printing failed', new Error(failureReason));
            resolve({ success: false, error: failureReason });
          }
        });
      });
    } catch (err: any) {
      logError('IPC app:printWindow failed', err);
      return { success: false, error: err.message || 'Could not initiate printing.' };
    }
  });
}
