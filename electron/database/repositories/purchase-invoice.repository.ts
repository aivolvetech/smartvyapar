import crypto from 'crypto';
import { getDatabaseConnection } from '../database-connection';
import { RepositoryError } from './repository-errors';
import {
  PurchaseDiscountType,
  PurchaseFilter,
  PurchaseInvoice,
  PurchaseListItem,
  PurchaseListResult,
  PurchaseStatus,
} from '../../../shared/models/supplier-purchase';

const SORT_COLUMN_MAP: Record<PurchaseFilter['sortBy'], string> = {
  invoiceDate: 'pi.invoiceDate',
  purchaseNumber: 'pi.purchaseNumber',
  supplierName: 's.name',
  grandTotal: 'pi.grandTotal',
  updatedAt: 'pi.updatedAt',
};

function mapInvoice(row: any): PurchaseInvoice {
  return {
    id: row.id,
    shopId: row.shopId,
    supplierId: row.supplierId,
    purchaseNumber: row.purchaseNumber,
    supplierInvoiceNumber: row.supplierInvoiceNumber || null,
    invoiceDate: row.invoiceDate,
    dueDate: row.dueDate || null,
    status: row.status,
    subtotal: row.subtotal ?? 0,
    lineDiscountTotal: row.lineDiscountTotal ?? 0,
    invoiceDiscountType: row.invoiceDiscountType || 'NONE',
    invoiceDiscountValue: row.invoiceDiscountValue ?? 0,
    invoiceDiscountTotal: row.invoiceDiscountTotal ?? 0,
    taxableAmount: row.taxableAmount ?? 0,
    cgstTotal: row.cgstTotal ?? 0,
    sgstTotal: row.sgstTotal ?? 0,
    igstTotal: row.igstTotal ?? 0,
    cessTotal: row.cessTotal ?? 0,
    roundOff: row.roundOff ?? 0,
    grandTotal: row.grandTotal ?? 0,
    paidAmount: row.paidAmount ?? 0,
    outstandingAmount: row.outstandingAmount ?? 0,
    notes: row.notes || null,
    postedAt: row.postedAt ? new Date(row.postedAt).toISOString() : null,
    cancelledAt: row.cancelledAt ? new Date(row.cancelledAt).toISOString() : null,
    cancellationReason: row.cancellationReason || null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
    version: row.version ?? 1,
  };
}

