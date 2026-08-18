import { getDatabaseConnection } from '../database/database-connection';
import { ProductRepository } from '../database/repositories/product.repository';
import { PurchaseInvoiceRepository } from '../database/repositories/purchase-invoice.repository';
import { PurchaseLineRepository } from '../database/repositories/purchase-line.repository';
import { PurchaseReportRepository } from '../database/repositories/purchase-report.repository';
import { ShopRepository } from '../database/repositories/shop.repository';
import { SupplierLedgerRepository } from '../database/repositories/supplier-ledger.repository';
import { SupplierRepository } from '../database/repositories/supplier.repository';
import {
  CancelPurchaseInput,
  PurchaseDashboardSummary,
  PurchaseDetail,
  PurchaseDraftInput,
  PurchaseFilter,
  PurchaseInvoice,
  PurchaseListResult,
} from '../../shared/models/supplier-purchase';
import { InventoryService } from './inventory.service';
import { PricingService } from './pricing.service';
import { PurchaseCalculationService } from './purchase-calculation.service';
import { PurchaseNumberService } from './purchase-number.service';
import { SupplierLedgerService } from './supplier-ledger.service';

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function sanitizeDraft(input: PurchaseDraftInput): PurchaseDraftInput {
  if (!input?.supplierId?.trim()) throw new Error('Supplier is required.');
  if (!input.invoiceDate?.trim()) throw new Error('Invoice date is required.');
  return {
    supplierId: input.supplierId,
    supplierInvoiceNumber: input.supplierInvoiceNumber?.trim() || undefined,
    invoiceDate: input.invoiceDate,
    dueDate: input.dueDate || undefined,
    invoiceDiscountType: input.invoiceDiscountType || 'NONE',
    invoiceDiscountValue: Number(input.invoiceDiscountValue ?? 0),
    notes: input.notes?.trim() || undefined,
    lines: input.lines || [],
  };
}

export class PurchaseService {
  private invoiceRepo = new PurchaseInvoiceRepository();
  private lineRepo = new PurchaseLineRepository();
  private supplierRepo = new SupplierRepository();
  private shopRepo = new ShopRepository();
  private productRepo = new ProductRepository();
  private ledgerRepo = new SupplierLedgerRepository();
  private reportRepo = new PurchaseReportRepository();
  private calculator = new PurchaseCalculationService();
  private numberService = new PurchaseNumberService();
  private inventory = new InventoryService();
  private ledger = new SupplierLedgerService();
  private pricing = new PricingService();

  public listPurchases(filter: PurchaseFilter): PurchaseListResult {
    return this.invoiceRepo.list(filter);
  }

  public getPurchaseById(id: string): PurchaseDetail | null {
    if (!id?.trim()) throw new Error('Purchase ID is required.');
    const invoice = this.invoiceRepo.findById(id);
    if (!invoice) return null;
    const supplier = this.supplierRepo.findById(invoice.supplierId);
    if (!supplier) throw new Error('Supplier not found.');
    return {
      invoice,
      supplier,
      lines: this.lineRepo.listByInvoice(invoice.id),
      ledgerEntries: this.ledgerRepo.listByReference('PURCHASE_INVOICE', invoice.id),
    };
  }

  public createPurchaseDraft(input: PurchaseDraftInput): PurchaseDetail {
    const prepared = this.prepareDraft(input);
    const shop = this.requireShop();
    const db = getDatabaseConnection();
    const detail = db.transaction(() => {
      const purchaseNumber = this.numberService.nextPurchaseNumber(prepared.invoiceDate);
      const invoice = this.invoiceRepo.createDraft({
        shopId: shop.id,
        supplierId: prepared.supplierId,
        purchaseNumber,
        supplierInvoiceNumber: prepared.supplierInvoiceNumber,
        invoiceDate: prepared.invoiceDate,
        dueDate: prepared.dueDate,
        invoiceDiscountType: prepared.invoiceDiscountType || 'NONE',
        invoiceDiscountValue: prepared.invoiceDiscountValue || 0,
        notes: prepared.notes,
      });
      this.applyDraftLines(invoice.id, prepared);
      return this.getPurchaseById(invoice.id)!;
    })();
    return detail;
  }

  public updatePurchaseDraft(id: string, input: PurchaseDraftInput): PurchaseDetail {
    const existing = this.invoiceRepo.findById(id);
    if (!existing) throw new Error('Purchase not found.');
    if (existing.status !== 'DRAFT') throw new Error('Only draft purchases can be edited.');
    const prepared = this.prepareDraft(input, id);
    const db = getDatabaseConnection();
    return db.transaction(() => {
      this.applyDraftLines(id, prepared);
      return this.getPurchaseById(id)!;
    })();
  }

  public deletePurchaseDraft(id: string): void {
    const existing = this.invoiceRepo.findById(id);
    if (!existing) throw new Error('Purchase not found.');
    if (existing.status !== 'DRAFT') throw new Error('Only draft purchases can be deleted.');
    this.invoiceRepo.deleteDraft(id);
  }

  public calculatePurchase(input: PurchaseDraftInput) {
    return this.calculator.calculate(this.prepareDraft(input, undefined, false));
  }

