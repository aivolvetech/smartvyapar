import { getDatabaseConnection } from '../database/database-connection';
import { ProductRepository } from '../database/repositories/product.repository';
import { ShopRepository } from '../database/repositories/shop.repository';
import { InventoryAdjustmentRepository } from '../database/repositories/inventory-adjustment.repository';
import { InventoryReportRepository } from '../database/repositories/inventory-report.repository';
import { InventoryTransactionRepository } from '../database/repositories/inventory-transaction.repository';
import {
  CreateInventoryAdjustmentInput,
  InventoryDashboardSummary,
  InventoryMovementFilter,
  InventoryMovementResult,
  InventoryStockSummary,
  InventorySummaryFilter,
  InventorySummaryResult,
  InventoryTransaction,
  PostDamageInput,
  PostExpiryInput,
  PostLossInput,
  PostOpeningStockInput,
  ReverseInventoryTransactionInput,
} from '../../shared/models/inventory';

type OutboundType = 'ADJUSTMENT_OUT' | 'DAMAGE_OUT' | 'EXPIRY_OUT' | 'LOSS_OUT';

export class InventoryService {
  private productRepo = new ProductRepository();
  private shopRepo = new ShopRepository();
  private transactionRepo = new InventoryTransactionRepository();
  private adjustmentRepo = new InventoryAdjustmentRepository();
  private reportRepo = new InventoryReportRepository();

  public getProductStock(productId: string): InventoryStockSummary {
    const shop = this.requireShop();
    const summary = this.transactionRepo.getProductStock(shop.id, productId);
    if (!summary) throw new Error('Product not found.');
    return summary;
  }

  public getInventorySummary(filter: InventorySummaryFilter): InventorySummaryResult {
    const shop = this.requireShop();
    return this.reportRepo.listStock(shop.id, filter);
  }

  public getInventoryMovements(filter: InventoryMovementFilter): InventoryMovementResult {
    const shop = this.requireShop();
    return this.transactionRepo.listMovements(shop.id, filter);
  }

  public getInventoryDashboardSummary(): InventoryDashboardSummary {
    const shop = this.requireShop();
    return this.reportRepo.dashboardSummary(shop.id);
  }

  public postOpeningStock(input: PostOpeningStockInput): InventoryTransaction {
    return this.postInbound({
      productId: input.productId,
      transactionType: 'OPENING',
      quantity: input.quantity,
      unitCost: input.unitCost ?? 0,
      reasonCode: input.reason || 'OPENING',
      notes: input.notes ?? null,
      occurredAt: input.occurredAt,
      referenceType: 'MANUAL_OPENING',
    });
  }

  public postAdjustment(input: CreateInventoryAdjustmentInput): InventoryTransaction {
    if (input.adjustmentType === 'ADJUSTMENT_IN') {
      return this.postAdjustmentTransaction(input, Math.abs(input.quantity), input.unitCost ?? 0);
    }
    return this.postAdjustmentTransaction(input, -Math.abs(input.quantity), input.unitCost ?? undefined);
  }

  public postDamage(input: PostDamageInput): InventoryTransaction {
    return this.postOutbound({
      productId: input.productId,
      transactionType: 'DAMAGE_OUT',
      quantity: input.quantity,
      reasonCode: input.reason,
      notes: input.notes ?? null,
      occurredAt: input.occurredAt,
    });
  }

  public postExpiry(input: PostExpiryInput): InventoryTransaction {
    return this.postOutbound({
      productId: input.productId,
      transactionType: 'EXPIRY_OUT',
      quantity: input.quantity,
      reasonCode: input.reason,
      notes: input.notes ? `${input.notes} | Expiry date: ${input.expiryDate}` : `Expiry date: ${input.expiryDate}`,
      occurredAt: input.expiryDate,
    });
  }

  public postLoss(input: PostLossInput): InventoryTransaction {
    return this.postOutbound({
      productId: input.productId,
      transactionType: 'LOSS_OUT',
      quantity: input.quantity,
      reasonCode: input.reason,
      notes: input.notes ?? null,
      occurredAt: input.occurredAt,
    });
  }

