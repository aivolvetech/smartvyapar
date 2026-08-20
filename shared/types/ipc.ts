// ============================================================================
// Smart Vyapar — Shared IPC Types
// These types are exposed to the renderer process via contextBridge.
// Never expose internal DB types, native drivers, paths, or keys here.
// ============================================================================

export interface AppDiagnosticInfo {
  electronVersion: string;
  nodeVersion: string;
  nodeAbi: string;
  prismaVersion: string;
  prismaEnginePath: string;
  betterSqlite3Path: string;
}

export interface AppInfo {
  appName: string;
  appVersion: string;
  platform: string;
  dbStatus: string;
  diagnosticInfo: AppDiagnosticInfo;
}

// --------------------------------------------------------------------------
// Shop
// --------------------------------------------------------------------------
export interface ShopData {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  gstNumber: string | null;
  merchantUpiId: string | null;
  allowNegativeStockGlobally?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShopCreateInput {
  name: string;
  phone?: string;
  address?: string;
  gstNumber?: string;
  merchantUpiId?: string;
  allowNegativeStockGlobally?: boolean;
}

// --------------------------------------------------------------------------
// Unit of Measure
// --------------------------------------------------------------------------
export interface UnitOfMeasureData {
  id: string;
  name: string;
  shortName: string;
  decimalAllowed: boolean;
  decimalPlaces: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUnitInput {
  name: string;
  shortName: string;
  decimalAllowed?: boolean;
  decimalPlaces?: number;
}

export interface UpdateUnitInput {
  name?: string;
  shortName?: string;
  decimalAllowed?: boolean;
  decimalPlaces?: number;
  isActive?: boolean;
}

// --------------------------------------------------------------------------
// Product Category
// --------------------------------------------------------------------------
export interface ProductCategoryData {
  id: string;
  name: string;
  description: string | null;
  parentCategoryId: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryInput {
  name: string;
  description?: string;
  parentCategoryId?: string;
  displayOrder?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string | null;
  parentCategoryId?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}

// --------------------------------------------------------------------------
// Brand
// --------------------------------------------------------------------------
export interface BrandData {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBrandInput {
  name: string;
  description?: string;
}

export interface UpdateBrandInput {
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

// --------------------------------------------------------------------------
// Tax Rate
// --------------------------------------------------------------------------
export type TaxTypeValue = 'GST' | 'EXEMPT' | 'ZERO_RATED' | 'NON_GST';

export interface TaxRateData {
  id: string;
  name: string;
  rate: number;
  taxType: TaxTypeValue;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cessRate: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// --------------------------------------------------------------------------
// Barcode
// --------------------------------------------------------------------------
export interface ProductBarcodeData {
  id: string;
  productId: string;
  barcode: string;
  barcodeType: string;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBarcodeInput {
  barcode: string;
  barcodeType?: string;
  isPrimary?: boolean;
}

// --------------------------------------------------------------------------
// Product Pricing
// --------------------------------------------------------------------------
export interface CreateProductPriceInput {
  purchasePrice: number;
  sellingPrice: number;
  mrp: number;
  wholesalePrice?: number;
}

// --------------------------------------------------------------------------
// Opening Balance
// --------------------------------------------------------------------------
export interface CreateOpeningBalanceInput {
  quantity: number;
  unitCost?: number;
}

// --------------------------------------------------------------------------
// Product
// --------------------------------------------------------------------------
export type ProductTypeValue = 'GOODS' | 'SERVICE';

export interface ProductData {
  id: string;
  productCode: string;
  name: string;
  printName: string | null;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  brandId: string | null;
  brandName: string | null;
  primaryUnitId: string;
  unitName: string | null;
  unitShortName: string | null;
  hsnSacCode: string | null;
  taxRateId: string | null;
  taxRateName: string | null;
  taxRate: number | null;
  productType: ProductTypeValue;
  trackInventory: boolean;
  allowNegativeStock: boolean;
  negativeStockPolicy?: 'INHERIT' | 'ALLOW' | 'BLOCK';
  minimumStockLevel: number | null;
  reorderLevel: number | null;
  maximumStockLevel: number | null;
  sku: string | null;
  barcodes: ProductBarcodeData[];
  // Resolved from default PriceBook via PricingService
  purchasePrice: number | null;
  sellingPrice: number | null;
  mrp: number | null;
  wholesalePrice: number | null;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// Lightweight list item — for table display
export interface ProductListItem {
  id: string;
  productCode: string;
  name: string;
  categoryName: string | null;
  brandName: string | null;
  unitShortName: string | null;
  hsnSacCode: string | null;
  taxRateName: string | null;
  taxRate: number | null;
  purchasePrice: number | null;
  sellingPrice: number | null;
  mrp: number | null;
  primaryBarcode: string | null;
  productType: ProductTypeValue;
  isActive: boolean;
  updatedAt: string;
}

// --------------------------------------------------------------------------
// Product Create Request — structured creation contract
// --------------------------------------------------------------------------
export interface CreateProductRequest {
  product: {
    productCode: string;
    name: string;
    printName?: string;
    description?: string;
    categoryId?: string;
    brandId?: string;
    primaryUnitId: string;
    hsnSacCode?: string;
    taxRateId?: string;
    productType?: ProductTypeValue;
    trackInventory?: boolean;
    allowNegativeStock?: boolean;
    negativeStockPolicy?: 'INHERIT' | 'ALLOW' | 'BLOCK';
    minimumStockLevel?: number;
    reorderLevel?: number;
    maximumStockLevel?: number;
    sku?: string;
  };
  barcodes: CreateBarcodeInput[];
  defaultPrice: CreateProductPriceInput;
  openingBalance?: CreateOpeningBalanceInput;
}

export interface UpdateProductRequest {
  product: {
    productCode?: string;
    name?: string;
    printName?: string | null;
    description?: string | null;
    categoryId?: string | null;
    brandId?: string | null;
    primaryUnitId?: string;
    hsnSacCode?: string | null;
    taxRateId?: string | null;
    productType?: ProductTypeValue;
    trackInventory?: boolean;
    allowNegativeStock?: boolean;
    negativeStockPolicy?: 'INHERIT' | 'ALLOW' | 'BLOCK';
    minimumStockLevel?: number | null;
    reorderLevel?: number | null;
    maximumStockLevel?: number | null;
    sku?: string | null;
    isActive?: boolean;
  };
  barcodes?: CreateBarcodeInput[];
  defaultPrice?: CreateProductPriceInput;
}

// --------------------------------------------------------------------------
// Product List Filter
// --------------------------------------------------------------------------
export type ProductSortField = 'name' | 'productCode' | 'sellingPrice' | 'mrp' | 'createdAt' | 'updatedAt';

export interface ProductListFilter {
  search?: string;
  barcode?: string;
  categoryId?: string;
  brandId?: string;
  isActive?: boolean;
  productType?: ProductTypeValue;
  page: number;
  pageSize: number;
  sortBy: ProductSortField;
  sortDirection: 'ASC' | 'DESC';
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ProductListResult {
  items: ProductListItem[];
  pagination: PaginationMeta;
}

export type {
  InventoryTransaction,
  InventoryTransactionType,
  InventoryStockStatus,
  InventoryStockSummary,
  InventoryMovementListItem,
  InventoryMovementFilter,
  InventoryMovementResult,
  InventorySummaryFilter,
  InventorySummaryResult,
  InventoryDashboardSummary,
  InventoryAdjustment,
  CreateInventoryAdjustmentInput,
  PostOpeningStockInput,
  PostDamageInput,
  PostExpiryInput,
  PostLossInput,
  ReverseInventoryTransactionInput,
} from '../models/inventory';

export type {
  SupplierOpeningBalanceType,
  PurchaseStatus,
  PurchaseDiscountType,
  SupplierLedgerEntryType,
  Supplier,
  SupplierListItem,
  SupplierFilter,
  SupplierListResult,
  CreateSupplierInput,
  UpdateSupplierInput,
  SupplierOutstandingSummary,
  SupplierLedgerEntry,
  PurchaseInvoice,
  PurchaseInvoiceLine,
  PurchaseLineInput,
  PurchaseDraftInput,
  PurchaseCalculationResult,
  PurchaseListItem,
  PurchaseFilter,
  PurchaseListResult,
  PurchaseDetail,
  CancelPurchaseInput,
  PurchaseDashboardSummary,
} from '../models/supplier-purchase';

// --------------------------------------------------------------------------
// Generic IPC response wrapper
// --------------------------------------------------------------------------
export interface IPCResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// --------------------------------------------------------------------------
// IPC Channel Registry
// --------------------------------------------------------------------------
export const IPC_CHANNELS = {
  // App
  APP_GET_INFO: 'app:getInfo',
  // Shop
  SHOP_GET:    'shop:get',
  SHOP_CREATE: 'shop:create',
  // DB
  DB_STATUS: 'db:status',
  PRINT_WINDOW: 'app:printWindow',
  // Unit of Measure
  UNIT_LIST:   'unit:list',
  UNIT_CREATE: 'unit:create',
  UNIT_UPDATE: 'unit:update',
  // Category
  CATEGORY_LIST:   'category:list',
  CATEGORY_CREATE: 'category:create',
  CATEGORY_UPDATE: 'category:update',
  // Brand
  BRAND_LIST:   'brand:list',
  BRAND_CREATE: 'brand:create',
  BRAND_UPDATE: 'brand:update',
  // Tax Rate
  TAX_RATE_LIST: 'taxRate:list',
  // Product
  PRODUCT_LIST:       'product:list',
  PRODUCT_GET_BY_ID:  'product:getById',
  PRODUCT_GET_BY_BARCODE: 'product:getByBarcode',
  PRODUCT_CREATE:     'product:create',
  PRODUCT_UPDATE:     'product:update',
  PRODUCT_SET_ACTIVE: 'product:setActive',
  // Inventory
  INVENTORY_SUMMARY: 'inventory:summary',
  INVENTORY_PRODUCT_STOCK: 'inventory:productStock',
  INVENTORY_MOVEMENTS: 'inventory:movements',
  INVENTORY_POST_OPENING: 'inventory:postOpening',
  INVENTORY_POST_ADJUSTMENT: 'inventory:postAdjustment',
  INVENTORY_POST_DAMAGE: 'inventory:postDamage',
  INVENTORY_POST_EXPIRY: 'inventory:postExpiry',
  INVENTORY_POST_LOSS: 'inventory:postLoss',
  INVENTORY_REVERSE: 'inventory:reverse',
  INVENTORY_DASHBOARD: 'inventory:dashboard',
  // Supplier
  SUPPLIER_LIST: 'supplier:list',
  SUPPLIER_GET_BY_ID: 'supplier:getById',
  SUPPLIER_CREATE: 'supplier:create',
  SUPPLIER_UPDATE: 'supplier:update',
  SUPPLIER_SET_ACTIVE: 'supplier:setActive',
  SUPPLIER_OUTSTANDING: 'supplier:outstanding',
  // Purchase
  PURCHASE_LIST: 'purchase:list',
  PURCHASE_GET_BY_ID: 'purchase:getById',
  PURCHASE_CREATE_DRAFT: 'purchase:createDraft',
  PURCHASE_UPDATE_DRAFT: 'purchase:updateDraft',
  PURCHASE_DELETE_DRAFT: 'purchase:deleteDraft',
  PURCHASE_CALCULATE: 'purchase:calculate',
  PURCHASE_POST: 'purchase:post',
  PURCHASE_CANCEL: 'purchase:cancel',
  PURCHASE_DASHBOARD: 'purchase:dashboard',
  // Import
  IMPORT_SELECT_FILE: 'import:selectFile',
  IMPORT_GET_TEMPLATES: 'import:getTemplates',
  IMPORT_GET_COLUMNS: 'import:getColumns',
  IMPORT_CREATE_JOB: 'import:createJob',
  IMPORT_PARSE_JOB: 'import:parseJob',
  IMPORT_MAPPING_PROFILE: 'import:getMappingProfile',
  IMPORT_VALIDATE: 'import:validate',
  IMPORT_DUPLICATE_POLICY: 'import:setDuplicatePolicy',
  IMPORT_EXECUTE: 'import:execute',
  IMPORT_CANCEL: 'import:cancel',
  IMPORT_HISTORY: 'import:history',
  IMPORT_RESULT: 'import:result',
  IMPORT_PREVIEW: 'import:preview',
  IMPORT_ERRORS_CSV: 'import:errorsCsv',

  // Customer
  CUSTOMER_LIST: 'customer:list',
  CUSTOMER_GET_BY_ID: 'customer:getById',
  CUSTOMER_CREATE: 'customer:create',
  CUSTOMER_UPDATE: 'customer:update',
  CUSTOMER_SET_ACTIVE: 'customer:setActive',
  CUSTOMER_OUTSTANDING: 'customer:outstanding',
  CUSTOMER_LEDGER: 'customer:ledger',
  CUSTOMER_POST_OPENING: 'customer:postOpening',

  // Sales Draft (Phase 6.3)
  SALES_CREATE_DRAFT: 'sales:createDraft',
  SALES_GET_DRAFT: 'sales:getDraft',
  SALES_LIST_DRAFTS: 'sales:listDrafts',
  SALES_SAVE_DRAFT: 'sales:saveDraft',
  SALES_HOLD_BILL: 'sales:holdBill',
  SALES_RESUME_BILL: 'sales:resumeBill',
  SALES_DELETE_DRAFT: 'sales:deleteDraft',
  SALES_HISTORY: 'sales:history',

  // POS/Billing (Phase 6.4)
  POS_SEARCH_PRODUCTS: 'pos:searchProducts',
  POS_RESOLVE_BARCODE: 'pos:resolveBarcode',
  POS_LIST_HELD: 'pos:listHeld',
  POS_REPRICE_CART: 'pos:repriceCart',
  POS_CREATE_DRAFT: 'pos:createDraft',
  POS_GET_DRAFT: 'pos:getDraft',
  POS_SAVE_DRAFT: 'pos:saveDraft',
  POS_ADD_LINE: 'pos:addLine',
  POS_UPDATE_LINE: 'pos:updateLine',
  POS_REMOVE_LINE: 'pos:removeLine',
  POS_HOLD_BILL: 'pos:holdBill',
  POS_RESUME_BILL: 'pos:resumeBill',
  POS_DELETE_DRAFT: 'pos:deleteDraft',
  POS_POST_SALE: 'pos:postSale',
  POS_CALCULATE_CART: 'pos:calculateCart',
  POS_RECEIVE_PAYMENT: 'pos:receivePayment',
  POS_CANCEL_SALE: 'pos:cancelSale',
  SALES_DASHBOARD: 'sales:dashboard',
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];

export * from '../models/customer';

export interface ReceiveCustomerPaymentInput {
  invoiceId: string;
  paymentMode: 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER';
  amount: number;
  referenceNumber?: string | null;
  paymentContext?: { upiConfirmed?: boolean; confirmedUpiAmount?: number };
}

export interface CancelSaleInput {
  invoiceId: string;
  reason: string;
  version: number;
}

export interface SalesDashboardFilter {
  shopId: string;
  dateFrom?: string;
  dateTo?: string;
  rangeType?: 'today' | 'week' | 'month' | 'custom';
}

export interface SalesDashboardSummary {
  grossSales: number;
  cancelledSales: number;
  operationalNetSales: number;
  collections: number;
  currentReceivables: number;
}
