import { getDatabaseConnection } from '../database-connection';
import { SalesHistoryFilter, SalesHistoryItem, SalesHistoryResult, SalesInvoice, SalesInvoiceStatus, SalesInvoiceDiscountType } from '../../../shared/models/sales';
import { mapRowToSalesInvoice } from './row-mappers/sales.mapper';
import { RepositoryError } from './repository-errors';

export class SalesInvoiceRepository {
  public listHistory(filter: SalesHistoryFilter): SalesHistoryResult {
    try {
      const db = getDatabaseConnection();
      const page = Math.max(1, Math.trunc(filter.page || 1));
      const pageSize = Math.min(200, Math.max(1, Math.trunc(filter.pageSize || 25)));
      const where: string[] = ['si.shopId = ?'];
      const params: Array<string | number> = [filter.shopId];

      if (filter.dateFrom) { where.push('si.invoiceDate >= ?'); params.push(filter.dateFrom); }
      if (filter.dateTo) { where.push('si.invoiceDate <= ?'); params.push(filter.dateTo); }
      if (filter.invoiceNumber) {
        where.push('(LOWER(COALESCE(si.invoiceNumber, \'\')) LIKE ? OR LOWER(si.draftReference) LIKE ?)');
        const query = `%${filter.invoiceNumber.trim().toLowerCase()}%`;
        params.push(query, query);
      }
      if (filter.customerId) { where.push('si.customerId = ?'); params.push(filter.customerId); }
      if (filter.paymentStatus) { where.push('si.paymentStatus = ?'); params.push(filter.paymentStatus); }
      if (filter.status) { where.push('si.status = ?'); params.push(filter.status); }

      const whereSql = where.join(' AND ');
      const totalItems = Number((db.prepare(`SELECT COUNT(*) AS count FROM SalesInvoice si WHERE ${whereSql}`).get(...params) as any).count || 0);
      const rows = db.prepare(`
        SELECT si.id, si.invoiceNumber, si.draftReference, si.invoiceDate, si.postedAt,
               si.customerId, c.name AS customerName, c.customerCode, c.isWalkIn,
               si.grandTotal, si.paidAmount, si.outstandingAmount, si.paymentStatus,
               si.status, si.heldAt, si.cancelledAt, si.version
        FROM SalesInvoice si
        JOIN Customer c ON c.id = si.customerId
        WHERE ${whereSql}
        ORDER BY COALESCE(si.postedAt, si.heldAt, si.updatedAt) DESC, si.createdAt DESC
        LIMIT ? OFFSET ?
      `).all(...params, pageSize, (page - 1) * pageSize) as any[];

      const items: SalesHistoryItem[] = rows.map(row => ({
        id: row.id,
        invoiceNumber: row.invoiceNumber || null,
        draftReference: row.draftReference,
        invoiceDate: row.invoiceDate,
        postedAt: row.postedAt || null,
        customerId: row.customerId,
        customerName: row.customerName,
        customerCode: row.customerCode,
        isWalkIn: Boolean(row.isWalkIn),
        grandTotal: Number(row.grandTotal || 0),
        paidAmount: Number(row.paidAmount || 0),
        outstandingAmount: Number(row.outstandingAmount || 0),
        paymentStatus: row.paymentStatus,
        status: row.status,
        heldAt: row.heldAt || null,
        cancelledAt: row.cancelledAt || null,
        version: Number(row.version || 1),
      }));

      return { items, totalItems, page, pageSize, totalPages: Math.ceil(totalItems / pageSize) };
    } catch (err: any) {
      throw new RepositoryError(`Failed to list sales history: ${err.message}`);
    }
  }

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
