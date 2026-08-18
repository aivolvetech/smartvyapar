import crypto from 'crypto';
import { getDatabaseConnection } from '../../../database/database-connection';
import { UnitOfMeasureRepository } from '../../../database/repositories/unit-of-measure.repository';
import { TaxRateRepository } from '../../../database/repositories/tax-rate.repository';
import { PriceBookRepository } from '../../../database/repositories/price-book.repository';
import { ProductRepository } from '../../../database/repositories/product.repository';
import { ProductBarcodeRepository } from '../../../database/repositories/product-barcode.repository';
import { ProductPriceRepository } from '../../../database/repositories/product-price.repository';
import { BrandRepository } from '../../../database/repositories/brand.repository';
import { ProductCategoryRepository } from '../../../database/repositories/product-category.repository';
import { SupplierRepository } from '../../../database/repositories/supplier.repository';
import { SupplierLedgerRepository } from '../../../database/repositories/supplier-ledger.repository';
import { InventoryOpeningBalanceRepository } from '../../../database/repositories/inventory-opening-balance.repository';
import { ProductService } from '../../product.service';
import { InventoryService } from '../../inventory.service';
import { SupplierService } from '../../supplier.service';
import {
  validateProductFields,
  validateProductPrice,
  enforceServiceProductRestrictions,
  enforceInventoryEligibility,
  validateOpeningStock,
  validateSupplierFields,
  validateSupplierOpeningBalance,
} from '../domain-rules';

export interface ProcessorContext {
  shopId: string;
  existingUnits: Map<string, string>; // normShortName -> id
  existingTaxRates: Map<string, string>; // normTaxCode -> id
  existingPriceBooks: Map<string, string>; // normPriceBookCode -> id
  existingProducts: Map<string, { id: string; productType: string; trackInventory: boolean }>; // normProductCode -> details
  existingSuppliers: Map<string, { id: string; gstNumber: string | null; panNumber: string | null; phone: string | null }>; // normSupplierCode -> details
}

export class UnitImportProcessor {
  private repo = new UnitOfMeasureRepository();

  public process(data: Record<string, any>, action: 'INSERT' | 'UPDATE'): string {
    const prepared = {
      name: String(data.name || '').trim(),
      shortName: String(data.unitCode || '').trim(),
      decimalAllowed: data.decimalAllowed === true,
      decimalPlaces: Number(data.decimalPlaces || 0),
      isActive: data.isActive !== false
    };

    if (action === 'INSERT') {
      const uom = this.repo.create(prepared);
      return uom.id;
    } else {
      const normShort = prepared.shortName.toLowerCase();
      const existing = this.repo.findByNormalizedShortName(normShort);
      if (!existing) throw new Error(`Unit ${prepared.shortName} not found for update.`);
      const updated = this.repo.update(existing.id, prepared);
      return updated.id;
    }
  }
}

export class TaxRateImportProcessor {
  private repo = new TaxRateRepository();

