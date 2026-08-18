import crypto from 'crypto';
import { getDatabaseConnection } from '../database-connection';
import { RepositoryError } from './repository-errors';
import {
  CreateSupplierInput,
  Supplier,
  SupplierFilter,
  SupplierListItem,
  SupplierListResult,
  SupplierOpeningBalanceType,
  UpdateSupplierInput,
} from '../../../shared/models/supplier-purchase';

const SORT_COLUMN_MAP: Record<SupplierFilter['sortBy'], string> = {
  supplierCode: 's.supplierCode',
  name: 's.name',
  city: 's.city',
  outstanding: 'outstanding',
  updatedAt: 's.updatedAt',
};

export function normalizeSupplierText(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}

function mapSupplier(row: any): Supplier {
  return {
    id: row.id,
    supplierCode: row.supplierCode,
    name: row.name,
    contactPerson: row.contactPerson || null,
    phone: row.phone || null,
    alternatePhone: row.alternatePhone || null,
    email: row.email || null,
    gstNumber: row.gstNumber || null,
    panNumber: row.panNumber || null,
    addressLine1: row.addressLine1 || null,
    addressLine2: row.addressLine2 || null,
    city: row.city || null,
    state: row.state || null,
    postalCode: row.postalCode || null,
    country: row.country || 'India',
    paymentTermsDays: row.paymentTermsDays ?? 0,
    creditLimit: row.creditLimit ?? 0,
    openingBalance: row.openingBalance ?? 0,
    openingBalanceType: row.openingBalanceType || 'NONE',
    notes: row.notes || null,
    isActive: Boolean(row.isActive),
    outstanding: row.outstanding ?? 0,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
    version: row.version ?? 1,
  };
}

export class SupplierRepository {
  public create(input: CreateSupplierInput): Supplier {
    try {
      const db = getDatabaseConnection();
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO Supplier (
          id, supplierCode, normalizedSupplierCode, name, normalizedName,
          contactPerson, phone, alternatePhone, email, gstNumber, panNumber,
          addressLine1, addressLine2, city, state, postalCode, country,
          paymentTermsDays, creditLimit, openingBalance, openingBalanceType,
          notes, isActive, createdAt, updatedAt, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        id,
        input.supplierCode.trim(),
        normalizeSupplierText(input.supplierCode),
        input.name.trim(),
        normalizeSupplierText(input.name),
        input.contactPerson?.trim() || null,
        input.phone?.trim() || null,
        input.alternatePhone?.trim() || null,
        input.email?.trim() || null,
        input.gstNumber?.trim().toUpperCase() || null,
        input.panNumber?.trim().toUpperCase() || null,
        input.addressLine1?.trim() || null,
        input.addressLine2?.trim() || null,
        input.city?.trim() || null,
        input.state?.trim() || null,
        input.postalCode?.trim() || null,
        input.country?.trim() || 'India',
        input.paymentTermsDays ?? 0,
        input.creditLimit ?? 0,
        input.openingBalance ?? 0,
        input.openingBalanceType ?? 'NONE',
        input.notes?.trim() || null,
        input.isActive === false ? 0 : 1,
        now,
        now
      );
      return this.findById(id)!;
    } catch (err: any) {
      throw new RepositoryError(`Failed to create supplier: ${err.message}`);
    }
  }

