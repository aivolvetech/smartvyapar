/**
 * PricingService — authoritative price resolver.
 * ProductPrice is the source of truth for all pricing.
 * Cache columns on Product are derived fields updated ONLY by this service.
 */
import { PriceBookRepository, DEFAULT_PRICE_BOOK_ID } from '../database/repositories/price-book.repository';
import { ProductPriceRepository } from '../database/repositories/product-price.repository';
import { ProductRepository } from '../database/repositories/product.repository';
import { getDatabaseConnection } from '../database/database-connection';
import { CreateProductPriceInput } from '../../shared/types/ipc';
import { logInfo } from '../utils/logger';

export interface ResolvedPrice {
  purchasePrice: number | null;
  sellingPrice: number | null;
  mrp: number | null;
  wholesalePrice: number | null;
}

const NO_PRICE: ResolvedPrice = { purchasePrice: null, sellingPrice: null, mrp: null, wholesalePrice: null };

export class PricingService {
  private priceBookRepo = new PriceBookRepository();
  private priceRepo = new ProductPriceRepository();
  private productRepo = new ProductRepository();

  /** Resolve the currently effective price for a product from the default PriceBook */
  public resolveDefaultPrice(productId: string): ResolvedPrice {
    try {
      const defaultBook = this.priceBookRepo.getDefault();
      const price = this.priceRepo.findActivePrice(productId, defaultBook.id);
      if (!price) return NO_PRICE;
      return {
        purchasePrice: price.purchasePrice,
        sellingPrice: price.sellingPrice,
        mrp: price.mrp,
        wholesalePrice: price.wholesalePrice,
      };
    } catch {
      return NO_PRICE;
    }
  }

  /**
   * Create the initial default ProductPrice and update the Product cache.
   * Validates no overlapping active price record exists.
   * Called exclusively inside the product creation transaction.
   */
  public createDefaultPrice(productId: string, input: CreateProductPriceInput): void {
    const db = getDatabaseConnection();
    const defaultBook = this.priceBookRepo.getDefault();
    const effectiveFrom = new Date().toISOString().split('T')[0];

    if (this.priceRepo.hasOverlap(productId, defaultBook.id, effectiveFrom, null)) {
      throw new Error('Overlapping active price record detected for this product and price book.');
    }

    this.priceRepo.create({
      productId,
      priceBookId: defaultBook.id,
      purchasePrice: input.purchasePrice,
      sellingPrice: input.sellingPrice,
      mrp: input.mrp,
      wholesalePrice: input.wholesalePrice,
      effectiveFrom,
    });

    // Update Product price cache columns (only PricingService may do this)
    this.productRepo.updatePriceCache(
      productId,
      input.purchasePrice,
      input.sellingPrice,
      input.mrp,
      input.wholesalePrice ?? null
    );

    logInfo(`PricingService: Created default price for product ${productId}`);
  }

  /**
   * Update the default price for an existing product.
   * Deactivates the existing active price and creates a new record.
   */
  public updateDefaultPrice(productId: string, input: CreateProductPriceInput): void {
    const defaultBook = this.priceBookRepo.getDefault();
    const effectiveFrom = new Date().toISOString().split('T')[0];

    // Close off the current active price
    this.priceRepo.deactivateByProduct(productId, defaultBook.id);

    this.priceRepo.create({
      productId,
      priceBookId: defaultBook.id,
      purchasePrice: input.purchasePrice,
      sellingPrice: input.sellingPrice,
      mrp: input.mrp,
      wholesalePrice: input.wholesalePrice,
      effectiveFrom,
    });

    this.productRepo.updatePriceCache(
      productId,
      input.purchasePrice,
      input.sellingPrice,
      input.mrp,
      input.wholesalePrice ?? null
    );

    logInfo(`PricingService: Updated default price for product ${productId}`);
  }

  /**
   * Ensure Shop is assigned to the default PriceBook.
   * Called once on first startup when a Shop exists.
   * Idempotent: only creates if no active assignment exists.
   */
  public ensureShopDefaultPriceBook(shopId: string): void {
    const { StorePriceBookRepository } = require('../database/repositories/store-price-book.repository');
    const storePbRepo = new StorePriceBookRepository();
    const existing = storePbRepo.findActiveByShop(shopId);
    if (!existing) {
      const defaultBook = this.priceBookRepo.getDefault();
      const today = new Date().toISOString().split('T')[0];
      storePbRepo.create({
        shopId,
        priceBookId: defaultBook.id,
        priority: 1,
        effectiveFrom: today,
      });
      logInfo(`PricingService: Assigned shop ${shopId} to default PriceBook`);
    }
  }
}
