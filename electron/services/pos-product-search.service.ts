import { getDatabaseConnection } from '../database/database-connection';
import { POSProductSearchResult, POSProductResult } from '../../shared/types/pos';
import { SalesPriceResolutionService } from './sales-price-resolution.service';
import { resolveEffectiveNegativeStock } from './stock-policy';

export class POSProductSearchService {
  private priceResolutionService = new SalesPriceResolutionService();

  public searchPOSProducts(input: {
    shopId: string;
    query: string;
    customerId?: string;
    draftDate?: string;
    page?: number;
    pageSize?: number;
  }): POSProductSearchResult {
    const db = getDatabaseConnection();
    const shop = db.prepare('SELECT * FROM Shop WHERE id = ?').get(input.shopId) as any;
    const queryStr = (input.query || '').trim().toLowerCase();
    const page = input.page && input.page > 0 ? input.page : 1;
    const pageSize = input.pageSize && input.pageSize > 0 ? input.pageSize : 20;
    const offset = (page - 1) * pageSize;

    let productIds: string[] = [];
    let totalItems = 0;

    if (queryStr) {
      const matchPattern = `%${queryStr}%`;
      // Find matching active product IDs
      const countRow = db.prepare(`
        SELECT COUNT(DISTINCT p.id) as total FROM Product p
        LEFT JOIN ProductCategory c ON c.id = p.categoryId
        LEFT JOIN Brand b ON b.id = p.brandId
        WHERE p.isActive = 1 AND (
          p.normalizedProductCode LIKE ? OR
          p.normalizedSku LIKE ? OR
          p.normalizedName LIKE ? OR
          c.name LIKE ? OR
          b.name LIKE ? OR
          EXISTS (SELECT 1 FROM ProductBarcode pb WHERE pb.productId = p.id AND pb.barcode LIKE ?)
        )
      `).get(queryStr, queryStr, matchPattern, matchPattern, matchPattern, matchPattern) as { total: number };

      totalItems = countRow.total;

      const rows = db.prepare(`
        SELECT DISTINCT p.id, p.name FROM Product p
        LEFT JOIN ProductCategory c ON c.id = p.categoryId
        LEFT JOIN Brand b ON b.id = p.brandId
        WHERE p.isActive = 1 AND (
          p.normalizedProductCode LIKE ? OR
          p.normalizedSku LIKE ? OR
          p.normalizedName LIKE ? OR
          c.name LIKE ? OR
          b.name LIKE ? OR
          EXISTS (SELECT 1 FROM ProductBarcode pb WHERE pb.productId = p.id AND pb.barcode LIKE ?)
        )
        ORDER BY p.name ASC, p.id ASC
        LIMIT ? OFFSET ?
      `).all(queryStr, queryStr, matchPattern, matchPattern, matchPattern, matchPattern, pageSize, offset) as any[];

      productIds = rows.map(r => r.id);
    } else {
      // Find all active product IDs
      const countRow = db.prepare('SELECT COUNT(*) as total FROM Product WHERE isActive = 1').get() as { total: number };
      totalItems = countRow.total;

      const rows = db.prepare(`
        SELECT id FROM Product
        WHERE isActive = 1
        ORDER BY name ASC, id ASC
        LIMIT ? OFFSET ?
      `).all(pageSize, offset) as any[];

      productIds = rows.map(r => r.id);
    }

    if (productIds.length === 0) {
      return {
        items: [],
        totalItems,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
      };
    }

    // Batch load products
    const placeholders = productIds.map(() => '?').join(',');
    const products = db.prepare(`
      SELECT * FROM Product WHERE id IN (${placeholders})
    `).all(...productIds) as any[];

    // Batch load primary barcodes
    const barcodes = db.prepare(`
      SELECT * FROM ProductBarcode 
      WHERE productId IN (${placeholders}) AND isActive = 1
    `).all(...productIds) as any[];

    // Batch load stock
    const stockRows = db.prepare(`
      SELECT productId, COALESCE(SUM(quantity), 0) AS quantityOnHand
      FROM InventoryTransaction
      WHERE shopId = ? AND productId IN (${placeholders})
      GROUP BY productId
    `).all(input.shopId, ...productIds) as any[];

    const stockMap = new Map<string, number>();
    for (const r of stockRows) {
      stockMap.set(r.productId, r.quantityOnHand);
    }

    // Load UOMs and Tax rates for batch processing
    const uomIds = Array.from(new Set(products.map(p => p.primaryUnitId).filter(Boolean)));
    const taxRateIds = Array.from(new Set(products.map(p => p.taxRateId).filter(Boolean)));

    const uoms = uomIds.length > 0 ? db.prepare(`
      SELECT * FROM UnitOfMeasure WHERE id IN (${uomIds.map(() => '?').join(',')})
    `).all(...uomIds) as any[] : [];

    const taxRates = taxRateIds.length > 0 ? db.prepare(`
      SELECT * FROM TaxRate WHERE id IN (${taxRateIds.map(() => '?').join(',')})
    `).all(...taxRateIds) as any[] : [];

    const uomMap = new Map<string, any>();
    for (const u of uoms) uomMap.set(u.id, u);

    const taxMap = new Map<string, any>();
    for (const t of taxRates) taxMap.set(t.id, t);

    const items: POSProductResult[] = [];
    const todayStr = new Date().toISOString();

    // Map and resolve prices
    // Order products to match the paginated order of productIds
    const productMap = new Map<string, any>();
    for (const p of products) {
      productMap.set(p.id, p);
    }

    for (const pid of productIds) {
      const p = productMap.get(pid);
      if (!p) continue;

      const pBarcodes = barcodes.filter(b => b.productId === p.id);
      const primaryBarcodeRow = pBarcodes.find(b => b.isPrimary) || pBarcodes[0] || null;
      const barcode = primaryBarcodeRow ? primaryBarcodeRow.barcode : null;

      const unit = uomMap.get(p.primaryUnitId);
      const unitName = unit ? unit.shortName : null;
      const allowsDecimalQuantity = unit ? Boolean(unit.decimalAllowed) : false;
      const decimalPlaces = unit ? (unit.decimalPlaces ?? 0) : 0;

      const tax = taxMap.get(p.taxRateId);
      const taxCategory = tax ? tax.taxType : 'EXEMPT';
      const taxRate = tax ? tax.rate : 0;

      const currentStock = stockMap.get(p.id) ?? 0;

      try {
        const priceResolution = this.priceResolutionService.resolvePrice({
          shopId: input.shopId,
          productId: p.id,
          customerId: input.customerId,
          draftDate: input.draftDate,
        });

        items.push({
          productId: p.id,
          productCode: p.productCode,
          productName: p.name,
          productType: p.productType,
          barcode,
          unitId: p.primaryUnitId,
          unitName,
          allowsDecimalQuantity,
          decimalPlaces,
          taxRateId: p.taxRateId,
          taxCategory,
          taxRate,
          hsnSacCode: p.hsnSacCode || null,
          sellingPrice: priceResolution.sellingPrice,
          mrp: priceResolution.mrp,
          minimumSellingPrice: null,
          minimumSellingPriceConfigured: false,
          priceSource: priceResolution.priceSource,
          currentStock,
          stockAsOf: todayStr,
          trackInventory: Boolean(p.trackInventory),
          allowNegativeStock: resolveEffectiveNegativeStock(p, shop || { allowNegativeStockGlobally: 0 }),
          warnings: priceResolution.warnings,
        });
      } catch (err: any) {
        // Exclude products that fail price resolution from search results (as per rule: "missing-price Products must not be added to Cart" / search filters active pricing only)
        // Or if we want to search them but return warnings or filter them. The rule says "missing-price Products must not be added to Cart"
        // Let's filter them out or handle cleanly. Let's log it or bypass it.
        // We will exclude them so they can't be added to cart.
      }
    }

    return {
      items,
      totalItems,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    };
  }
}
