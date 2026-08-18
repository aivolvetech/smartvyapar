import { getDatabaseConnection } from '../database/database-connection';
import { CustomerLedgerRepository } from '../database/repositories/customer-ledger.repository';
import { CustomerRepository } from '../database/repositories/customer.repository';
import { ShopRepository } from '../database/repositories/shop.repository';
import {
  CustomerOpeningBalanceInput,
  CustomerLedgerEntry,
  CustomerOutstandingSummary,
} from '../../shared/models/customer';

function money(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error('Invalid monetary value.');
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export class CustomerLedgerService {
  private repo = new CustomerLedgerRepository();
  private customerRepo = new CustomerRepository();
  private shopRepo = new ShopRepository();

  public postOpeningBalance(input: CustomerOpeningBalanceInput): CustomerLedgerEntry | null {
    const customer = this.customerRepo.findById(input.customerId);
    if (!customer) throw new Error('Customer not found.');
    if (!customer.isActive) throw new Error('Customer is inactive.');
    if (customer.isWalkIn) throw new Error('Walk-In Customer cannot receive ledger entries.');

    const amount = Number(input.amount ?? 0);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error('Opening balance amount cannot be negative.');
    }

    if (input.balanceType === 'NONE' || amount === 0) {
      return null; // NONE balance type or zero amount writes no ledger row
    }

    if (!input.referenceNumber?.trim()) {
      throw new Error('Reference number is required for posting opening balances.');
    }

    const shop = this.shopRepo.getShop();
    if (!shop) throw new Error('Shop profile is required.');

    const normalizedRef = input.referenceNumber.trim().toLowerCase();
    const idempotencyKey = `CUSTOMER_OPENING:${shop.id}:${customer.id}:${normalizedRef}`;

    const db = getDatabaseConnection();
    return db.transaction(() => {
      // 1. Check idempotency
      const duplicateKey = this.repo.findByIdempotencyKey(idempotencyKey);
      if (duplicateKey) {
        throw new Error('An opening balance with this reference number has already been posted.');
      }

      // 2. Check if customer already has any opening balance ledger entry
      const existingOpening = this.repo.findOpeningEntry(customer.id);
      if (existingOpening) {
        throw new Error('An opening balance has already been posted for this customer.');
      }

      const creditAmount = input.balanceType === 'ADVANCE' ? money(amount) : 0;
      const debitAmount = input.balanceType === 'RECEIVABLE' ? money(amount) : 0;

      return this.repo.create({
        customerId: customer.id,
        shopId: shop.id,
        entryType: 'OPENING_BALANCE',
        referenceType: 'CUSTOMER_OPENING',
        referenceId: customer.id,
        referenceNumber: input.referenceNumber.trim(),
        debitAmount,
        creditAmount,
        occurredAt: input.openingDate || new Date().toISOString().split('T')[0],
        idempotencyKey,
        notes: input.notes?.trim() || 'Posted customer opening balance.',
      });
    })();
  }

  public outstanding(customerId: string): CustomerOutstandingSummary {
    if (!customerId?.trim()) throw new Error('Customer ID is required.');
    const customer = this.customerRepo.findById(customerId);
    if (!customer) throw new Error('Customer not found.');

    if (customer.isWalkIn) {
      return {
        customerId,
        totalDebits: 0,
        totalCredits: 0,
        outstanding: 0,
      };
    }

    return this.repo.getOutstanding(customerId);
  }

  public getCustomerLedger(
    customerId: string,
    filter: { page: number; pageSize: number }
  ): { items: CustomerLedgerEntry[]; totalItems: number; totalPages: number } {
    if (!customerId?.trim()) throw new Error('Customer ID is required.');
    const customer = this.customerRepo.findById(customerId);
    if (!customer) throw new Error('Customer not found.');

    if (customer.isWalkIn) {
      return { items: [], totalItems: 0, totalPages: 1 };
    }

    return this.repo.listByCustomer(customerId, filter);
  }

  // Future use methods for billing/sales (re-post on sale posting)
  public recordSale(input: {
    customerId: string;
    shopId: string;
    invoiceId: string;
    invoiceNumber: string;
    amount: number;
    occurredAt: string;
  }): CustomerLedgerEntry {
    const customer = this.customerRepo.findById(input.customerId);
    if (!customer) throw new Error('Customer not found.');
    if (customer.isWalkIn) throw new Error('Walk-In Customer cannot receive ledger entries.');

    const roundedAmt = money(input.amount);
    const idempotencyKey = `SALE:${input.shopId}:${input.invoiceId}`;

    return this.repo.create({
      customerId: input.customerId,
      shopId: input.shopId,
      entryType: 'SALE',
      referenceType: 'SALES_INVOICE',
      referenceId: input.invoiceId,
      referenceNumber: input.invoiceNumber,
      debitAmount: roundedAmt,
      creditAmount: 0,
      occurredAt: input.occurredAt,
      idempotencyKey,
      notes: 'Sales invoice posted.',
    });
  }

  public recordReceipt(input: {
    customerId: string;
    shopId: string;
    paymentId: string;
    invoiceId: string;
    invoiceNumber: string;
    amount: number;
    occurredAt: string;
    paymentMode: string;
  }): CustomerLedgerEntry {
    const customer = this.customerRepo.findById(input.customerId);
    if (!customer) throw new Error('Customer not found.');
    if (customer.isWalkIn) throw new Error('Walk-In Customer cannot receive ledger entries.');

    const roundedAmt = money(input.amount);
    const idempotencyKey = `RECEIPT:${input.shopId}:${input.paymentId}`;

    return this.repo.create({
      customerId: input.customerId,
      shopId: input.shopId,
      entryType: 'RECEIPT',
      referenceType: 'SALES_PAYMENT',
      referenceId: input.paymentId,
      referenceNumber: input.invoiceNumber,
      debitAmount: 0,
      creditAmount: roundedAmt,
      occurredAt: input.occurredAt,
      idempotencyKey,
      notes: `Payment receipt captured via ${input.paymentMode}.`,
    });
  }

  public recordSaleCancellation(input: {
    customerId: string;
    shopId: string;
    invoiceId: string;
    invoiceNumber: string;
    amount: number;
    occurredAt: string;
    reason: string;
  }): CustomerLedgerEntry {
    const customer = this.customerRepo.findById(input.customerId);
    if (!customer) throw new Error('Customer not found.');
    if (customer.isWalkIn) throw new Error('Walk-In Customer cannot receive ledger entries.');

    const roundedAmt = money(input.amount);
    const idempotencyKey = `SALE_CANCEL:${input.shopId}:${input.invoiceId}`;

    return this.repo.create({
      customerId: input.customerId,
      shopId: input.shopId,
      entryType: 'SALE_CANCELLATION',
      referenceType: 'SALES_INVOICE',
      referenceId: input.invoiceId,
      referenceNumber: input.invoiceNumber,
      debitAmount: 0,
      creditAmount: roundedAmt,
      occurredAt: input.occurredAt,
      idempotencyKey,
      notes: `Sales cancellation reversal: ${input.reason}`,
    });
  }

  public recordReceiptReversal(input: {
    customerId: string;
    shopId: string;
    paymentId: string;
    invoiceId: string;
    invoiceNumber: string;
    amount: number;
    occurredAt: string;
    reason: string;
  }): CustomerLedgerEntry {
    const customer = this.customerRepo.findById(input.customerId);
    if (!customer) throw new Error('Customer not found.');
    if (customer.isWalkIn) throw new Error('Walk-In Customer cannot receive ledger entries.');

    const roundedAmt = money(input.amount);
    const idempotencyKey = `RECEIPT_REVERSAL:${input.shopId}:${input.paymentId}`;

    return this.repo.create({
      customerId: input.customerId,
      shopId: input.shopId,
      entryType: 'RECEIPT_REVERSAL',
      referenceType: 'SALES_PAYMENT',
      referenceId: input.paymentId,
      referenceNumber: input.invoiceNumber,
      debitAmount: roundedAmt,
      creditAmount: 0,
      occurredAt: input.occurredAt,
      idempotencyKey,
      notes: `Receipt reversed: ${input.reason}`,
    });
  }
}
