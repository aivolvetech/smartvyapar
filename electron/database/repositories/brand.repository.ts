import crypto from 'crypto';
import { getDatabaseConnection } from '../database-connection';
import { Brand, CreateBrandInput, UpdateBrandInput } from '../../../shared/models/brand';
import { mapRowToBrand } from './row-mappers/brand.mapper';
import { RepositoryError } from './repository-errors';

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export class BrandRepository {
  public listAll(activeOnly = false): Brand[] {
    try {
      const db = getDatabaseConnection();
      const sql = activeOnly
        ? 'SELECT * FROM Brand WHERE isActive = 1 ORDER BY name ASC'
        : 'SELECT * FROM Brand ORDER BY name ASC';
      return (db.prepare(sql).all() as any[]).map(mapRowToBrand);
    } catch (err: any) {
      throw new RepositoryError(`Failed to list brands: ${err.message}`);
    }
  }

  public findById(id: string): Brand | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT * FROM Brand WHERE id = ?').get(id);
      return row ? mapRowToBrand(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find brand: ${err.message}`);
    }
  }

  public findByNormalizedName(normalizedName: string): Brand | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT * FROM Brand WHERE normalizedName = ?').get(normalizedName);
      return row ? mapRowToBrand(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find brand by name: ${err.message}`);
    }
  }

  public isUsedByProduct(id: string): boolean {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT count(*) as c FROM Product WHERE brandId = ?').get(id) as { c: number };
      return row.c > 0;
    } catch (err: any) {
      throw new RepositoryError(`Failed to check brand usage: ${err.message}`);
    }
  }

  public create(input: CreateBrandInput): Brand {
    try {
      const db = getDatabaseConnection();
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO Brand (id, name, normalizedName, description, isActive, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, 1, ?, ?)
      `).run(id, input.name, normalize(input.name), input.description || null, now, now);
      return mapRowToBrand(db.prepare('SELECT * FROM Brand WHERE id = ?').get(id));
    } catch (err: any) {
      throw new RepositoryError(`Failed to create brand: ${err.message}`);
    }
  }

  public update(id: string, input: UpdateBrandInput): Brand {
    try {
      const db = getDatabaseConnection();
      const existing = this.findById(id);
      if (!existing) throw new RepositoryError(`Brand not found: ${id}`);
      const now = new Date().toISOString();
      const name = input.name !== undefined ? input.name : existing.name;
      const description = input.description !== undefined ? input.description : existing.description;
      const isActive = input.isActive !== undefined ? input.isActive : existing.isActive;
      db.prepare(`
        UPDATE Brand SET name=?, normalizedName=?, description=?, isActive=?, updatedAt=? WHERE id=?
      `).run(name, normalize(name), description || null, isActive ? 1 : 0, now, id);
      return mapRowToBrand(db.prepare('SELECT * FROM Brand WHERE id = ?').get(id));
    } catch (err: any) {
      throw new RepositoryError(`Failed to update brand: ${err.message}`);
    }
  }
}
