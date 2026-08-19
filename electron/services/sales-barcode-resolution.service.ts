import { getDatabaseConnection } from '../database/database-connection';
import { POSProductResult } from '../../shared/types/pos';
import { SalesPriceResolutionService } from './sales-price-resolution.service';
import { resolveEffectiveNegativeStock } from './stock-policy';

export class SalesBarcodeResolutionService {
  private priceResolutionService = new SalesPriceResolutionService();

  public resolveProductByBarcode(input: {
    shopId: string;
    barcode: string;
    customerId?: string;
    draftDate?: string;
  }): POSProductResult {
    const db = getDatabaseConnection();
    const shop = db.prepare('SELECT * FROM Shop WHERE id = ?').get(input.shopId) as any;
    
    // 1. Normalize barcode deterministically
    const normalizedBarcode = input.barcode.trim();
    if (!normalizedBarcode) {
      throw new Error('Barcode cannot be empty.');
    }

    // 2. Find matching active barcodes
    const barcodeRows = db.prepare(`
      SELECT * FROM ProductBarcode 
      WHERE barcode = ? AND isActive = 1
    `).all(normalizedBarcode) as any[];

    if (barcodeRows.length === 0) {
      throw new Error('PRODUCT_NOT_FOUND');
    }

    // 3. Detect duplicate active barcode conflicts
    if (barcodeRows.length >= 2) {
      throw new Error(`Duplicate active barcode conflict detected for "${normalizedBarcode}".`);
    }

    const barcodeRow = barcodeRows[0];
    const productId = barcodeRow.productId;

    // 4. Load Product details
    const product = db.prepare('SELECT * FROM Product WHERE id = ?').get(productId) as any;
    if (!product) {
      throw new Error(`Product associated with barcode "${normalizedBarcode}" not found.`);
    }

    // 5. Confirm Product is active
    if (!product.isActive) {
      throw new Error(`Product "${product.name}" is inactive.`);
    }

    // 6. Load primary/default Unit
    let unitName: string | null = null;
    let allowsDecimalQuantity = false;
    let decimalPlaces = 0;
    if (product.primaryUnitId) {
      const unit = db.prepare('SELECT * FROM UnitOfMeasure WHERE id = ?').get(product.primaryUnitId) as any;
      if (unit) {
        if (!unit.isActive) {
          throw new Error(`Unit of measure "${unit.name}" is inactive.`);
        }
        unitName = unit.shortName;
        allowsDecimalQuantity = Boolean(unit.decimalAllowed);
        decimalPlaces = unit.decimalPlaces ?? 0;
      }
    }

    // 7. Load TaxRate
    let taxCategory: 'EXEMPT' | 'GST' | 'ZERO_RATED' | 'NON_GST' = 'EXEMPT';
    let taxRate = 0;
    if (product.taxRateId) {
      const tax = db.prepare('SELECT * FROM TaxRate WHERE id = ?').get(product.taxRateId) as any;
      if (tax) {
        if (!tax.isActive) {
          throw new Error(`Tax rate "${tax.name}" is inactive.`);
        }
        taxCategory = tax.taxType;
        taxRate = tax.rate;
      }
    }

    // 8. Resolve Product Price
    const priceResolution = this.priceResolutionService.resolvePrice({
      shopId: input.shopId,
      productId: product.id,
      customerId: input.customerId,
      draftDate: input.draftDate,
    });

    // 9. Load current stock summary (advisory only)
    const stockRow = db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) AS quantityOnHand
      FROM InventoryTransaction
      WHERE shopId = ? AND productId = ?
    `).get(input.shopId, product.id) as { quantityOnHand: number } | undefined;
    const currentStock = stockRow ? stockRow.quantityOnHand : 0;

    return {
      productId: product.id,
      productCode: product.productCode,
      productName: product.name,
      productType: product.productType,
      barcode: barcodeRow.barcode,
      unitId: product.primaryUnitId,
      unitName,
      allowsDecimalQuantity,
      decimalPlaces,
      taxRateId: product.taxRateId,
      taxCategory,
      taxRate,
      hsnSacCode: product.hsnSacCode || null,
      sellingPrice: priceResolution.sellingPrice,
      mrp: priceResolution.mrp,
      minimumSellingPrice: null,
      minimumSellingPriceConfigured: false,
      priceSource: priceResolution.priceSource,
      currentStock,
      stockAsOf: new Date().toISOString(),
      trackInventory: Boolean(product.trackInventory),
      allowNegativeStock: resolveEffectiveNegativeStock(product, shop || { allowNegativeStockGlobally: 0 }),
      warnings: priceResolution.warnings,
    };
  }
}
