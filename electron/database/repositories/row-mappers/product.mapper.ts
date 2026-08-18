import { Product } from '../../../../shared/models/product';

export function mapRowToProduct(row: any): Product {
  if (!row) throw new Error('Cannot map empty row to Product');
  return {
    id: row.id,
    productCode: row.productCode,
    normalizedProductCode: row.normalizedProductCode,
    name: row.name,
    normalizedName: row.normalizedName,
    printName: row.printName || null,
    description: row.description || null,
    categoryId: row.categoryId || null,
    brandId: row.brandId || null,
    primaryUnitId: row.primaryUnitId,
    hsnSacCode: row.hsnSacCode || null,
    taxRateId: row.taxRateId || null,
    productType: row.productType || 'GOODS',
    trackInventory: Boolean(row.trackInventory),
    allowNegativeStock: Boolean(row.allowNegativeStock),
    minimumStockLevel: row.minimumStockLevel ?? null,
    reorderLevel: row.reorderLevel ?? null,
    maximumStockLevel: row.maximumStockLevel ?? null,
    sku: row.sku || null,
    normalizedSku: row.normalizedSku || null,
    cachedPurchasePrice: row.cachedPurchasePrice ?? null,
    cachedSellingPrice: row.cachedSellingPrice ?? null,
    cachedMrp: row.cachedMrp ?? null,
    cachedWholesalePrice: row.cachedWholesalePrice ?? null,
    isActive: Boolean(row.isActive),
    version: row.version ?? 1,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}