  public postPurchaseIn(input: {
    productId: string;
    quantity: number;
    unitCost: number;
    referenceType: 'PURCHASE_INVOICE';
    referenceId: string;
    referenceNumber: string;
    occurredAt: string;
  }): InventoryTransaction {
    return this.postInbound({
      productId: input.productId,
      transactionType: 'PURCHASE_IN',
      quantity: input.quantity,
      unitCost: input.unitCost,
      reasonCode: 'PURCHASE_IN',
      notes: 'Posted from purchase invoice.',
      occurredAt: input.occurredAt,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      referenceNumber: input.referenceNumber,
    });
  }

  public reverseTransaction(input: ReverseInventoryTransactionInput): InventoryTransaction {
    if (!input.transactionId?.trim()) throw new Error('Transaction ID is required.');
    if (!input.reason?.trim()) throw new Error('Reversal reason is required.');

    const db = getDatabaseConnection();
    return db.transaction(() => {
      const original = this.transactionRepo.findById(input.transactionId);
      if (!original) throw new Error('Inventory transaction not found.');
      if (original.reversalOfTransactionId) throw new Error('A reversal transaction cannot be reversed again.');
      if (this.transactionRepo.hasReversal(original.id)) throw new Error('Inventory transaction has already been reversed.');

      const product = this.requireInventoryProduct(original.productId);
      const shop = this.requireShop();
      const reversalQuantity = -original.quantity;
      if (reversalQuantity < 0) {
        this.ensureNegativeStockAllowed(shop.id, product.id, Math.abs(reversalQuantity), product.allowNegativeStock);
      }

      return this.transactionRepo.create({
        shopId: shop.id,
        productId: original.productId,
        transactionType: 'REVERSAL',
        quantity: reversalQuantity,
        unitCost: original.unitCost,
        referenceType: 'REVERSAL',
        referenceId: original.id,
        referenceNumber: original.referenceNumber,
        sourceTransactionId: original.id,
        reversalOfTransactionId: original.id,
        reasonCode: input.reason.trim(),
        notes: input.notes ?? null,
      });
    })();
  }

  private postAdjustmentTransaction(input: CreateInventoryAdjustmentInput, signedQuantity: number, suppliedUnitCost?: number): InventoryTransaction {
    if (!input.reason?.trim()) throw new Error('Adjustment reason is required.');
    const db = getDatabaseConnection();
    return db.transaction(() => {
      const product = this.requireInventoryProduct(input.productId);
      const shop = this.requireShop();
      const current = this.transactionRepo.currentStock(shop.id, product.id);
      if (signedQuantity < 0) {
        this.ensureNegativeStockAllowed(shop.id, product.id, Math.abs(signedQuantity), product.allowNegativeStock);
      }
      const unitCost = this.resolveUnitCost(shop.id, product.id, signedQuantity, suppliedUnitCost);
      const adjustment = this.adjustmentRepo.createPosted({
        adjustmentType: input.adjustmentType,
        reasonCode: input.reason.trim(),
        notes: input.notes ?? null,
        occurredAt: input.occurredAt ?? new Date().toISOString(),
      });
      this.adjustmentRepo.createLine({
        adjustmentId: adjustment.id,
        productId: product.id,
        systemQuantity: current,
        countedQuantity: input.adjustmentType === 'ADJUSTMENT_IN' ? current + Math.abs(input.quantity) : current - Math.abs(input.quantity),
        differenceQuantity: signedQuantity,
        unitCost,
        notes: input.notes ?? null,
      });
      return this.transactionRepo.create({
        shopId: shop.id,
        productId: product.id,
        transactionType: input.adjustmentType,
        quantity: signedQuantity,
        unitCost,
        referenceType: 'INVENTORY_ADJUSTMENT',
        referenceId: adjustment.id,
        referenceNumber: adjustment.adjustmentNumber,
        reasonCode: input.reason.trim(),
        notes: input.notes ?? null,
        occurredAt: input.occurredAt,
      });
    })();
  }

