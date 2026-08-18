import { ProductCategory } from '../../../../shared/models/product-category';

export function mapRowToCategory(row: any): ProductCategory {
  if (!row) throw new Error('Cannot map empty row to ProductCategory');
  return {
    id: row.id,
    name: row.name,
    normalizedName: row.normalizedName,
    description: row.description || null,
    parentCategoryId: row.parentCategoryId || null,
    displayOrder: row.displayOrder ?? 0,
    isActive: Boolean(row.isActive),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}