  public update(id: string, input: UpdateSupplierInput): Supplier {
    try {
      const db = getDatabaseConnection();
      const existing = this.findById(id);
      if (!existing) throw new RepositoryError('Supplier not found.');
      const merged = { ...existing, ...input };
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE Supplier SET
          supplierCode=?, normalizedSupplierCode=?, name=?, normalizedName=?,
          contactPerson=?, phone=?, alternatePhone=?, email=?, gstNumber=?, panNumber=?,
          addressLine1=?, addressLine2=?, city=?, state=?, postalCode=?, country=?,
          paymentTermsDays=?, creditLimit=?, openingBalance=?, openingBalanceType=?,
          notes=?, isActive=?, version=version+1, updatedAt=?
        WHERE id=?
      `).run(
        String(merged.supplierCode).trim(),
        normalizeSupplierText(String(merged.supplierCode)),
        String(merged.name).trim(),
        normalizeSupplierText(String(merged.name)),
        merged.contactPerson?.trim() || null,
        merged.phone?.trim() || null,
        merged.alternatePhone?.trim() || null,
        merged.email?.trim() || null,
        merged.gstNumber?.trim().toUpperCase() || null,
        merged.panNumber?.trim().toUpperCase() || null,
        merged.addressLine1?.trim() || null,
        merged.addressLine2?.trim() || null,
        merged.city?.trim() || null,
        merged.state?.trim() || null,
        merged.postalCode?.trim() || null,
        merged.country?.trim() || 'India',
        merged.paymentTermsDays ?? 0,
        merged.creditLimit ?? 0,
        merged.openingBalance ?? 0,
        (merged.openingBalanceType || 'NONE') as SupplierOpeningBalanceType,
        merged.notes?.trim() || null,
        merged.isActive === false ? 0 : 1,
        now,
        id
      );
      return this.findById(id)!;
    } catch (err: any) {
      throw new RepositoryError(`Failed to update supplier: ${err.message}`);
    }
  }

  public setActive(id: string, active: boolean): Supplier {
    try {
      const db = getDatabaseConnection();
      db.prepare('UPDATE Supplier SET isActive=?, version=version+1, updatedAt=? WHERE id=?')
        .run(active ? 1 : 0, new Date().toISOString(), id);
      const supplier = this.findById(id);
      if (!supplier) throw new RepositoryError('Supplier not found.');
      return supplier;
    } catch (err: any) {
      throw new RepositoryError(`Failed to set supplier active state: ${err.message}`);
    }
  }

  public findById(id: string): Supplier | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare(`
        SELECT s.*, COALESCE(l.outstanding, 0) AS outstanding
        FROM Supplier s
        LEFT JOIN (
          SELECT supplierId, COALESCE(SUM(creditAmount - debitAmount), 0) AS outstanding
          FROM SupplierLedgerEntry
          GROUP BY supplierId
        ) l ON l.supplierId = s.id
        WHERE s.id = ?
      `).get(id);
      return row ? mapSupplier(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find supplier: ${err.message}`);
    }
  }

  public findByNormalizedCode(code: string): Supplier | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT *, 0 AS outstanding FROM Supplier WHERE normalizedSupplierCode=?').get(code);
      return row ? mapSupplier(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find supplier by code: ${err.message}`);
    }
  }

  public isReferenced(id: string): boolean {
    const db = getDatabaseConnection();
    const row = db.prepare('SELECT count(*) AS count FROM PurchaseInvoice WHERE supplierId=?').get(id) as { count: number };
    return row.count > 0;
  }

  public list(filter: SupplierFilter): SupplierListResult {
    try {
      const db = getDatabaseConnection();
      const conditions: string[] = [];
      const params: any[] = [];
      if (filter.isActive !== undefined) {
        conditions.push('s.isActive=?');
        params.push(filter.isActive ? 1 : 0);
      }
      if (filter.search) {
        const norm = normalizeSupplierText(filter.search);
        conditions.push('(s.normalizedSupplierCode = ? OR s.normalizedName LIKE ? OR s.phone LIKE ? OR s.gstNumber LIKE ?)');
        params.push(norm, `%${norm}%`, `%${filter.search.trim()}%`, `%${filter.search.trim().toUpperCase()}%`);
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const sortColumn = SORT_COLUMN_MAP[filter.sortBy] ?? 's.name';
      const direction = filter.sortDirection === 'DESC' ? 'DESC' : 'ASC';
      const pageSize = Math.min(Math.max(filter.pageSize, 1), 200);
      const page = Math.max(filter.page, 1);
      const offset = (page - 1) * pageSize;
      const fromSql = `
        FROM Supplier s
        LEFT JOIN (
          SELECT supplierId, COALESCE(SUM(creditAmount - debitAmount), 0) AS outstanding
          FROM SupplierLedgerEntry GROUP BY supplierId
        ) l ON l.supplierId=s.id
        ${where}
      `;
      const count = db.prepare(`SELECT count(*) AS total ${fromSql}`).get(...params) as { total: number };
      const rows = db.prepare(`
        SELECT s.id, s.supplierCode, s.name, s.contactPerson, s.phone, s.gstNumber,
               s.city, s.paymentTermsDays, s.isActive, s.updatedAt,
               COALESCE(l.outstanding, 0) AS outstanding
        ${fromSql}
        ORDER BY ${sortColumn} ${direction}, s.id ASC
        LIMIT ? OFFSET ?
      `).all(...params, pageSize, offset) as any[];
      const items: SupplierListItem[] = rows.map(row => ({
        id: row.id,
        supplierCode: row.supplierCode,
        name: row.name,
        contactPerson: row.contactPerson || null,
        phone: row.phone || null,
        gstNumber: row.gstNumber || null,
        city: row.city || null,
        paymentTermsDays: row.paymentTermsDays ?? 0,
        outstanding: row.outstanding ?? 0,
        isActive: Boolean(row.isActive),
        updatedAt: new Date(row.updatedAt).toISOString(),
      }));
      return {
        items,
        pagination: { page, pageSize, totalItems: count.total, totalPages: Math.max(1, Math.ceil(count.total / pageSize)) },
      };
    } catch (err: any) {
      throw new RepositoryError(`Failed to list suppliers: ${err.message}`);
    }
  }
}
