import crypto from 'crypto';
import { getDatabaseConnection } from '../database-connection';
import { ProductPrice, CreateProductPriceInput, UpdateProductPriceInput } from '../../../shared/models/product-price';
import { mapRowToProductPrice } from './row-mappers/product-price.mapper';
import { RepositoryError } from './repository-errors';

export class ProductPriceRepository {
  /** Find active price for a product+priceBook combo effective at a given date */
  public findActivePrice(productId: string, priceBookId: string, asOfDate?: string): ProductPrice | null {
    try {
      const db = getDatabaseConnection();
      const date = asOfDate ?? new Date().toISOString().split('T')[0];
      const row = db.prepare(`
        SELECT * FROM ProductPrice
        WHERE productId = ? AND priceBookId = ? AND isActive = 1
          AND effectiveFrom <= ?
          AND (effectiveTo IS NULL OR effectiveTo >= ?)
        ORDER BY effectiveFrom DESC
        LIMIT 1
      `).get(productId, priceBookId, date, date);
      return row ? mapRowToProductPrice(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find active price: ${err.message}`);
    }
  }

  /** Detect any overlapping active price records for the same product+priceBook */
  public hasOverlap(productId: string, priceBookId: string, effectiveFrom: string, effectiveTo: string | null, excludeId?: string): boolean {
    try {
      const db = getDatabaseConnection();
      // Overlap exists when two ranges [A,B] and [C,D] satisfy: A <= D and C <= B
      // (NULL effectiveTo means "open end" = far future)
      let sql = `
        SELECT count(*) as c FROM ProductPrice
        WHERE productId = ? AND priceBookId = ? AND isActive = 1
          AND effectiveFrom <= COALESCE(?, '9999-12-31')
          AND COALESCE(effectiveTo, '9999-12-31') >= ?
      `;
      const params: any[] = [productId, priceBookId, effectiveTo, effectiveFrom];
      if (excludeId) {
        sql += ' AND id != ?';
        params.push(excludeId);
      }
      const row = db.prepare(sql).get(...params) as { c: number };
      return row.c > 0;
    } catch (err: any) {
      throw new RepositoryError(`Failed to check price overlap: ${err.message}`);
    }
  }

  public listByProduct(productId: string): ProductPrice[] {
    try {
      const db = getDatabaseConnection();
      return (db.prepare('SELECT * FROM ProductPrice WHERE productId = ? ORDER BY effectiveFrom DESC').all(productId) as any[])
        .map(mapRowToProductPrice);
    } catch (err: any) {
      throw new RepositoryError(`Failed to list product prices: ${err.message}`);
    }
  }

  public create(input: CreateProductPriceInput): ProductPrice {
    try {
      const db = getDatabaseConnection();
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO ProductPrice
          (id, productId, priceBookId, purchasePrice, sellingPrice, mrp, wholesalePrice,
           effectiveFrom, effectiveTo, isActive, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        id, input.productId, input.priceBookId,
        input.purchasePrice, input.sellingPrice, input.mrp,
        input.wholesalePrice ?? null,
        input.effectiveFrom, input.effectiveTo ?? null,
        now, now
      );
      return mapRowToProductPrice(db.prepare('SELECT * FROM ProductPrice WHERE id = ?').get(id));
    } catch (err: any) {
      throw new RepositoryError(`Failed to create product price: ${err.message}`);
    }
  }

  public update(id: string, input: UpdateProductPriceInput): ProductPrice {
    try {
      const db = getDatabaseConnection();
      const now = new Date().toISOString();
      const fields: string[] = [];
      const values: any[] = [];
      if (input.purchasePrice !== undefined)  { fields.push('purchasePrice=?');  values.push(input.purchasePrice); }
      if (input.sellingPrice !== undefined)   { fields.push('sellingPrice=?');   values.push(input.sellingPrice); }
      if (input.mrp !== undefined)            { fields.push('mrp=?');            values.push(input.mrp); }
      if (input.wholesalePrice !== undefined) { fields.push('wholesalePrice=?'); values.push(input.wholesalePrice); }
      if (input.effectiveTo !== undefined)    { fields.push('effectiveTo=?');    values.push(input.effectiveTo); }
      if (input.isActive !== undefined)       { fields.push('isActive=?');       values.push(input.isActive ? 1 : 0); }
      fields.push('updatedAt=?'); values.push(now);
      values.push(id);
      db.prepare(`UPDATE ProductPrice SET ${fields.join(',')} WHERE id=?`).run(...values);
      return mapRowToProductPrice(db.prepare('SELECT * FROM ProductPrice WHERE id = ?').get(id));
    } catch (err: any) {
      throw new RepositoryError(`Failed to update product price: ${err.message}`);
    }
  }

  /** Deactivate all active prices for a product (used during full price replacement) */
  public deactivateByProduct(productId: string, priceBookId: string): void {
    try {
      const db = getDatabaseConnection();
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE ProductPrice SET isActive=0, updatedAt=?
        WHERE productId=? AND priceBookId=? AND isActive=1
      `).run(now, productId, priceBookId);
    } catch (err: any) {
      throw new RepositoryError(`Failed to deactivate prices: ${err.message}`);
    }
  }
}
