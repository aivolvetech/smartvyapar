import { getDatabaseConnection } from '../database-connection';
import { SalesInvoiceLine } from '../../../shared/models/sales';
import { mapRowToSalesInvoiceLine } from './row-mappers/sales.mapper';
import { RepositoryError } from './repository-errors';

export class SalesLineRepository {
  public create(line: SalesInvoiceLine): void {
    try {
      const db = getDatabaseConnection();
      db.prepare(`
        INSERT INTO SalesInvoiceLine (
          id, salesInvoiceId, productId, productCodeSnapshot, productNameSnapshot,
          barcodeSnapshot, hsnSacCodeSnapshot, productTypeSnapshot, unitId, unitNameSnapshot,
          taxRateId, taxCategorySnapshot, taxRateSnapshot, quantity, unitPrice, mrp,
          minimumSellingPrice, discountType, discountValue, discountAmount,
          invoiceDiscountAllocation, taxableAmount, cgstRate, cgstAmount, sgstRate, sgstAmount,
          igstRate, igstAmount, cessRate, cessAmount, lineTotal, inventoryTransactionId,
          createdAt, updatedAt
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?
        )
      `).run(
        line.id,
        line.salesInvoiceId,
        line.productId,
        line.productCodeSnapshot,
        line.productNameSnapshot,
        line.barcodeSnapshot ?? null,
        line.hsnSacCodeSnapshot ?? null,
        line.productTypeSnapshot,
        line.unitId ?? null,
        line.unitNameSnapshot ?? null,
        line.taxRateId ?? null,
        line.taxCategorySnapshot,
        line.taxRateSnapshot,
        line.quantity,
        line.unitPrice,
        line.mrp,
        line.minimumSellingPrice ?? null,
        line.discountType,
        line.discountValue,
        line.discountAmount,
        line.invoiceDiscountAllocation,
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
        line.createdAt,
        line.updatedAt
      );
    } catch (err: any) {
      throw new RepositoryError(`Failed to create sales invoice line: ${err.message}`);
    }
  }

  public findById(id: string): SalesInvoiceLine | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT * FROM SalesInvoiceLine WHERE id = ?').get(id);
      return row ? mapRowToSalesInvoiceLine(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find sales invoice line: ${err.message}`);
    }
  }

  public findByInvoiceId(invoiceId: string): SalesInvoiceLine[] {
    try {
      const db = getDatabaseConnection();
      const rows = db.prepare('SELECT * FROM SalesInvoiceLine WHERE salesInvoiceId = ? ORDER BY createdAt ASC').all(invoiceId);
      return rows.map(mapRowToSalesInvoiceLine);
    } catch (err: any) {
      throw new RepositoryError(`Failed to find sales invoice lines by invoice id: ${err.message}`);
    }
  }

  public update(line: SalesInvoiceLine): void {
    try {
      const db = getDatabaseConnection();
      db.prepare(`
        UPDATE SalesInvoiceLine
        SET 
          quantity = ?,
          unitPrice = ?,
          mrp = ?,
          discountType = ?,
          discountValue = ?,
          discountAmount = ?,
          invoiceDiscountAllocation = ?,
          taxableAmount = ?,
          cgstAmount = ?,
          sgstAmount = ?,
          igstAmount = ?,
          cessAmount = ?,
          lineTotal = ?,
          inventoryTransactionId = ?,
          updatedAt = ?
        WHERE id = ?
      `).run(
        line.quantity,
        line.unitPrice,
        line.mrp,
        line.discountType,
        line.discountValue,
        line.discountAmount,
        line.invoiceDiscountAllocation,
        line.taxableAmount,
        line.cgstAmount,
        line.sgstAmount,
        line.igstAmount,
        line.cessAmount,
        line.lineTotal,
        line.inventoryTransactionId ?? null,
        line.updatedAt,
        line.id
      );
    } catch (err: any) {
      throw new RepositoryError(`Failed to update sales invoice line: ${err.message}`);
    }
  }

  public delete(id: string): void {
    try {
      const db = getDatabaseConnection();
      db.prepare('DELETE FROM SalesInvoiceLine WHERE id = ?').run(id);
    } catch (err: any) {
      throw new RepositoryError(`Failed to delete sales invoice line: ${err.message}`);
    }
  }

  public deleteByInvoiceId(invoiceId: string): void {
    try {
      const db = getDatabaseConnection();
      db.prepare('DELETE FROM SalesInvoiceLine WHERE salesInvoiceId = ?').run(invoiceId);
    } catch (err: any) {
      throw new RepositoryError(`Failed to delete sales invoice lines: ${err.message}`);
    }
  }
}
