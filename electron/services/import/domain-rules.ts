/**
 * domain-rules.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared, synchronous domain rule validators used by BOTH normal application
 * services and bulk-import processors.
 *
 * These are pure validation functions — they throw descriptive errors on
 * violation, accept and return plain values, and have no side-effects.
 * They MUST NOT import services or touch the database.
 *
 * Contract:
 *   • Normal services: call these BEFORE their async I/O steps.
 *   • Import processors: call these INSIDE the synchronous db.transaction().
 *   • Both paths enforce the same rules from the same code.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── PRODUCT ────────────────────────────────────────────────────────────────

export interface ProductPriceInput {
  purchasePrice: number;
  sellingPrice: number;
  mrp: number;
}

export interface ProductDomainInput {
  productCode?: string | null;
  name?: string | null;
  productType?: string | null;
  trackInventory?: boolean | null;
  allowNegativeStock?: boolean | null;
}

/**
 * Validates core product field constraints shared across service and processor.
 * Does not check DB uniqueness — that is the caller's responsibility.
 */
export function validateProductFields(input: ProductDomainInput): void {
  if (!input.productCode?.trim()) throw new Error('Product code is required.');
  if (input.productCode.trim().length > 30) throw new Error('Product code cannot exceed 30 characters.');
  if (!input.name?.trim()) throw new Error('Product name is required.');
  if (input.name.trim().length > 200) throw new Error('Product name cannot exceed 200 characters.');

  const productType = String(input.productType || 'GOODS').toUpperCase();
  if (!['GOODS', 'SERVICE'].includes(productType)) {
    throw new Error('Product type must be GOODS or SERVICE.');
  }
}

/**
 * Enforces SERVICE-product restrictions on inventory tracking fields.
 * A SERVICE product must never track inventory or allow negative stock.
 */
export function enforceServiceProductRestrictions(productType: string, trackInventory: boolean, allowNegativeStock: boolean): void {
  if (productType === 'SERVICE') {
    if (trackInventory) throw new Error('SERVICE products cannot have inventory tracking enabled.');
    if (allowNegativeStock) throw new Error('SERVICE products cannot allow negative stock.');
  }
}

/**
 * Validates that an opening stock import targets an inventory-eligible product.
 * Throws a descriptive error if the product is a SERVICE or has tracking disabled.
 */
export function enforceInventoryEligibility(productType: string, trackInventory: boolean, productCode: string): void {
  if (productType !== 'GOODS') {
    throw new Error(`Product "${productCode}" is a SERVICE product. Opening stock is not allowed for SERVICE products.`);
  }
  if (!trackInventory) {
    throw new Error(`Product "${productCode}" has inventory tracking disabled. Enable tracking before posting opening stock.`);
  }
}

/**
 * Validates product price sign constraints.
 * sellingPrice must be >= 0, mrp must be >= sellingPrice, purchase must be >= 0.
 */
export function validateProductPrice(input: ProductPriceInput): void {
  if (!Number.isFinite(input.purchasePrice) || input.purchasePrice < 0)
    throw new Error('Purchase price cannot be negative.');
  if (!Number.isFinite(input.sellingPrice) || input.sellingPrice < 0)
    throw new Error('Selling price cannot be negative.');
  if (!Number.isFinite(input.mrp) || input.mrp < 0)
    throw new Error('MRP cannot be negative.');
  if (input.mrp > 0 && input.sellingPrice > input.mrp)
    throw new Error(`Selling price (${input.sellingPrice}) cannot exceed MRP (${input.mrp}).`);
}

/**
 * Validates barcode constraints for a batch of barcodes being added.
 * Enforces: no empty values, at most one primary.
 */
export function validateBarcodeBatch(barcodes: Array<{ barcode?: string | null; isPrimary?: boolean | null }>): void {
  const primaryCount = barcodes.filter(b => b.isPrimary).length;
  if (primaryCount > 1) throw new Error('At most one primary barcode is allowed per product.');
  for (const b of barcodes) {
    if (!b.barcode?.trim()) throw new Error('Barcode value cannot be empty.');
  }
}

// ─── SUPPLIER ───────────────────────────────────────────────────────────────

export interface SupplierDomainInput {
  supplierCode?: string | null;
  name?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  gstNumber?: string | null;
  panNumber?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  paymentTermsDays?: number | null;
  creditLimit?: number | null;
  openingBalance?: number | null;
  openingBalanceType?: string | null;
}