export class PurchaseInvoiceRepository {
  public createDraft(input: {
    shopId: string;
    supplierId: string;
    purchaseNumber: string;
    supplierInvoiceNumber?: string | null;
    invoiceDate: string;
    dueDate?: string | null;
    invoiceDiscountType: PurchaseDiscountType;
    invoiceDiscountValue: number;
    notes?: string | null;
  }): PurchaseInvoice {
    try {
      const db = getDatabaseConnection();
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO PurchaseInvoice (
          id, shopId, supplierId, purchaseNumber, supplierInvoiceNumber,
          invoiceDate, dueDate, status, invoiceDiscountType, invoiceDiscountValue,
          notes, createdAt, updatedAt, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, 1)
      `).run(
        id,
        input.shopId,
        input.supplierId,
        input.purchaseNumber,
        input.supplierInvoiceNumber || null,
        input.invoiceDate,
        input.dueDate || null,
        input.invoiceDiscountType,
        input.invoiceDiscountValue,
        input.notes || null,
        now,
        now
      );
      return this.findById(id)!;
    } catch (err: any) {
      throw new RepositoryError(`Failed to create purchase draft: ${err.message}`);
    }
  }

  public updateDraft(id: string, input: {
    supplierId: string;
    supplierInvoiceNumber?: string | null;
    invoiceDate: string;
    dueDate?: string | null;
    invoiceDiscountType: PurchaseDiscountType;
    invoiceDiscountValue: number;
    notes?: string | null;
    totals: Pick<PurchaseInvoice, 'subtotal' | 'lineDiscountTotal' | 'invoiceDiscountTotal' | 'taxableAmount' | 'cgstTotal' | 'sgstTotal' | 'igstTotal' | 'cessTotal' | 'roundOff' | 'grandTotal'>;
  }): PurchaseInvoice {
    const db = getDatabaseConnection();
    db.prepare(`
      UPDATE PurchaseInvoice SET
        supplierId=?, supplierInvoiceNumber=?, invoiceDate=?, dueDate=?,
        invoiceDiscountType=?, invoiceDiscountValue=?, subtotal=?, lineDiscountTotal=?,
        invoiceDiscountTotal=?, taxableAmount=?, cgstTotal=?, sgstTotal=?, igstTotal=?,
        cessTotal=?, roundOff=?, grandTotal=?, outstandingAmount=?, notes=?,
        version=version+1, updatedAt=?
      WHERE id=? AND status='DRAFT'
    `).run(
      input.supplierId,
      input.supplierInvoiceNumber || null,
      input.invoiceDate,
      input.dueDate || null,
      input.invoiceDiscountType,
      input.invoiceDiscountValue,
      input.totals.subtotal,
      input.totals.lineDiscountTotal,
      input.totals.invoiceDiscountTotal,
      input.totals.taxableAmount,
      input.totals.cgstTotal,
      input.totals.sgstTotal,
      input.totals.igstTotal,
      input.totals.cessTotal,
      input.totals.roundOff,
      input.totals.grandTotal,
      input.totals.grandTotal,
      input.notes || null,
      new Date().toISOString(),
      id
    );
    const invoice = this.findById(id);
    if (!invoice) throw new RepositoryError('Purchase not found.');
    return invoice;
  }

  public updateTotals(id: string, totals: Pick<PurchaseInvoice, 'subtotal' | 'lineDiscountTotal' | 'invoiceDiscountTotal' | 'taxableAmount' | 'cgstTotal' | 'sgstTotal' | 'igstTotal' | 'cessTotal' | 'roundOff' | 'grandTotal'>): void {
    const db = getDatabaseConnection();
    db.prepare(`
      UPDATE PurchaseInvoice SET subtotal=?, lineDiscountTotal=?, invoiceDiscountTotal=?,
        taxableAmount=?, cgstTotal=?, sgstTotal=?, igstTotal=?, cessTotal=?,
        roundOff=?, grandTotal=?, outstandingAmount=?, version=version+1, updatedAt=?
      WHERE id=? AND status='DRAFT'
    `).run(
      totals.subtotal,
      totals.lineDiscountTotal,
      totals.invoiceDiscountTotal,
      totals.taxableAmount,
      totals.cgstTotal,
      totals.sgstTotal,
      totals.igstTotal,
      totals.cessTotal,
      totals.roundOff,
      totals.grandTotal,
      totals.grandTotal,
      new Date().toISOString(),
      id
    );
  }

  public markPosted(id: string): PurchaseInvoice {
    const db = getDatabaseConnection();
    const now = new Date().toISOString();
    const result = db.prepare(`
      UPDATE PurchaseInvoice
      SET status='POSTED', postedAt=?, outstandingAmount=grandTotal-paidAmount, version=version+1, updatedAt=?
      WHERE id=? AND status='DRAFT'
    `).run(now, now, id);
    if (result.changes !== 1) throw new RepositoryError('Purchase could not be posted.');
    return this.findById(id)!;
  }

  public markCancelled(id: string, reason: string): PurchaseInvoice {
    const db = getDatabaseConnection();
    const now = new Date().toISOString();
    const result = db.prepare(`
      UPDATE PurchaseInvoice
      SET status='CANCELLED', cancelledAt=?, cancellationReason=?, outstandingAmount=0,
          version=version+1, updatedAt=?
      WHERE id=? AND status='POSTED'
    `).run(now, reason, now, id);
    if (result.changes !== 1) throw new RepositoryError('Purchase could not be cancelled.');
    return this.findById(id)!;
  }

  public deleteDraft(id: string): void {
    const db = getDatabaseConnection();
    const result = db.prepare('DELETE FROM PurchaseInvoice WHERE id=? AND status=?').run(id, 'DRAFT');
    if (result.changes !== 1) throw new RepositoryError('Only draft purchases can be deleted.');
  }

  public findById(id: string): PurchaseInvoice | null {
    const db = getDatabaseConnection();
    const row = db.prepare('SELECT * FROM PurchaseInvoice WHERE id=?').get(id);
    return row ? mapInvoice(row) : null;
  }

  public duplicateSupplierInvoice(supplierId: string, supplierInvoiceNumber: string, excludeId?: string): boolean {
    if (!supplierInvoiceNumber.trim()) return false;
    const db = getDatabaseConnection();
    const row = db.prepare(`
      SELECT count(*) AS count FROM PurchaseInvoice
      WHERE supplierId=? AND supplierInvoiceNumber=? AND (? IS NULL OR id<>?)
    `).get(supplierId, supplierInvoiceNumber.trim(), excludeId ?? null, excludeId ?? null) as { count: number };
    return row.count > 0;
  }

  public list(filter: PurchaseFilter): PurchaseListResult {
    const db = getDatabaseConnection();
    const conditions: string[] = [];
    const params: any[] = [];
    if (filter.supplierId) {
      conditions.push('pi.supplierId=?');
      params.push(filter.supplierId);
    }
    if (filter.status) {
      conditions.push('pi.status=?');
      params.push(filter.status);
    }
    if (filter.dateFrom) {
      conditions.push('pi.invoiceDate >= ?');
      params.push(filter.dateFrom);
    }
    if (filter.dateTo) {
      conditions.push('pi.invoiceDate <= ?');
      params.push(filter.dateTo);
    }
    if (filter.search) {
      const q = `%${filter.search.trim()}%`;
      conditions.push('(pi.purchaseNumber LIKE ? OR pi.supplierInvoiceNumber LIKE ? OR s.name LIKE ? OR s.supplierCode LIKE ?)');
      params.push(q, q, q, q);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const fromSql = `FROM PurchaseInvoice pi INNER JOIN Supplier s ON s.id=pi.supplierId ${where}`;
    const count = db.prepare(`SELECT count(*) AS total ${fromSql}`).get(...params) as { total: number };
    const sortColumn = SORT_COLUMN_MAP[filter.sortBy] ?? 'pi.invoiceDate';
    const direction = filter.sortDirection === 'ASC' ? 'ASC' : 'DESC';
    const pageSize = Math.min(Math.max(filter.pageSize, 1), 200);
    const page = Math.max(filter.page, 1);
    const offset = (page - 1) * pageSize;
    const rows = db.prepare(`
      SELECT pi.id, pi.purchaseNumber, pi.supplierId, s.name AS supplierName,
        pi.supplierInvoiceNumber, pi.invoiceDate, pi.dueDate, pi.status,
        pi.taxableAmount, (pi.cgstTotal + pi.sgstTotal + pi.igstTotal + pi.cessTotal) AS taxTotal,
        pi.grandTotal, pi.outstandingAmount, pi.updatedAt
      ${fromSql}
      ORDER BY ${sortColumn} ${direction}, pi.id ASC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset) as any[];
    const items: PurchaseListItem[] = rows.map(row => ({
      id: row.id,
      purchaseNumber: row.purchaseNumber,
      supplierId: row.supplierId,
      supplierName: row.supplierName,
      supplierInvoiceNumber: row.supplierInvoiceNumber || null,
      invoiceDate: row.invoiceDate,
      dueDate: row.dueDate || null,
      status: row.status,
      taxableAmount: row.taxableAmount ?? 0,
      taxTotal: row.taxTotal ?? 0,
      grandTotal: row.grandTotal ?? 0,
      outstandingAmount: row.outstandingAmount ?? 0,
      updatedAt: new Date(row.updatedAt).toISOString(),
    }));
    return {
      items,
      pagination: { page, pageSize, totalItems: count.total, totalPages: Math.max(1, Math.ceil(count.total / pageSize)) },
    };
  }
}
