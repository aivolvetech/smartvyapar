import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app } from 'electron';
import * as XLSX from 'xlsx';
import { getImportTempDir } from '../../database/database-paths';

export interface FileTokenData {
  token: string;
  originalName: string;
  tempPath: string;
  size: number;
  expiresAt: number;
}

export class ImportFileParserService {
  private static tokenMap = new Map<string, FileTokenData>();
  private static isInitialized = false;

  private static getTempDir(): string {
    const dir = getImportTempDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  public static initialize(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.getTempDir();
    // Set periodic garbage collection of expired tokens every 5 minutes
    setInterval(() => this.cleanupExpiredTokens(), 5 * 60 * 1000);
  }

  public registerFile(originalName: string, sourcePath: string): FileTokenData {
    const ext = path.extname(originalName).toLowerCase();
    if (ext !== '.csv' && ext !== '.xlsx') {
      throw new Error('Unsupported file extension. Only CSV and XLSX are supported.');
    }

    const token = `import-token-${crypto.randomUUID()}`;
    const tempPath = path.join(ImportFileParserService.getTempDir(), `${token}${ext}`);

    // Copy file to secure temp directory
    fs.copyFileSync(sourcePath, tempPath);
    const stats = fs.statSync(tempPath);

    // Initial limits check: 25 MB max file size
    if (stats.size > 25 * 1024 * 1024) {
      fs.unlinkSync(tempPath);
      throw new Error('File exceeds the maximum size limit of 25 MB.');
    }

    const fileData: FileTokenData = {
      token,
      originalName,
      tempPath,
      size: stats.size,
      expiresAt: Date.now() + 15 * 60 * 1000 // 15 minutes lifetime
    };

    ImportFileParserService.tokenMap.set(token, fileData);
    return fileData;
  }

  public getWorksheets(token: string): string[] {
    const fileData = this.getValidTokenData(token);
    const ext = path.extname(fileData.tempPath).toLowerCase();

    if (ext === '.csv') {
      return ['CSV_Sheet'];
    }

    try {
      const workbook = XLSX.readFile(fileData.tempPath, { bookSheets: true });
      return workbook.SheetNames || [];
    } catch (err: any) {
      throw new Error(`Failed to read Excel sheets: ${err.message}`);
    }
  }

  public parseRows(token: string, worksheetName?: string): unknown[] {
    const fileData = this.getValidTokenData(token);
    const ext = path.extname(fileData.tempPath).toLowerCase();

    if (ext === '.csv') {
      return this.parseCsv(fileData.tempPath);
    } else {
      return this.parseXlsx(fileData.tempPath, worksheetName);
    }
  }

  private parseCsv(filePath: string): unknown[] {
    try {
      let buf = fs.readFileSync(filePath);
      // Strip UTF-8 BOM if present to avoid SheetJS codepage corruption eating first characters
      if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
        buf = buf.subarray(3);
      }

      const workbook = XLSX.read(buf, { type: 'buffer', codepage: 65001, cellFormula: false });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      this.validateParsedRows(rows);
      return rows;
    } catch (err: any) {
      throw new Error(`Failed to parse CSV file: ${err.message}`);
    }
  }

  private parseXlsx(filePath: string, sheetName?: string): unknown[] {
    try {
      const workbook = XLSX.readFile(filePath, { cellFormula: false });

      // Reject macro-enabled workbooks
      if (workbook.vbaraw) {
        throw new Error('Excel files with VBA macros are blocked for security reasons.');
      }

      const activeSheet = sheetName || workbook.SheetNames[0];
      if (!workbook.SheetNames.includes(activeSheet)) {
        throw new Error(`Sheet name "${activeSheet}" not found in workbook.`);
      }

      const sheet = workbook.Sheets[activeSheet];
      
      // Default to first sheet, verify if sheet is hidden
      const sheetProps = (workbook.Workbook as any)?.Sheets?.find((s: any) => s.name === activeSheet);
      if (sheetProps && sheetProps.Hidden) {
        throw new Error(`Selected worksheet "${activeSheet}" is hidden and cannot be parsed.`);
      }

      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      this.validateParsedRows(rows);
      return rows;
    } catch (err: any) {
      throw new Error(`Failed to parse XLSX file: ${err.message}`);
    }
  }

  private validateParsedRows(rows: any[]): void {
    if (rows.length === 0) {
      throw new Error('The uploaded file contains no data rows.');
    }
    if (rows.length > 50000) {
      throw new Error('The file exceeds the maximum limit of 50,000 rows.');
    }
    // Verify first row contains headers
    const firstRowKeys = Object.keys(rows[0]);
    if (firstRowKeys.length === 0 || firstRowKeys.some(k => k.startsWith('__EMPTY'))) {
      throw new Error('The file lacks valid column headers.');
    }
    if (firstRowKeys.length > 100) {
      throw new Error('The file exceeds the maximum limit of 100 columns.');
    }
  }

  public getValidTokenData(token: string): FileTokenData {
    const fileData = ImportFileParserService.tokenMap.get(token);
    if (!fileData) {
      throw new Error('Invalid or expired file upload token.');
    }
    if (Date.now() > fileData.expiresAt) {
      this.cleanupToken(token);
      throw new Error('File upload token has expired. Please re-upload the file.');
    }
    return fileData;
  }

  public cleanupToken(token: string): void {
    const fileData = ImportFileParserService.tokenMap.get(token);
    if (fileData) {
      try {
        if (fs.existsSync(fileData.tempPath)) {
          fs.unlinkSync(fileData.tempPath);
        }
      } catch (err) {
        // Suppress unlink error
      }
      ImportFileParserService.tokenMap.delete(token);
    }
  }

  private static cleanupExpiredTokens(): void {
    const now = Date.now();
    for (const [token, fileData] of this.tokenMap.entries()) {
      if (now > fileData.expiresAt) {
        try {
          if (fs.existsSync(fileData.tempPath)) {
            fs.unlinkSync(fileData.tempPath);
          }
        } catch {}
        this.tokenMap.delete(token);
      }
    }
  }
}