/**
 * Validates and normalizes supplier field constraints.
 * Shared between SupplierService.validate() and SupplierImportProcessor.
 * Returns validated, trimmed values ready for persistence.
 */
export function validateSupplierFields(input: SupplierDomainInput): {
  supplierCode: string;
  name: string;
  email: string;
  gstNumber: string;
  panNumber: string;
  phone: string;
  alternatePhone: string;
  paymentTermsDays: number;
  creditLimit: number;
  openingBalance: number;
  openingBalanceType: 'PAYABLE' | 'RECEIVABLE' | 'NONE';
} {
  const supplierCode = input.supplierCode?.trim();
  const name = input.name?.trim();

  if (!supplierCode) throw new Error('Supplier code is required.');
  if (supplierCode.length > 30) throw new Error('Supplier code cannot exceed 30 characters.');
  if (!name) throw new Error('Supplier name is required.');
  if (name.length > 200) throw new Error('Supplier name cannot exceed 200 characters.');

  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()))
    throw new Error('Invalid supplier email format.');
  if (input.gstNumber && !/^[0-9A-Z]{15}$/.test(input.gstNumber.trim().toUpperCase()))
    throw new Error('GST number must be exactly 15 alphanumeric characters.');
  if (input.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(input.panNumber.trim().toUpperCase()))
    throw new Error('Invalid PAN number format (expected: AAAAA0000A).');
  if (input.phone && !/^[0-9+\-\s()]{6,20}$/.test(input.phone.trim()))
    throw new Error('Invalid phone number (6–20 digits/symbols allowed).');
  if (input.alternatePhone && !/^[0-9+\-\s()]{6,20}$/.test(input.alternatePhone.trim()))
    throw new Error('Invalid alternate phone number (6–20 digits/symbols allowed).');

  const paymentTermsDays = Math.floor(Number(input.paymentTermsDays ?? 0));
  if (!Number.isFinite(paymentTermsDays) || paymentTermsDays < 0)
    throw new Error('Payment terms cannot be negative.');

  const creditLimit = Number(input.creditLimit ?? 0);
  if (!Number.isFinite(creditLimit) || creditLimit < 0)
    throw new Error('Credit limit cannot be negative.');

  const openingBalance = Number(input.openingBalance ?? 0);
  if (!Number.isFinite(openingBalance) || openingBalance < 0)
    throw new Error('Opening balance cannot be negative.');

  const balType = String(input.openingBalanceType || 'NONE').toUpperCase();
  if (!['PAYABLE', 'RECEIVABLE', 'NONE'].includes(balType))
    throw new Error("Opening balance type must be PAYABLE, RECEIVABLE, or NONE.");

  return {
    supplierCode,
    name,
    email: input.email?.trim() || '',
    gstNumber: input.gstNumber?.trim().toUpperCase() || '',
    panNumber: input.panNumber?.trim().toUpperCase() || '',
    phone: input.phone?.trim() || '',
    alternatePhone: input.alternatePhone?.trim() || '',
    paymentTermsDays,
    creditLimit,
    openingBalance,
    openingBalanceType: balType as 'PAYABLE' | 'RECEIVABLE' | 'NONE',
  };
}

// ─── SUPPLIER OPENING BALANCE ────────────────────────────────────────────────

export interface SupplierOpeningBalanceInput {
  supplierCode: string;
  referenceNumber: string;
  openingBalance: number;
  openingBalanceType: string;
  balanceDate?: string | null;
}

/**
 * Validates supplier opening balance import constraints.
 *
 * Rules enforced:
 *   1. supplierCode must be non-empty (supplier existence is checked by the processor)
 *   2. referenceNumber must be non-empty (idempotency key)
 *   3. openingBalance must be > 0 (zero-balance entries are meaningless)
 *   4. openingBalanceType must be PAYABLE or RECEIVABLE (NONE is invalid for ledger entries)
 *   5. Sign convention: PAYABLE → credit (we owe supplier), RECEIVABLE → debit (supplier owes us)
 */
