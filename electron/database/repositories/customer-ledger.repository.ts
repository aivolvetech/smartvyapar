import crypto from 'crypto';
import { getDatabaseConnection } from '../database-connection';
import { CustomerLedgerEntry, CustomerLedgerEntryType, CustomerOutstandingSummary } from '../../../shared/models/customer';
import { RepositoryError } from './repository-errors';

function mapRowToLedger(row: any): CustomerLedgerEntry {
  return {
    id: row.id,
    customerId: row.customerId,
    shopId: row.shopId,
    entryType: row.entryType as CustomerLedgerEntryType,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    referenceNumber: row.referenceNumber || null,
    debitAmount: row.debitAmount ?? 0,
    creditAmount: row.creditAmount ?? 0,
    occurredAt: row.occurredAt,
    notes: row.notes || null,
    idempotencyKey: row.idempotencyKey || null,
    createdAt: row.createdAt,
  };
}

export class CustomerLedgerRepository {
  public create(input: {
    customerId: string;
    shopId: string;
    entryType: CustomerLedgerEntryType;
    referenceType: string;
    referenceId: string;
    referenceNumber?: string | null;
    debitAmount?: number;
    creditAmount?: number;
    occurredAt?: string;
    notes?: string | null;
    idempotencyKey?: string | null;
  }): CustomerLedgerEntry {
    try {
      const db = getDatabaseConnection();
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO CustomerLedgerEntry (
          id, customerId, shopId, entryType, referenceType, referenceId, referenceNumber,
          debitAmount, creditAmount, occurredAt, notes, idempotencyKey, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.customerId,
        input.shopId,
        input.entryType,
        input.referenceType,
        input.referenceId,
        input.referenceNumber ?? null,
        input.debitAmount ?? 0,
        input.creditAmount ?? 0,
        input.occurredAt ?? now,
        input.notes ?? null,
        input.idempotencyKey ?? null,
        now
      );
      return this.findById(id)!;
    } catch (err: any) {
      throw new RepositoryError(`Failed to create customer ledger entry: ${err.message}`);
    }
  }

  public findById(id: string): CustomerLedgerEntry | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT * FROM CustomerLedgerEntry WHERE id = ?').get(id);
      return row ? mapRowToLedger(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find ledger entry by id: ${err.message}`);
    }
  }

  public findByIdempotencyKey(key: string): CustomerLedgerEntry | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT * FROM CustomerLedgerEntry WHERE idempotencyKey = ?').get(key);
      return row ? mapRowToLedger(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find ledger entry by idempotency key: ${err.message}`);
    }
  }

  public findOpeningEntry(customerId: string): CustomerLedgerEntry | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare(`
        SELECT * FROM CustomerLedgerEntry
        WHERE customerId = ? AND entryType = 'OPENING_BALANCE'
        LIMIT 1
      `).get(customerId);
      return row ? mapRowToLedger(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find customer opening ledger entry: ${err.message}`);
    }
  }

  public getOutstanding(customerId: string): CustomerOutstandingSummary {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare(`
        SELECT
          COALESCE(SUM(debitAmount), 0) AS totalDebits,
          COALESCE(SUM(creditAmount), 0) AS totalCredits
        FROM CustomerLedgerEntry
        WHERE customerId = ?
      `).get(customerId) as { totalDebits: number; totalCredits: number };

      const totalDebits = row.totalDebits ?? 0;
      const totalCredits = row.totalCredits ?? 0;
      return {
        customerId,
        totalDebits,
        totalCredits,
        outstanding: totalDebits - totalCredits,
      };
    } catch (err: any) {
      throw new RepositoryError(`Failed to load customer outstanding summary: ${err.message}`);
    }
  }

  public listByCustomer(
    customerId: string,
    filter: { page: number; pageSize: number }
  ): { items: CustomerLedgerEntry[]; totalItems: number; totalPages: number } {
    try {
      const db = getDatabaseConnection();
      const pageSize = Math.min(Math.max(filter.pageSize || 25, 1), 200);
      const page = Math.max(filter.page || 1, 1);
      const offset = (page - 1) * pageSize;

      const fromSql = `
        FROM CustomerLedgerEntry
        WHERE customerId = ?
      `;

      const count = db.prepare(`SELECT count(*) AS total ${fromSql}`).get(customerId) as { total: number };
      const rows = db.prepare(`
        SELECT *
        ${fromSql}
        ORDER BY occurredAt DESC, createdAt DESC
        LIMIT ? OFFSET ?
      `).all(customerId, pageSize, offset) as any[];

      const items = rows.map(mapRowToLedger);

      return {
        items,
        totalItems: count.total,
        totalPages: Math.max(1, Math.ceil(count.total / pageSize)),
      };
    } catch (err: any) {
      throw new RepositoryError(`Failed to query customer ledger: ${err.message}`);
    }
  }
}
