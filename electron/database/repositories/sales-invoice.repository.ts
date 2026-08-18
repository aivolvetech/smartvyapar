import { getDatabaseConnection } from '../database-connection';
import { SalesInvoice, SalesInvoiceStatus, SalesInvoiceDiscountType } from '../../../shared/models/sales';
import { mapRowToSalesInvoice } from './row-mappers/sales.mapper';
import { RepositoryError } from './repository-errors';

export class SalesInvoiceRepository {
  public findById(id: string): SalesInvoice | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT * FROM SalesInvoice WHERE id = ?').get(id);
      return row ? mapRowToSalesInvoice(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find sales invoice by id: ${err.message}`);
    }
  }

  public findByDraftReference(shopId: string, draftReference: string): SalesInvoice | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT * FROM SalesInvoice WHERE shopId = ? AND draftReference = ?').get(shopId, draftReference);
      return row ? mapRowToSalesInvoice(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find sales invoice by draftReference: ${err.message}`);
    }
  }

  public create(input: {
    id: string;
    shopId: string;
    customerId: string;
    draftReference: string;
    invoiceDate: string;
    status: SalesInvoiceStatus;
    notes?: string | null;
    createdAt: string;
    updatedAt: string;
  }): SalesInvoice {
    try {
      const db = getDatabaseConnection();
      db.prepare(`
        INSERT INTO SalesInvoice (
          id, shopId, customerId, draftReference, invoiceNumber, invoiceDate, dueDate,
          status, paymentStatus, salesChannel, subtotal, lineDiscountTotal,
          invoiceDiscountType, invoiceDiscountValue, invoiceDiscountTotal,
          taxableAmount, cgstTotal, sgstTotal, igstTotal, cessTotal, roundOff, grandTotal,
          paidAmount, outstandingAmount, changeAmount, notes, heldAt, postedAt, cancelledAt,
          cancellationReason, createdAt, updatedAt, version
        ) VALUES (
          ?, ?, ?, ?, NULL, ?, NULL,
          ?, 'UNPAID', 'POS', 0, 0,
          'NONE', 0, 0,
          0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, ?, NULL, NULL, NULL,
          NULL, ?, ?, 1
        )
      `).run(
        input.id,
        input.shopId,
        input.customerId,
        input.draftReference,
        input.invoiceDate,
        input.status,
        input.notes ?? null,
        input.createdAt,
        input.updatedAt
      );

      const row = db.prepare('SELECT * FROM SalesInvoice WHERE id = ?').get(input.id);
      if (!row) throw new Error('Inserted row not found');
      return mapRowToSalesInvoice(row);
    } catch (err: any) {
      throw new RepositoryError(`Failed to create sales invoice: ${err.message}`);
    }
  }

  public update(invoice: SalesInvoice): void {
    try {
      const db = getDatabaseConnection();
      const result = db.prepare(`
        UPDATE SalesInvoice
        SET
          customerId = ?,
          invoiceNumber = ?,
          invoiceDate = ?,
          dueDate = ?,
          status = ?,
          paymentStatus = ?,
          salesChannel = ?,
          subtotal = ?,
          lineDiscountTotal = ?,
          invoiceDiscountType = ?,
          invoiceDiscountValue = ?,
          invoiceDiscountTotal = ?,
          taxableAmount = ?,
          cgstTotal = ?,
          sgstTotal = ?,
          igstTotal = ?,
          cessTotal = ?,
          roundOff = ?,
          grandTotal = ?,
          paidAmount = ?,
          outstandingAmount = ?,
          changeAmount = ?,
          notes = ?,
          heldAt = ?,
          postedAt = ?,
          cancelledAt = ?,
          cancellationReason = ?,
          updatedAt = ?,
          version = version + 1
        WHERE id = ? AND version = ?
      `).run(
        invoice.customerId,
        invoice.invoiceNumber,
        invoice.invoiceDate,
        invoice.dueDate,
        invoice.status,
        invoice.paymentStatus,
        invoice.salesChannel,
        invoice.subtotal,
        invoice.lineDiscountTotal,
        invoice.invoiceDiscountType,
        invoice.invoiceDiscountValue,
        invoice.invoiceDiscountTotal,
        invoice.taxableAmount,
        invoice.cgstTotal,
        invoice.sgstTotal,
        invoice.igstTotal,
        invoice.cessTotal,
        invoice.roundOff,
        invoice.grandTotal,
        invoice.paidAmount,
        invoice.outstandingAmount,
        invoice.changeAmount,
        invoice.notes,
        invoice.heldAt,
        invoice.postedAt,
        invoice.cancelledAt,
        invoice.cancellationReason,
        invoice.updatedAt,
        invoice.id,
        invoice.version
      );

      if (result.changes === 0) {
        throw new RepositoryError('Concurreny conflict or record not found during sales invoice update.');
      }
      invoice.version++;
    } catch (err: any) {
      throw new RepositoryError(`Failed to update sales invoice: ${err.message}`);
    }
  }

  public listDrafts(shopId: string): SalesInvoice[] {
    try {
      const db = getDatabaseConnection();
      const rows = db.prepare(`
        SELECT * FROM SalesInvoice 
        WHERE shopId = ? AND status IN ('DRAFT', 'HELD')
        ORDER BY createdAt DESC
      `).all(shopId);
      return rows.map(mapRowToSalesInvoice);
    } catch (err: any) {
      throw new RepositoryError(`Failed to list draft/held invoices: ${err.message}`);
    }
  }

  public delete(id: string): void {
    try {
      const db = getDatabaseConnection();
      db.prepare('DELETE FROM SalesInvoice WHERE id = ?').run(id);
    } catch (err: any) {
      throw new RepositoryError(`Failed to delete sales invoice: ${err.message}`);
    }
  }

  public getNextDraftSequence(shopId: string): number {
    try {
      const db = getDatabaseConnection();
      const rows = db.prepare(`
        SELECT draftReference FROM SalesInvoice 
        WHERE shopId = ? AND draftReference LIKE 'DFT-%'
      `).all(shopId) as { draftReference: string }[];

      let maxSeq = 0;
      for (const row of rows) {
        const match = row.draftReference.match(/^DFT-(\d+)$/i);
        if (match) {
          const seq = parseInt(match[1], 10);
          if (seq > maxSeq) maxSeq = seq;
        }
      }
      return maxSeq + 1;
    } catch (err: any) {
      throw new RepositoryError(`Failed to calculate next draft sequence: ${err.message}`);
    }
  }
}
