import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  ShopCreateInput,
  CreateUnitInput, UpdateUnitInput,
  CreateCategoryInput, UpdateCategoryInput,
  CreateBrandInput, UpdateBrandInput,
  ProductListFilter,
  CreateProductRequest,
  UpdateProductRequest,
  InventorySummaryFilter,
  InventoryMovementFilter,
  CreateInventoryAdjustmentInput,
  PostOpeningStockInput,
  PostDamageInput,
  PostExpiryInput,
  PostLossInput,
  ReverseInventoryTransactionInput,
  SupplierFilter,
  CreateSupplierInput,
  UpdateSupplierInput,
  PurchaseFilter,
  PurchaseDraftInput,
} from '../../shared/types/ipc';
import {
  ImportType,
  ImportMapping,
  ImportDuplicatePolicy,
  ImportTransactionMode,
} from '../../shared/types/import';

// Expose narrow, secure APIs to the React renderer via contextBridge
// No Node.js APIs, no ipcRenderer, no native modules are exposed directly.
contextBridge.exposeInMainWorld('smartVyapar', {
  // App
  getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_INFO),
  getDatabaseStatus: () => ipcRenderer.invoke(IPC_CHANNELS.DB_STATUS),

  // Shop
  getShop:    ()                       => ipcRenderer.invoke(IPC_CHANNELS.SHOP_GET),
  createShop: (input: ShopCreateInput) => ipcRenderer.invoke(IPC_CHANNELS.SHOP_CREATE, input),

  // Unit of Measure
  listUnits:  (activeOnly?: boolean)            => ipcRenderer.invoke(IPC_CHANNELS.UNIT_LIST,   { activeOnly }),
  createUnit: (input: CreateUnitInput)          => ipcRenderer.invoke(IPC_CHANNELS.UNIT_CREATE, input),
  updateUnit: (id: string, input: UpdateUnitInput) => ipcRenderer.invoke(IPC_CHANNELS.UNIT_UPDATE, { id, ...input }),

  // Category
  listCategories:  (activeOnly?: boolean)               => ipcRenderer.invoke(IPC_CHANNELS.CATEGORY_LIST,   { activeOnly }),
  createCategory:  (input: CreateCategoryInput)         => ipcRenderer.invoke(IPC_CHANNELS.CATEGORY_CREATE, input),
  updateCategory:  (id: string, input: UpdateCategoryInput) => ipcRenderer.invoke(IPC_CHANNELS.CATEGORY_UPDATE, { id, ...input }),

  // Brand
  listBrands:  (activeOnly?: boolean)             => ipcRenderer.invoke(IPC_CHANNELS.BRAND_LIST,   { activeOnly }),
  createBrand: (input: CreateBrandInput)          => ipcRenderer.invoke(IPC_CHANNELS.BRAND_CREATE, input),
  updateBrand: (id: string, input: UpdateBrandInput) => ipcRenderer.invoke(IPC_CHANNELS.BRAND_UPDATE, { id, ...input }),

  // Tax Rate
  listTaxRates: (activeOnly?: boolean) => ipcRenderer.invoke(IPC_CHANNELS.TAX_RATE_LIST, { activeOnly }),

  // Product
  listProducts:       (filter: ProductListFilter)         => ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_LIST,           filter),
  getProductById:     (id: string)                        => ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_GET_BY_ID,      id),
  getProductByBarcode:(barcode: string)                   => ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_GET_BY_BARCODE, barcode),
  createProduct:      (request: CreateProductRequest)     => ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_CREATE,         request),
  updateProduct:      (id: string, request: UpdateProductRequest) => ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_UPDATE, { id, ...request }),
  setProductActive:   (id: string, isActive: boolean)     => ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_SET_ACTIVE,     { id, isActive }),

  // Inventory
  getInventorySummary: (filter: InventorySummaryFilter) => ipcRenderer.invoke(IPC_CHANNELS.INVENTORY_SUMMARY, filter),
  getProductStock: (productId: string) => ipcRenderer.invoke(IPC_CHANNELS.INVENTORY_PRODUCT_STOCK, productId),
  getInventoryMovements: (filter: InventoryMovementFilter) => ipcRenderer.invoke(IPC_CHANNELS.INVENTORY_MOVEMENTS, filter),
  postOpeningStock: (input: PostOpeningStockInput) => ipcRenderer.invoke(IPC_CHANNELS.INVENTORY_POST_OPENING, input),
  postStockAdjustment: (input: CreateInventoryAdjustmentInput) => ipcRenderer.invoke(IPC_CHANNELS.INVENTORY_POST_ADJUSTMENT, input),
  postDamageStock: (input: PostDamageInput) => ipcRenderer.invoke(IPC_CHANNELS.INVENTORY_POST_DAMAGE, input),
  postExpiredStock: (input: PostExpiryInput) => ipcRenderer.invoke(IPC_CHANNELS.INVENTORY_POST_EXPIRY, input),
  postLostStock: (input: PostLossInput) => ipcRenderer.invoke(IPC_CHANNELS.INVENTORY_POST_LOSS, input),
  reverseInventoryTransaction: (input: ReverseInventoryTransactionInput) => ipcRenderer.invoke(IPC_CHANNELS.INVENTORY_REVERSE, input),
  getInventoryDashboardSummary: () => ipcRenderer.invoke(IPC_CHANNELS.INVENTORY_DASHBOARD),

  // Supplier
  getSuppliers: (filter: SupplierFilter) => ipcRenderer.invoke(IPC_CHANNELS.SUPPLIER_LIST, filter),
  getSupplierById: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.SUPPLIER_GET_BY_ID, id),
  createSupplier: (input: CreateSupplierInput) => ipcRenderer.invoke(IPC_CHANNELS.SUPPLIER_CREATE, input),
  updateSupplier: (id: string, input: UpdateSupplierInput) => ipcRenderer.invoke(IPC_CHANNELS.SUPPLIER_UPDATE, { id, ...input }),
  setSupplierActive: (id: string, isActive: boolean) => ipcRenderer.invoke(IPC_CHANNELS.SUPPLIER_SET_ACTIVE, { id, isActive }),
  getSupplierOutstanding: (supplierId: string) => ipcRenderer.invoke(IPC_CHANNELS.SUPPLIER_OUTSTANDING, supplierId),

  // Purchase
  getPurchases: (filter: PurchaseFilter) => ipcRenderer.invoke(IPC_CHANNELS.PURCHASE_LIST, filter),
  getPurchaseById: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.PURCHASE_GET_BY_ID, id),
  createPurchaseDraft: (input: PurchaseDraftInput) => ipcRenderer.invoke(IPC_CHANNELS.PURCHASE_CREATE_DRAFT, input),
  updatePurchaseDraft: (id: string, input: PurchaseDraftInput) => ipcRenderer.invoke(IPC_CHANNELS.PURCHASE_UPDATE_DRAFT, { id, ...input }),
  deletePurchaseDraft: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.PURCHASE_DELETE_DRAFT, id),
  calculatePurchase: (input: PurchaseDraftInput) => ipcRenderer.invoke(IPC_CHANNELS.PURCHASE_CALCULATE, input),
  postPurchase: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.PURCHASE_POST, id),
  cancelPurchase: (id: string, reason: string) => ipcRenderer.invoke(IPC_CHANNELS.PURCHASE_CANCEL, { id, reason }),
  getPurchaseDashboardSummary: () => ipcRenderer.invoke(IPC_CHANNELS.PURCHASE_DASHBOARD),

  // Bulk Import
  selectImportFile: () => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_SELECT_FILE),
  getImportTemplates: (importType: ImportType) => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_GET_TEMPLATES, importType),
  getImportColumns: (importType: ImportType) => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_GET_COLUMNS, importType),
  createImportJob: (payload: { importType: ImportType; fileName: string; fileHash: string; fileSize: number; worksheetName: string | null; token: string }) => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_CREATE_JOB, payload),
  parseImportJob: (payload: { jobId: string; token: string; worksheetName?: string }) => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_PARSE_JOB, payload),
  getColumnMappingProfile: (payload: { jobId: string; token: string }) => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_MAPPING_PROFILE, payload),
  validateImport: (payload: { jobId: string; mapping: ImportMapping }) => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_VALIDATE, payload),
  setImportDuplicatePolicy: (payload: { jobId: string; policy: ImportDuplicatePolicy }) => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_DUPLICATE_POLICY, payload),
  executeImport: (payload: { jobId: string; transactionMode: ImportTransactionMode }) => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_EXECUTE, payload),
  cancelImportJob: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_CANCEL, jobId),
  getImportHistory: (filter: any) => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_HISTORY, filter),
  getImportResult: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_RESULT, jobId),
  getImportPreview: (payload: { jobId: string; pageIndex?: number; pageSize?: number }) => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_PREVIEW, payload),
  exportImportErrorReport: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_ERRORS_CSV, jobId),

  // Customer
  getCustomers: (filter: any) => ipcRenderer.invoke(IPC_CHANNELS.CUSTOMER_LIST, filter),
  getCustomerById: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.CUSTOMER_GET_BY_ID, id),
  createCustomer: (input: any) => ipcRenderer.invoke(IPC_CHANNELS.CUSTOMER_CREATE, input),
  updateCustomer: (id: string, input: any) => ipcRenderer.invoke(IPC_CHANNELS.CUSTOMER_UPDATE, { id, ...input }),
  setCustomerActive: (id: string, isActive: boolean) => ipcRenderer.invoke(IPC_CHANNELS.CUSTOMER_SET_ACTIVE, { id, isActive }),
  getCustomerOutstanding: (customerId: string) => ipcRenderer.invoke(IPC_CHANNELS.CUSTOMER_OUTSTANDING, customerId),
  getCustomerLedger: (customerId: string, filter: any) => ipcRenderer.invoke(IPC_CHANNELS.CUSTOMER_LEDGER, { customerId, ...filter }),
  postCustomerOpeningBalance: (input: any) => ipcRenderer.invoke(IPC_CHANNELS.CUSTOMER_POST_OPENING, input),

  // Sales Draft (Phase 6.3)
  createDraftSalesInvoice: (shopId: string, customerId: string) => ipcRenderer.invoke(IPC_CHANNELS.SALES_CREATE_DRAFT, { shopId, customerId }),
  getDraftSalesInvoice: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.SALES_GET_DRAFT, id),
  listDraftSalesInvoices: (shopId: string) => ipcRenderer.invoke(IPC_CHANNELS.SALES_LIST_DRAFTS, shopId),
  saveDraftSalesInvoice: (id: string, input: any) => ipcRenderer.invoke(IPC_CHANNELS.SALES_SAVE_DRAFT, { id, input }),
  holdSalesInvoice: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.SALES_HOLD_BILL, id),
  resumeSalesInvoice: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.SALES_RESUME_BILL, id),
  deleteDraftSalesInvoice: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.SALES_DELETE_DRAFT, id),
  getSalesHistory: (filter: any) => ipcRenderer.invoke(IPC_CHANNELS.SALES_HISTORY, filter),

  // POS / Billing (Phase 6.4)
  searchPOSProducts: (input: any) => ipcRenderer.invoke(IPC_CHANNELS.POS_SEARCH_PRODUCTS, input),
  resolvePOSProductByBarcode: (input: any) => ipcRenderer.invoke(IPC_CHANNELS.POS_RESOLVE_BARCODE, input),
  listHeldPOSBills: (shopId: string) => ipcRenderer.invoke(IPC_CHANNELS.POS_LIST_HELD, { shopId }),
  repricePOSCartForCustomer: (input: any) => ipcRenderer.invoke(IPC_CHANNELS.POS_REPRICE_CART, input),
  createPOSDraft: (shopId: string, customerId: string) => ipcRenderer.invoke(IPC_CHANNELS.POS_CREATE_DRAFT, { shopId, customerId }),
  getPOSDraft: (id: string, shopId?: string) => ipcRenderer.invoke(IPC_CHANNELS.POS_GET_DRAFT, { id, shopId }),
  savePOSDraft: (id: string, input: any) => ipcRenderer.invoke(IPC_CHANNELS.POS_SAVE_DRAFT, { id, input }),
  addPOSDraftLine: (id: string, input: any) => ipcRenderer.invoke(IPC_CHANNELS.POS_ADD_LINE, { id, input }),
  updatePOSDraftLine: (id: string, lineId: string, input: any) => ipcRenderer.invoke(IPC_CHANNELS.POS_UPDATE_LINE, { id, lineId, input }),
  removePOSDraftLine: (id: string, lineId: string) => ipcRenderer.invoke(IPC_CHANNELS.POS_REMOVE_LINE, { id, lineId }),
  holdPOSDraft: (id: string, shopId?: string) => ipcRenderer.invoke(IPC_CHANNELS.POS_HOLD_BILL, { id, shopId }),
  resumePOSDraft: (id: string, shopId?: string) => ipcRenderer.invoke(IPC_CHANNELS.POS_RESUME_BILL, { id, shopId }),
  deletePOSDraft: (id: string, shopId?: string) => ipcRenderer.invoke(IPC_CHANNELS.POS_DELETE_DRAFT, { id, shopId }),
  postPOSSale: (id: string, payments: any[], version: number, paymentContext?: any) => ipcRenderer.invoke(IPC_CHANNELS.POS_POST_SALE, { id, payments, version, paymentContext }),
  calculatePOSCart: (input: any) => ipcRenderer.invoke(IPC_CHANNELS.POS_CALCULATE_CART, input),
});
