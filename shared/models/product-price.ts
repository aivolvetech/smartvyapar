export interface ProductPrice {
  id: string;
  productId: string;
  priceBookId: string;
  purchasePrice: number;
  sellingPrice: number;
  mrp: number;
  wholesalePrice: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductPriceInput {
  productId: string;
  priceBookId: string;
  purchasePrice: number;
  sellingPrice: number;
  mrp: number;
  wholesalePrice?: number;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface UpdateProductPriceInput {
  purchasePrice?: number;
  sellingPrice?: number;
  mrp?: number;
  wholesalePrice?: number | null;
  effectiveTo?: string;
  isActive?: boolean;
}
