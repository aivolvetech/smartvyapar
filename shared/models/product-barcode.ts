export interface ProductBarcode {
  id: string;
  productId: string;
  barcode: string;
  barcodeType: string;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductBarcodeInput {
  barcode: string;
  barcodeType?: string;
  isPrimary?: boolean;
}
