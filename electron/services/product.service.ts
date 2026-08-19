import crypto from 'crypto';
import { getDatabaseConnection } from '../database/database-connection';
import { ProductRepository } from '../database/repositories/product.repository';
import { ProductBarcodeRepository } from '../database/repositories/product-barcode.repository';
import { UnitOfMeasureRepository } from '../database/repositories/unit-of-measure.repository';
import { TaxRateRepository } from '../database/repositories/tax-rate.repository';
import { ProductCategoryRepository } from '../database/repositories/product-category.repository';
import { BrandRepository } from '../database/repositories/brand.repository';
import { PricingService } from './pricing.service';
import { OpeningBalanceService } from './opening-balance.service';
import { InventoryService } from './inventory.service';
import { ShopRepository } from '../database/repositories/shop.repository';
import { resolveEffectiveNegativeStock } from './stock-policy';
import {
  CreateProductRequest, UpdateProductRequest,
  ProductData, ProductListFilter, ProductListResult,
  ProductBarcodeData,
} from '../../shared/types/ipc';
import { Product } from '../../shared/models/product';
import { logInfo } from '../utils/logger';
import {
  validateProductFields,
  validateProductPrice,
  enforceServiceProductRestrictions,
  validateBarcodeBatch,
} from './import/domain-rules';

