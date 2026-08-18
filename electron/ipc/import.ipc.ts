import { ipcMain, dialog, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/types/ipc';
import { isTrustedSender } from './security';
import { BulkImportService } from '../services/import/bulk-import.service';
import { ImportTemplateService } from '../services/import/import-template.service';
import { ImportType, ImportMapping, ImportDuplicatePolicy, ImportTransactionMode } from '../../shared/types/import';

import { ImportFileParserService } from '../services/import/import-file-parser.service';

export function registerImportIpc(): void {
  ImportFileParserService.initialize();
  const service = new BulkImportService();

  // 1. Select Import File (Native Dialog)
  ipcMain.handle(IPC_CHANNELS.IMPORT_SELECT_FILE, async (event) => {
    if (!isTrustedSender(event)) throw new Error('Unauthorized IPC call.');

    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) throw new Error('No active window context.');

    const result = await dialog.showOpenDialog(win, {
      title: 'Select Data Import File',
      filters: [{ name: 'Excel & CSV Files', extensions: ['csv', 'xlsx'] }],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'File selection cancelled.' };
    }

    try {
      const selectedPath = result.filePaths[0];
      const originalName = require('path').basename(selectedPath);
      const registered = service.selectAndRegisterFile(originalName, selectedPath);
      
      return {
        success: true,
        data: {
          token: registered.token,
          fileName: originalName,
          fileSize: registered.size
        }
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 2. Get Templates
  ipcMain.handle(IPC_CHANNELS.IMPORT_GET_TEMPLATES, async (event, importType: ImportType) => {
    if (!isTrustedSender(event)) throw new Error('Unauthorized IPC call.');
    try {
      return { success: true, data: service.getTemplates(importType) };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 2b. Get Columns Definitions
  ipcMain.handle(IPC_CHANNELS.IMPORT_GET_COLUMNS, async (event, importType: ImportType) => {
    if (!isTrustedSender(event)) throw new Error('Unauthorized IPC call.');
    try {
      return { success: true, data: ImportTemplateService.getColumnDefinitions(importType) };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 3. Create Import Job
  ipcMain.handle(IPC_CHANNELS.IMPORT_CREATE_JOB, async (event, payload: {
    importType: ImportType;
    fileName: string;
    fileHash: string;
    fileSize: number;
    worksheetName: string | null;
    token: string;
  }) => {
    if (!isTrustedSender(event)) throw new Error('Unauthorized IPC call.');
    try {
      return { success: true, data: service.createImportJob(payload) };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 4. Parse Import Job (populates rows)
  ipcMain.handle(IPC_CHANNELS.IMPORT_PARSE_JOB, async (event, payload: { jobId: string; token: string; worksheetName?: string }) => {
    if (!isTrustedSender(event)) throw new Error('Unauthorized IPC call.');
    try {
      service.parseAndPrepareJob(payload.jobId, payload.token, payload.worksheetName);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 5. Get Mapping Profile
  ipcMain.handle(IPC_CHANNELS.IMPORT_MAPPING_PROFILE, async (event, payload: { jobId: string; token: string }) => {
    if (!isTrustedSender(event)) throw new Error('Unauthorized IPC call.');
    try {
      const mapping = service.getColumnMappingProfile(payload.jobId, payload.token);
      return { success: true, data: mapping };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 6. Validate Import Job
  ipcMain.handle(IPC_CHANNELS.IMPORT_VALIDATE, async (event, payload: { jobId: string; mapping: ImportMapping }) => {
    if (!isTrustedSender(event)) throw new Error('Unauthorized IPC call.');
    try {
      const validation = service.validateJob(payload.jobId, payload.mapping);
      return { success: true, data: validation };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 7. Set Duplicate Policy
  ipcMain.handle(IPC_CHANNELS.IMPORT_DUPLICATE_POLICY, async (event, payload: { jobId: string; policy: ImportDuplicatePolicy }) => {
    if (!isTrustedSender(event)) throw new Error('Unauthorized IPC call.');
    try {
      service.setDuplicatePolicy(payload.jobId, payload.policy);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 8. Execute Import
  ipcMain.handle(IPC_CHANNELS.IMPORT_EXECUTE, async (event, payload: { jobId: string; transactionMode: ImportTransactionMode }) => {
    if (!isTrustedSender(event)) throw new Error('Unauthorized IPC call.');
    try {
      // Execute import is asynchronous to avoid freezing renderer
      setTimeout(() => {
        try {
          service.executeImport(payload.jobId, payload.transactionMode);
        } catch {}
      }, 0);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 9. Cancel Import Job
  ipcMain.handle(IPC_CHANNELS.IMPORT_CANCEL, async (event, jobId: string) => {
    if (!isTrustedSender(event)) throw new Error('Unauthorized IPC call.');
    try {
      service.cancelImportJob(jobId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 10. Get Import History
  ipcMain.handle(IPC_CHANNELS.IMPORT_HISTORY, async (event, filter: any) => {
    if (!isTrustedSender(event)) throw new Error('Unauthorized IPC call.');
    try {
      return { success: true, data: service.getHistory(filter) };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 11. Get Job Result
  ipcMain.handle(IPC_CHANNELS.IMPORT_RESULT, async (event, jobId: string) => {
    if (!isTrustedSender(event)) throw new Error('Unauthorized IPC call.');
    try {
      return { success: true, data: service.getJobResult(jobId) };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 12. Get Rows Preview
  ipcMain.handle(IPC_CHANNELS.IMPORT_PREVIEW, async (event, payload: { jobId: string; pageIndex?: number; pageSize?: number }) => {
    if (!isTrustedSender(event)) throw new Error('Unauthorized IPC call.');
    try {
      const preview = service.getRowsPreview(payload.jobId, payload.pageIndex, payload.pageSize);
      return { success: true, data: preview };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 13. Export Errors CSV string
  ipcMain.handle(IPC_CHANNELS.IMPORT_ERRORS_CSV, async (event, jobId: string) => {
    if (!isTrustedSender(event)) throw new Error('Unauthorized IPC call.');
    try {
      return { success: true, data: service.getJobErrorsCsv(jobId) };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}
