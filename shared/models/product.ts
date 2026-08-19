export type ProductType = 'GOODS' | 'SERVICE';

export interface Product {
  id: string;
  productCode: string;
  normalizedProductCode: string;
  name: string;
  normalizedName: string;
  printName: string | null;
  description: string | null;
  categoryId: string | null;
  brandId: string | null;
  primaryUnitId: string;
  hsnSacCode: string | null;
  taxRateId: string | null;
  productType: ProductType;
  trackInventory: boolean;
  allowNegativeStock: boolean;
  negativeStockPolicy?: 'INHERIT' | 'ALLOW' | 'BLOCK';
  minimumStockLevel: number | null;
  reorderLevel: number | null;
  maximumStockLevel: number | null;
  sku: string | null;
  normalizedSku: string | null;
  // Derived cache — updated ONLY by PricingService
  cachedPurchasePrice: number | null;
  cachedSellingPrice: number | null;
  cachedMrp: number | null;
  cachedWholesalePrice: number | null;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductInput {
  productCode: string;
  name: string;
  printName?: string;
  description?: string;
  categoryId?: string;
  brandId?: string;
  primaryUnitId: string;
  hsnSacCode?: string;
  taxRateId?: string;
  productType?: ProductType;
  trackInventory?: boolean;
  allowNegativeStock?: boolean;
  negativeStockPolicy?: 'INHERIT' | 'ALLOW' | 'BLOCK';
  minimumStockLevel?: number;
  reorderLevel?: number;
  maximumStockLevel?: number;
  sku?: string;
}

export interface UpdateProductInput {
  productCode?: string;
  name?: string;
  printName?: string | null;
  description?: string | null;
  categoryId?: string | null;
  brandId?: string | null;
  primaryUnitId?: string;
  hsnSacCode?: string | null;
  taxRateId?: string | null;
  productType?: ProductType;
  trackInventory?: boolean;
  allowNegativeStock?: boolean;
  negativeStockPolicy?: 'INHERIT' | 'ALLOW' | 'BLOCK';
  minimumStockLevel?: number | null;
  reorderLevel?: number | null;
  maximumStockLevel?: number | null;
  sku?: string | null;
  isActive?: boolean;
}