export function validateSupplierOpeningBalance(input: SupplierOpeningBalanceInput): {
  creditAmount: number;
  debitAmount: number;
} {
  if (!input.supplierCode?.trim())
    throw new Error('Supplier code is required for opening balance.');

  if (!input.referenceNumber?.trim())
    throw new Error('Reference number is required and must be unique per supplier (idempotency key).');

  const amount = Number(input.openingBalance ?? 0);
  if (!Number.isFinite(amount) || amount <= 0)
    throw new Error('Opening balance must be greater than zero.');

  const balType = String(input.openingBalanceType || '').toUpperCase();
  if (!['PAYABLE', 'RECEIVABLE'].includes(balType))
    throw new Error("Opening balance type must be PAYABLE (we owe supplier) or RECEIVABLE (supplier owes us). NONE is not valid for a ledger entry.");

  // Sign convention enforcement
  // PAYABLE  → credit entry (liability increases; we owe supplier)
  // RECEIVABLE → debit entry (asset increases; supplier owes us)
  return {
    creditAmount: balType === 'PAYABLE' ? amount : 0,
    debitAmount: balType === 'RECEIVABLE' ? amount : 0,
  };
}

// ─── OPENING STOCK ──────────────────────────────────────────────────────────

export interface OpeningStockInput {
  quantity: number;
  unitCost?: number | null;
}

/**
 * Validates opening stock import constraints.
 * Product eligibility (GOODS, trackInventory=true) must be checked separately
 * using enforceInventoryEligibility() after the product is resolved.
 */
export function validateOpeningStock(input: OpeningStockInput): void {
  const qty = Number(input.quantity ?? 0);
  if (!Number.isFinite(qty) || qty <= 0)
    throw new Error('Opening stock quantity must be greater than zero.');

  if (input.unitCost !== undefined && input.unitCost !== null) {
    const cost = Number(input.unitCost);
    if (!Number.isFinite(cost) || cost < 0)
      throw new Error('Unit cost cannot be negative.');
  }
}

// ─── CUSTOMER ───────────────────────────────────────────────────────────────

export interface CustomerDomainInput {
  customerCode?: string | null;
  name?: string | null;
  customerType?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  gstNumber?: string | null;
  panNumber?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  paymentTermsDays?: number | null;
  creditLimit?: number | null;
}

export function validateCustomerFields(input: CustomerDomainInput): {
  customerCode: string;
  name: string;
  customerType: string;
  contactPerson: string;
  email: string;
  gstNumber: string;
  panNumber: string;
  phone: string;
  alternatePhone: string;
  paymentTermsDays: number;
  creditLimit: number;
} {
  const customerCode = input.customerCode?.trim();
  const name = input.name?.trim();

  if (customerCode !== undefined && !customerCode) throw new Error('Customer code is required.');
  if (customerCode && customerCode.length > 30) throw new Error('Customer code cannot exceed 30 characters.');
  if (!name) throw new Error('Customer name is required.');
  if (name.length > 200) throw new Error('Customer name cannot exceed 200 characters.');

  const customerType = String(input.customerType || 'RETAIL').toUpperCase();
  if (!['WALK_IN', 'RETAIL', 'WHOLESALE', 'DISTRIBUTOR', 'CORPORATE'].includes(customerType)) {
    throw new Error('Invalid customer type.');
  }

  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()))
    throw new Error('Invalid customer email format.');
  if (input.gstNumber && !/^[0-9A-Z]{15}$/.test(input.gstNumber.trim().toUpperCase()))
    throw new Error('GST number must be exactly 15 alphanumeric characters.');
  if (input.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(input.panNumber.trim().toUpperCase()))
    throw new Error('Invalid PAN number format (expected: AAAAA0000A).');
  if (input.phone && !/^[0-9+\-\s()]{6,20}$/.test(input.phone.trim()))
    throw new Error('Invalid phone number (6–20 digits/symbols allowed).');
  if (input.alternatePhone && !/^[0-9+\-\s()]{6,20}$/.test(input.alternatePhone.trim()))
    throw new Error('Invalid alternate phone number (6–20 digits/symbols allowed).');

  const paymentTermsDays = Math.floor(Number(input.paymentTermsDays ?? 0));
  if (!Number.isFinite(paymentTermsDays) || paymentTermsDays < 0)
    throw new Error('Payment terms cannot be negative.');

  const creditLimit = Number(input.creditLimit ?? 0);
  if (!Number.isFinite(creditLimit) || creditLimit < 0)
    throw new Error('Credit limit cannot be negative.');

  return {
    customerCode: customerCode || '',
    name,
    customerType,
    contactPerson: input.contactPerson?.trim() || '',
    email: input.email?.trim() || '',
    gstNumber: input.gstNumber?.trim().toUpperCase() || '',
    panNumber: input.panNumber?.trim().toUpperCase() || '',
    phone: input.phone?.trim() || '',
    alternatePhone: input.alternatePhone?.trim() || '',
    paymentTermsDays,
    creditLimit,
  };
}
