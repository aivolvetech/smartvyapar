import crypto from 'crypto';
import { getDatabaseConnection } from '../database-connection';
import { UnitOfMeasure, CreateUnitOfMeasureInput, UpdateUnitOfMeasureInput } from '../../../shared/models/unit-of-measure';
import { mapRowToUnit } from './row-mappers/unit-of-measure.mapper';
import { RepositoryError } from './repository-errors';

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export class UnitOfMeasureRepository {
  public listAll(activeOnly = false): UnitOfMeasure[] {
    try {
      const db = getDatabaseConnection();
      const sql = activeOnly
        ? 'SELECT * FROM UnitOfMeasure WHERE isActive = 1 ORDER BY name ASC'
        : 'SELECT * FROM UnitOfMeasure ORDER BY name ASC';
      return (db.prepare(sql).all() as any[]).map(mapRowToUnit);
    } catch (err: any) {
      throw new RepositoryError(`Failed to list units: ${err.message}`);
    }
  }

  public findById(id: string): UnitOfMeasure | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT * FROM UnitOfMeasure WHERE id = ?').get(id);
      return row ? mapRowToUnit(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find unit by id: ${err.message}`);
    }
  }

  public findByNormalizedName(normalizedName: string): UnitOfMeasure | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT * FROM UnitOfMeasure WHERE normalizedName = ?').get(normalizedName);
      return row ? mapRowToUnit(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find unit by name: ${err.message}`);
    }
  }

  public findByNormalizedShortName(normalizedShortName: string): UnitOfMeasure | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT * FROM UnitOfMeasure WHERE normalizedShortName = ?').get(normalizedShortName);
      return row ? mapRowToUnit(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find unit by shortName: ${err.message}`);
    }
  }

  public isUsedByProduct(id: string): boolean {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT count(*) as c FROM Product WHERE primaryUnitId = ?').get(id) as { c: number };
      return row.c > 0;
    } catch (err: any) {
      throw new RepositoryError(`Failed to check unit usage: ${err.message}`);
    }
  }

  public create(input: CreateUnitOfMeasureInput): UnitOfMeasure {
    try {
      const db = getDatabaseConnection();
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO UnitOfMeasure (id, name, shortName, normalizedName, normalizedShortName,
          decimalAllowed, decimalPlaces, isActive, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        id, input.name, input.shortName,
        normalize(input.name), normalize(input.shortName),
        input.decimalAllowed ? 1 : 0,
        input.decimalAllowed ? (input.decimalPlaces ?? 3) : 0,
        now, now
      );
      return mapRowToUnit(db.prepare('SELECT * FROM UnitOfMeasure WHERE id = ?').get(id));
    } catch (err: any) {
      throw new RepositoryError(`Failed to create unit: ${err.message}`);
    }
  }

  public update(id: string, input: UpdateUnitOfMeasureInput): UnitOfMeasure {
    try {
      const db = getDatabaseConnection();
      const existing = this.findById(id);
      if (!existing) throw new RepositoryError(`Unit not found: ${id}`);
      const now = new Date().toISOString();
      const name = input.name !== undefined ? input.name : existing.name;
      const shortName = input.shortName !== undefined ? input.shortName : existing.shortName;
      const decimalAllowed = input.decimalAllowed !== undefined ? input.decimalAllowed : existing.decimalAllowed;
      const decimalPlaces = input.decimalPlaces !== undefined ? input.decimalPlaces : existing.decimalPlaces;
      const isActive = input.isActive !== undefined ? input.isActive : existing.isActive;
      db.prepare(`
        UPDATE UnitOfMeasure
        SET name=?, shortName=?, normalizedName=?, normalizedShortName=?,
            decimalAllowed=?, decimalPlaces=?, isActive=?, updatedAt=?
        WHERE id=?
      `).run(
        name, shortName, normalize(name), normalize(shortName),
        decimalAllowed ? 1 : 0,
        decimalAllowed ? decimalPlaces : 0,
        isActive ? 1 : 0, now, id
      );
      return mapRowToUnit(db.prepare('SELECT * FROM UnitOfMeasure WHERE id = ?').get(id));
    } catch (err: any) {
      throw new RepositoryError(`Failed to update unit: ${err.message}`);
    }
  }
}
