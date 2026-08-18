export interface StorePriceBook {
  id: string;
  shopId: string;
  priceBookId: string;
  priority: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStorePriceBookInput {
  shopId: string;
  priceBookId: string;
  priority?: number;
  effectiveFrom: string;
  effectiveTo?: string;
}
