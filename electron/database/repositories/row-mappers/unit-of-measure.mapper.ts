import { UnitOfMeasure } from '../../../../shared/models/unit-of-measure';

export function mapRowToUnit(row: any): UnitOfMeasure {
  if (!row) throw new Error('Cannot map empty row to UnitOfMeasure');
  return {
    id: row.id,
    name: row.name,
    shortName: row.shortName,
    normalizedName: row.normalizedName,
    normalizedShortName: row.normalizedShortName,
    decimalAllowed: Boolean(row.decimalAllowed),
    decimalPlaces: row.decimalPlaces ?? 0,
    isActive: Boolean(row.isActive),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}
