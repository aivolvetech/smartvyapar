import { PaginationMeta } from '../types/ipc';

export type SupplierOpeningBalanceType = 'PAYABLE' | 'RECEIVABLE' | 'NONE';
export type PurchaseStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export type PurchaseDiscountType = 'NONE' | 'PERCENT' | 'AMOUNT';
export type SupplierLedgerEntryType =
  | 'OPENING_BALANCE'
  | 'PURCHASE'
  | 'PURCHASE_CANCELLATION'
  | 'PAYMENT'
  | 'PURCHASE_RETURN'
  | 'ADJUSTMENT';

export interface Supplier {
  id: string;
  supplierCode: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  alternatePhone: string | null;
  email: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string;
  paymentTermsDays: number;
  creditLimit: number;
  openingBalance: number;
  openingBalanceType: SupplierOpeningBalanceType;
  notes: string | null;
  isActive: boolean;
  outstanding: number;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface SupplierListItem {
  id: string;
  supplierCode: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  gstNumber: string | null;
  city: string | null;
  paymentTermsDays: number;
  outstanding: number;
  isActive: boolean;
  updatedAt: string;
}

export interface SupplierFilter {
  search?: string;
  isActive?: boolean;
  page: number;
  pageSize: number;
  sortBy: 'supplierCode' | 'name' | 'city' | 'outstanding' | 'updatedAt';
  sortDirection: 'ASC' | 'DESC';
}

export interface SupplierListResult {
  items: SupplierListItem[];
  pagination: PaginationMeta;
}

export interface CreateSupplierInput {
  supplierCode: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  alternatePhone?: string;
  email?: string;
  gstNumber?: string;
  panNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  paymentTermsDays?: number;
  creditLimit?: number;
  openingBalance?: number;
  openingBalanceType?: SupplierOpeningBalanceType;
  notes?: string;
  isActive?: boolean;
}

export type UpdateSupplierInput = Partial<CreateSupplierInput>;

export interface SupplierOutstandingSummary {
  supplierId: string;
  outstanding: number;
  totalDebits: number;
  totalCredits: number;
}

export interface SupplierLedgerEntry {
  id: string;
  supplierId: string;
  shopId: string;
  entryType: SupplierLedgerEntryType;
  referenceType: string;
  referenceId: string;
  referenceNumber: string | null;
  debitAmount: number;
  creditAmount: number;
  occurredAt: string;
  notes: string | null;
  createdAt: string;
}

export interface PurchaseInvoiceLine {
  id: string;
  purchaseInvoiceId: string;
  productId: string;
  productCodeSnapshot: string;
  productNameSnapshot: string;
  hsnSacCodeSnapshot: string | null;
  taxRateId: string | null;
  taxRateSnapshot: number;
  quantity: number;
  unitId: string | null;
  unitNameSnapshot: string | null;
  unitPrice: number;
  mrp: number;
  discountType: PurchaseDiscountType;
  discountValue: number;
  discountAmount: number;
  taxableAmount: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  cessRate: number;
  cessAmount: number;
  lineTotal: number;
  inventoryTransactionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseInvoice {
  id: string;
  shopId: string;
  supplierId: string;
  purchaseNumber: string;
  supplierInvoiceNumber: string | null;
  invoiceDate: string;
  dueDate: string | null;
  status: PurchaseStatus;
  subtotal: number;
  lineDiscountTotal: number;
  invoiceDiscountType: PurchaseDiscountType;
  invoiceDiscountValue: number;
  invoiceDiscountTotal: number;
  taxableAmount: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  cessTotal: number;
  roundOff: number;
  grandTotal: number;
  paidAmount: number;
  outstandingAmount: number;
  notes: string | null;
  postedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface PurchaseLineInput {
  id?: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  mrp?: number;
  discountType?: PurchaseDiscountType;
  discountValue?: number;
  taxRateId?: string | null;
}

export interface PurchaseDraftInput {
  supplierId: string;
  supplierInvoiceNumber?: string;
  invoiceDate: string;
  dueDate?: string;
  invoiceDiscountType?: PurchaseDiscountType;
  invoiceDiscountValue?: number;
  notes?: string;
  lines?: PurchaseLineInput[];
}

export interface PurchaseCalculationResult {
  lines: Omit<PurchaseInvoiceLine, 'id' | 'purchaseInvoiceId' | 'inventoryTransactionId' | 'createdAt' | 'updatedAt'>[];
  subtotal: number;
  lineDiscountTotal: number;
  invoiceDiscountTotal: number;
  taxableAmount: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  cessTotal: number;
  roundOff: number;
  grandTotal: number;
}

export interface PurchaseListItem {
  id: string;
  purchaseNumber: string;
  supplierId: string;
  supplierName: string;
  supplierInvoiceNumber: string | null;
  invoiceDate: string;
  dueDate: string | null;
  status: PurchaseStatus;
  taxableAmount: number;
  taxTotal: number;
  grandTotal: number;
  outstandingAmount: number;
  updatedAt: string;
}

export interface PurchaseFilter {
  search?: string;
  supplierId?: string;
  status?: PurchaseStatus;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
  sortBy: 'invoiceDate' | 'purchaseNumber' | 'supplierName' | 'grandTotal' | 'updatedAt';
  sortDirection: 'ASC' | 'DESC';
}

export interface PurchaseListResult {
  items: PurchaseListItem[];
  pagination: PaginationMeta;
}

export interface PurchaseDetail {
  invoice: PurchaseInvoice;
  supplier: Supplier;
  lines: PurchaseInvoiceLine[];
  ledgerEntries: SupplierLedgerEntry[];
}

export interface CancelPurchaseInput {
  reason: string;
}

export interface PurchaseDashboardSummary {
  purchasesToday: number;
  purchaseAmountToday: number;
  draftPurchases: number;
  supplierOutstanding: number;
  purchasesDue: number;
}
