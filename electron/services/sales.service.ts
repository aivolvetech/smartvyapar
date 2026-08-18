import crypto from 'crypto';
import { getDatabaseConnection } from '../database/database-connection';
import { SalesInvoiceRepository } from '../database/repositories/sales-invoice.repository';
import { SalesLineRepository } from '../database/repositories/sales-line.repository';
import { CustomerRepository } from '../database/repositories/customer.repository';
import { ProductRepository } from '../database/repositories/product.repository';
import { ProductBarcodeRepository } from '../database/repositories/product-barcode.repository';
import { UnitOfMeasureRepository } from '../database/repositories/unit-of-measure.repository';
import { TaxRateRepository } from '../database/repositories/tax-rate.repository';
import { SalesPriceResolutionService } from './sales-price-resolution.service';
import { SalesBarcodeResolutionService } from './sales-barcode-resolution.service';
import {
  SalesInvoice,
  SalesInvoiceLine,
  SalesInvoiceDetail,
  DraftSalesInvoiceInput,
  DraftSalesInvoiceLineInput
} from '../../shared/models/sales';
import {
  POSDraftViewModel,
  POSCart,
  POSCartLine,
  POSCartLineInput,
  POSDraftSaveInput,
  POSHeldBillListItem,
  POSCustomerRepriceResult,
  POSPriceChange,
  POSWarning,
  POSPriceSource
} from '../../shared/types/pos';

