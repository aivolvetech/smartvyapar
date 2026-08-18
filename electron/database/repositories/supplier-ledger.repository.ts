import crypto from 'crypto';
import { getDatabaseConnection } from '../database-connection';
import { RepositoryError } from './repository-errors';
import {
  SupplierLedgerEntry,
  SupplierLedgerEntryType,
  SupplierOutstandingSummary,
} from '../../../shared/models/supplier-purchase';

function mapEntry(row: any): SupplierLedgerEntry {
  return {
    id: row.id,
    supplierId: row.supplierId,
    shopId: row.shopId,
    entryType: row.entryType,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    referenceNumber: row.referenceNumber || null,
    debitAmount: row.debitAmount ?? 0,
    creditAmount: row.creditAmount ?? 0,
    occurredAt: new Date(row.occurredAt).toISOString(),
    notes: row.notes || null,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

export class SupplierLedgerRepository {
  public create(input: {
    supplierId: string;
    shopId: string;
    entryType: SupplierLedgerEntryType;
    referenceType: string;
    referenceId: string;
    referenceNumber?: string | null;
    debitAmount?: number;
    creditAmount?: number;
    occurredAt?: string;
    notes?: string | null;
  }): SupplierLedgerEntry {
    try {
      const db = getDatabaseConnection();
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO SupplierLedgerEntry (
          id, supplierId, shopId, entryType, referenceType, referenceId, referenceNumber,
          debitAmount, creditAmount, occurredAt, notes, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.supplierId,
        input.shopId,
        input.entryType,
        input.referenceType,
        input.referenceId,
        input.referenceNumber ?? null,
        input.debitAmount ?? 0,
        input.creditAmount ?? 0,
        input.occurredAt ?? now,
        input.notes ?? null,
        now
      );
      return this.findById(id)!;
    } catch (err: any) {
      throw new RepositoryError(`Failed to create supplier ledger entry: ${err.message}`);
    }
  }

  public findById(id: string): SupplierLedgerEntry | null {
    const db = getDatabaseConnection();
    const row = db.prepare('SELECT * FROM SupplierLedgerEntry WHERE id=?').get(id);
    return row ? mapEntry(row) : null;
  }

  public listByReference(referenceType: string, referenceId: string): SupplierLedgerEntry[] {
    const db = getDatabaseConnection();
    const rows = db.prepare(`
      SELECT * FROM SupplierLedgerEntry
      WHERE referenceType=? AND referenceId=?
      ORDER BY occurredAt ASC, createdAt ASC
    `).all(referenceType, referenceId) as any[];
    return rows.map(mapEntry);
  }

  public outstanding(supplierId: string): SupplierOutstandingSummary {
    const db = getDatabaseConnection();
    const row = db.prepare(`
      SELECT
        COALESCE(SUM(debitAmount), 0) AS totalDebits,
        COALESCE(SUM(creditAmount), 0) AS totalCredits
      FROM SupplierLedgerEntry
      WHERE supplierId=?
    `).get(supplierId) as { totalDebits: number; totalCredits: number };
    return {
      supplierId,
      totalDebits: row.totalDebits ?? 0,
      totalCredits: row.totalCredits ?? 0,
      outstanding: (row.totalCredits ?? 0) - (row.totalDebits ?? 0),
    };
  }
}
