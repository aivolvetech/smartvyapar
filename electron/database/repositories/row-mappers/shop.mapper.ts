import { Shop } from '../../../../shared/models/shop';

export function mapRowToShop(row: any): Shop {
  if (!row) {
    throw new Error('Cannot map empty row to Shop');
  }
  return {
    id: row.id,
    name: row.name,
    phone: row.phone || null,
    address: row.address || null,
    gstNumber: row.gstNumber || null,
    merchantUpiId: row.merchantUpiId || null,
    createdAt: typeof row.createdAt === 'number'
      ? new Date(row.createdAt).toISOString()
      : new Date(row.createdAt).toISOString(),
    updatedAt: typeof row.updatedAt === 'number'
      ? new Date(row.updatedAt).toISOString()
      : new Date(row.updatedAt).toISOString(),
  };
}