  private postInbound(input: {
    productId: string;
    transactionType: 'OPENING' | 'ADJUSTMENT_IN' | 'PURCHASE_IN';
    quantity: number;
    unitCost: number;
    reasonCode: string;
    notes: string | null;
    occurredAt?: string;
    referenceType?: string;
    referenceId?: string;
    referenceNumber?: string | null;
  }): InventoryTransaction {
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error('Quantity must be greater than zero.');
    if (!Number.isFinite(input.unitCost) || input.unitCost < 0) throw new Error('Unit cost cannot be negative.');
    const db = getDatabaseConnection();
    return db.transaction(() => {
      const product = this.requireInventoryProduct(input.productId);
      const shop = this.requireShop();
      return this.transactionRepo.create({
        shopId: shop.id,
        productId: product.id,
        transactionType: input.transactionType,
        quantity: Math.abs(input.quantity),
        unitCost: input.unitCost,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        referenceNumber: input.referenceNumber ?? null,
        reasonCode: input.reasonCode,
        notes: input.notes,
        occurredAt: input.occurredAt,
      });
    })();
  }

  private postOutbound(input: {
    productId: string;
    transactionType: OutboundType;
    quantity: number;
    reasonCode: string;
    notes: string | null;
    occurredAt?: string;
  }): InventoryTransaction {
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error('Quantity must be greater than zero.');
    if (!input.reasonCode?.trim()) throw new Error('Reason is required.');
    const db = getDatabaseConnection();
    return db.transaction(() => {
      const product = this.requireInventoryProduct(input.productId);
      const shop = this.requireShop();
      this.ensureNegativeStockAllowed(shop.id, product.id, Math.abs(input.quantity), product.allowNegativeStock);
      const unitCost = this.resolveUnitCost(shop.id, product.id, -Math.abs(input.quantity));
      const adjustment = this.adjustmentRepo.createPosted({
        adjustmentType: input.transactionType,
        reasonCode: input.reasonCode.trim(),
        notes: input.notes,
        occurredAt: input.occurredAt ?? new Date().toISOString(),
      });
      this.adjustmentRepo.createLine({
        adjustmentId: adjustment.id,
        productId: product.id,
        systemQuantity: this.transactionRepo.currentStock(shop.id, product.id),
        differenceQuantity: -Math.abs(input.quantity),
        unitCost,
        notes: input.notes,
      });
      return this.transactionRepo.create({
        shopId: shop.id,
        productId: product.id,
        transactionType: input.transactionType,
        quantity: -Math.abs(input.quantity),
        unitCost,
        referenceType: 'INVENTORY_ADJUSTMENT',
        referenceId: adjustment.id,
        referenceNumber: adjustment.adjustmentNumber,
        reasonCode: input.reasonCode.trim(),
        notes: input.notes,
        occurredAt: input.occurredAt,
      });
    })();
  }

  private resolveUnitCost(shopId: string, productId: string, signedQuantity: number, suppliedUnitCost?: number): number {
    if (suppliedUnitCost !== undefined) {
      if (!Number.isFinite(suppliedUnitCost) || suppliedUnitCost < 0) throw new Error('Unit cost cannot be negative.');
      return suppliedUnitCost;
    }
    if (signedQuantity > 0) throw new Error('Unit cost is required for stock-in adjustments.');
    return this.transactionRepo.averageCost(shopId, productId) ?? 0;
  }

  private ensureNegativeStockAllowed(shopId: string, productId: string, requestedOut: number, allowNegativeStock: boolean): void {
    const current = this.transactionRepo.currentStock(shopId, productId);
    if (!allowNegativeStock && current - requestedOut < 0) {
      throw new Error(`Insufficient stock. Available: ${current}, requested: ${requestedOut}.`);
    }
  }

  private requireInventoryProduct(productId: string) {
    if (!productId?.trim()) throw new Error('Product is required.');
    const product = this.productRepo.findById(productId);
    if (!product) throw new Error('Product not found.');
    if (product.productType !== 'GOODS') throw new Error('Service products cannot have inventory movements.');
    if (!product.trackInventory) throw new Error('Inventory tracking is disabled for this product.');
    return product;
  }

  private requireShop() {
    const shop = this.shopRepo.getShop();
    if (!shop) throw new Error('Shop profile is required before inventory can be posted.');
    return shop;
  }
}