  public process(data: Record<string, any>, action: 'INSERT' | 'UPDATE'): string {
    const code = String(data.taxCode || '').trim();
    const prepared = {
      name: String(data.name || '').trim(),
      rate: Number(data.rate || 0),
      taxType: String(data.taxCategory || 'GST').toUpperCase(),
      cgstRate: Number(data.cgstRate || 0),
      sgstRate: Number(data.sgstRate || 0),
      igstRate: Number(data.igstRate || 0),
      cessRate: Number(data.cessRate || 0),
      isActive: data.isActive !== false,
      effectiveFrom: new Date().toISOString().split('T')[0]
    };

    const db = getDatabaseConnection();
    const now = new Date().toISOString();

    if (action === 'INSERT') {
      const id = `tax-imported-${crypto.randomUUID()}`;
      db.prepare(`
        INSERT INTO TaxRate (id, name, rate, taxType, cgstRate, sgstRate, igstRate, cessRate, effectiveFrom, isActive, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, code, prepared.rate, prepared.taxType, prepared.cgstRate, prepared.sgstRate,
        prepared.igstRate, prepared.cessRate, prepared.effectiveFrom, prepared.isActive ? 1 : 0, now, now
      );
      return id;
    } else {
      const existing = db.prepare('SELECT id FROM TaxRate WHERE name = ?').get(code) as { id: string } | undefined;
      if (!existing) throw new Error(`Tax Rate ${code} not found for update.`);
      db.prepare(`
        UPDATE TaxRate
        SET rate=?, taxType=?, cgstRate=?, sgstRate=?, igstRate=?, cessRate=?, isActive=?, updatedAt=?
        WHERE id=?
      `).run(
        prepared.rate, prepared.taxType, prepared.cgstRate, prepared.sgstRate,
        prepared.igstRate, prepared.cessRate, prepared.isActive ? 1 : 0, now, existing.id
      );
      return existing.id;
    }
  }
}

export class PriceBookImportProcessor {
  public process(data: Record<string, any>, action: 'INSERT' | 'UPDATE'): string {
    const code = String(data.code || '').trim();
    const prepared = {
      name: String(data.name || '').trim(),
      description: data.description ? String(data.description).trim() : null,
      isActive: data.isActive !== false
    };

    const db = getDatabaseConnection();
    const now = new Date().toISOString();

    if (action === 'INSERT') {
      const id = `pricebook-imported-${crypto.randomUUID()}`;
      db.prepare(`
        INSERT INTO PriceBook (id, code, name, description, isDefault, isActive, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, 0, ?, ?, ?)
      `).run(id, code, prepared.name, prepared.description, prepared.isActive ? 1 : 0, now, now);
      return id;
    } else {
      const existing = db.prepare('SELECT id FROM PriceBook WHERE code = ?').get(code) as { id: string } | undefined;
      if (!existing) throw new Error(`Price Book ${code} not found for update.`);
      db.prepare(`
        UPDATE PriceBook
        SET name=?, description=?, isActive=?, updatedAt=?
        WHERE id=?
      `).run(prepared.name, prepared.description, prepared.isActive ? 1 : 0, now, existing.id);
      return existing.id;
    }
  }
}

export class ProductImportProcessor {
  private productService = new ProductService();
  private repo = new ProductRepository();
  private brandRepo = new BrandRepository();
  private categoryRepo = new ProductCategoryRepository();

  /**
   * Finds an existing Brand by name, or creates it automatically.
   * This means brands in the CSV do NOT need to be pre-created.
   */
  private findOrCreateBrand(name: string): string | undefined {
    if (!name || !name.trim()) return undefined;
    const normName = name.trim().toLowerCase().replace(/\s+/g, ' ');
    const existing = this.brandRepo.findByNormalizedName(normName);
    if (existing) return existing.id;
    const created = this.brandRepo.create({ name: name.trim() });
    return created.id;
  }

  /**
   * Finds an existing root-level Category by name, or creates it automatically.
   * This means categories in the CSV do NOT need to be pre-created.
   */
  private findOrCreateCategory(name: string): string | undefined {
    if (!name || !name.trim()) return undefined;
    const normName = name.trim().toLowerCase().replace(/\s+/g, ' ');
    const existing = this.categoryRepo.findByNormalizedNameAndParent(normName, null);
    if (existing) return existing.id;
    const db = getDatabaseConnection();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO ProductCategory (id, name, normalizedName, description, parentCategoryId, displayOrder, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, null, null, 0, 1, ?, ?)
    `).run(id, name.trim(), normName, now, now);
    return id;
  }

  // Synchronous database-only bypass for transactions inside ImportExecutionService.
  // Calls the same domain-rules validators as ProductService.createProduct() so all
  // normalization, type restrictions, and price sign rules are enforced identically.
  public processSync(data: Record<string, any>, action: 'INSERT' | 'UPDATE', context: ProcessorContext): string {
    const productCode = String(data.productCode || '').trim();
    const name = String(data.name || '').trim();
    const productType = String(data.productType || 'GOODS').toUpperCase() as any;

    // ── Shared domain rule: required fields + type guard ────────────────────
    validateProductFields({ productCode, name, productType });

    // ── Shared domain rule: SERVICE restrictions ────────────────────────────
    const trackInventory = productType === 'SERVICE' ? false : (data.trackInventory !== false);
    const allowNegativeStock = productType === 'SERVICE' ? false : (data.allowNegativeStock === true);
    enforceServiceProductRestrictions(productType, trackInventory, allowNegativeStock);

    // ── Shared domain rule: price sign checks ──────────────────────────────
    validateProductPrice({
      purchasePrice: Number(data.purchasePrice || 0),
      sellingPrice: Number(data.sellingPrice || 0),
      mrp: Number(data.mrp || 0),
    });

    const unitNorm = String(data.unitCode || '').trim().toLowerCase();
    const primaryUnitId = context.existingUnits.get(unitNorm)!;

    const taxNorm = data.taxCode ? String(data.taxCode).trim().toLowerCase() : '';
    const taxRateId = taxNorm ? context.existingTaxRates.get(taxNorm) : null;

    const brandId = this.findOrCreateBrand(String(data.brand || '').trim());
    const categoryId = this.findOrCreateCategory(String(data.category || '').trim());

    const now = new Date().toISOString();
    const db = getDatabaseConnection();

    if (action === 'INSERT') {
      const id = crypto.randomUUID();
      this.repo.createRow({
        id,
        productCode,
        name,
        printName: data.printName ? String(data.printName).trim() : name,
        description: data.description ? String(data.description).trim() : undefined,
        categoryId,
        brandId,
        primaryUnitId,
        taxRateId: taxRateId || undefined,
        productType,
        trackInventory,
        allowNegativeStock,
        minimumStockLevel: data.minimumStock !== undefined && data.minimumStock !== null ? Number(data.minimumStock) : undefined,
        maximumStockLevel: data.maximumStock !== undefined && data.maximumStock !== null ? Number(data.maximumStock) : undefined,
        reorderLevel: data.reorderLevel !== undefined && data.reorderLevel !== null ? Number(data.reorderLevel) : undefined,
        sku: data.sku ? String(data.sku).trim() : undefined
      });

      this.repo.updatePriceCache(id, Number(data.purchasePrice || 0), Number(data.sellingPrice || 0), Number(data.mrp || 0), null);

      // Insert default price book mapping
      const priceId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO ProductPrice (id, productId, priceBookId, purchasePrice, sellingPrice, mrp, wholesalePrice, effectiveFrom, isActive, createdAt, updatedAt)
        VALUES (?, ?, 'pricebook-default', ?, ?, ?, null, ?, 1, ?, ?)
      `).run(priceId, id, Number(data.purchasePrice || 0), Number(data.sellingPrice || 0), Number(data.mrp || 0), now.split('T')[0], now, now);

      return id;
    } else {
      const existing = this.repo.findByNormalizedCode(productCode.toLowerCase());
      if (!existing) throw new Error(`Product ${productCode} not found for update.`);

      this.repo.update(existing.id, {
        name,
        printName: data.printName ? String(data.printName).trim() : undefined,
        description: data.description ? String(data.description).trim() : undefined,
        categoryId,
        brandId,
        primaryUnitId,
        taxRateId: taxRateId || undefined,
        sku: data.sku ? String(data.sku).trim() : undefined,
        trackInventory,
        allowNegativeStock,
        minimumStockLevel: data.minimumStock !== undefined && data.minimumStock !== null ? Number(data.minimumStock) : undefined,
        maximumStockLevel: data.maximumStock !== undefined && data.maximumStock !== null ? Number(data.maximumStock) : undefined,
        reorderLevel: data.reorderLevel !== undefined && data.reorderLevel !== null ? Number(data.reorderLevel) : undefined,
        isActive: data.isActive !== false
      });

      this.repo.updatePriceCache(
        existing.id,
        Number(data.purchasePrice || existing.cachedPurchasePrice || 0),
        Number(data.sellingPrice || existing.cachedSellingPrice || 0),
        Number(data.mrp || existing.cachedMrp || 0),
        null
      );

      // Update default price book row
      db.prepare(`
        UPDATE ProductPrice
        SET purchasePrice = ?, sellingPrice = ?, mrp = ?, updatedAt = ?
        WHERE productId = ? AND priceBookId = 'pricebook-default'
      `).run(
        Number(data.purchasePrice || existing.cachedPurchasePrice || 0),
        Number(data.sellingPrice || existing.cachedSellingPrice || 0),
        Number(data.mrp || existing.cachedMrp || 0),
        now,
        existing.id
      );

      return existing.id;
    }
  }
}

export class ProductBarcodeImportProcessor {
  private repo = new ProductBarcodeRepository();

  public process(data: Record<string, any>, action: 'INSERT'): string {
    const productCodeNorm = String(data.productCode || '').trim().toLowerCase();
    const barcode = String(data.barcode || '').trim();

    const db = getDatabaseConnection();
    const prod = db.prepare('SELECT id FROM Product WHERE normalizedProductCode = ?').get(productCodeNorm) as { id: string } | undefined;
    if (!prod) throw new Error(`Product Code "${data.productCode}" does not exist.`);

    if (action === 'INSERT') {
      const barcodeData = {
        barcode,
        barcodeType: data.barcodeType ? String(data.barcodeType).trim() : 'EAN13',
        isPrimary: data.isPrimary === true,
        isActive: data.isActive !== false
      };

      if (barcodeData.isPrimary) {
        // Clear existing primary barcodes for this product first
        this.repo.clearPrimaryForProduct(prod.id);
      }

      const created = this.repo.create(prod.id, barcodeData);
      return created.id;
    }
    throw new Error('Barcode update is not supported.');
  }
}

export class ProductPriceImportProcessor {
  private repo = new ProductPriceRepository();

  public process(data: Record<string, any>, action: 'INSERT' | 'UPDATE', context: ProcessorContext): string {
    const productCodeNorm = String(data.productCode || '').trim().toLowerCase();
    const priceBookCodeNorm = String(data.priceBookCode || '').trim().toLowerCase();

    const db = getDatabaseConnection();
    const prod = db.prepare('SELECT id FROM Product WHERE normalizedProductCode = ?').get(productCodeNorm) as { id: string } | undefined;
    if (!prod) throw new Error(`Product Code "${data.productCode}" does not exist.`);

    const priceBook = db.prepare('SELECT id FROM PriceBook WHERE code = ?').get(data.priceBookCode) as { id: string } | undefined;
    if (!priceBook) throw new Error(`Price Book Code "${data.priceBookCode}" does not exist.`);

    const now = new Date().toISOString();
    const prepared = {
      productId: prod.id,
      priceBookId: priceBook.id,
      purchasePrice: Number(data.purchasePrice || 0),
      sellingPrice: Number(data.sellingPrice || 0),
      mrp: Number(data.mrp || 0),
      wholesalePrice: null,
      effectiveFrom: data.effectiveFrom ? String(data.effectiveFrom).trim() : now.split('T')[0],
      effectiveTo: data.effectiveTo ? String(data.effectiveTo).trim() : null,
      isActive: data.isActive !== false
    };

    if (action === 'INSERT') {
      const id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO ProductPrice (id, productId, priceBookId, purchasePrice, sellingPrice, mrp, wholesalePrice, effectiveFrom, effectiveTo, isActive, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, prepared.productId, prepared.priceBookId, prepared.purchasePrice, prepared.sellingPrice,
        prepared.mrp, prepared.wholesalePrice, prepared.effectiveFrom, prepared.effectiveTo, prepared.isActive ? 1 : 0, now, now
      );
      return id;
    } else {
      // Find exact price record matching product, pricebook and effectiveFrom
      const existing = db.prepare(`
        SELECT id FROM ProductPrice
        WHERE productId = ? AND priceBookId = ? AND effectiveFrom = ?
      `).get(prepared.productId, prepared.priceBookId, prepared.effectiveFrom) as { id: string } | undefined;

      if (!existing) {
        throw new Error(`Price record not found for product, price book, and effective date: ${prepared.effectiveFrom}`);
      }

      db.prepare(`
        UPDATE ProductPrice
        SET purchasePrice=?, sellingPrice=?, mrp=?, effectiveTo=?, isActive=?, updatedAt=?
        WHERE id=?
      `).run(
        prepared.purchasePrice, prepared.sellingPrice, prepared.mrp, prepared.effectiveTo, prepared.isActive ? 1 : 0, now, existing.id
      );

      return existing.id;
    }
  }
}

export class OpeningStockImportProcessor {
  private inventoryService = new InventoryService();
  private balanceRepo = new InventoryOpeningBalanceRepository();

  public process(data: Record<string, any>, context: ProcessorContext): string {
    const productCodeNorm = String(data.productCode || '').trim().toLowerCase();
    const db = getDatabaseConnection();
    const prodRow = db.prepare('SELECT id, productType, trackInventory FROM Product WHERE normalizedProductCode = ?').get(productCodeNorm) as { id: string; productType: string; trackInventory: number } | undefined;
    if (!prodRow) throw new Error(`Product Code "${data.productCode}" does not exist.`);

    // ── Shared domain rule: only GOODS with tracking enabled may receive opening stock ─
    enforceInventoryEligibility(prodRow.productType, prodRow.trackInventory === 1, String(data.productCode));

    // ── Shared domain rule: qty > 0, cost >= 0 ─────────────────────────────
    const qty = Number(data.quantity || 0);
    const unitCost = Number(data.unitCost || 0);
    validateOpeningStock({ quantity: qty, unitCost });

    const reference = String(data.referenceNumber || '').trim();
    const openingDate = String(data.openingDate || '').trim();

    // 1. Create opening stock metadata row in InventoryOpeningBalance
    const balance = this.balanceRepo.create({
      productId: prodRow.id,
      shopId: context.shopId,
      quantity: qty,
      unitCost,
      recordedAt: openingDate,
      reference
    });

    // 2. Post inventory ledger transaction through InventoryService.
    // InventoryService.postOpeningStock → postInbound wraps in db.transaction().
    // better-sqlite3 supports nested transactions via SQLite savepoints, so this
    // participates safely inside the outer import transaction without independent commit.
    const tx = this.inventoryService.postOpeningStock({
      productId: prodRow.id,
      quantity: qty,
      unitCost,
      reason: 'BULK_IMPORT',
      notes: data.notes ? `Imported batch: ${data.notes}` : `Imported under reference: ${reference}`,
      occurredAt: openingDate
    });

    return balance.id;
  }
}

export class SupplierImportProcessor {
  private service = new SupplierService();
  private repo = new SupplierRepository();

  // Calls the shared validateSupplierFields() from domain-rules.ts — the same
  // function SupplierService.validate() delegates to. This ensures GST regex,
  // PAN regex, phone format, sign checks and required-field rules are identical.
  public processSync(data: Record<string, any>, action: 'INSERT' | 'UPDATE'): string {
    const code = String(data.supplierCode || '').trim();
    const validated = validateSupplierFields({
      supplierCode: code,
      name: String(data.supplierName || '').trim(),
      contactPerson: data.contactPerson ? String(data.contactPerson).trim() : undefined,
      phone: data.phone ? String(data.phone).trim() : undefined,
      alternatePhone: data.alternatePhone ? String(data.alternatePhone).trim() : undefined,
      email: data.email ? String(data.email).trim() : undefined,
      gstNumber: data.gstNumber ? String(data.gstNumber).trim().toUpperCase() : undefined,
      panNumber: data.panNumber ? String(data.panNumber).trim().toUpperCase() : undefined,
      paymentTermsDays: Number(data.paymentTermsDays || 0),
      creditLimit: Number(data.creditLimit || 0),
      openingBalance: 0,           // Enforced: master data only; ledger handled by SUPPLIER_OPENING_BALANCE import
      openingBalanceType: 'NONE',  // Enforced: must be NONE for master rows
    });

    const prepared = {
      supplierCode: validated.supplierCode,
      name: validated.name,
      contactPerson: data.contactPerson ? String(data.contactPerson).trim() : '',
      phone: validated.phone,
      alternatePhone: validated.alternatePhone,
      email: validated.email,
      gstNumber: validated.gstNumber,
      panNumber: validated.panNumber,
      addressLine1: data.addressLine1 ? String(data.addressLine1).trim() : '',
      addressLine2: data.addressLine2 ? String(data.addressLine2).trim() : '',
      city: data.city ? String(data.city).trim() : '',
      state: data.state ? String(data.state).trim() : '',
      postalCode: data.postalCode ? String(data.postalCode).trim() : '',
      country: data.country ? String(data.country).trim() : 'India',
      paymentTermsDays: validated.paymentTermsDays,
      creditLimit: validated.creditLimit,
      openingBalance: 0,
      openingBalanceType: 'NONE' as any,
      notes: data.notes ? String(data.notes).trim() : '',
      isActive: data.isActive !== false
    };

    if (action === 'INSERT') {
      const created = this.repo.create(prepared);
      return created.id;
    } else {
      const existing = this.repo.findByNormalizedCode(code.toLowerCase());
      if (!existing) throw new Error(`Supplier ${code} not found for update.`);
      const updated = this.repo.update(existing.id, prepared);
      return updated.id;
    }
  }
}

export class SupplierOpeningBalanceImportProcessor {
  private ledgerRepo = new SupplierLedgerRepository();

  // Enforces shared domain rules from validateSupplierOpeningBalance():
  //   • referenceNumber non-empty (idempotency key)
  //   • amount > 0 (zero-balance entries are semantically invalid)
  //   • type is PAYABLE or RECEIVABLE (NONE is rejected)
  //   • correct sign convention: PAYABLE→credit, RECEIVABLE→debit
  // Idempotency (de-dup by referenceNumber+supplierCode) is enforced upstream
  // in ImportDuplicateService using existingSupplierBalances compound key.
  public process(data: Record<string, any>, context: ProcessorContext): string {
    const sCode = String(data.supplierCode || '').trim();
    const db = getDatabaseConnection();
    const sup = db.prepare('SELECT id FROM Supplier WHERE normalizedSupplierCode = ?').get(sCode.toLowerCase()) as { id: string } | undefined;
    if (!sup) throw new Error(`Supplier Code "${data.supplierCode}" does not exist.`);

    const ref = String(data.referenceNumber || '').trim();
    const notes = data.notes ? String(data.notes).trim() : 'Imported supplier opening balance.';

    // ── Shared domain rule: sign convention + amount + type + ref ───────────
    const { creditAmount, debitAmount } = validateSupplierOpeningBalance({
      supplierCode: sCode,
      referenceNumber: ref,
      openingBalance: Number(data.openingBalance ?? 0),
      openingBalanceType: String(data.openingBalanceType || ''),
      balanceDate: data.balanceDate,
    });

    const entry = this.ledgerRepo.create({
      supplierId: sup.id,
      shopId: context.shopId,
      entryType: 'OPENING_BALANCE',
      referenceType: 'SUPPLIER_IMPORT',
      referenceId: sup.id,
      referenceNumber: ref,
      creditAmount,
      debitAmount,
      occurredAt: data.balanceDate,
      notes
    });

    return entry.id;
  }
}