function normalizeStr(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export class ProductService {
  private _productRepo = new ProductRepository();
  private _barcodeRepo = new ProductBarcodeRepository();
  private _unitRepo = new UnitOfMeasureRepository();
  private _taxRepo = new TaxRateRepository();
  private _categoryRepo = new ProductCategoryRepository();
  private _brandRepo = new BrandRepository();
  private _pricingService = new PricingService();
  private _openingBalanceService = new OpeningBalanceService();
  private _inventoryService = new InventoryService();
  private _shopRepo = new ShopRepository();

  private mapProductToData(product: Product): ProductData {
    const barcodes: ProductBarcodeData[] = this._barcodeRepo.listByProduct(product.id).map(b => ({
      id: b.id, productId: b.productId, barcode: b.barcode,
      barcodeType: b.barcodeType, isPrimary: b.isPrimary, isActive: b.isActive,
      createdAt: b.createdAt, updatedAt: b.updatedAt,
    }));

    const prices = this._pricingService.resolveDefaultPrice(product.id);
    const shop = this._shopRepo.getShop() || { allowNegativeStockGlobally: false };
    const effectiveNeg = resolveEffectiveNegativeStock(product, shop);

    return {
      id: product.id,
      productCode: product.productCode,
      name: product.name,
      printName: product.printName,
      description: product.description,
      categoryId: product.categoryId,
      categoryName: null, // enriched via SQL in list queries; single-get enrichment below
      brandId: product.brandId,
      brandName: null,
      primaryUnitId: product.primaryUnitId,
      unitName: null,
      unitShortName: null,
      hsnSacCode: product.hsnSacCode,
      taxRateId: product.taxRateId,
      taxRateName: null,
      taxRate: null,
      productType: product.productType,
      trackInventory: product.trackInventory,
      allowNegativeStock: effectiveNeg,
      negativeStockPolicy: product.negativeStockPolicy,
      minimumStockLevel: product.minimumStockLevel,
      reorderLevel: product.reorderLevel,
      maximumStockLevel: product.maximumStockLevel,
      sku: product.sku,
      barcodes,
      purchasePrice: prices.purchasePrice,
      sellingPrice: prices.sellingPrice,
      mrp: prices.mrp,
      wholesalePrice: prices.wholesalePrice,
      isActive: product.isActive,
      version: product.version,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  public async listProducts(filter: ProductListFilter): Promise<ProductListResult> {
    return this._productRepo.list(filter);
  }

  public async getProductById(id: string): Promise<ProductData | null> {
    const product = this._productRepo.findById(id);
    if (!product) return null;

    const data = this.mapProductToData(product);

    const lookups = this._productRepo.getDetailLookups(product.id);
    data.categoryName = lookups.categoryName;
    data.brandName = lookups.brandName;
    data.unitName = lookups.unitName;
    data.unitShortName = lookups.unitShortName;
    data.taxRateName = lookups.taxRateName;
    data.taxRate = lookups.taxRate;

    return data;
  }

  public async getProductByBarcode(barcode: string): Promise<ProductData | null> {
    const product = this._productRepo.findByBarcode(barcode);
    if (!product) return null;
    return this.getProductById(product.id);
  }

  /**
   * Create a Product with Barcodes, Default Price, and optional Opening Balance
   * atomically in a single database transaction.
   * Any failure rolls back the entire operation.
   */
  public async createProduct(request: CreateProductRequest): Promise<ProductData> {
    const { product: prodInput, barcodes, defaultPrice, openingBalance } = request;

    // --- Pre-transaction validation ---
    validateProductFields({
      productCode: prodInput.productCode,
      name: prodInput.name,
      productType: prodInput.productType,
    });

    const productType = prodInput.productType || 'GOODS';
    const trackInventory = productType === 'SERVICE' ? false : (prodInput.trackInventory !== false);
    const allowNegativeStock = productType === 'SERVICE' ? false : (prodInput.allowNegativeStock ?? false);
    
    enforceServiceProductRestrictions(productType, trackInventory, allowNegativeStock);
    validateProductPrice(defaultPrice);
    validateBarcodeBatch(barcodes);

    const normCode = normalizeStr(prodInput.productCode);
    if (this._productRepo.findByNormalizedCode(normCode)) {
      throw new Error(`Product code "${prodInput.productCode.trim()}" already exists.`);
    }

    if (prodInput.sku) {
      const normSku = normalizeStr(prodInput.sku);
      if (this._productRepo.findByNormalizedSku(normSku)) {
        throw new Error(`SKU "${prodInput.sku.trim()}" already exists.`);
      }
    }

    // Validate unit exists
    if (!this._unitRepo.findById(prodInput.primaryUnitId)) {
      throw new Error('Selected unit of measure does not exist.');
    }

    if (prodInput.categoryId && !this._categoryRepo.findById(prodInput.categoryId)) {
      throw new Error('Selected category does not exist.');
    }

    if (prodInput.brandId && !this._brandRepo.findById(prodInput.brandId)) {
      throw new Error('Selected brand does not exist.');
    }

    // Validate tax rate exists (if provided)
    if (prodInput.taxRateId && !this._taxRepo.findById(prodInput.taxRateId)) {
      throw new Error('Selected tax rate does not exist.');
    }

    // SERVICE-type opening balance restrictions
    if (productType === 'SERVICE') {
      if (openingBalance && (openingBalance.quantity ?? 0) > 0) {
        throw new Error('Opening balance is not allowed for SERVICE products.');
      }
    }
    if (productType === 'GOODS' && trackInventory === false && openingBalance && (openingBalance.quantity ?? 0) > 0) {
      throw new Error('Opening balance is only allowed when inventory tracking is enabled.');
    }

    for (const b of barcodes) {
      if (this._barcodeRepo.barcodeExists(b.barcode.trim())) {
        throw new Error(`Barcode "${b.barcode.trim()}" already assigned to another product.`);
      }
    }

    // Get shop for opening balance
    const shop = this._shopRepo.getShop();

    // --- Atomic transaction ---
    const db = getDatabaseConnection();
    const productId = crypto.randomUUID();

    db.transaction(() => {
      // 1. Create Product row
      this._productRepo.createRow({
        ...prodInput,
        id: productId,
        productCode: prodInput.productCode.trim(),
        name: prodInput.name.trim(),
        trackInventory: productType === 'SERVICE' ? false : (prodInput.trackInventory !== false),
        allowNegativeStock: productType === 'SERVICE' ? false : (prodInput.allowNegativeStock ?? false),
        negativeStockPolicy: productType === 'SERVICE' ? 'BLOCK' : (prodInput.negativeStockPolicy || 'INHERIT'),
        productType,
      });

      // 2. Create Barcodes — clear primary before setting new one
      const hasPrimary = barcodes.some(b => b.isPrimary);
      for (const b of barcodes) {
        if (b.isPrimary && hasPrimary) {
          this._barcodeRepo.clearPrimaryForProduct(productId);
        }
        this._barcodeRepo.create(productId, { ...b, barcode: b.barcode.trim() });
      }

      // 3. Create Default ProductPrice + update cache (PricingService)
      this._pricingService.createDefaultPrice(productId, defaultPrice);

      // 4. Optional Opening Balance
      if (openingBalance && openingBalance.quantity > 0 && shop) {
        const openingRecord = this._openingBalanceService.create({
          productId,
          shopId: shop.id,
          quantity: openingBalance.quantity,
          unitCost: openingBalance.unitCost ?? 0,
          recordedAt: new Date().toISOString(),
        });
        this._inventoryService.postOpeningStock({
          productId,
          quantity: openingBalance.quantity,
          unitCost: openingBalance.unitCost ?? 0,
          reason: 'PRODUCT_OPENING_BALANCE',
          notes: 'Posted from Product create opening balance.',
          occurredAt: openingRecord.recordedAt,
        });
      }
    })();

    logInfo(`ProductService: Created product ${productId} (${prodInput.productCode})`);

    const created = await this.getProductById(productId);
    if (!created) throw new Error('Product creation succeeded but retrieval failed.');
    return created;
  }

  public async updateProduct(id: string, request: UpdateProductRequest): Promise<ProductData> {
    const existing = this._productRepo.findById(id);
    if (!existing) throw new Error('Product not found.');

    const { product: prodInput, barcodes, defaultPrice } = request;

    // Validate code uniqueness if changing
    if (prodInput.productCode) {
      const normCode = normalizeStr(prodInput.productCode);
      const dup = this._productRepo.findByNormalizedCode(normCode);
      if (dup && dup.id !== id) throw new Error(`Product code "${prodInput.productCode.trim()}" already exists.`);
    }

    if (prodInput.sku) {
      const normSku = normalizeStr(prodInput.sku);
      const dup = this._productRepo.findByNormalizedSku(normSku);
      if (dup && dup.id !== id) throw new Error(`SKU "${prodInput.sku.trim()}" already exists.`);
    }

    if (prodInput.primaryUnitId && !this._unitRepo.findById(prodInput.primaryUnitId)) {
      throw new Error('Selected unit of measure does not exist.');
    }

    if (prodInput.categoryId && !this._categoryRepo.findById(prodInput.categoryId)) {
      throw new Error('Selected category does not exist.');
    }

    if (prodInput.brandId && !this._brandRepo.findById(prodInput.brandId)) {
      throw new Error('Selected brand does not exist.');
    }

    if (prodInput.taxRateId && !this._taxRepo.findById(prodInput.taxRateId)) {
      throw new Error('Selected tax rate does not exist.');
    }

    const productType = prodInput.productType ?? existing.productType;

    validateProductFields({
      productCode: prodInput.productCode || existing.productCode,
      name: prodInput.name || existing.name,
      productType: productType,
    });

    const trackInventory = productType === 'SERVICE' ? false : (prodInput.trackInventory !== undefined ? prodInput.trackInventory : existing.trackInventory);
    const allowNegativeStock = productType === 'SERVICE' ? false : (prodInput.allowNegativeStock !== undefined ? prodInput.allowNegativeStock : existing.allowNegativeStock);
    enforceServiceProductRestrictions(productType, trackInventory, allowNegativeStock);

    if (defaultPrice) {
      validateProductPrice(defaultPrice);
    }
    if (barcodes !== undefined) {
      validateBarcodeBatch(barcodes);
    }

    const db = getDatabaseConnection();
    db.transaction(() => {
      // 1. Update product core fields
      this._productRepo.update(id, {
        ...prodInput,
        trackInventory,
        allowNegativeStock,
        negativeStockPolicy: productType === 'SERVICE' ? 'BLOCK' : (prodInput.negativeStockPolicy || 'INHERIT'),
      });

      // 2. Update barcodes (replace strategy — delete active ones, create new)
      if (barcodes !== undefined) {
        for (const b of barcodes) {
          if (this._barcodeRepo.barcodeExists(b.barcode.trim(), id)) {
            throw new Error(`Barcode "${b.barcode.trim()}" already assigned to another product.`);
          }
        }

        // Clear all existing barcodes for this product, then re-create
        this._barcodeRepo.deleteByProductId(id);
        const hasPrimary = barcodes.some(b => b.isPrimary);
        for (const b of barcodes) {
          if (b.isPrimary && hasPrimary) {
            this._barcodeRepo.clearPrimaryForProduct(id);
          }
          this._barcodeRepo.create(id, { ...b, barcode: b.barcode.trim() });
        }
      }

      // 3. Update price if provided
      if (defaultPrice !== undefined) {
        if (defaultPrice.sellingPrice < 0) throw new Error('Selling price cannot be negative.');
        if (defaultPrice.mrp < 0) throw new Error('MRP cannot be negative.');
        this._pricingService.updateDefaultPrice(id, defaultPrice);
      }
    })();

    logInfo(`ProductService: Updated product ${id}`);

    const updated = await this.getProductById(id);
    if (!updated) throw new Error('Product update succeeded but retrieval failed.');
    return updated;
  }

  public async setProductActive(id: string, isActive: boolean): Promise<ProductData> {
    const existing = this._productRepo.findById(id);
    if (!existing) throw new Error('Product not found.');
    this._productRepo.setActive(id, isActive);
    const updated = await this.getProductById(id);
    if (!updated) throw new Error('Product status update succeeded but retrieval failed.');
    return updated;
  }
}
