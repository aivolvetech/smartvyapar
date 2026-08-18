// =============================================================================
// Smart Vyapar - Phase 6.4 Shared POS/Billing Types
// =============================================================================

export type POSPriceSource =
  | 'CUSTOMER_PRICE_BOOK'
  | 'SHOP_PRICE_BOOK'
  | 'STANDARD_PRICE_BOOK'
  | 'PRODUCT_FALLBACK';

export type POSWarning =
  | 'CUSTOMER_PRICE_BOOK_INACTIVE'
  | 'CUSTOMER_PRICE_NOT_FOUND'
  | 'FALLBACK_PRICE_USED'
  | 'ZERO_SELLING_PRICE';

export interface POSResolvedPrice {
  productId: string;
  priceBookId: string | null;
  priceBookCode: string | null;
  priceSource: POSPriceSource;
  sellingPrice: number;
  mrp: number;
  minimumSellingPrice: number | null;
  minimumSellingPriceConfigured: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  resolvedAt: string;
  warnings: POSWarning[];
}

export interface POSProductResult {
  productId: string;
  productCode: string;
  productName: string;
  productType: 'GOODS' | 'SERVICE';
  barcode: string | null;
  unitId: string | null;
  unitName: string | null;
  allowsDecimalQuantity: boolean;
  decimalPlaces: number;
  taxRateId: string | null;
  taxCategory: 'EXEMPT' | 'GST' | 'ZERO_RATED' | 'NON_GST';
  taxRate: number;
  hsnSacCode: string | null;
  sellingPrice: number;
  mrp: number;
  minimumSellingPrice: number | null;
  minimumSellingPriceConfigured: boolean;
  priceSource: POSPriceSource;
  currentStock: number;
  stockAsOf: string | null;
  trackInventory: boolean;
  allowNegativeStock: boolean;
  warnings: POSWarning[];
}

export interface POSProductSearchInput {
  shopId: string;
  query: string;
  customerId?: string;
  draftDate?: string;
  page?: number;
  pageSize?: number;
}

export interface POSProductSearchResult {
  items: POSProductResult[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface POSCartLineInput {
  productId: string;
  quantity: number;
  provisionalUnitPrice: number;
  provisionalDiscountType: 'NONE' | 'PERCENT' | 'AMOUNT';
  provisionalDiscountValue: number;
}

export interface POSCartLine {
  id: string;
  productId: string;
  productCodeSnapshot: string;
  productNameSnapshot: string;
  barcodeSnapshot: string | null;
  unitId: string | null;
  unitNameSnapshot: string | null;
  taxRateId: string | null;
  taxCategorySnapshot: 'EXEMPT' | 'GST' | 'ZERO_RATED' | 'NON_GST';
  taxRateSnapshot: number;
  hsnSacCodeSnapshot: string | null;
  productTypeSnapshot: 'GOODS' | 'SERVICE';
  quantity: number;
  unitPrice: number; // resolved or provisional
  mrp: number;
  minimumSellingPrice: number | null;
  minimumSellingPriceConfigured: boolean;
  discountType: 'NONE' | 'PERCENT' | 'AMOUNT';
  discountValue: number;
  discountAmount: number;
  taxableAmount: number;
  lineTotal: number;
  priceSource: POSPriceSource;
  advisoryStock: number;
  warnings: POSWarning[];
}

export interface POSCart {
  lines: POSCartLine[];
  subtotal: number;
  lineDiscountTotal: number;
  invoiceDiscountType: 'NONE' | 'PERCENT' | 'AMOUNT';
  invoiceDiscountValue: number;
  invoiceDiscountTotal: number;
  taxableAmount: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  cessTotal: number;
  roundOff: number;
  grandTotal: number;
}

export interface POSCustomerSelection {
  id: string;
  name: string;
  customerCode: string;
  customerType: string;
  priceBookId: string | null;
  priceBookName: string | null;
  phone: string | null;
  outstanding: number;
  isWalkIn: boolean;
}

export interface POSDraftViewModel {
  id: string;
  shopId: string;
  customerId: string;
  draftReference: string;
  invoiceDate: string;
  dueDate: string | null;
  status: 'DRAFT' | 'HELD';
  notes: string | null;
  cart: POSCart;
  heldAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface POSDraftSaveInput {
  customerId: string;
  invoiceDate: string;
  dueDate: string | null;
  invoiceDiscountType: 'NONE' | 'PERCENT' | 'AMOUNT';
  invoiceDiscountValue: number;
  notes: string | null;
  lines: POSCartLineInput[];
}

export interface POSHeldBillListItem {
  id: string;
  draftReference: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  heldAt: string;
  lineCount: number;
  provisionalTotal: number;
  notes: string | null;
}

export interface BarcodeResolutionInput {
  shopId: string;
  barcode: string;
  customerId?: string;
  draftDate?: string;
}

export interface POSPriceChange {
  productId: string;
  productName: string;
  oldPrice: number;
  newPrice: number;
  oldPriceSource: POSPriceSource;
  newPriceSource: POSPriceSource;
  warnings: POSWarning[];
}

export interface POSCustomerRepriceResult {
  success: boolean;
  repricedLines: POSCartLine[];
  priceChanges: POSPriceChange[];
  totals: {
    subtotal: number;
    grandTotal: number;
  };
}
