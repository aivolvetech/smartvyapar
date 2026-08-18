import crypto from 'crypto';
import { getDatabaseConnection } from '../database-connection';
import { InventoryOpeningBalance, CreateInventoryOpeningBalanceInput } from '../../../shared/models/inventory-opening-balance';
import { RepositoryError } from './repository-errors';

function mapRow(row: any): InventoryOpeningBalance {
  return {
    id: row.id,
    productId: row.productId,
    shopId: row.shopId,
    quantity: row.quantity ?? 0,
    unitCost: row.unitCost ?? 0,
    recordedAt: row.recordedAt,
    reference: row.reference || null,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

export class InventoryOpeningBalanceRepository {
  public findByProductAndShop(productId: string, shopId: string): InventoryOpeningBalance | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare(
        'SELECT * FROM InventoryOpeningBalance WHERE productId=? AND shopId=?'
      ).get(productId, shopId);
      return row ? mapRow(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find opening balance: ${err.message}`);
    }
  }

  public create(input: CreateInventoryOpeningBalanceInput): InventoryOpeningBalance {
    try {
      const db = getDatabaseConnection();
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const recordedAt = input.recordedAt ?? now;
      db.prepare(`
        INSERT INTO InventoryOpeningBalance
          (id, productId, shopId, quantity, unitCost, recordedAt, reference, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, input.productId, input.shopId,
        input.quantity, input.unitCost ?? 0,
        recordedAt, input.reference || null, now
      );
      return mapRow(db.prepare('SELECT * FROM InventoryOpeningBalance WHERE id = ?').get(id));
    } catch (err: any) {
      throw new RepositoryError(`Failed to create opening balance: ${err.message}`);
    }
  }

  public deleteByProductId(productId: string): void {
    try {
      const db = getDatabaseConnection();
      db.prepare('DELETE FROM InventoryOpeningBalance WHERE productId = ?').run(productId);
    } catch (err: any) {
      throw new RepositoryError(`Failed to delete opening balance: ${err.message}`);
    }
  }
}
