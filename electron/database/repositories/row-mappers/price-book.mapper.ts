import { PriceBook } from '../../../../shared/models/price-book';

export function mapRowToPriceBook(row: any): PriceBook {
  if (!row) throw new Error('Cannot map empty row to PriceBook');
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description || null,
    isDefault: Boolean(row.isDefault),
    isActive: Boolean(row.isActive),
    effectiveFrom: row.effectiveFrom || null,
    effectiveTo: row.effectiveTo || null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}
