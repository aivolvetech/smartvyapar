import { TaxRate } from '../../../../shared/models/tax-rate';

export function mapRowToTaxRate(row: any): TaxRate {
  if (!row) throw new Error('Cannot map empty row to TaxRate');
  return {
    id: row.id,
    name: row.name,
    rate: row.rate ?? 0,
    taxType: row.taxType,
    cgstRate: row.cgstRate ?? 0,
    sgstRate: row.sgstRate ?? 0,
    igstRate: row.igstRate ?? 0,
    cessRate: row.cessRate ?? 0,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo || null,
    isActive: Boolean(row.isActive),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}
