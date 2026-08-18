import crypto from 'crypto';
import { getDatabaseConnection } from '../database-connection';
import { Shop, CreateShopInput, UpdateShopInput } from '../../../shared/models/shop';
import { mapRowToShop } from './row-mappers/shop.mapper';
import { RepositoryError } from './repository-errors';

export class ShopRepository {
  public getShop(): Shop | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT * FROM Shop LIMIT 1').get();
      if (!row) return null;
      return mapRowToShop(row);
    } catch (err: any) {
      throw new RepositoryError(`Failed to fetch shop: ${err.message || String(err)}`);
    }
  }

  public shopExists(): boolean {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT count(*) as count FROM Shop').get() as { count: number };
      return row.count > 0;
    } catch (err: any) {
      throw new RepositoryError(`Failed to check shop existence: ${err.message || String(err)}`);
    }
  }

  public createShop(input: CreateShopInput): Shop {
    try {
      const db = getDatabaseConnection();
      const id = crypto.randomUUID();
      // SQLite store datetime as string or milliseconds. We will use ISO string formats.
      const nowStr = new Date().toISOString();

      db.prepare(`
        INSERT INTO Shop (id, name, phone, address, gstNumber, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.name,
        input.phone || null,
        input.address || null,
        input.gstNumber || null,
        nowStr,
        nowStr
      );

      const row = db.prepare('SELECT * FROM Shop WHERE id = ?').get(id);
      return mapRowToShop(row);
    } catch (err: any) {
      throw new RepositoryError(`Failed to create shop: ${err.message || String(err)}`);
    }
  }

  public updateShop(input: UpdateShopInput): Shop {
    try {
      const db = getDatabaseConnection();
      const existing = this.getShop();
      if (!existing) {
        throw new RepositoryError('No shop exists to update.');
      }

      const nowStr = new Date().toISOString();
      const name = input.name !== undefined ? input.name : existing.name;
      const phone = input.phone !== undefined ? input.phone : existing.phone;
      const address = input.address !== undefined ? input.address : existing.address;
      const gstNumber = input.gstNumber !== undefined ? input.gstNumber : existing.gstNumber;

      db.prepare(`
        UPDATE Shop
        SET name = ?, phone = ?, address = ?, gstNumber = ?, updatedAt = ?
        WHERE id = ?
      `).run(
        name,
        phone || null,
        address || null,
        gstNumber || null,
        nowStr,
        existing.id
      );

      const row = db.prepare('SELECT * FROM Shop WHERE id = ?').get(existing.id);
      return mapRowToShop(row);
    } catch (err: any) {
      throw new RepositoryError(`Failed to update shop: ${err.message || String(err)}`);
    }
  }
}
