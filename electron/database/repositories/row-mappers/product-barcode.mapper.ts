import { ProductBarcode } from '../../../../shared/models/product-barcode';

export function mapRowToBarcode(row: any): ProductBarcode {
  if (!row) throw new Error('Cannot map empty row to ProductBarcode');
  return {
    id: row.id,
    productId: row.productId,
    barcode: row.barcode,
    barcodeType: row.barcodeType || 'EAN13',
    isPrimary: Boolean(row.isPrimary),
    isActive: Boolean(row.isActive),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}
