import { Brand } from '../../../../shared/models/brand';

export function mapRowToBrand(row: any): Brand {
  if (!row) throw new Error('Cannot map empty row to Brand');
  return {
    id: row.id,
    name: row.name,
    normalizedName: row.normalizedName,
    description: row.description || null,
    isActive: Boolean(row.isActive),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}