// Standard two-decimal rounding helper
function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export class SalesService {
  private salesInvoiceRepo = new SalesInvoiceRepository();
  private salesLineRepo = new SalesLineRepository();
  private customerRepo = new CustomerRepository();
  private productRepo = new ProductRepository();
  private barcodeRepo = new ProductBarcodeRepository();
  private unitRepo = new UnitOfMeasureRepository();
  private taxRateRepo = new TaxRateRepository();
  private priceResolutionService = new SalesPriceResolutionService();
  private barcodeResolutionService = new SalesBarcodeResolutionService();

  /**
   * Helper to verify a Customer exists, belongs to the Shop, and is active.
   */
  private validateCustomerForShop(customerId: string, shopId: string): any {
    const customer = this.customerRepo.findById(customerId);
    if (!customer) {
      throw new Error(`Customer with ID ${customerId} not found.`);
    }
    if (customer.shopId !== shopId) {
      throw new Error(`Customer does not belong to this shop.`);
    }
    if (!customer.isActive) {
      throw new Error(`Customer ${customer.name} is inactive.`);
    }
    return customer;
  }

  /**
   * Helper to calculate provisional totals for an invoice detail.
   */
  private calculateProvisionalTotals(
    invoice: SalesInvoice,
    lines: SalesInvoiceLine[],
    customer: any,
    shop: any
  ): POSCart {
    // Determine inter-state status
    let interState = false;
    if (customer && customer.gstNumber && shop && shop.gstNumber) {
      const custStateCode = customer.gstNumber.trim().substring(0, 2);
      const shopStateCode = shop.gstNumber.trim().substring(0, 2);
      if (custStateCode && shopStateCode && custStateCode !== shopStateCode) {
        interState = true;
      }
    } else if (customer && customer.state && shop && shop.address) {
      const custState = customer.state.trim().toLowerCase();
      const shopAddress = shop.address.trim().toLowerCase();
      if (custState && !shopAddress.includes(custState)) {
        interState = true;
      }
    }

    let subtotal = 0;
    let lineDiscountTotal = 0;

    // Calculate line taxable amounts and base amounts
    const processedLines = lines.map(line => {
      const unitPrice = line.unitPrice;
      const discountValue = line.discountValue;

      let discountAmount = 0;
      if (line.discountType === 'PERCENT') {
        discountAmount = money((unitPrice * discountValue) / 100);
      } else if (line.discountType === 'AMOUNT') {
        discountAmount = money(discountValue);
      }

      const quantity = line.quantity;
      const baseAmount = money(quantity * unitPrice);
      const lineDiscount = money(quantity * discountAmount);
      const taxableAmount = money(baseAmount - lineDiscount);

      subtotal += taxableAmount;
      lineDiscountTotal += lineDiscount;

      return {
        ...line,
        discountAmount,
        taxableAmount,
        lineTotal: taxableAmount // Will update after allocating invoice discount
      };
    });

    // Calculate invoice discount
    let invoiceDiscountTotal = 0;
    if (invoice.invoiceDiscountType === 'PERCENT') {
      invoiceDiscountTotal = money((subtotal * invoice.invoiceDiscountValue) / 100);
    } else if (invoice.invoiceDiscountType === 'AMOUNT') {
      invoiceDiscountTotal = money(invoice.invoiceDiscountValue);
    }

    const overallTaxableAmount = money(Math.max(0, subtotal - invoiceDiscountTotal));

    // Allocate invoice discount and calculate line taxes
    let allocatedTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    let cessTotal = 0;

    const cartLines: POSCartLine[] = processedLines.map((line, idx) => {
      let allocation = 0;
      if (subtotal > 0) {
        if (idx === processedLines.length - 1) {
          allocation = money(invoiceDiscountTotal - allocatedTotal);
        } else {
          allocation = money((invoiceDiscountTotal * line.taxableAmount) / subtotal);
          allocatedTotal = money(allocatedTotal + allocation);
        }
      }

      const allocatedTaxableAmount = money(Math.max(0, line.taxableAmount - allocation));

      // Calculate taxes
      const taxRate = line.taxRateSnapshot;
      let cgstRate = 0;
      let sgstRate = 0;
      let igstRate = 0;
      let cessRate = line.cessRate || 0;

      if (line.taxCategorySnapshot === 'GST') {
        if (interState) {
          igstRate = taxRate;
        } else {
          cgstRate = line.cgstRate || (taxRate / 2);
          sgstRate = line.sgstRate || (taxRate / 2);
        }
      }

      const cgstAmount = money((allocatedTaxableAmount * cgstRate) / 100);
      const sgstAmount = money((allocatedTaxableAmount * sgstRate) / 100);
      const igstAmount = money((allocatedTaxableAmount * igstRate) / 100);
      const cessAmount = money((allocatedTaxableAmount * cessRate) / 100);

      cgstTotal += cgstAmount;
      sgstTotal += sgstAmount;
      igstTotal += igstAmount;
      cessTotal += cessAmount;

      const lineTotal = money(allocatedTaxableAmount + cgstAmount + sgstAmount + igstAmount + cessAmount);

      // Advisory stock
      const db = getDatabaseConnection();
      const stockRow = db.prepare(`
        SELECT COALESCE(SUM(quantity), 0) AS q
        FROM InventoryTransaction
        WHERE shopId = ? AND productId = ?
      `).get(invoice.shopId, line.productId) as { q: number } | undefined;
      const advisoryStock = stockRow ? stockRow.q : 0;

      // Resolve warnings and priceSource for line item
      let priceSource: POSPriceSource = 'STANDARD_PRICE_BOOK';
      let warnings: POSWarning[] = [];
      try {
        const resolved = this.priceResolutionService.resolvePrice({
          shopId: invoice.shopId,
          productId: line.productId,
          customerId: invoice.customerId,
          draftDate: invoice.invoiceDate
        });
        priceSource = resolved.priceSource;
        warnings = resolved.warnings;
      } catch (err) {
        // Fallback warnings
      }

      return {
        id: line.id,
        productId: line.productId,
        productCodeSnapshot: line.productCodeSnapshot,
        productNameSnapshot: line.productNameSnapshot,
        barcodeSnapshot: line.barcodeSnapshot,
        unitId: line.unitId,
        unitNameSnapshot: line.unitNameSnapshot,
        taxRateId: line.taxRateId,
        taxCategorySnapshot: line.taxCategorySnapshot,
        taxRateSnapshot: line.taxRateSnapshot,
        hsnSacCodeSnapshot: line.hsnSacCodeSnapshot,
        productTypeSnapshot: line.productTypeSnapshot,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        mrp: line.mrp,
        minimumSellingPrice: null,
        minimumSellingPriceConfigured: false,
        discountType: line.discountType,
        discountValue: line.discountValue,
        discountAmount: line.discountAmount,
        taxableAmount: allocatedTaxableAmount,
        lineTotal,
        priceSource,
        advisoryStock,
        warnings
      };
    });

    const subtotalWithTaxes = money(overallTaxableAmount + cgstTotal + sgstTotal + igstTotal + cessTotal);
    const grandTotalRounded = Math.round(subtotalWithTaxes);
    const roundOff = money(grandTotalRounded - subtotalWithTaxes);

    return {
      lines: cartLines,
      subtotal: money(subtotal),
      lineDiscountTotal: money(lineDiscountTotal),
      invoiceDiscountType: invoice.invoiceDiscountType,
      invoiceDiscountValue: invoice.invoiceDiscountValue,
      invoiceDiscountTotal: money(invoiceDiscountTotal),
      taxableAmount: money(overallTaxableAmount),
      cgstTotal: money(cgstTotal),
      sgstTotal: money(sgstTotal),
      igstTotal: money(igstTotal),
      cessTotal: money(cessTotal),
      roundOff,
      grandTotal: grandTotalRounded
    };
  }

  /**
   * Helper to build the POS Draft ViewModel.
   */
  private buildDraftViewModel(invoice: SalesInvoice, lines: SalesInvoiceLine[]): POSDraftViewModel {
    const db = getDatabaseConnection();
    const customer = db.prepare('SELECT * FROM Customer WHERE id = ?').get(invoice.customerId);
    const shop = db.prepare('SELECT * FROM Shop WHERE id = ?').get(invoice.shopId);

    const cart = this.calculateProvisionalTotals(invoice, lines, customer, shop);

    return {
      id: invoice.id,
      shopId: invoice.shopId,
      customerId: invoice.customerId,
      draftReference: invoice.draftReference,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      status: invoice.status as 'DRAFT' | 'HELD',
      notes: invoice.notes,
      cart,
      heldAt: invoice.heldAt,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt
    };
  }

  public createDraft(shopId: string, customerId: string): SalesInvoice {
    const customer = this.customerRepo.findById(customerId);
    if (!customer) {
      throw new Error(`Customer with ID ${customerId} not found.`);
    }
    if (customer.shopId !== shopId) {
      throw new Error(`Customer does not belong to this shop.`);
    }
    if (!customer.isActive) {
      throw new Error(`Customer ${customer.name} is inactive.`);
    }

    const nextSeq = this.salesInvoiceRepo.getNextDraftSequence(shopId);
    const draftRef = `DFT-${String(nextSeq).padStart(6, '0')}`;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const invoiceDate = now.split('T')[0];

    return this.salesInvoiceRepo.create({
      id,
      shopId,
      customerId,
      draftReference: draftRef,
      invoiceDate,
      status: 'DRAFT',
      createdAt: now,
      updatedAt: now
    });
  }

  public listDrafts(shopId: string): SalesInvoice[] {
    return this.salesInvoiceRepo.listDrafts(shopId);
  }

  public saveDraft(id: string, input: DraftSalesInvoiceInput): SalesInvoice {
    const db = getDatabaseConnection();
    
    return db.transaction(() => {
      const invoice = this.salesInvoiceRepo.findById(id);
      if (!invoice) {
        throw new Error(`Sales invoice ${id} not found.`);
      }
      if (invoice.status === 'POSTED' || invoice.status === 'CANCELLED') {
        throw new Error(`Cannot edit posted or cancelled invoice.`);
      }
      if (invoice.status === 'HELD') {
        throw new Error(`Held bills must be resumed to DRAFT before editing.`);
      }

      const customer = this.customerRepo.findById(input.customerId);
      if (!customer) {
        throw new Error(`Customer with ID ${input.customerId} not found.`);
      }
      if (customer.shopId !== invoice.shopId) {
        throw new Error(`Customer does not belong to this shop.`);
      }
      if (!customer.isActive) {
        throw new Error(`Customer ${customer.name} is inactive.`);
      }

      const now = new Date().toISOString();
      invoice.customerId = input.customerId;
      invoice.invoiceDate = input.invoiceDate.trim();
      invoice.dueDate = input.dueDate ? input.dueDate.trim() : null;
      invoice.invoiceDiscountType = input.invoiceDiscountType;
      invoice.invoiceDiscountValue = input.invoiceDiscountValue ?? 0;
      invoice.notes = input.notes ? input.notes.trim() : null;
      invoice.updatedAt = now;

      this.salesLineRepo.deleteByInvoiceId(id);

      let subtotal = 0;
      let lineDiscountTotal = 0;

      for (const lineInput of input.lines) {
        if (lineInput.quantity <= 0 || !Number.isFinite(lineInput.quantity)) {
          throw new Error('Quantity must be greater than zero.');
        }
        if (lineInput.unitPrice < 0 || !Number.isFinite(lineInput.unitPrice)) {
          throw new Error('Unit price cannot be negative.');
        }
        if (lineInput.discountValue < 0 || !Number.isFinite(lineInput.discountValue)) {
          throw new Error('Discount value cannot be negative.');
        }

        const product = this.productRepo.findById(lineInput.productId);
        if (!product) {
          throw new Error(`Product with ID ${lineInput.productId} not found.`);
        }
        if (!product.isActive) {
          throw new Error(`Product ${product.name} is inactive.`);
        }

        const barcodes = this.barcodeRepo.listByProduct(product.id);
        const primaryBarcode = barcodes.find(b => b.isPrimary)?.barcode || barcodes[0]?.barcode || null;

        let unitNameSnapshot: string | null = null;
        if (product.primaryUnitId) {
          const unit = this.unitRepo.findById(product.primaryUnitId);
          if (unit) {
            unitNameSnapshot = unit.shortName;
          }
        }

        let taxCategorySnapshot = 'EXEMPT';
        let taxRateSnapshot = 0;
        let cgstRate = 0;
        let sgstRate = 0;
        let igstRate = 0;
        let cessRate = 0;

        if (product.taxRateId) {
          const tax = this.taxRateRepo.findById(product.taxRateId);
          if (tax) {
            taxCategorySnapshot = tax.taxType;
            taxRateSnapshot = tax.rate;
            cgstRate = tax.cgstRate || 0;
            sgstRate = tax.sgstRate || 0;
            igstRate = tax.igstRate || 0;
            cessRate = tax.cessRate || 0;
          }
        }

        let discountAmount = 0;
        if (lineInput.discountType === 'PERCENT') {
          discountAmount = money((lineInput.unitPrice * lineInput.discountValue) / 100);
        } else if (lineInput.discountType === 'AMOUNT') {
          discountAmount = money(lineInput.discountValue);
        }
        const lineTotal = money(lineInput.quantity * money(lineInput.unitPrice - discountAmount));

        subtotal += lineTotal;
        lineDiscountTotal += money(lineInput.quantity * discountAmount);

        const lineId = crypto.randomUUID();
        const line: SalesInvoiceLine = {
          id: lineId,
          salesInvoiceId: id,
          productId: product.id,
          productCodeSnapshot: product.productCode,
          productNameSnapshot: product.name,
          barcodeSnapshot: primaryBarcode,
          hsnSacCodeSnapshot: product.hsnSacCode,
          productTypeSnapshot: product.productType,
          unitId: product.primaryUnitId,
          unitNameSnapshot,
          taxRateId: product.taxRateId,
          taxCategorySnapshot: taxCategorySnapshot as any,
          taxRateSnapshot,
          quantity: lineInput.quantity,
          unitPrice: lineInput.unitPrice,
          mrp: product.cachedMrp || lineInput.unitPrice || 0,
          minimumSellingPrice: product.cachedSellingPrice || 0,
          discountType: lineInput.discountType,
          discountValue: lineInput.discountValue,
          discountAmount,
          invoiceDiscountAllocation: 0,
          taxableAmount: lineTotal,
          cgstRate,
          cgstAmount: 0,
          sgstRate,
          sgstAmount: 0,
          igstRate,
          igstAmount: 0,
          cessRate,
          cessAmount: 0,
          lineTotal,
          inventoryTransactionId: null,
          createdAt: now,
          updatedAt: now
        };

        this.salesLineRepo.create(line);
      }

      let invoiceDiscountTotal = 0;
      if (invoice.invoiceDiscountType === 'PERCENT') {
        invoiceDiscountTotal = money((subtotal * invoice.invoiceDiscountValue) / 100);
      } else if (invoice.invoiceDiscountType === 'AMOUNT') {
        invoiceDiscountTotal = money(invoice.invoiceDiscountValue);
      }

      const grandTotal = money(Math.max(0, subtotal - invoiceDiscountTotal));

      invoice.subtotal = money(subtotal);
      invoice.lineDiscountTotal = money(lineDiscountTotal);
      invoice.invoiceDiscountTotal = money(invoiceDiscountTotal);
      invoice.taxableAmount = money(grandTotal);
      invoice.grandTotal = money(grandTotal);
      invoice.outstandingAmount = money(grandTotal);

      this.salesInvoiceRepo.update(invoice);
      return invoice;
    })();
  }

  /**
   * Creates a new draft sales invoice for POS.
   */
  public createDraftForPOS(shopId: string, customerId: string): POSDraftViewModel {
    const db = getDatabaseConnection();
    return db.transaction(() => {
      // Validate customer
      this.validateCustomerForShop(customerId, shopId);

      const nextSeq = this.salesInvoiceRepo.getNextDraftSequence(shopId);
      const draftRef = `DFT-${String(nextSeq).padStart(6, '0')}`;
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const invoiceDate = now.split('T')[0];

      const invoice = this.salesInvoiceRepo.create({
        id,
        shopId,
        customerId,
        draftReference: draftRef,
        invoiceDate,
        status: 'DRAFT',
        createdAt: now,
        updatedAt: now
      });

      return this.buildDraftViewModel(invoice, []);
    })();
  }

  /**
   * Retrieves a draft invoice for POS.
   */
  public getDraftForPOS(id: string, shopId?: string): POSDraftViewModel {
    const detail = this.getDraft(id, shopId);
    return this.buildDraftViewModel(detail.invoice, detail.lines);
  }

  /**
   * Retrieves detail object directly (for legacy compatibility and sub-operations).
   */
  public getDraft(id: string, shopId?: string): SalesInvoiceDetail {
    const invoice = this.salesInvoiceRepo.findById(id);
    if (!invoice) {
      throw new Error(`Sales invoice ${id} not found.`);
    }
    if (shopId && invoice.shopId !== shopId) {
      throw new Error(`Access denied. Invoice does not belong to this shop.`);
    }
    const lines = this.salesLineRepo.findByInvoiceId(id);
    return { invoice, lines };
  }

  /**
   * Lists held bills for POS.
   */
  public listHeldBillsForPOS(shopId: string): POSHeldBillListItem[] {
    const db = getDatabaseConnection();
    const rows = db.prepare(`
      SELECT 
        si.id,
        si.draftReference,
        si.customerId,
        c.name AS customerName,
        c.phone AS customerPhone,
        si.heldAt,
        si.grandTotal AS provisionalTotal,
        si.notes,
        (SELECT COUNT(*) FROM SalesInvoiceLine WHERE salesInvoiceId = si.id) AS lineCount
      FROM SalesInvoice si
      JOIN Customer c ON c.id = si.customerId
      WHERE si.shopId = ? AND si.status = 'HELD'
      ORDER BY si.heldAt DESC
    `).all(shopId) as any[];

    return rows.map(r => ({
      id: r.id,
      draftReference: r.draftReference,
      customerId: r.customerId,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      heldAt: r.heldAt || new Date().toISOString(),
      lineCount: r.lineCount ?? 0,
      provisionalTotal: r.provisionalTotal ?? 0,
      notes: r.notes || null
    }));
  }

  /**
   * Saves the entire POS draft atomically.
   */
  public saveDraftFromPOS(id: string, input: POSDraftSaveInput): POSDraftViewModel {
    const db = getDatabaseConnection();

    return db.transaction(() => {
      const invoice = this.salesInvoiceRepo.findById(id);
      if (!invoice) {
        throw new Error(`Sales invoice ${id} not found.`);
      }
      if (invoice.status === 'POSTED' || invoice.status === 'CANCELLED') {
        throw new Error(`Cannot edit posted or cancelled invoice.`);
      }
      if (invoice.status === 'HELD') {
        throw new Error(`Held bills must be resumed to DRAFT before editing.`);
      }

      // 1. Verify customer is active and belongs to shop
      const customer = this.validateCustomerForShop(input.customerId, invoice.shopId);

      const now = new Date().toISOString();
      invoice.customerId = input.customerId;
      invoice.invoiceDate = input.invoiceDate.trim();
      invoice.dueDate = input.dueDate ? input.dueDate.trim() : null;
      invoice.invoiceDiscountType = input.invoiceDiscountType;
      invoice.invoiceDiscountValue = input.invoiceDiscountValue ?? 0;
      invoice.notes = input.notes ? input.notes.trim() : null;
      invoice.updatedAt = now;

      // Clean lines first
      this.salesLineRepo.deleteByInvoiceId(id);

      const linesToInsert: SalesInvoiceLine[] = [];

      for (const lineInput of input.lines) {
        // Enforce validations
        const product = this.productRepo.findById(lineInput.productId);
        if (!product) {
          throw new Error(`Product with ID ${lineInput.productId} not found.`);
        }
        if (!product.isActive) {
          throw new Error(`Product "${product.name}" is inactive.`);
        }

        // Validate quantity decimals based on UOM
        const unit = product.primaryUnitId ? this.unitRepo.findById(product.primaryUnitId) : null;
        const decimalAllowed = unit ? Boolean(unit.decimalAllowed) : false;
        const decimalPlaces = unit ? (unit.decimalPlaces ?? 0) : 0;

        if (lineInput.quantity <= 0 || !Number.isFinite(lineInput.quantity)) {
          throw new Error('Quantity must be greater than zero.');
        }

        if (!decimalAllowed && lineInput.quantity % 1 !== 0) {
          throw new Error(`Product "${product.name}" does not allow decimal quantities.`);
        }

        if (decimalAllowed) {
          const roundedQuantity = Number(lineInput.quantity.toFixed(decimalPlaces));
          if (lineInput.quantity !== roundedQuantity) {
            throw new Error(`Quantity ${lineInput.quantity} exceeds configured decimal places of ${decimalPlaces} for unit "${unit?.shortName}".`);
          }
        }

        if (lineInput.provisionalUnitPrice < 0 || !Number.isFinite(lineInput.provisionalUnitPrice)) {
          throw new Error('Provisional unit price cannot be negative.');
        }

        if (lineInput.provisionalDiscountValue < 0 || !Number.isFinite(lineInput.provisionalDiscountValue)) {
          throw new Error('Provisional discount value cannot be negative.');
        }

        // Snapshots from database
        const barcodes = this.barcodeRepo.listByProduct(product.id);
        const primaryBarcode = barcodes.find(b => b.isPrimary)?.barcode || barcodes[0]?.barcode || null;

        let unitNameSnapshot: string | null = null;
        if (unit) {
          unitNameSnapshot = unit.shortName;
        }

        let taxCategorySnapshot = 'EXEMPT';
        let taxRateSnapshot = 0;
        let cgstRate = 0;
        let sgstRate = 0;
        let igstRate = 0;
        let cessRate = 0;

        if (product.taxRateId) {
          const tax = this.taxRateRepo.findById(product.taxRateId);
          if (tax) {
            taxCategorySnapshot = tax.taxType;
            taxRateSnapshot = tax.rate;
            cgstRate = tax.cgstRate || 0;
            sgstRate = tax.sgstRate || 0;
            igstRate = tax.igstRate || 0;
            cessRate = tax.cessRate || 0;
          }
        }

        const lineId = crypto.randomUUID();
        const line: SalesInvoiceLine = {
          id: lineId,
          salesInvoiceId: id,
          productId: product.id,
          productCodeSnapshot: product.productCode,
          productNameSnapshot: product.name,
          barcodeSnapshot: primaryBarcode,
          hsnSacCodeSnapshot: product.hsnSacCode,
          productTypeSnapshot: product.productType,
          unitId: product.primaryUnitId,
          unitNameSnapshot,
          taxRateId: product.taxRateId,
          taxCategorySnapshot: taxCategorySnapshot as any,
          taxRateSnapshot,
          quantity: lineInput.quantity,
          unitPrice: lineInput.provisionalUnitPrice,
          mrp: product.cachedMrp || lineInput.provisionalUnitPrice || 0,
          minimumSellingPrice: null,
          discountType: lineInput.provisionalDiscountType,
          discountValue: lineInput.provisionalDiscountValue,
          discountAmount: 0,
          invoiceDiscountAllocation: 0,
          taxableAmount: 0,
          cgstRate,
          cgstAmount: 0,
          sgstRate,
          sgstAmount: 0,
          igstRate,
          igstAmount: 0,
          cessRate,
          cessAmount: 0,
          lineTotal: 0,
          inventoryTransactionId: null,
          createdAt: now,
          updatedAt: now
        };

        linesToInsert.push(line);
      }

      // Persist lines in database
      for (const line of linesToInsert) {
        this.salesLineRepo.create(line);
      }

      // Recalculate and update invoice header
      const shop = db.prepare('SELECT * FROM Shop WHERE id = ?').get(invoice.shopId);
      const cart = this.calculateProvisionalTotals(invoice, linesToInsert, customer, shop);

      // Save provisional values into database SalesInvoice header fields
      invoice.subtotal = cart.subtotal;
      invoice.lineDiscountTotal = cart.lineDiscountTotal;
      invoice.invoiceDiscountTotal = cart.invoiceDiscountTotal;
      invoice.taxableAmount = cart.taxableAmount;
      invoice.cgstTotal = cart.cgstTotal;
      invoice.sgstTotal = cart.sgstTotal;
      invoice.igstTotal = cart.igstTotal;
      invoice.cessTotal = cart.cessTotal;
      invoice.roundOff = cart.roundOff;
      invoice.grandTotal = cart.grandTotal;
      invoice.outstandingAmount = cart.grandTotal;

      this.salesInvoiceRepo.update(invoice);

      return this.buildDraftViewModel(invoice, linesToInsert);
    })();
  }

  /**
   * Adds a product to a draft cart or increments quantity if duplicate.
   */
  public addDraftLine(invoiceId: string, input: POSCartLineInput): POSDraftViewModel {
    const db = getDatabaseConnection();

    return db.transaction(() => {
      const invoice = this.salesInvoiceRepo.findById(invoiceId);
      if (!invoice) throw new Error(`Draft ${invoiceId} not found.`);
      if (invoice.status !== 'DRAFT') throw new Error('Cannot edit non-draft invoice.');

      const existingLines = this.salesLineRepo.findByInvoiceId(invoiceId);
      const duplicateLine = existingLines.find(line => line.productId === input.productId);

      if (duplicateLine) {
        // Enforce increment
        const newQty = duplicateLine.quantity + input.quantity;
        const product = this.productRepo.findById(input.productId)!;
        const unit = product.primaryUnitId ? this.unitRepo.findById(product.primaryUnitId) : null;
        const decimalPlaces = unit ? (unit.decimalPlaces ?? 0) : 0;

        if (unit && !unit.decimalAllowed && newQty % 1 !== 0) {
          throw new Error(`Product "${product.name}" does not allow decimal quantities.`);
        }

        duplicateLine.quantity = unit && unit.decimalAllowed ? Number(newQty.toFixed(decimalPlaces)) : newQty;
        this.salesLineRepo.update(duplicateLine);
      } else {
        // Create new line snapshot
        const product = this.productRepo.findById(input.productId);
        if (!product) throw new Error('Product not found.');
        if (!product.isActive) throw new Error('Product is inactive.');

        const barcodes = this.barcodeRepo.listByProduct(product.id);
        const primaryBarcode = barcodes.find(b => b.isPrimary)?.barcode || barcodes[0]?.barcode || null;

        let unitNameSnapshot: string | null = null;
        if (product.primaryUnitId) {
          const unit = this.unitRepo.findById(product.primaryUnitId);
          if (unit) {
            unitNameSnapshot = unit.shortName;
          }
        }

        let taxCategorySnapshot = 'EXEMPT';
        let taxRateSnapshot = 0;
        let cgstRate = 0;
        let sgstRate = 0;
        let igstRate = 0;
        let cessRate = 0;

        if (product.taxRateId) {
          const tax = this.taxRateRepo.findById(product.taxRateId);
          if (tax) {
            taxCategorySnapshot = tax.taxType;
            taxRateSnapshot = tax.rate;
            cgstRate = tax.cgstRate || 0;
            sgstRate = tax.sgstRate || 0;
            igstRate = tax.igstRate || 0;
            cessRate = tax.cessRate || 0;
          }
        }

        const now = new Date().toISOString();
        this.salesLineRepo.create({
          id: crypto.randomUUID(),
          salesInvoiceId: invoiceId,
          productId: product.id,
          productCodeSnapshot: product.productCode,
          productNameSnapshot: product.name,
          barcodeSnapshot: primaryBarcode,
          hsnSacCodeSnapshot: product.hsnSacCode,
          productTypeSnapshot: product.productType,
          unitId: product.primaryUnitId,
          unitNameSnapshot,
          taxRateId: product.taxRateId,
          taxCategorySnapshot: taxCategorySnapshot as any,
          taxRateSnapshot,
          quantity: input.quantity,
          unitPrice: input.provisionalUnitPrice,
          mrp: product.cachedMrp || input.provisionalUnitPrice || 0,
          minimumSellingPrice: null,
          discountType: input.provisionalDiscountType,
          discountValue: input.provisionalDiscountValue,
          discountAmount: 0,
          invoiceDiscountAllocation: 0,
          taxableAmount: 0,
          cgstRate,
          cgstAmount: 0,
          sgstRate,
          sgstAmount: 0,
          igstRate,
          igstAmount: 0,
          cessRate,
          cessAmount: 0,
          lineTotal: 0,
          inventoryTransactionId: null,
          createdAt: now,
          updatedAt: now
        });
      }

      // Re-read and build resolved view model
      const updatedLines = this.salesLineRepo.findByInvoiceId(invoiceId);
      const customer = this.customerRepo.findById(invoice.customerId);
      const shop = db.prepare('SELECT * FROM Shop WHERE id = ?').get(invoice.shopId);

      const cart = this.calculateProvisionalTotals(invoice, updatedLines, customer, shop);
      invoice.subtotal = cart.subtotal;
      invoice.lineDiscountTotal = cart.lineDiscountTotal;
      invoice.invoiceDiscountTotal = cart.invoiceDiscountTotal;
      invoice.taxableAmount = cart.taxableAmount;
      invoice.cgstTotal = cart.cgstTotal;
      invoice.sgstTotal = cart.sgstTotal;
      invoice.igstTotal = cart.igstTotal;
      invoice.cessTotal = cart.cessTotal;
      invoice.roundOff = cart.roundOff;
      invoice.grandTotal = cart.grandTotal;
      invoice.outstandingAmount = cart.grandTotal;
      this.salesInvoiceRepo.update(invoice);

      return this.buildDraftViewModel(invoice, updatedLines);
    })();
  }

  /**
   * Modifies an existing draft line quantity or price.
   */
  public updateDraftLine(invoiceId: string, lineId: string, input: POSCartLineInput): POSDraftViewModel {
    const db = getDatabaseConnection();

    return db.transaction(() => {
      const invoice = this.salesInvoiceRepo.findById(invoiceId);
      if (!invoice) throw new Error(`Draft ${invoiceId} not found.`);
      if (invoice.status !== 'DRAFT') throw new Error('Cannot edit non-draft invoice.');

      const line = this.salesLineRepo.findById(lineId);
      if (!line || line.salesInvoiceId !== invoiceId) {
        throw new Error(`Line ${lineId} not found in this draft.`);
      }

      // Enforce decimal checks
      const product = this.productRepo.findById(line.productId)!;
      const unit = product.primaryUnitId ? this.unitRepo.findById(product.primaryUnitId) : null;
      const decimalAllowed = unit ? Boolean(unit.decimalAllowed) : false;
      const decimalPlaces = unit ? (unit.decimalPlaces ?? 0) : 0;

      if (input.quantity <= 0 || !Number.isFinite(input.quantity)) {
        throw new Error('Quantity must be greater than zero.');
      }

      if (!decimalAllowed && input.quantity % 1 !== 0) {
        throw new Error(`Product "${product.name}" does not allow decimal quantities.`);
      }

      if (decimalAllowed) {
        const roundedQuantity = Number(input.quantity.toFixed(decimalPlaces));
        if (input.quantity !== roundedQuantity) {
          throw new Error('Quantity exceeds allowed decimal places.');
        }
      }

      line.quantity = input.quantity;
      line.unitPrice = input.provisionalUnitPrice;
      line.discountType = input.provisionalDiscountType;
      line.discountValue = input.provisionalDiscountValue;
      line.updatedAt = new Date().toISOString();

      this.salesLineRepo.update(line);

      const updatedLines = this.salesLineRepo.findByInvoiceId(invoiceId);
      const customer = this.customerRepo.findById(invoice.customerId);
      const shop = db.prepare('SELECT * FROM Shop WHERE id = ?').get(invoice.shopId);

      const cart = this.calculateProvisionalTotals(invoice, updatedLines, customer, shop);
      invoice.subtotal = cart.subtotal;
      invoice.lineDiscountTotal = cart.lineDiscountTotal;
      invoice.invoiceDiscountTotal = cart.invoiceDiscountTotal;
      invoice.taxableAmount = cart.taxableAmount;
      invoice.cgstTotal = cart.cgstTotal;
      invoice.sgstTotal = cart.sgstTotal;
      invoice.igstTotal = cart.igstTotal;
      invoice.cessTotal = cart.cessTotal;
      invoice.roundOff = cart.roundOff;
      invoice.grandTotal = cart.grandTotal;
      invoice.outstandingAmount = cart.grandTotal;
      this.salesInvoiceRepo.update(invoice);

      return this.buildDraftViewModel(invoice, updatedLines);
    })();
  }

  /**
   * Deletes a draft line from the cart.
   */
  public removeDraftLine(invoiceId: string, lineId: string): POSDraftViewModel {
    const db = getDatabaseConnection();

    return db.transaction(() => {
      const invoice = this.salesInvoiceRepo.findById(invoiceId);
      if (!invoice) throw new Error(`Draft ${invoiceId} not found.`);
      if (invoice.status !== 'DRAFT') throw new Error('Cannot edit non-draft invoice.');

      this.salesLineRepo.delete(lineId);

      const updatedLines = this.salesLineRepo.findByInvoiceId(invoiceId);
      const customer = this.customerRepo.findById(invoice.customerId);
      const shop = db.prepare('SELECT * FROM Shop WHERE id = ?').get(invoice.shopId);

      const cart = this.calculateProvisionalTotals(invoice, updatedLines, customer, shop);
      invoice.subtotal = cart.subtotal;
      invoice.lineDiscountTotal = cart.lineDiscountTotal;
      invoice.invoiceDiscountTotal = cart.invoiceDiscountTotal;
      invoice.taxableAmount = cart.taxableAmount;
      invoice.cgstTotal = cart.cgstTotal;
      invoice.sgstTotal = cart.sgstTotal;
      invoice.igstTotal = cart.igstTotal;
      invoice.cessTotal = cart.cessTotal;
      invoice.roundOff = cart.roundOff;
      invoice.grandTotal = cart.grandTotal;
      invoice.outstandingAmount = cart.grandTotal;
      this.salesInvoiceRepo.update(invoice);

      return this.buildDraftViewModel(invoice, updatedLines);
    })();
  }

  /**
   * Atomically reprices a cart when the customer changes.
   */
  public repriceCartForCustomer(invoiceId: string, customerId: string): POSCustomerRepriceResult {
    const db = getDatabaseConnection();

    return db.transaction(() => {
      const invoice = this.salesInvoiceRepo.findById(invoiceId);
      if (!invoice) throw new Error(`Draft ${invoiceId} not found.`);
      if (invoice.status !== 'DRAFT') throw new Error('Only draft invoices can be repriced.');

      // Validate new customer
      const newCustomer = this.validateCustomerForShop(customerId, invoice.shopId);
      const shop = db.prepare('SELECT * FROM Shop WHERE id = ?').get(invoice.shopId);
      const existingLines = this.salesLineRepo.findByInvoiceId(invoiceId);

      const priceChanges: POSPriceChange[] = [];
      const updatedLinesPayload: { line: SalesInvoiceLine; oldPrice: number; oldSource: POSPriceSource; resolvedPrice: any }[] = [];

      for (const line of existingLines) {
        // Resolve new price for customer
        let oldPriceSource: POSPriceSource = 'STANDARD_PRICE_BOOK';
        try {
          const oldResolved = this.priceResolutionService.resolvePrice({
            shopId: invoice.shopId,
            productId: line.productId,
            customerId: invoice.customerId,
            draftDate: invoice.invoiceDate
          });
          oldPriceSource = oldResolved.priceSource;
        } catch {
          // Old fallback
        }

        const newResolved = this.priceResolutionService.resolvePrice({
          shopId: invoice.shopId,
          productId: line.productId,
          customerId: customerId,
          draftDate: invoice.invoiceDate
        });

        priceChanges.push({
          productId: line.productId,
          productName: line.productNameSnapshot,
          oldPrice: line.unitPrice,
          newPrice: newResolved.sellingPrice,
          oldPriceSource,
          newPriceSource: newResolved.priceSource,
          warnings: newResolved.warnings
        });

        const lineCopy = { ...line };
        lineCopy.unitPrice = newResolved.sellingPrice;
        lineCopy.mrp = newResolved.mrp;

        updatedLinesPayload.push({
          line: lineCopy,
          oldPrice: line.unitPrice,
          oldSource: oldPriceSource,
          resolvedPrice: newResolved
        });
      }

      // Apply changes atomically to DB
      for (const item of updatedLinesPayload) {
        this.salesLineRepo.update(item.line);
      }

      // Update header customerId and recalculate totals
      invoice.customerId = customerId;
      const updatedInvoiceLines = this.salesLineRepo.findByInvoiceId(invoiceId);
      const cart = this.calculateProvisionalTotals(invoice, updatedInvoiceLines, newCustomer, shop);

      invoice.subtotal = cart.subtotal;
      invoice.lineDiscountTotal = cart.lineDiscountTotal;
      invoice.invoiceDiscountTotal = cart.invoiceDiscountTotal;
      invoice.taxableAmount = cart.taxableAmount;
      invoice.cgstTotal = cart.cgstTotal;
      invoice.sgstTotal = cart.sgstTotal;
      invoice.igstTotal = cart.igstTotal;
      invoice.cessTotal = cart.cessTotal;
      invoice.roundOff = cart.roundOff;
      invoice.grandTotal = cart.grandTotal;
      invoice.outstandingAmount = cart.grandTotal;
      this.salesInvoiceRepo.update(invoice);

      return {
        success: true,
        repricedLines: cart.lines,
        priceChanges,
        totals: {
          subtotal: cart.subtotal,
          grandTotal: cart.grandTotal
        }
      };
    })();
  }

  /**
   * Resumes a held bill, transitioning status to DRAFT and re-resolving prices.
   */
  public resumeBillForPOS(id: string, shopId?: string): POSDraftViewModel {
    const db = getDatabaseConnection();

    return db.transaction(() => {
      const invoice = this.salesInvoiceRepo.findById(id);
      if (!invoice) throw new Error(`Sales invoice ${id} not found.`);
      if (shopId && invoice.shopId !== shopId) {
        throw new Error('Invoice does not belong to this shop.');
      }
      if (invoice.status !== 'HELD') {
        throw new Error('Only HELD bills can be resumed.');
      }

      // Transition state HELD -> DRAFT
      const now = new Date().toISOString();
      invoice.status = 'DRAFT';
      invoice.heldAt = null;
      invoice.updatedAt = now;
      this.salesInvoiceRepo.update(invoice);

      // Re-resolve prices
      const lines = this.salesLineRepo.findByInvoiceId(id);
      for (const line of lines) {
        try {
          const resolved = this.priceResolutionService.resolvePrice({
            shopId: invoice.shopId,
            productId: line.productId,
            customerId: invoice.customerId,
            draftDate: invoice.invoiceDate
          });
          line.unitPrice = resolved.sellingPrice;
          line.mrp = resolved.mrp;
          this.salesLineRepo.update(line);
        } catch (err) {
          // Keep original price if resolution fails on resume, or let it throw.
          // The policy says: "re-resolve Customer and prices, show price-change warnings"
        }
      }

      const updatedLines = this.salesLineRepo.findByInvoiceId(id);
      const customer = this.customerRepo.findById(invoice.customerId);
      const shop = db.prepare('SELECT * FROM Shop WHERE id = ?').get(invoice.shopId);

      const cart = this.calculateProvisionalTotals(invoice, updatedLines, customer, shop);
      invoice.subtotal = cart.subtotal;
      invoice.lineDiscountTotal = cart.lineDiscountTotal;
      invoice.invoiceDiscountTotal = cart.invoiceDiscountTotal;
      invoice.taxableAmount = cart.taxableAmount;
      invoice.cgstTotal = cart.cgstTotal;
      invoice.sgstTotal = cart.sgstTotal;
      invoice.igstTotal = cart.igstTotal;
      invoice.cessTotal = cart.cessTotal;
      invoice.roundOff = cart.roundOff;
      invoice.grandTotal = cart.grandTotal;
      invoice.outstandingAmount = cart.grandTotal;
      this.salesInvoiceRepo.update(invoice);

      return this.buildDraftViewModel(invoice, updatedLines);
    })();
  }

  /**
   * Holds a draft bill.
   */
  public holdBill(id: string, shopId?: string): void {
    const invoice = this.salesInvoiceRepo.findById(id);
    if (!invoice) {
      throw new Error(`Sales invoice ${id} not found.`);
    }
    if (shopId && invoice.shopId !== shopId) {
      throw new Error(`Access denied. Invoice does not belong to this shop.`);
    }
    if (invoice.status !== 'DRAFT') {
      throw new Error('Only DRAFT invoices can be held.');
    }

    const lines = this.salesLineRepo.findByInvoiceId(id);
    if (lines.length === 0) {
      throw new Error('Draft must contain at least one line to be held.');
    }

    const now = new Date().toISOString();
    invoice.status = 'HELD';
    invoice.heldAt = now;
    invoice.updatedAt = now;

    this.salesInvoiceRepo.update(invoice);
  }

  /**
   * Resumes a held bill (legacy method compatibility).
   */
  public resumeBill(id: string, shopId?: string): void {
    const invoice = this.salesInvoiceRepo.findById(id);
    if (!invoice) {
      throw new Error(`Sales invoice ${id} not found.`);
    }
    if (shopId && invoice.shopId !== shopId) {
      throw new Error(`Access denied. Invoice does not belong to this shop.`);
    }
    if (invoice.status !== 'HELD') {
      throw new Error('Only HELD invoices can be resumed.');
    }

    const now = new Date().toISOString();
    invoice.status = 'DRAFT';
    invoice.heldAt = null;
    invoice.updatedAt = now;

    this.salesInvoiceRepo.update(invoice);
  }

  /**
   * Deletes a draft invoice.
   */
  public deleteDraft(id: string, shopId?: string): void {
    const invoice = this.salesInvoiceRepo.findById(id);
    if (!invoice) {
      throw new Error(`Sales invoice ${id} not found.`);
    }
    if (shopId && invoice.shopId !== shopId) {
      throw new Error(`Access denied. Invoice does not belong to this shop.`);
    }
    if (invoice.status !== 'DRAFT' && invoice.status !== 'HELD') {
      throw new Error('Only unposted draft or held invoices can be deleted.');
    }

    this.salesInvoiceRepo.delete(id);
  }
}
