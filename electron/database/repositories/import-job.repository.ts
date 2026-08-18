import { getDatabaseConnection } from '../database-connection';
import { ImportJob, ImportJobRow, ImportHistoryFilter, ImportJobStatus, ImportRowStatus, ImportRowAction } from '../../../shared/types/import';
import { RepositoryError } from './repository-errors';

function mapJobRow(row: any): ImportJob {
  return {
    id: row.id,
    importType: row.importType as any,
    fileName: row.fileName,
    fileHash: row.fileHash,
    fileSize: row.fileSize,
    worksheetName: row.worksheetName,
    status: row.status as any,
    duplicatePolicy: row.duplicatePolicy as any,
    transactionMode: row.transactionMode as any,
    totalRows: row.totalRows,
    validRows: row.validRows,
    invalidRows: row.invalidRows,
    duplicateRows: row.duplicateRows,
    insertedRows: row.insertedRows,
    updatedRows: row.updatedRows,
    skippedRows: row.skippedRows,
    failedRows: row.failedRows,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    cancelledAt: row.cancelledAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    errorSummary: row.errorSummary,
    appVersion: row.appVersion,
  };
}

function mapRowRow(row: any): ImportJobRow {
  return {
    id: row.id,
    importJobId: row.importJobId,
    rowNumber: row.rowNumber,
    sourceKey: row.sourceKey,
    normalizedSourceKey: row.normalizedSourceKey,
    rowHash: row.rowHash,
    status: row.status as any,
    action: row.action as any,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    sourceDataJson: row.sourceDataJson,
    normalizedDataJson: row.normalizedDataJson,
    resultRecordId: row.resultRecordId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class ImportJobRepository {
  public createJob(job: ImportJob): ImportJob {
    try {
      const db = getDatabaseConnection();
      db.prepare(`
        INSERT INTO "ImportJob" (
          id, importType, fileName, fileHash, fileSize, worksheetName, status,
          duplicatePolicy, transactionMode, totalRows, validRows, invalidRows,
          duplicateRows, insertedRows, updatedRows, skippedRows, failedRows,
          startedAt, completedAt, cancelledAt, createdAt, updatedAt, errorSummary, appVersion
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        job.id, job.importType, job.fileName, job.fileHash, job.fileSize, job.worksheetName, job.status,
        job.duplicatePolicy, job.transactionMode, job.totalRows, job.validRows, job.invalidRows,
        job.duplicateRows, job.insertedRows, job.updatedRows, job.skippedRows, job.failedRows,
        job.startedAt, job.completedAt, job.cancelledAt, job.createdAt, job.updatedAt, job.errorSummary, job.appVersion
      );
      return job;
    } catch (err: any) {
      throw new RepositoryError(`Failed to create import job: ${err.message}`);
    }
  }

  public findJobById(id: string): ImportJob | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT * FROM "ImportJob" WHERE id = ?').get(id);
      return row ? mapJobRow(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find import job: ${err.message}`);
    }
  }

  public updateJobStatus(id: string, status: ImportJobStatus, extra: Partial<ImportJob> = {}): void {
    try {
      const db = getDatabaseConnection();
      const now = new Date().toISOString();
      const fields = ['status = ?', 'updatedAt = ?'];
      const values: any[] = [status, now];

      for (const [key, val] of Object.entries(extra)) {
        if (key !== 'id' && key !== 'status' && key !== 'createdAt' && key !== 'updatedAt') {
          fields.push(`"${key}" = ?`);
          values.push(val);
        }
      }
      values.push(id);

      db.prepare(`UPDATE "ImportJob" SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    } catch (err: any) {
      throw new RepositoryError(`Failed to update import job status: ${err.message}`);
    }
  }

  public listJobs(filter: ImportHistoryFilter): ImportJob[] {
    try {
      const db = getDatabaseConnection();
      let sql = 'SELECT * FROM "ImportJob"';
      const conditions: string[] = [];
      const values: any[] = [];

      if (filter.importType) {
        conditions.push('importType = ?');
        values.push(filter.importType);
      }
      if (filter.status) {
        conditions.push('status = ?');
        values.push(filter.status);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      sql += ' ORDER BY createdAt DESC';

      if (filter.limit !== undefined) {
        sql += ' LIMIT ?';
        values.push(filter.limit);
        if (filter.offset !== undefined) {
          sql += ' OFFSET ?';
          values.push(filter.offset);
        }
      }

      return (db.prepare(sql).all(...values) as any[]).map(mapJobRow);
    } catch (err: any) {
      throw new RepositoryError(`Failed to list import jobs: ${err.message}`);
    }
  }

  public createRows(rows: ImportJobRow[]): void {
    if (rows.length === 0) return;
    try {
      const db = getDatabaseConnection();
      const insert = db.prepare(`
        INSERT INTO "ImportJobRow" (
          id, importJobId, rowNumber, sourceKey, normalizedSourceKey, rowHash,
          status, action, errorCode, errorMessage, sourceDataJson, normalizedDataJson,
          resultRecordId, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      db.transaction(() => {
        for (const row of rows) {
          insert.run(
            row.id, row.importJobId, row.rowNumber, row.sourceKey, row.normalizedSourceKey, row.rowHash,
            row.status, row.action, row.errorCode, row.errorMessage, row.sourceDataJson, row.normalizedDataJson,
            row.resultRecordId, row.createdAt, row.updatedAt
          );
        }
      })();
    } catch (err: any) {
      throw new RepositoryError(`Failed to bulk create import rows: ${err.message}`);
    }
  }

  public getRowsByJobId(jobId: string, limit?: number, offset?: number): ImportJobRow[] {
    try {
      const db = getDatabaseConnection();
      let sql = 'SELECT * FROM "ImportJobRow" WHERE importJobId = ? ORDER BY rowNumber ASC';
      const values: any[] = [jobId];

      if (limit !== undefined) {
        sql += ' LIMIT ?';
        values.push(limit);
        if (offset !== undefined) {
          sql += ' OFFSET ?';
          values.push(offset);
        }
      }

      return (db.prepare(sql).all(...values) as any[]).map(mapRowRow);
    } catch (err: any) {
      throw new RepositoryError(`Failed to get import rows: ${err.message}`);
    }
  }

  public getRowsByStatus(jobId: string, statusList: ImportRowStatus[]): ImportJobRow[] {
    try {
      const db = getDatabaseConnection();
      const placeholders = statusList.map(() => '?').join(',');
      const rows = db.prepare(`
        SELECT * FROM "ImportJobRow"
        WHERE importJobId = ? AND status IN (${placeholders})
        ORDER BY rowNumber ASC
      `).all(jobId, ...statusList);
      return (rows as any[]).map(mapRowRow);
    } catch (err: any) {
      throw new RepositoryError(`Failed to get rows by status: ${err.message}`);
    }
  }

  public getRowsPreview(
    jobId: string,
    filterStatus?: ImportRowStatus[],
    pageIndex = 0,
    pageSize = 50
  ): { items: ImportJobRow[]; totalItems: number } {
    try {
      const db = getDatabaseConnection();
      let conditions = 'importJobId = ?';
      const values: any[] = [jobId];

      if (filterStatus && filterStatus.length > 0) {
        const placeholders = filterStatus.map(() => '?').join(',');
        conditions += ` AND status IN (${placeholders})`;
        values.push(...filterStatus);
      }

      const countRow = db.prepare(`SELECT count(*) as c FROM "ImportJobRow" WHERE ${conditions}`).get(...values) as { c: number };
      const totalItems = countRow.c;

      let sql = `SELECT * FROM "ImportJobRow" WHERE ${conditions} ORDER BY rowNumber ASC LIMIT ? OFFSET ?`;
      const offset = pageIndex * pageSize;
      values.push(pageSize, offset);

      const items = (db.prepare(sql).all(...values) as any[]).map(mapRowRow);
      return { items, totalItems };
    } catch (err: any) {
      throw new RepositoryError(`Failed to get rows preview: ${err.message}`);
    }
  }

  public updateRowStatusAndAction(
    rowId: string,
    status: ImportRowStatus,
    action: ImportRowAction,
    errorCode: string | null = null,
    errorMessage: string | null = null,
    resultRecordId: string | null = null
  ): void {
    try {
      const db = getDatabaseConnection();
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE "ImportJobRow"
        SET status = ?, action = ?, errorCode = ?, errorMessage = ?, resultRecordId = ?, updatedAt = ?
        WHERE id = ?
      `).run(status, action, errorCode, errorMessage, resultRecordId, now, rowId);
    } catch (err: any) {
      throw new RepositoryError(`Failed to update row status: ${err.message}`);
    }
  }

  public updateRowNormalizedData(
    rowId: string,
    normalizedDataJson: string,
    status: ImportRowStatus,
    action: ImportRowAction,
    errorCode: string | null = null,
    errorMessage: string | null = null
  ): void {
    try {
      const db = getDatabaseConnection();
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE "ImportJobRow"
        SET normalizedDataJson = ?, status = ?, action = ?, errorCode = ?, errorMessage = ?, updatedAt = ?
        WHERE id = ?
      `).run(normalizedDataJson, status, action, errorCode, errorMessage, now, rowId);
    } catch (err: any) {
      throw new RepositoryError(`Failed to update row normalized data: ${err.message}`);
    }
  }
}
