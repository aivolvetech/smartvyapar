// =============================================================================
// Smart Vyapar - Phase 6.3 Sales Models & Inputs
// =============================================================================

export type SalesInvoiceStatus = 'DRAFT' | 'HELD' | 'POSTED' | 'CANCELLED';

export type SalesPaymentStatus = 'CAPTURED' | 'REVERSED';

export type SalesPaymentMode = 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'CREDIT';

export type SalesInvoiceDiscountType = 'NONE' | 'PERCENT' | 'AMOUNT';

export interface SalesInvoice {
  id: string;
  shopId: string;
  customerId: string;
  draftReference: string;
  invoiceNumber: string | null;
  invoiceDate: string;
  dueDate: string | null;
  status: SalesInvoiceStatus;
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  salesChannel: 'POS' | 'COUNTER' | 'MANUAL';
  subtotal: number;
  lineDiscountTotal: number;
  invoiceDiscountType: SalesInvoiceDiscountType;
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
  changeAmount: number;
  notes: string | null;
  heldAt: string | null;
  postedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface SalesInvoiceLine {
  id: string;
  salesInvoiceId: string;
  productId: string;
  productCodeSnapshot: string;
  productNameSnapshot: string;
  barcodeSnapshot: string | null;
  hsnSacCodeSnapshot: string | null;
  productTypeSnapshot: 'GOODS' | 'SERVICE';
  unitId: string | null;
  unitNameSnapshot: string | null;
  taxRateId: string | null;
  taxCategorySnapshot: 'EXEMPT' | 'GST' | 'ZERO_RATED' | 'NON_GST';
  taxRateSnapshot: number;
  quantity: number;
  unitPrice: number;
  mrp: number;
  minimumSellingPrice: number | null;
  discountType: 'NONE' | 'PERCENT' | 'AMOUNT';
  discountValue: number;
  discountAmount: number;
  invoiceDiscountAllocation: number;
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

export interface SalesPayment {
  id: string;
  salesInvoiceId: string;
  paymentMode: SalesPaymentMode;
  amount: number;
  referenceNumber: string | null;
  paymentDate: string;
  status: SalesPaymentStatus;
  notes: string | null;
  idempotencyKey: string | null;
  createdAt: string;
}

// Editable draft line input structure (does not trust snapshots from the renderer)
export interface DraftSalesInvoiceLineInput {
  productId: string;
  quantity: number;
  unitPrice: number; // custom price override if supplied by POS/operator
  discountType: 'NONE' | 'PERCENT' | 'AMOUNT';
  discountValue: number;
}

// Editable draft header + lines save payload structure
export interface DraftSalesInvoiceInput {
  customerId: string;
  invoiceDate: string;
  dueDate: string | null;
  invoiceDiscountType: SalesInvoiceDiscountType;
  invoiceDiscountValue: number;
  notes: string | null;
  lines: DraftSalesInvoiceLineInput[];
}

export interface SalesInvoiceDetail {
  invoice: SalesInvoice;
  lines: SalesInvoiceLine[];
}

export interface SalesHistoryFilter {
  shopId: string;
  dateFrom?: string;
  dateTo?: string;
  invoiceNumber?: string;
  customerId?: string;
  paymentStatus?: SalesInvoice['paymentStatus'];
  status?: SalesInvoiceStatus;
  page?: number;
  pageSize?: number;
}

export interface SalesHistoryItem {
  id: string;
  invoiceNumber: string | null;
  draftReference: string;
  invoiceDate: string;
  postedAt: string | null;
  customerId: string;
  customerName: string;
  customerCode: string;
  isWalkIn: boolean;
  grandTotal: number;
  paidAmount: number;
  outstandingAmount: number;
  paymentStatus: SalesInvoice['paymentStatus'];
  status: SalesInvoiceStatus;
  heldAt: string | null;
  cancelledAt: string | null;
  version: number;
}

export interface SalesHistoryResult {
  items: SalesHistoryItem[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
