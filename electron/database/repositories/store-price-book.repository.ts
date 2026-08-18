import crypto from 'crypto';
import { getDatabaseConnection } from '../database-connection';
import { StorePriceBook, CreateStorePriceBookInput } from '../../../shared/models/store-price-book';
import { RepositoryError } from './repository-errors';

function mapRow(row: any): StorePriceBook {
  return {
    id: row.id,
    shopId: row.shopId,
    priceBookId: row.priceBookId,
    priority: row.priority ?? 1,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo || null,
    isActive: Boolean(row.isActive),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export class StorePriceBookRepository {
  public findActiveByShop(shopId: string): StorePriceBook | null {
    try {
      const db = getDatabaseConnection();
      const today = new Date().toISOString().split('T')[0];
      const row = db.prepare(`
        SELECT * FROM StorePriceBook
        WHERE shopId = ? AND isActive = 1
          AND effectiveFrom <= ?
          AND (effectiveTo IS NULL OR effectiveTo >= ?)
        ORDER BY priority DESC
        LIMIT 1
      `).get(shopId, today, today);
      return row ? mapRow(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find store price book: ${err.message}`);
    }
  }

  public hasOverlap(shopId: string, priceBookId: string, effectiveFrom: string, effectiveTo: string | null, excludeId?: string): boolean {
    try {
      const db = getDatabaseConnection();
      let sql = `
        SELECT count(*) as c FROM StorePriceBook
        WHERE shopId=? AND priceBookId=? AND isActive=1
          AND effectiveFrom <= COALESCE(?, '9999-12-31')
          AND COALESCE(effectiveTo, '9999-12-31') >= ?
      `;
      const params: any[] = [shopId, priceBookId, effectiveTo, effectiveFrom];
      if (excludeId) { sql += ' AND id != ?'; params.push(excludeId); }
      const row = db.prepare(sql).get(...params) as { c: number };
      return row.c > 0;
    } catch (err: any) {
      throw new RepositoryError(`Failed to check store price book overlap: ${err.message}`);
    }
  }

  public create(input: CreateStorePriceBookInput): StorePriceBook {
    try {
      const db = getDatabaseConnection();
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO StorePriceBook
          (id, shopId, priceBookId, priority, effectiveFrom, effectiveTo, isActive, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        id, input.shopId, input.priceBookId,
        input.priority ?? 1,
        input.effectiveFrom,
        input.effectiveTo ?? null,
        now, now
      );
      return mapRow(db.prepare('SELECT * FROM StorePriceBook WHERE id = ?').get(id));
    } catch (err: any) {
      throw new RepositoryError(`Failed to create store price book: ${err.message}`);
    }
  }
}
