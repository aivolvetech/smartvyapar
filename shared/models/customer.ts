import { PaginationMeta } from '../types/ipc';

export type CustomerType = 'WALK_IN' | 'RETAIL' | 'WHOLESALE' | 'DISTRIBUTOR' | 'CORPORATE';
export type CustomerOpeningBalanceType = 'RECEIVABLE' | 'ADVANCE' | 'NONE';

export type CustomerLedgerEntryType =
  | 'OPENING_BALANCE'
  | 'SALE'
  | 'SALE_CANCELLATION'
  | 'RECEIPT'
  | 'RECEIPT_REVERSAL'
  | 'SALES_RETURN'  // reserved
  | 'CREDIT_NOTE'   // reserved
  | 'DEBIT_NOTE'    // reserved
  | 'ADJUSTMENT';   // reserved

export interface Customer {
  id: string;
  shopId: string;
  customerCode: string;
  normalizedCustomerCode: string;
  name: string;
  normalizedName: string;
  customerType: CustomerType;
  contactPerson: string | null;
  phone: string | null;
  normalizedPhone: string | null;
  alternatePhone: string | null;
  email: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  billingAddressLine1: string | null;
  billingAddressLine2: string | null;
  shippingAddressLine1: string | null;
  shippingAddressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string;
  paymentTermsDays: number;
  creditLimit: number;
  priceBookId: string | null;
  notes: string | null;
  isWalkIn: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CustomerListItem {
  id: string;
  customerCode: string;
  name: string;
  customerType: CustomerType;
  phone: string | null;
  gstNumber: string | null;
  city: string | null;
  state: string | null;
  priceBookName: string | null;
  outstanding: number;
  isActive: boolean;
  isWalkIn: boolean;
  updatedAt: string;
}

export interface CustomerFilter {
  search?: string;
  customerType?: CustomerType;
  isActive?: boolean;
  outstandingState?: 'ALL' | 'DUE' | 'ADVANCE' | 'ZERO';
  page: number;
  pageSize: number;
  sortBy: 'customerCode' | 'name' | 'customerType' | 'outstanding' | 'updatedAt';
  sortDirection: 'ASC' | 'DESC';
}

export interface CustomerListResult {
  items: CustomerListItem[];
  pagination: PaginationMeta;
}

export interface CreateCustomerInput {
  customerCode?: string;
  name: string;
  customerType: CustomerType;
  contactPerson?: string;
  phone?: string;
  alternatePhone?: string;
  email?: string;
  gstNumber?: string;
  panNumber?: string;
  billingAddressLine1?: string;
  billingAddressLine2?: string;
  shippingAddressLine1?: string;
  shippingAddressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  paymentTermsDays?: number;
  creditLimit?: number;
  priceBookId?: string;
  notes?: string;
  isActive?: boolean;
}

export type UpdateCustomerInput = Partial<CreateCustomerInput>;

export interface CustomerDetail {
  customer: Customer;
  priceBookName: string | null;
  outstandingSummary: CustomerOutstandingSummary;
}

export interface CustomerLedgerEntry {
  id: string;
  customerId: string;
  shopId: string;
  entryType: CustomerLedgerEntryType;
  referenceType: string;
  referenceId: string;
  referenceNumber: string | null;
  debitAmount: number;
  creditAmount: number;
  occurredAt: string;
  notes: string | null;
  idempotencyKey: string | null;
  createdAt: string;
}

export interface CustomerOutstandingSummary {
  customerId: string;
  outstanding: number;
  totalDebits: number;
  totalCredits: number;
}

export interface CustomerOpeningBalanceInput {
  customerId: string;
  openingDate: string;
  amount: number;
  balanceType: CustomerOpeningBalanceType;
  referenceNumber: string;
  notes?: string;
}

export interface DuplicateCustomerWarning {
  field: 'phone' | 'gstNumber';
  message: string;
  existingCustomerId: string;
}
