import crypto from 'crypto';
import { getDatabaseConnection } from '../database-connection';
import { RepositoryError } from './repository-errors';
import { PurchaseInvoiceLine } from '../../../shared/models/supplier-purchase';

export type PurchaseLineRowInput = Omit<PurchaseInvoiceLine, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

function mapLine(row: any): PurchaseInvoiceLine {
  return {
    id: row.id,
    purchaseInvoiceId: row.purchaseInvoiceId,
    productId: row.productId,
    productCodeSnapshot: row.productCodeSnapshot,
    productNameSnapshot: row.productNameSnapshot,
    hsnSacCodeSnapshot: row.hsnSacCodeSnapshot || null,
    taxRateId: row.taxRateId || null,
    taxRateSnapshot: row.taxRateSnapshot ?? 0,
    quantity: row.quantity ?? 0,
    unitId: row.unitId || null,
    unitNameSnapshot: row.unitNameSnapshot || null,
    unitPrice: row.unitPrice ?? 0,
    mrp: row.mrp ?? 0,
    discountType: row.discountType || 'NONE',
    discountValue: row.discountValue ?? 0,
    discountAmount: row.discountAmount ?? 0,
    taxableAmount: row.taxableAmount ?? 0,
    cgstRate: row.cgstRate ?? 0,
    cgstAmount: row.cgstAmount ?? 0,
    sgstRate: row.sgstRate ?? 0,
    sgstAmount: row.sgstAmount ?? 0,
    igstRate: row.igstRate ?? 0,
    igstAmount: row.igstAmount ?? 0,
    cessRate: row.cessRate ?? 0,
    cessAmount: row.cessAmount ?? 0,
    lineTotal: row.lineTotal ?? 0,
    inventoryTransactionId: row.inventoryTransactionId || null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export class PurchaseLineRepository {
  public replaceForInvoice(purchaseInvoiceId: string, lines: PurchaseLineRowInput[]): PurchaseInvoiceLine[] {
    try {
      const db = getDatabaseConnection();
      db.prepare('DELETE FROM PurchaseInvoiceLine WHERE purchaseInvoiceId=?').run(purchaseInvoiceId);
      for (const line of lines) {
        this.create({ ...line, purchaseInvoiceId });
      }
      return this.listByInvoice(purchaseInvoiceId);
    } catch (err: any) {
      throw new RepositoryError(`Failed to replace purchase lines: ${err.message}`);
    }
  }

  public create(line: PurchaseLineRowInput): PurchaseInvoiceLine {
    const db = getDatabaseConnection();
    const id = line.id || crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO PurchaseInvoiceLine (
        id, purchaseInvoiceId, productId, productCodeSnapshot, productNameSnapshot,
        hsnSacCodeSnapshot, taxRateId, taxRateSnapshot, quantity, unitId, unitNameSnapshot,
        unitPrice, mrp, discountType, discountValue, discountAmount, taxableAmount,
        cgstRate, cgstAmount, sgstRate, sgstAmount, igstRate, igstAmount, cessRate,
        cessAmount, lineTotal, inventoryTransactionId, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      line.purchaseInvoiceId,
      line.productId,
      line.productCodeSnapshot,
      line.productNameSnapshot,
      line.hsnSacCodeSnapshot ?? null,
      line.taxRateId ?? null,
      line.taxRateSnapshot,
      line.quantity,
      line.unitId ?? null,
      line.unitNameSnapshot ?? null,
      line.unitPrice,
      line.mrp,
      line.discountType,
      line.discountValue,
      line.discountAmount,
      line.taxableAmount,
      line.cgstRate,
      line.cgstAmount,
      line.sgstRate,
      line.sgstAmount,
      line.igstRate,
      line.igstAmount,
      line.cessRate,
      line.cessAmount,
      line.lineTotal,
      line.inventoryTransactionId ?? null,
      now,
      now
    );
    return this.findById(id)!;
  }

  public setInventoryTransaction(lineId: string, transactionId: string): void {
    const db = getDatabaseConnection();
    db.prepare('UPDATE PurchaseInvoiceLine SET inventoryTransactionId=?, updatedAt=? WHERE id=?')
      .run(transactionId, new Date().toISOString(), lineId);
  }

  public findById(id: string): PurchaseInvoiceLine | null {
    const db = getDatabaseConnection();
    const row = db.prepare('SELECT * FROM PurchaseInvoiceLine WHERE id=?').get(id);
    return row ? mapLine(row) : null;
  }

  public listByInvoice(purchaseInvoiceId: string): PurchaseInvoiceLine[] {
    const db = getDatabaseConnection();
    const rows = db.prepare(`
      SELECT * FROM PurchaseInvoiceLine
      WHERE purchaseInvoiceId=?
      ORDER BY createdAt ASC, id ASC
    `).all(purchaseInvoiceId) as any[];
    return rows.map(mapLine);
  }
}
