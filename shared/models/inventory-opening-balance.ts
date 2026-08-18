export interface InventoryOpeningBalance {
  id: string;
  productId: string;
  shopId: string;
  quantity: number;
  unitCost: number;
  recordedAt: string;
  reference: string | null;
  createdAt: string;
}

export interface CreateInventoryOpeningBalanceInput {
  productId: string;
  shopId: string;
  quantity: number;
  unitCost?: number;
  recordedAt?: string;
  reference?: string;
}
