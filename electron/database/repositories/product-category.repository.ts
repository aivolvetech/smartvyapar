import crypto from 'crypto';
import { getDatabaseConnection } from '../database-connection';
import { ProductCategory, CreateProductCategoryInput, UpdateProductCategoryInput } from '../../../shared/models/product-category';
import { mapRowToCategory } from './row-mappers/product-category.mapper';
import { RepositoryError } from './repository-errors';

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export class ProductCategoryRepository {
  public listAll(activeOnly = false): ProductCategory[] {
    try {
      const db = getDatabaseConnection();
      const sql = activeOnly
        ? 'SELECT * FROM ProductCategory WHERE isActive = 1 ORDER BY displayOrder ASC, name ASC'
        : 'SELECT * FROM ProductCategory ORDER BY displayOrder ASC, name ASC';
      return (db.prepare(sql).all() as any[]).map(mapRowToCategory);
    } catch (err: any) {
      throw new RepositoryError(`Failed to list categories: ${err.message}`);
    }
  }

  public findById(id: string): ProductCategory | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT * FROM ProductCategory WHERE id = ?').get(id);
      return row ? mapRowToCategory(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find category: ${err.message}`);
    }
  }

  public findByNormalizedNameAndParent(normalizedName: string, parentCategoryId: string | null): ProductCategory | null {
    try {
      const db = getDatabaseConnection();
      const row = parentCategoryId
        ? db.prepare('SELECT * FROM ProductCategory WHERE normalizedName=? AND parentCategoryId=?').get(normalizedName, parentCategoryId)
        : db.prepare('SELECT * FROM ProductCategory WHERE normalizedName=? AND parentCategoryId IS NULL').get(normalizedName);
      return row ? mapRowToCategory(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find category by name: ${err.message}`);
    }
  }

  public isUsedByProduct(id: string): boolean {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT count(*) as c FROM Product WHERE categoryId = ?').get(id) as { c: number };
      return row.c > 0;
    } catch (err: any) {
      throw new RepositoryError(`Failed to check category usage: ${err.message}`);
    }
  }

  /** Returns the chain of ancestor IDs from root down to this category */
  public getAncestorIds(id: string): string[] {
    try {
      const ancestors: string[] = [];
      let current = this.findById(id);
      while (current && current.parentCategoryId) {
        ancestors.unshift(current.parentCategoryId);
        current = this.findById(current.parentCategoryId);
      }
      return ancestors;
    } catch (err: any) {
      throw new RepositoryError(`Failed to resolve category ancestors: ${err.message}`);
    }
  }

  public create(input: CreateProductCategoryInput): ProductCategory {
    try {
      const db = getDatabaseConnection();
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO ProductCategory
          (id, name, normalizedName, description, parentCategoryId, displayOrder, isActive, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        id, input.name, normalize(input.name),
        input.description || null,
        input.parentCategoryId || null,
        input.displayOrder ?? 0,
        now, now
      );
      return mapRowToCategory(db.prepare('SELECT * FROM ProductCategory WHERE id = ?').get(id));
    } catch (err: any) {
      throw new RepositoryError(`Failed to create category: ${err.message}`);
    }
  }

  public update(id: string, input: UpdateProductCategoryInput): ProductCategory {
    try {
      const db = getDatabaseConnection();
      const existing = this.findById(id);
      if (!existing) throw new RepositoryError(`Category not found: ${id}`);
      const now = new Date().toISOString();
      const name = input.name !== undefined ? input.name : existing.name;
      const description = input.description !== undefined ? input.description : existing.description;
      const parentCategoryId = input.parentCategoryId !== undefined ? input.parentCategoryId : existing.parentCategoryId;
      const displayOrder = input.displayOrder !== undefined ? input.displayOrder : existing.displayOrder;
      const isActive = input.isActive !== undefined ? input.isActive : existing.isActive;
      db.prepare(`
        UPDATE ProductCategory
        SET name=?, normalizedName=?, description=?, parentCategoryId=?,
            displayOrder=?, isActive=?, updatedAt=?
        WHERE id=?
      `).run(
        name, normalize(name), description || null,
        parentCategoryId || null, displayOrder,
        isActive ? 1 : 0, now, id
      );
      return mapRowToCategory(db.prepare('SELECT * FROM ProductCategory WHERE id = ?').get(id));
    } catch (err: any) {
      throw new RepositoryError(`Failed to update category: ${err.message}`);
    }
  }
}
