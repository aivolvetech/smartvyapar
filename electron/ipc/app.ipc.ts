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

  ipcMain.handle(IPC_CHANNELS.PRINT_WINDOW, async (event, payload: { html: string }): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) {
      return { success: false, error: 'Access denied: Untrusted application frame.' };
    }
    try {
      logInfo('IPC Invoked: app:printWindow');
      const { html } = payload || {};
      if (!html) throw new Error('HTML content is required for printing.');

      const { BrowserWindow } = require('electron');
      const win = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              background: white !important;
              color: #000 !important;
              margin: 0;
              padding: 15px;
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              font-size: 13px;
              line-height: 1.4;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 12px 0;
            }
            th, td {
              border-bottom: 1px dashed #000;
              padding: 6px;
              text-align: left;
            }
          </style>
        </head>
        <body>
          ${html}
        </body>
        </html>
      `;

      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

      return new Promise((resolve) => {
        win.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
          win.destroy();
          if (success) {
            logInfo('Printing succeeded via hidden print window');
            resolve({ success: true });
          } else {
            logError('Printing failed via hidden print window', new Error(failureReason));
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
