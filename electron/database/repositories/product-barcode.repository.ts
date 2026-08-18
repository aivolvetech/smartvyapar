import crypto from 'crypto';
import { getDatabaseConnection } from '../database-connection';
import { ProductBarcode, CreateProductBarcodeInput } from '../../../shared/models/product-barcode';
import { mapRowToBarcode } from './row-mappers/product-barcode.mapper';
import { RepositoryError } from './repository-errors';

export class ProductBarcodeRepository {
  public listByProduct(productId: string): ProductBarcode[] {
    try {
      const db = getDatabaseConnection();
      return (db.prepare('SELECT * FROM ProductBarcode WHERE productId = ? ORDER BY isPrimary DESC').all(productId) as any[])
        .map(mapRowToBarcode);
    } catch (err: any) {
      throw new RepositoryError(`Failed to list barcodes: ${err.message}`);
    }
  }

  public findByBarcode(barcode: string): ProductBarcode | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT * FROM ProductBarcode WHERE barcode = ?').get(barcode);
      return row ? mapRowToBarcode(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find barcode: ${err.message}`);
    }
  }

  public barcodeExists(barcode: string, excludeProductId?: string): boolean {
    try {
      const db = getDatabaseConnection();
      const row = excludeProductId
        ? db.prepare('SELECT count(*) as c FROM ProductBarcode WHERE barcode=? AND productId != ?').get(barcode, excludeProductId) as { c: number }
        : db.prepare('SELECT count(*) as c FROM ProductBarcode WHERE barcode=?').get(barcode) as { c: number };
      return row.c > 0;
    } catch (err: any) {
      throw new RepositoryError(`Failed to check barcode existence: ${err.message}`);
    }
  }

  /** Create a barcode row; caller is responsible for primary-unset in the same transaction */
  public create(productId: string, input: CreateProductBarcodeInput): ProductBarcode {
    try {
      const db = getDatabaseConnection();
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO ProductBarcode (id, productId, barcode, barcodeType, isPrimary, isActive, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        id, productId, input.barcode,
        input.barcodeType || 'EAN13',
        input.isPrimary ? 1 : 0,
        now, now
      );
      return mapRowToBarcode(db.prepare('SELECT * FROM ProductBarcode WHERE id = ?').get(id));
    } catch (err: any) {
      throw new RepositoryError(`Failed to create barcode: ${err.message}`);
    }
  }

  /** Unset isPrimary on all barcodes for a product (before setting a new primary) */
  public clearPrimaryForProduct(productId: string): void {
    try {
      const db = getDatabaseConnection();
      const now = new Date().toISOString();
      db.prepare('UPDATE ProductBarcode SET isPrimary=0, updatedAt=? WHERE productId=?').run(now, productId);
    } catch (err: any) {
      throw new RepositoryError(`Failed to clear primary barcodes: ${err.message}`);
    }
  }

  public deactivate(id: string): void {
    try {
      const db = getDatabaseConnection();
      const now = new Date().toISOString();
      db.prepare('UPDATE ProductBarcode SET isActive=0, isPrimary=0, updatedAt=? WHERE id=?').run(now, id);
    } catch (err: any) {
      throw new RepositoryError(`Failed to deactivate barcode: ${err.message}`);
    }
  }

  public deleteByProductId(productId: string): void {
    try {
      const db = getDatabaseConnection();
      db.prepare('DELETE FROM ProductBarcode WHERE productId = ?').run(productId);
    } catch (err: any) {
      throw new RepositoryError(`Failed to delete barcodes: ${err.message}`);
    }
  }
}
