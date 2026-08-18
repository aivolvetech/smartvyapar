import { SupplierLedgerRepository } from '../database/repositories/supplier-ledger.repository';
import { SupplierLedgerEntry, SupplierOutstandingSummary } from '../../shared/models/supplier-purchase';

export class SupplierLedgerService {
  private repo = new SupplierLedgerRepository();

  public recordOpening(input: {
    supplierId: string;
    shopId: string;
    amount: number;
    type: 'PAYABLE' | 'RECEIVABLE' | 'NONE';
  }): SupplierLedgerEntry | null {
    if (!input.amount || input.amount <= 0 || input.type === 'NONE') return null;
    return this.repo.create({
      supplierId: input.supplierId,
      shopId: input.shopId,
      entryType: 'OPENING_BALANCE',
      referenceType: 'SUPPLIER_OPENING',
      referenceId: input.supplierId,
      referenceNumber: null,
      creditAmount: input.type === 'PAYABLE' ? input.amount : 0,
      debitAmount: input.type === 'RECEIVABLE' ? input.amount : 0,
      notes: 'Supplier opening balance.',
    });
  }

  public recordPurchase(input: {
    supplierId: string;
    shopId: string;
    purchaseId: string;
    purchaseNumber: string;
    amount: number;
    occurredAt: string;
  }): SupplierLedgerEntry {
    return this.repo.create({
      supplierId: input.supplierId,
      shopId: input.shopId,
      entryType: 'PURCHASE',
      referenceType: 'PURCHASE_INVOICE',
      referenceId: input.purchaseId,
      referenceNumber: input.purchaseNumber,
      creditAmount: input.amount,
      debitAmount: 0,
      occurredAt: input.occurredAt,
      notes: 'Purchase invoice posted.',
    });
  }

  public recordPurchaseCancellation(input: {
    supplierId: string;
    shopId: string;
    purchaseId: string;
    purchaseNumber: string;
    amount: number;
    occurredAt: string;
    reason: string;
  }): SupplierLedgerEntry {
    return this.repo.create({
      supplierId: input.supplierId,
      shopId: input.shopId,
      entryType: 'PURCHASE_CANCELLATION',
      referenceType: 'PURCHASE_INVOICE',
      referenceId: input.purchaseId,
      referenceNumber: input.purchaseNumber,
      debitAmount: input.amount,
      creditAmount: 0,
      occurredAt: input.occurredAt,
      notes: `Purchase cancelled: ${input.reason}`,
    });
  }

  public outstanding(supplierId: string): SupplierOutstandingSummary {
    return this.repo.outstanding(supplierId);
  }
}
