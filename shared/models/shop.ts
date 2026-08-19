export interface Shop {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  gstNumber?: string | null;
  merchantUpiId?: string | null;
  allowNegativeStockGlobally?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShopInput {
  name: string;
  phone?: string;
  address?: string;
  gstNumber?: string;
  merchantUpiId?: string;
  allowNegativeStockGlobally?: boolean;
}

export interface UpdateShopInput {
  name?: string;
  phone?: string | null;
  address?: string | null;
  gstNumber?: string | null;
  merchantUpiId?: string | null;
  allowNegativeStockGlobally?: boolean;
}
