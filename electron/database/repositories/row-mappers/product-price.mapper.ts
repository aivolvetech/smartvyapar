import { ProductPrice } from '../../../../shared/models/product-price';

export function mapRowToProductPrice(row: any): ProductPrice {
  if (!row) throw new Error('Cannot map empty row to ProductPrice');
  return {
    id: row.id,
    productId: row.productId,
    priceBookId: row.priceBookId,
    purchasePrice: row.purchasePrice ?? 0,
    sellingPrice: row.sellingPrice ?? 0,
    mrp: row.mrp ?? 0,
    wholesalePrice: row.wholesalePrice ?? null,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo || null,
    isActive: Boolean(row.isActive),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}
