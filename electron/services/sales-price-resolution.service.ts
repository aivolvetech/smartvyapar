import { getDatabaseConnection } from '../database/database-connection';
import { POSResolvedPrice, POSPriceSource, POSWarning } from '../../shared/types/pos';
import { logWarn } from '../utils/logger';

export class SalesPriceResolutionService {
  /**
   * Resolves the selling price of a product for a given customer and shop on a specific date.
   */
  public resolvePrice(input: {
    shopId: string;
    productId: string;
    customerId?: string;
    draftDate?: string;
  }): POSResolvedPrice {
    const db = getDatabaseConnection();
    const today = new Date().toISOString().split('T')[0];
    const draftDate = input.draftDate ? input.draftDate.trim().split('T')[0] : today;

    // Load product
    const product = db.prepare('SELECT * FROM Product WHERE id = ?').get(input.productId) as any;
    if (!product) {
      throw new Error(`Product with ID ${input.productId} not found.`);
    }
    if (!product.isActive) {
      throw new Error(`Product ${product.name} is inactive.`);
    }

    const warnings: POSWarning[] = [];

    // Step 1: Customer Price Book
    if (input.customerId) {
      const customer = db.prepare('SELECT * FROM Customer WHERE id = ?').get(input.customerId) as any;
      if (customer && customer.priceBookId) {
        // Validate Price Book
        const pb = db.prepare('SELECT * FROM PriceBook WHERE id = ?').get(customer.priceBookId) as any;
        if (!pb || !pb.isActive || 
            (pb.effectiveFrom && pb.effectiveFrom > draftDate) || 
            (pb.effectiveTo && pb.effectiveTo < draftDate)) {
          warnings.push('CUSTOMER_PRICE_BOOK_INACTIVE');
        } else {
          // Resolve price in Customer Price Book
          const price = this.findPriceInBook(db, input.productId, customer.priceBookId, draftDate);
          if (price) {
            return this.buildResult(input.productId, customer.priceBookId, pb.code, 'CUSTOMER_PRICE_BOOK', price, warnings);
          } else {
            warnings.push('CUSTOMER_PRICE_NOT_FOUND');
          }
        }
      }
    }

    // Step 2: Shop StorePriceBook mappings
    const mappings = db.prepare(`
      SELECT * FROM StorePriceBook
      WHERE shopId = ? AND isActive = 1
    `).all(input.shopId) as any[];

    // Filter by dates
    const validMappings = mappings.filter(m => {
      const fromValid = !m.effectiveFrom || m.effectiveFrom <= draftDate;
      const toValid = !m.effectiveTo || m.effectiveTo >= draftDate;
      return fromValid && toValid;
    });

    // Sort by priority ASC (lowest numeric wins)
    validMappings.sort((a, b) => (a.priority ?? 1) - (b.priority ?? 1));

    for (const map of validMappings) {
      const pb = db.prepare('SELECT * FROM PriceBook WHERE id = ?').get(map.priceBookId) as any;
      if (pb && pb.isActive && 
          (!pb.effectiveFrom || pb.effectiveFrom <= draftDate) && 
          (!pb.effectiveTo || pb.effectiveTo >= draftDate)) {
        const price = this.findPriceInBook(db, input.productId, map.priceBookId, draftDate);
        if (price) {
          return this.buildResult(input.productId, map.priceBookId, pb.code, 'SHOP_PRICE_BOOK', price, warnings);
        }
      }
    }

    // Step 3: Standard Price Book (Default)
    const standardPb = db.prepare('SELECT * FROM PriceBook WHERE isDefault = 1 AND isActive = 1 LIMIT 1').get() as any;
    if (standardPb && 
        (!standardPb.effectiveFrom || standardPb.effectiveFrom <= draftDate) && 
        (!standardPb.effectiveTo || standardPb.effectiveTo >= draftDate)) {
      const price = this.findPriceInBook(db, input.productId, standardPb.id, draftDate);
      if (price) {
        return this.buildResult(input.productId, standardPb.id, standardPb.code, 'STANDARD_PRICE_BOOK', price, warnings);
      }
    }

    // Step 4: Product Fallback
    if (product.cachedSellingPrice !== null && product.cachedSellingPrice !== undefined) {
      const sellingPrice = Number(product.cachedSellingPrice);
      if (Number.isFinite(sellingPrice) && sellingPrice >= 0) {
        warnings.push('FALLBACK_PRICE_USED');
        const mrp = product.cachedMrp !== null && product.cachedMrp !== undefined ? Number(product.cachedMrp) : sellingPrice;
        const fallbackPrice = {
          sellingPrice,
          mrp,
          effectiveFrom: null,
          effectiveTo: null
        };
        return this.buildResult(input.productId, null, null, 'PRODUCT_FALLBACK', fallbackPrice, warnings);
      }
    }

    throw new Error(`No valid price found for Product ${product.name} (Code: ${product.productCode}).`);
  }

  private findPriceInBook(db: any, productId: string, priceBookId: string, draftDate: string) {
    const prices = db.prepare(`
      SELECT * FROM ProductPrice
      WHERE productId = ? AND priceBookId = ? AND isActive = 1
    `).all(productId, priceBookId) as any[];

    // Filter by dates
    const validPrices = prices.filter(p => {
      const fromValid = !p.effectiveFrom || p.effectiveFrom <= draftDate;
      const toValid = !p.effectiveTo || p.effectiveTo >= draftDate;
      const priceValid = Number.isFinite(p.sellingPrice) && p.sellingPrice >= 0 && Number.isFinite(p.mrp) && p.mrp >= 0;
      return fromValid && toValid && priceValid;
    });

    if (validPrices.length === 0) {
      return null;
    }

    if (validPrices.length >= 2) {
      throw new Error(`PRICE_CONFLICT: Multiple overlapping active prices found for Product ID ${productId} in PriceBook ${priceBookId} on ${draftDate}.`);
    }

    return validPrices[0];
  }

  private buildResult(
    productId: string,
    priceBookId: string | null,
    priceBookCode: string | null,
    priceSource: POSPriceSource,
    price: { sellingPrice: number; mrp: number; effectiveFrom: string | null; effectiveTo: string | null },
    warnings: POSWarning[]
  ): POSResolvedPrice {
    const activeWarnings = [...warnings];
    if (price.sellingPrice === 0) {
      activeWarnings.push('ZERO_SELLING_PRICE');
    }

    return {
      productId,
      priceBookId,
      priceBookCode,
      priceSource,
      sellingPrice: price.sellingPrice,
      mrp: price.mrp,
      minimumSellingPrice: null,
      minimumSellingPriceConfigured: false,
      effectiveFrom: price.effectiveFrom,
      effectiveTo: price.effectiveTo,
      resolvedAt: new Date().toISOString(),
      warnings: activeWarnings
    };
  }
}
