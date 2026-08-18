export interface Shop {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  gstNumber?: string | null;
  merchantUpiId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShopInput {
  name: string;
  phone?: string;
  address?: string;
  gstNumber?: string;
  merchantUpiId?: string;
}

export interface UpdateShopInput {
  name?: string;
  phone?: string | null;
  address?: string | null;
  gstNumber?: string | null;
  merchantUpiId?: string | null;
}