  public postPurchase(id: string): PurchaseDetail {
    const db = getDatabaseConnection();
    return db.transaction(() => {
      const detail = this.getPurchaseById(id);
      if (!detail) throw new Error('Purchase not found.');
      if (detail.invoice.status !== 'DRAFT') throw new Error('Only draft purchases can be posted.');
      if (detail.lines.length === 0) throw new Error('Purchase must have at least one line.');

      for (const line of detail.lines) {
        const product = this.productRepo.findById(line.productId);
        if (!product) throw new Error(`Product not found for line ${line.productNameSnapshot}.`);
        if (product.productType === 'GOODS' && product.trackInventory) {
          if (line.inventoryTransactionId) throw new Error('Purchase line is already linked to inventory.');
          const tx = this.inventory.postPurchaseIn({
            productId: product.id,
            quantity: line.quantity,
            unitCost: line.unitPrice,
            referenceType: 'PURCHASE_INVOICE',
            referenceId: detail.invoice.id,
            referenceNumber: detail.invoice.purchaseNumber,
            occurredAt: detail.invoice.invoiceDate,
          });
          this.lineRepo.setInventoryTransaction(line.id, tx.id);
        }
        this.updateLastPurchasePrice(product, line.unitPrice, line.mrp);
      }

      const posted = this.invoiceRepo.markPosted(id);
      this.ledger.recordPurchase({
        supplierId: posted.supplierId,
        shopId: posted.shopId,
        purchaseId: posted.id,
        purchaseNumber: posted.purchaseNumber,
        amount: posted.grandTotal,
        occurredAt: posted.postedAt || new Date().toISOString(),
      });
      return this.getPurchaseById(id)!;
    })();
  }

  public cancelPurchase(id: string, input: CancelPurchaseInput): PurchaseDetail {
    if (!input.reason?.trim()) throw new Error('Cancellation reason is required.');
    const db = getDatabaseConnection();
    return db.transaction(() => {
      const detail = this.getPurchaseById(id);
      if (!detail) throw new Error('Purchase not found.');
      if (detail.invoice.status !== 'POSTED') throw new Error('Only posted purchases can be cancelled.');
      for (const line of detail.lines) {
        if (line.inventoryTransactionId) {
          this.inventory.reverseTransaction({
            transactionId: line.inventoryTransactionId,
            reason: 'PURCHASE_CANCELLED',
            notes: input.reason.trim(),
          });
        }
      }
      const cancelled = this.invoiceRepo.markCancelled(id, input.reason.trim());
      this.ledger.recordPurchaseCancellation({
        supplierId: cancelled.supplierId,
        shopId: cancelled.shopId,
        purchaseId: cancelled.id,
        purchaseNumber: cancelled.purchaseNumber,
        amount: cancelled.grandTotal,
        occurredAt: cancelled.cancelledAt || new Date().toISOString(),
        reason: input.reason.trim(),
      });
      return this.getPurchaseById(id)!;
    })();
  }

  public getPurchaseDashboardSummary(): PurchaseDashboardSummary {
    const shop = this.requireShop();
    return this.reportRepo.dashboardSummary(shop.id);
  }

  private prepareDraft(input: PurchaseDraftInput, excludeId?: string, requireActiveSupplier = true): PurchaseDraftInput {
    const prepared = sanitizeDraft(input);
    const supplier = this.supplierRepo.findById(prepared.supplierId);
    if (!supplier) throw new Error('Supplier not found.');
    if (requireActiveSupplier && !supplier.isActive) throw new Error('Inactive supplier cannot be used for new purchases.');
    if (prepared.supplierInvoiceNumber && this.invoiceRepo.duplicateSupplierInvoice(supplier.id, prepared.supplierInvoiceNumber, excludeId)) {
      throw new Error('This supplier invoice number already exists for the selected supplier.');
    }
    if (!prepared.dueDate) prepared.dueDate = addDays(prepared.invoiceDate, supplier.paymentTermsDays);
    return prepared;
  }

  private applyDraftLines(id: string, input: PurchaseDraftInput): PurchaseInvoice {
    const calc = this.calculator.calculate(input);
    this.invoiceRepo.updateDraft(id, {
      supplierId: input.supplierId,
      supplierInvoiceNumber: input.supplierInvoiceNumber,
      invoiceDate: input.invoiceDate,
      dueDate: input.dueDate,
      invoiceDiscountType: input.invoiceDiscountType || 'NONE',
      invoiceDiscountValue: input.invoiceDiscountValue || 0,
      notes: input.notes,
      totals: calc,
    });
    this.lineRepo.replaceForInvoice(id, calc.lines.map(line => ({
      purchaseInvoiceId: id,
      ...line,
      inventoryTransactionId: null,
    })));
    return this.invoiceRepo.findById(id)!;
  }

  private updateLastPurchasePrice(product: NonNullable<ReturnType<ProductRepository['findById']>>, unitPrice: number, mrp: number): void {
    const current = this.pricing.resolveDefaultPrice(product.id);
    this.pricing.updateDefaultPrice(product.id, {
      purchasePrice: unitPrice,
      sellingPrice: current.sellingPrice ?? product.cachedSellingPrice ?? 0,
      mrp: current.mrp ?? product.cachedMrp ?? mrp ?? 0,
      wholesalePrice: current.wholesalePrice ?? product.cachedWholesalePrice ?? undefined,
    });
  }

  private requireShop() {
    const shop = this.shopRepo.getShop();
    if (!shop) throw new Error('Shop profile is required before creating purchases.');
    return shop;
  }
}
