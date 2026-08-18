import { getDatabaseConnection } from '../database-connection';
import { TaxRate } from '../../../shared/models/tax-rate';
import { mapRowToTaxRate } from './row-mappers/tax-rate.mapper';
import { RepositoryError } from './repository-errors';

export class TaxRateRepository {
  public listAll(activeOnly = false): TaxRate[] {
    try {
      const db = getDatabaseConnection();
      const sql = activeOnly
        ? 'SELECT * FROM TaxRate WHERE isActive = 1 ORDER BY rate ASC'
        : 'SELECT * FROM TaxRate ORDER BY rate ASC';
      return (db.prepare(sql).all() as any[]).map(mapRowToTaxRate);
    } catch (err: any) {
      throw new RepositoryError(`Failed to list tax rates: ${err.message}`);
    }
  }

  public findById(id: string): TaxRate | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT * FROM TaxRate WHERE id = ?').get(id);
      return row ? mapRowToTaxRate(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find tax rate: ${err.message}`);
    }
  }

  public isUsedByProduct(id: string): boolean {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT count(*) as c FROM Product WHERE taxRateId = ?').get(id) as { c: number };
      return row.c > 0;
    } catch (err: any) {
      throw new RepositoryError(`Failed to check tax rate usage: ${err.message}`);
    }
  }

  /**
   * Deactivate a tax rate. Hard-delete is not permitted if referenced by products.
   * Tax records referenced by future transactions must be deactivated rather than deleted.
   */
  public setActive(id: string, isActive: boolean): TaxRate {
    try {
      const db = getDatabaseConnection();
      const now = new Date().toISOString();
      db.prepare('UPDATE TaxRate SET isActive=?, updatedAt=? WHERE id=?').run(isActive ? 1 : 0, now, id);
      const row = db.prepare('SELECT * FROM TaxRate WHERE id = ?').get(id);
      if (!row) throw new RepositoryError(`TaxRate not found: ${id}`);
      return mapRowToTaxRate(row);
    } catch (err: any) {
      throw new RepositoryError(`Failed to set tax rate active: ${err.message}`);
    }
  }
}
