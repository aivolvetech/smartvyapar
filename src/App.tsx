import React, { useState, useEffect } from 'react';

import {
  AppInfo, ShopData, IPCResponse, ShopCreateInput,
  UnitOfMeasureData, CreateUnitInput, UpdateUnitInput,
  ProductCategoryData, CreateCategoryInput, UpdateCategoryInput,
  BrandData, CreateBrandInput, UpdateBrandInput,
  TaxRateData, ProductData, ProductListFilter, ProductListResult,
  CreateProductRequest, UpdateProductRequest, CreateBarcodeInput,
  InventoryDashboardSummary, InventorySummaryFilter, InventorySummaryResult,
  InventoryMovementFilter, InventoryMovementResult, InventoryStockSummary,
  CreateInventoryAdjustmentInput, PostDamageInput, PostExpiryInput, PostLossInput,
  PostOpeningStockInput, ReverseInventoryTransactionInput,
  PurchaseDashboardSummary,
} from '../shared/types/ipc';
import { ImportType } from '../shared/types/import';

declare global {
  interface Window {
    smartVyapar: {
      getAppInfo(): Promise<IPCResponse<AppInfo>>;
      getShop(): Promise<IPCResponse<ShopData | null>>;
      createShop(input: ShopCreateInput): Promise<IPCResponse<ShopData>>;
      getDatabaseStatus(): Promise<IPCResponse<{ state: 'CONNECTED' | 'MIGRATING' | 'ERROR'; encrypted: boolean; offline: boolean }>>;

      listUnits(activeOnly?: boolean): Promise<IPCResponse<UnitOfMeasureData[]>>;
      createUnit(input: CreateUnitInput): Promise<IPCResponse<UnitOfMeasureData>>;
      updateUnit(id: string, input: UpdateUnitInput): Promise<IPCResponse<UnitOfMeasureData>>;

      listCategories(activeOnly?: boolean): Promise<IPCResponse<ProductCategoryData[]>>;
      createCategory(input: CreateCategoryInput): Promise<IPCResponse<ProductCategoryData>>;
      updateCategory(id: string, input: UpdateCategoryInput): Promise<IPCResponse<ProductCategoryData>>;

      listBrands(activeOnly?: boolean): Promise<IPCResponse<BrandData[]>>;
      createBrand(input: CreateBrandInput): Promise<IPCResponse<BrandData>>;
      updateBrand(id: string, input: UpdateBrandInput): Promise<IPCResponse<BrandData>>;

      listTaxRates(activeOnly?: boolean): Promise<IPCResponse<TaxRateData[]>>;

      listProducts(filter: ProductListFilter): Promise<IPCResponse<ProductListResult>>;
      getProductById(id: string): Promise<IPCResponse<ProductData | null>>;
      getProductByBarcode(barcode: string): Promise<IPCResponse<ProductData | null>>;
      createProduct(request: CreateProductRequest): Promise<IPCResponse<ProductData>>;
      updateProduct(id: string, request: UpdateProductRequest): Promise<IPCResponse<ProductData>>;
      setProductActive(id: string, isActive: boolean): Promise<IPCResponse<ProductData>>;

      getInventorySummary(filter: InventorySummaryFilter): Promise<IPCResponse<InventorySummaryResult>>;
      getProductStock(productId: string): Promise<IPCResponse<InventoryStockSummary>>;
      getInventoryMovements(filter: InventoryMovementFilter): Promise<IPCResponse<InventoryMovementResult>>;
      postOpeningStock(input: PostOpeningStockInput): Promise<IPCResponse<any>>;
      postStockAdjustment(input: CreateInventoryAdjustmentInput): Promise<IPCResponse<any>>;
      postDamageStock(input: PostDamageInput): Promise<IPCResponse<any>>;
      postExpiredStock(input: PostExpiryInput): Promise<IPCResponse<any>>;
      postLostStock(input: PostLossInput): Promise<IPCResponse<any>>;
      reverseInventoryTransaction(input: ReverseInventoryTransactionInput): Promise<IPCResponse<any>>;
      getInventoryDashboardSummary(): Promise<IPCResponse<InventoryDashboardSummary>>;
      getPurchaseDashboardSummary(): Promise<IPCResponse<PurchaseDashboardSummary>>;

      getCustomers(filter: any): Promise<IPCResponse<any>>;
      getCustomerById(id: string): Promise<IPCResponse<any>>;
      createCustomer(input: any): Promise<IPCResponse<any>>;
      updateCustomer(id: string, input: any): Promise<IPCResponse<any>>;
      setCustomerActive(id: string, isActive: boolean): Promise<IPCResponse<any>>;
      getCustomerOutstanding(customerId: string): Promise<IPCResponse<any>>;
      getCustomerLedger(customerId: string, filter: any): Promise<IPCResponse<any>>;
      postCustomerOpeningBalance(input: any): Promise<IPCResponse<any>>;

      // Sales Draft (Phase 6.3)
      createDraftSalesInvoice(shopId: string, customerId: string): Promise<IPCResponse<any>>;
      getDraftSalesInvoice(id: string): Promise<IPCResponse<any>>;
      listDraftSalesInvoices(shopId: string): Promise<IPCResponse<any>>;
      saveDraftSalesInvoice(id: string, input: any): Promise<IPCResponse<any>>;
      holdSalesInvoice(id: string): Promise<IPCResponse<any>>;
      resumeSalesInvoice(id: string): Promise<IPCResponse<any>>;
      deleteDraftSalesInvoice(id: string): Promise<IPCResponse<any>>;
      getSalesHistory(filter: any): Promise<IPCResponse<any>>;
    };
  }
}

import ProductModule from './components/products/ProductModule';
import InventoryModule from './components/inventory/InventoryModule';
import SupplierModule from './components/suppliers/SupplierModule';
import PurchaseModule from './components/purchases/PurchaseModule';
import BulkImportModule from './components/import/BulkImportModule';
import CustomerModule from './components/customers/CustomerModule';
import BillingModule from './components/pos/BillingModule';
import SalesHistoryModule from './components/sales/SalesHistoryModule';

if (typeof window !== 'undefined' && !window.smartVyapar) {
  // Setup simple in-memory storage for the web-mode/browser mocks
  const mockStorage: {
    units: UnitOfMeasureData[];
    categories: ProductCategoryData[];
    brands: BrandData[];
    products: ProductData[];
    movements: any[];
    customers: any[];
    suppliers: any[];
    purchases: any[];
    sales: any[];
  } = {
    units: [
      { id: 'uom-pcs', name: 'Piece', shortName: 'PCS', decimalAllowed: false, decimalPlaces: 0, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'uom-kg', name: 'Kilogram', shortName: 'KG', decimalAllowed: true, decimalPlaces: 3, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ],
    categories: [
      { id: 'cat-1', name: 'Grocery', description: 'Grocery items', parentCategoryId: null, displayOrder: 1, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ],
    brands: [
      { id: 'brand-1', name: 'Tata', description: 'Tata products', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ],
    products: [],
    movements: [],
    customers: [
      { id: 'cust-walkin', shopId: 'mock-id-1234', customerCode: 'WALKIN', normalizedCustomerCode: 'walkin', name: 'Walk-In Customer', normalizedName: 'walk-in customer', customerType: 'WALK_IN', isActive: true, creditLimit: null, isWalkIn: true, outstanding: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1 }
    ],
    suppliers: [
      { id: 'sup-1', shopId: 'mock-id-1234', supplierCode: 'SUP-001', name: 'Tata Wholesale', contactPerson: 'Mr. Tata', phone: '9999999999', email: 'tata@wholesale.com', gstNumber: null, outstanding: 1200, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ],
    purchases: [],
    sales: []
  };

  const mockStock = (productId: string) => mockStorage.movements
    .filter(m => m.productId === productId)
    .reduce((sum, m) => sum + m.quantity, 0);

  const mockStockSummary = (p: ProductData): InventoryStockSummary => {
    const quantityOnHand = mockStock(p.id);
    const stockStatus = quantityOnHand < 0
      ? 'NEGATIVE_STOCK'
      : quantityOnHand <= 0
        ? 'OUT_OF_STOCK'
        : p.maximumStockLevel !== null && quantityOnHand > p.maximumStockLevel
          ? 'OVER_STOCK'
          : p.minimumStockLevel !== null && quantityOnHand <= p.minimumStockLevel
            ? 'LOW_STOCK'
            : 'IN_STOCK';
    return {
      productId: p.id,
      productCode: p.productCode,
      productName: p.name,
      categoryName: p.categoryName,
      primaryBarcode: p.barcodes.find(b => b.isPrimary)?.barcode || null,
      primaryUnit: p.unitShortName || '',
      quantityOnHand,
      averageCost: p.purchasePrice,
      minimumStockLevel: p.minimumStockLevel,
      reorderLevel: p.reorderLevel,
      maximumStockLevel: p.maximumStockLevel,
      stockStatus,
      lastMovementAt: mockStorage.movements.filter(m => m.productId === p.id).at(-1)?.occurredAt || null,
      productType: p.productType,
      trackInventory: p.trackInventory,
      allowNegativeStock: p.allowNegativeStock,
      isActive: p.isActive,
    };
  };

  const mockPostMovement = (productId: string, transactionType: string, quantity: number, unitCost = 0, reasonCode = 'MOCK') => {
    const p = mockStorage.products.find(item => item.id === productId);
    if (!p) return { success: false, error: 'Product not found' };
    if (p.productType !== 'GOODS' || !p.trackInventory) return { success: false, error: 'Inventory tracking is disabled for this product.' };
    if (quantity < 0 && !p.allowNegativeStock && mockStock(productId) + quantity < 0) {
      return { success: false, error: `Insufficient stock. Available: ${mockStock(productId)}, requested: ${Math.abs(quantity)}.` };
    }
    const movement = {
      id: 'inv-' + Date.now(),
      productId,
      productCode: p.productCode,
      productName: p.name,
      transactionType,
      quantity,
      quantityIn: quantity > 0 ? quantity : null,
      quantityOut: quantity < 0 ? Math.abs(quantity) : null,
      unitCost,
      totalCost: Math.abs(quantity) * unitCost,
      referenceType: 'MOCK',
      referenceId: null,
      referenceNumber: null,
      reasonCode,
      notes: null,
      occurredAt: new Date().toISOString(),
      postedAt: new Date().toISOString(),
      isReversal: false,
      isReversed: false,
    };
    mockStorage.movements.push(movement);
    return { success: true, data: movement };
  };

  window.smartVyapar = {
    getAppInfo: async () => ({
      success: true,
      data: {
        appName: 'Smart Vyapar [Mock]',
        appVersion: '0.1.0',
        platform: 'win32',
        dbStatus: 'CONNECTED',
        diagnosticInfo: {
          electronVersion: '30.0.9',
          nodeVersion: '20.11.1',
          nodeAbi: '123',
          prismaVersion: 'disabled',
          prismaEnginePath: 'disabled',
          betterSqlite3Path: 'better-sqlite3-multiple-ciphers'
        }
      }
    }),
    getShop: async () => {
      const stored = localStorage.getItem('mock_shop');
      return { success: true, data: stored ? JSON.parse(stored) : null };
    },
    createShop: async (input: ShopCreateInput) => {
      const shop = {
        id: 'mock-id-1234',
        name: input.name,
        phone: input.phone || null,
        address: input.address || null,
        gstNumber: input.gstNumber || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem('mock_shop', JSON.stringify(shop));
      return { success: true, data: shop };
    },
    getDatabaseStatus: async () => ({
      success: true,
      data: { state: 'CONNECTED', encrypted: true, offline: true }
    }),

    // Units
    listUnits: async () => ({ success: true, data: mockStorage.units }),
    createUnit: async (input: CreateUnitInput) => {
      const u: UnitOfMeasureData = {
        id: 'uom-' + Date.now(),
        name: input.name,
        shortName: input.shortName,
        decimalAllowed: input.decimalAllowed ?? false,
        decimalPlaces: input.decimalPlaces ?? 0,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      mockStorage.units.push(u);
      return { success: true, data: u };
    },
    updateUnit: async (id: string, input: UpdateUnitInput) => {
      const u = mockStorage.units.find(item => item.id === id);
      if (!u) return { success: false, error: 'Not found' };
      if (input.name !== undefined) u.name = input.name;
      if (input.shortName !== undefined) u.shortName = input.shortName;
      if (input.decimalAllowed !== undefined) u.decimalAllowed = input.decimalAllowed;
      if (input.decimalPlaces !== undefined) u.decimalPlaces = input.decimalPlaces;
      if (input.isActive !== undefined) u.isActive = input.isActive;
      u.updatedAt = new Date().toISOString();
      return { success: true, data: u };
    },

    // Categories
    listCategories: async () => ({ success: true, data: mockStorage.categories }),
    createCategory: async (input: CreateCategoryInput) => {
      const c: ProductCategoryData = {
        id: 'cat-' + Date.now(),
        name: input.name,
        description: input.description ?? null,
        parentCategoryId: input.parentCategoryId ?? null,
        displayOrder: input.displayOrder ?? 0,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      mockStorage.categories.push(c);
      return { success: true, data: c };
    },
    updateCategory: async (id: string, input: UpdateCategoryInput) => {
      const c = mockStorage.categories.find(item => item.id === id);
      if (!c) return { success: false, error: 'Not found' };
      if (input.name !== undefined) c.name = input.name;
      if (input.description !== undefined) c.description = input.description;
      if (input.parentCategoryId !== undefined) c.parentCategoryId = input.parentCategoryId;
      if (input.displayOrder !== undefined) c.displayOrder = input.displayOrder;
      if (input.isActive !== undefined) c.isActive = input.isActive;
      c.updatedAt = new Date().toISOString();
      return { success: true, data: c };
    },

    // Brands
    listBrands: async () => ({ success: true, data: mockStorage.brands }),
    createBrand: async (input: CreateBrandInput) => {
      const b: BrandData = {
        id: 'brand-' + Date.now(),
        name: input.name,
        description: input.description ?? null,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      mockStorage.brands.push(b);
      return { success: true, data: b };
    },
    updateBrand: async (id: string, input: UpdateBrandInput) => {
      const b = mockStorage.brands.find(item => item.id === id);
      if (!b) return { success: false, error: 'Not found' };
      if (input.name !== undefined) b.name = input.name;
      if (input.description !== undefined) b.description = input.description;
      if (input.isActive !== undefined) b.isActive = input.isActive;
      b.updatedAt = new Date().toISOString();
      return { success: true, data: b };
    },

    // Tax Rates
    listTaxRates: async () => ({
      success: true,
      data: [
        { id: 'tax-exempt', name: 'Exempt', rate: 0, taxType: 'EXEMPT', cgstRate: 0, sgstRate: 0, igstRate: 0, cessRate: 0, effectiveFrom: '2017-07-01', effectiveTo: null, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'tax-gst-18', name: 'GST 18%', rate: 18, taxType: 'GST', cgstRate: 9, sgstRate: 9, igstRate: 18, cessRate: 0, effectiveFrom: '2017-07-01', effectiveTo: null, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      ]
    }),

    // Products
    listProducts: async (filter: ProductListFilter) => {
      let filtered = [...mockStorage.products];
      if (filter.search) {
        const q = filter.search.toLowerCase();
        filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.productCode.toLowerCase().includes(q));
      }
      if (filter.isActive !== undefined) {
        filtered = filtered.filter(p => p.isActive === filter.isActive);
      }
      const totalItems = filtered.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / filter.pageSize));
      const pageItems = filtered.slice((filter.page - 1) * filter.pageSize, filter.page * filter.pageSize);
      const items = pageItems.map(p => ({
        id: p.id,
        productCode: p.productCode,
        name: p.name,
        categoryName: p.categoryId ? (mockStorage.categories.find(c=>c.id===p.categoryId)?.name || null) : null,
        brandName: p.brandId ? (mockStorage.brands.find(b=>b.id===p.brandId)?.name || null) : null,
        unitShortName: p.primaryUnitId ? (mockStorage.units.find(u=>u.id===p.primaryUnitId)?.shortName || null) : null,
        hsnSacCode: p.hsnSacCode,
        taxRateName: p.taxRateId ? 'GST 18%' : null,
        taxRate: p.taxRateId ? 18 : null,
        sellingPrice: p.sellingPrice,
        mrp: p.mrp,
        primaryBarcode: p.barcodes.find(b=>b.isPrimary)?.barcode || null,
        productType: p.productType,
        isActive: p.isActive,
        updatedAt: p.updatedAt
      }));
      return {
        success: true,
        data: {
          items,
          pagination: { page: filter.page, pageSize: filter.pageSize, totalItems, totalPages }
        }
      };
    },
    getProductById: async (id: string) => {
      const p = mockStorage.products.find(item => item.id === id);
      return { success: true, data: p || null };
    },
    getProductByBarcode: async (barcode: string) => {
      const p = mockStorage.products.find(item => item.barcodes.some(b => b.barcode === barcode));
      return { success: true, data: p || null };
    },
    searchPOSProducts: async (input: any) => {
      const q = (input.query || '').trim().toLowerCase();
      let filtered = mockStorage.products.filter(p => p.isActive);
      if (q) {
        filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.productCode.toLowerCase().includes(q) || p.barcodes.some(b => b.barcode.toLowerCase().includes(q)));
      }
      const items = filtered.map(p => ({
        productId: p.id,
        productCode: p.productCode,
        productName: p.name,
        productType: p.productType,
        barcode: p.barcodes.find(b => b.isPrimary)?.barcode || p.barcodes[0]?.barcode || null,
        unitId: p.primaryUnitId,
        unitName: p.unitShortName,
        allowsDecimalQuantity: p.primaryUnitId ? (mockStorage.units.find(u => u.id === p.primaryUnitId)?.decimalAllowed ?? false) : false,
        decimalPlaces: p.primaryUnitId ? (mockStorage.units.find(u => u.id === p.primaryUnitId)?.decimalPlaces ?? 0) : 0,
        taxRateId: p.taxRateId,
        taxCategory: p.taxRateId ? 'GST' : 'EXEMPT',
        taxRate: p.taxRateId ? 18 : 0,
        hsnSacCode: p.hsnSacCode,
        sellingPrice: p.sellingPrice,
        mrp: p.mrp,
        minimumSellingPrice: null,
        minimumSellingPriceConfigured: false,
        priceSource: 'STANDARD_PRICE_BOOK' as any,
        currentStock: 100,
        stockAsOf: new Date().toISOString(),
        trackInventory: p.trackInventory,
        allowNegativeStock: p.allowNegativeStock,
        warnings: []
      }));
      return {
        success: true,
        data: {
          items,
          totalItems: items.length,
          page: 1,
          pageSize: 50,
          totalPages: 1
        }
      };
    },
    resolvePOSProductByBarcode: async (input: any) => {
      const p = mockStorage.products.find(item => item.isActive && item.barcodes.some(b => b.barcode === input.barcode));
      if (!p) return { success: false, error: 'Product not found' };
      const resolved = {
        productId: p.id,
        productCode: p.productCode,
        productName: p.name,
        productType: p.productType,
        barcode: input.barcode,
        unitId: p.primaryUnitId,
        unitName: p.unitShortName,
        allowsDecimalQuantity: p.primaryUnitId ? (mockStorage.units.find(u => u.id === p.primaryUnitId)?.decimalAllowed ?? false) : false,
        decimalPlaces: p.primaryUnitId ? (mockStorage.units.find(u => u.id === p.primaryUnitId)?.decimalPlaces ?? 0) : 0,
        taxRateId: p.taxRateId,
        taxCategory: p.taxRateId ? 'GST' : 'EXEMPT',
        taxRate: p.taxRateId ? 18 : 0,
        hsnSacCode: p.hsnSacCode,
        sellingPrice: p.sellingPrice,
        mrp: p.mrp,
        minimumSellingPrice: null,
        minimumSellingPriceConfigured: false,
        priceSource: 'STANDARD_PRICE_BOOK' as any,
        currentStock: 100,
        stockAsOf: new Date().toISOString(),
        trackInventory: p.trackInventory,
        allowNegativeStock: p.allowNegativeStock,
        warnings: []
      };
      return { success: true, data: resolved };
    },
    createProduct: async (req: CreateProductRequest) => {
      const normalizedCode = req.product.productCode.trim().toLowerCase();
      if (mockStorage.products.some(p => p.productCode.trim().toLowerCase() === normalizedCode)) {
        return { success: false, error: `Product code "${req.product.productCode.trim()}" already exists.` };
      }
      const requestedBarcodes = req.barcodes.map((b: CreateBarcodeInput) => b.barcode.trim()).filter(Boolean);
      const duplicateBarcode = requestedBarcodes.find((barcode: string) =>
        mockStorage.products.some(p => p.barcodes.some(existing => existing.barcode === barcode))
      );
      if (duplicateBarcode) {
        return { success: false, error: `Barcode "${duplicateBarcode}" already assigned to another product.` };
      }
      const id = 'prod-' + Date.now();
      const p: ProductData = {
        id,
        productCode: req.product.productCode,
        name: req.product.name,
        printName: req.product.printName || null,
        description: req.product.description || null,
        categoryId: req.product.categoryId || null,
        categoryName: req.product.categoryId ? (mockStorage.categories.find(c=>c.id===req.product.categoryId)?.name || null) : null,
        brandId: req.product.brandId || null,
        brandName: req.product.brandId ? (mockStorage.brands.find(b=>b.id===req.product.brandId)?.name || null) : null,
        primaryUnitId: req.product.primaryUnitId,
        unitName: mockStorage.units.find(u=>u.id===req.product.primaryUnitId)?.name || null,
        unitShortName: mockStorage.units.find(u=>u.id===req.product.primaryUnitId)?.shortName || null,
        hsnSacCode: req.product.hsnSacCode || null,
        taxRateId: req.product.taxRateId || null,
        taxRateName: req.product.taxRateId ? 'GST 18%' : null,
        taxRate: req.product.taxRateId ? 18 : null,
        productType: req.product.productType || 'GOODS',
        trackInventory: req.product.trackInventory ?? true,
        allowNegativeStock: req.product.allowNegativeStock ?? false,
        minimumStockLevel: req.product.minimumStockLevel ?? null,
        reorderLevel: req.product.reorderLevel ?? null,
        maximumStockLevel: req.product.maximumStockLevel ?? null,
        sku: req.product.sku || null,
        barcodes: req.barcodes.map((b: CreateBarcodeInput, i: number) => ({
          id: 'bc-' + i + '-' + Date.now(),
          productId: id,
          barcode: b.barcode,
          barcodeType: b.barcodeType || 'EAN13',
          isPrimary: b.isPrimary ?? false,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })),
        purchasePrice: req.defaultPrice.purchasePrice,
        sellingPrice: req.defaultPrice.sellingPrice,
        mrp: req.defaultPrice.mrp,
        wholesalePrice: req.defaultPrice.wholesalePrice ?? null,
        isActive: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      mockStorage.products.push(p);
      if (req.openingBalance && req.openingBalance.quantity > 0 && p.productType === 'GOODS' && p.trackInventory) {
        mockPostMovement(p.id, 'OPENING', req.openingBalance.quantity, req.openingBalance.unitCost ?? 0, 'PRODUCT_OPENING_BALANCE');
      }
      return { success: true, data: p };
    },
    updateProduct: async (id: string, req: UpdateProductRequest) => {
      const p = mockStorage.products.find(item => item.id === id);
      if (!p) return { success: false, error: 'Not found' };
      if (req.product.productCode !== undefined) p.productCode = req.product.productCode;
      if (req.product.name !== undefined) p.name = req.product.name;
      if (req.product.printName !== undefined) p.printName = req.product.printName;
      if (req.product.description !== undefined) p.description = req.product.description;
      if (req.product.categoryId !== undefined) p.categoryId = req.product.categoryId;
      if (req.product.brandId !== undefined) p.brandId = req.product.brandId;
      if (req.product.primaryUnitId !== undefined) p.primaryUnitId = req.product.primaryUnitId;
      if (req.product.hsnSacCode !== undefined) p.hsnSacCode = req.product.hsnSacCode;
      if (req.product.taxRateId !== undefined) p.taxRateId = req.product.taxRateId;
      if (req.product.productType !== undefined) p.productType = req.product.productType;
      if (req.product.trackInventory !== undefined) p.trackInventory = req.product.trackInventory;
      if (req.product.allowNegativeStock !== undefined) p.allowNegativeStock = req.product.allowNegativeStock;
      if (req.product.minimumStockLevel !== undefined) p.minimumStockLevel = req.product.minimumStockLevel;
      if (req.product.reorderLevel !== undefined) p.reorderLevel = req.product.reorderLevel;
      if (req.product.maximumStockLevel !== undefined) p.maximumStockLevel = req.product.maximumStockLevel;
      if (req.product.sku !== undefined) p.sku = req.product.sku;
      if (req.product.isActive !== undefined) p.isActive = req.product.isActive;
      if (req.barcodes !== undefined) {
        p.barcodes = req.barcodes.map((b: CreateBarcodeInput, i: number) => ({
          id: 'bc-' + i + '-' + Date.now(),
          productId: id,
          barcode: b.barcode,
          barcodeType: b.barcodeType || 'EAN13',
          isPrimary: b.isPrimary ?? false,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
      }
      if (req.defaultPrice !== undefined) {
        p.purchasePrice = req.defaultPrice.purchasePrice;
        p.sellingPrice = req.defaultPrice.sellingPrice;
        p.mrp = req.defaultPrice.mrp;
        p.wholesalePrice = req.defaultPrice.wholesalePrice ?? null;
      }
      p.version++;
      p.updatedAt = new Date().toISOString();
      return { success: true, data: p };
    },
    setProductActive: async (id: string, isActive: boolean) => {
      const p = mockStorage.products.find(item => item.id === id);
      if (!p) return { success: false, error: 'Not found' };
      p.isActive = isActive;
      p.version++;
      p.updatedAt = new Date().toISOString();
      return { success: true, data: p };
    },
    getInventorySummary: async (filter: InventorySummaryFilter) => {
      let summaries = mockStorage.products
        .filter(p => p.productType === 'GOODS' && p.trackInventory)
        .map(mockStockSummary);
      if (filter.search) {
        const q = filter.search.toLowerCase();
        summaries = summaries.filter(p => p.productCode.toLowerCase().includes(q) || p.productName.toLowerCase().includes(q) || (p.primaryBarcode || '').includes(filter.search!));
      }
      if (filter.stockStatus) summaries = summaries.filter(p => p.stockStatus === filter.stockStatus);
      const totalItems = summaries.length;
      const pageItems = summaries.slice((filter.page - 1) * filter.pageSize, filter.page * filter.pageSize);
      return { success: true, data: { items: pageItems, pagination: { page: filter.page, pageSize: filter.pageSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / filter.pageSize)) } } };
    },
    getProductStock: async (productId: string) => {
      const p = mockStorage.products.find(item => item.id === productId);
      return p ? { success: true, data: mockStockSummary(p) } : { success: false, error: 'Product not found' };
    },
    getInventoryMovements: async (filter: InventoryMovementFilter) => {
      let items = [...mockStorage.movements];
      if (filter.productId) items = items.filter(m => m.productId === filter.productId);
      if (filter.transactionType) items = items.filter(m => m.transactionType === filter.transactionType);
      const totalItems = items.length;
      const pageItems = items.slice((filter.page - 1) * filter.pageSize, filter.page * filter.pageSize);
      return { success: true, data: { items: pageItems, pagination: { page: filter.page, pageSize: filter.pageSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / filter.pageSize)) } } };
    },
    postOpeningStock: async (input: PostOpeningStockInput) => mockPostMovement(input.productId, 'OPENING', Math.abs(input.quantity), input.unitCost ?? 0, input.reason || 'OPENING'),
    postStockAdjustment: async (input: CreateInventoryAdjustmentInput) => mockPostMovement(input.productId, input.adjustmentType, input.adjustmentType === 'ADJUSTMENT_IN' ? Math.abs(input.quantity) : -Math.abs(input.quantity), input.unitCost ?? 0, input.reason),
    postDamageStock: async (input: PostDamageInput) => mockPostMovement(input.productId, 'DAMAGE_OUT', -Math.abs(input.quantity), 0, input.reason),
    postExpiredStock: async (input: PostExpiryInput) => mockPostMovement(input.productId, 'EXPIRY_OUT', -Math.abs(input.quantity), 0, input.reason),
    postLostStock: async (input: PostLossInput) => mockPostMovement(input.productId, 'LOSS_OUT', -Math.abs(input.quantity), 0, input.reason),
    reverseInventoryTransaction: async (input: ReverseInventoryTransactionInput) => {
      const original = mockStorage.movements.find(m => m.id === input.transactionId);
      if (!original) return { success: false, error: 'Inventory transaction not found.' };
      return mockPostMovement(original.productId, 'REVERSAL', -original.quantity, original.unitCost, input.reason);
    },
    getInventoryDashboardSummary: async () => {
      const summaries = mockStorage.products.filter(p => p.productType === 'GOODS' && p.trackInventory && p.isActive).map(mockStockSummary);
      const data: InventoryDashboardSummary = {
        totalTrackedProducts: summaries.length,
        totalStockQuantity: summaries.reduce((sum, p) => sum + p.quantityOnHand, 0),
        inStockProducts: summaries.filter(p => p.quantityOnHand > 0).length,
        lowStockProducts: summaries.filter(p => p.stockStatus === 'LOW_STOCK').length,
        outOfStockProducts: summaries.filter(p => p.stockStatus === 'OUT_OF_STOCK').length,
        reorderRequiredProducts: summaries.filter(p => p.reorderLevel !== null && p.quantityOnHand <= p.reorderLevel).length,
        negativeStockProducts: summaries.filter(p => p.stockStatus === 'NEGATIVE_STOCK').length,
        overStockProducts: summaries.filter(p => p.stockStatus === 'OVER_STOCK').length,
        damagePostedToday: mockStorage.movements.filter(m => m.transactionType === 'DAMAGE_OUT').reduce((sum, m) => sum + Math.abs(m.quantity), 0),
        expiryPostedToday: mockStorage.movements.filter(m => m.transactionType === 'EXPIRY_OUT').reduce((sum, m) => sum + Math.abs(m.quantity), 0),
      };
      return { success: true, data };
    },
    getPurchaseDashboardSummary: async () => ({ success: true, data: { purchasesToday: 0, purchaseAmountToday: 0, draftPurchases: 0, supplierOutstanding: 0, purchasesDue: 0 } }),

    // Customers
    getCustomers: async (filter: any) => {
      let filtered = [...mockStorage.customers];
      if (filter?.search) {
        const q = filter.search.toLowerCase();
        filtered = filtered.filter(c => c.name.toLowerCase().includes(q) || c.customerCode.toLowerCase().includes(q));
      }
      return { success: true, data: { items: filtered, pagination: { page: 1, pageSize: 50, totalItems: filtered.length, totalPages: 1 } } };
    },
    getCustomerById: async (id: string) => {
      const c = mockStorage.customers.find(item => item.id === id);
      return { success: true, data: c || null };
    },
    createCustomer: async (input: any) => {
      if (input.requireUniquePhone || input.isQuick) {
        if (!input.name || !input.name.trim()) {
          return { success: false, error: 'CUSTOMER_NAME_REQUIRED' };
        }
        if (!input.phone || !input.phone.trim() || !/^[0-9+\-\s()]{6,20}$/.test(input.phone.trim())) {
          return { success: false, error: 'INVALID_MOBILE' };
        }
        const clean = input.phone.trim().replace(/[^0-9]/g, '');
        const dup = mockStorage.customers.find(item => item.phone && item.phone.trim().replace(/[^0-9]/g, '') === clean);
        if (dup) {
          return { success: false, error: 'CUSTOMER_MOBILE_EXISTS' };
        }
      }
      const c = {
        id: 'cust-' + Date.now(),
        shopId: 'mock-id-1234',
        customerCode: input.customerCode || ('CUST-' + String(mockStorage.customers.length + 1).padStart(6, '0')),
        name: input.name,
        phone: input.phone || null,
        email: input.email || null,
        gstNumber: input.gstNumber || null,
        creditLimit: input.creditLimit || null,
        isActive: true,
        isWalkIn: false,
        outstanding: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      mockStorage.customers.push(c);
      return { success: true, data: c };
    },
    updateCustomer: async (id: string, input: any) => {
      const c = mockStorage.customers.find(item => item.id === id);
      if (!c) return { success: false, error: 'Customer not found' };
      Object.assign(c, input);
      c.updatedAt = new Date().toISOString();
      return { success: true, data: c };
    },
    setCustomerActive: async (id: string, isActive: boolean) => {
      const c = mockStorage.customers.find(item => item.id === id);
      if (!c) return { success: false, error: 'Customer not found' };
      c.isActive = isActive;
      c.updatedAt = new Date().toISOString();
      return { success: true, data: c };
    },
    getCustomerOutstanding: async (_id: string) => ({ success: true, data: { outstandingBalance: 0 } }),
    getCustomerLedger: async (_customerId: string, _filter: any) => ({ success: true, data: { items: [], pagination: { page: 1, pageSize: 50, totalItems: 0, totalPages: 1 } } }),
    postCustomerOpeningBalance: async (_input: any) => ({ success: true }),

    // Suppliers
    getSuppliers: async (filter: any) => {
      let filtered = [...mockStorage.suppliers];
      if (filter?.search) {
        const q = filter.search.toLowerCase();
        filtered = filtered.filter(s => s.name.toLowerCase().includes(q) || s.supplierCode.toLowerCase().includes(q));
      }
      return { success: true, data: { items: filtered, pagination: { page: 1, pageSize: 50, totalItems: filtered.length, totalPages: 1 } } };
    },
    getSupplierById: async (id: string) => {
      const s = mockStorage.suppliers.find(item => item.id === id);
      return { success: true, data: s || null };
    },
    createSupplier: async (input: any) => {
      const s = {
        id: 'sup-' + Date.now(),
        shopId: 'mock-id-1234',
        supplierCode: input.supplierCode || ('SUP-' + Date.now()),
        name: input.name,
        contactPerson: input.contactPerson || null,
        phone: input.phone || null,
        email: input.email || null,
        gstNumber: input.gstNumber || null,
        outstanding: 0,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      mockStorage.suppliers.push(s);
      return { success: true, data: s };
    },
    updateSupplier: async (id: string, input: any) => {
      const s = mockStorage.suppliers.find(item => item.id === id);
      if (!s) return { success: false, error: 'Supplier not found' };
      Object.assign(s, input);
      s.updatedAt = new Date().toISOString();
      return { success: true, data: s };
    },
    setSupplierActive: async (id: string, isActive: boolean) => {
      const s = mockStorage.suppliers.find(item => item.id === id);
      if (!s) return { success: false, error: 'Supplier not found' };
      s.isActive = isActive;
      s.updatedAt = new Date().toISOString();
      return { success: true, data: s };
    },
    getSupplierOutstanding: async (id: string) => {
      const s = mockStorage.suppliers.find(item => item.id === id);
      return { success: true, data: { outstandingBalance: s ? s.outstandingBalance : 0 } };
    },

    // Purchases
    getPurchases: async (_filter: any) => ({ success: true, data: { items: mockStorage.purchases, pagination: { page: 1, pageSize: 50, totalItems: mockStorage.purchases.length, totalPages: 1 } } }),
    getPurchaseById: async (id: string) => ({ success: true, data: mockStorage.purchases.find(p => p.id === id) || null }),
    createPurchaseDraft: async (input: any) => {
      const p = { id: 'pur-' + Date.now(), invoiceNumber: null, status: 'DRAFT', ...input, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      mockStorage.purchases.push(p);
      return { success: true, data: p };
    },
    updatePurchaseDraft: async (id: string, input: any) => {
      const p = mockStorage.purchases.find(item => item.id === id);
      if (!p) return { success: false, error: 'Purchase not found' };
      Object.assign(p, input);
      p.updatedAt = new Date().toISOString();
      return { success: true, data: p };
    },
    deletePurchaseDraft: async (id: string) => {
      mockStorage.purchases = mockStorage.purchases.filter(p => p.id !== id);
      return { success: true };
    },
    calculatePurchase: async (_input: any) => ({ success: true, data: { subtotal: 0, taxTotal: 0, discountTotal: 0, grandTotal: 0 } }),
    postPurchase: async (id: string) => {
      const p = mockStorage.purchases.find(item => item.id === id);
      if (p) p.status = 'POSTED';
      return { success: true };
    },
    cancelPurchase: async (id: string, _reason: string) => {
      const p = mockStorage.purchases.find(item => item.id === id);
      if (p) p.status = 'CANCELLED';
      return { success: true };
    },

    // Data Import
    getImportHistory: async () => ({ success: true, data: [] }),
    getImportTemplates: async () => ({ success: true, data: [] }),
    getImportColumns: async () => ({ success: true, data: [] }),
    createImportJob: async () => ({ success: true, data: { id: 'job-mock' } }),
    parseImportJob: async () => ({ success: true, data: { status: 'PARSED' } }),
    getColumnMappingProfile: async () => ({ success: true, data: { mappings: [] } }),
    validateImport: async () => ({ success: true, data: { validRows: 0, errorRows: 0 } }),
    setImportDuplicatePolicy: async () => ({ success: true }),
    executeImport: async () => ({ success: true, data: { importedCount: 0 } }),
    cancelImportJob: async () => ({ success: true }),

    // Sales Drafts
    createDraftSalesInvoice: async (shopId: string, customerId: string) => {
      const s = { id: 'sale-' + Date.now(), shopId, customerId, status: 'DRAFT', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      mockStorage.sales.push(s);
      return { success: true, data: s };
    },
    getDraftSalesInvoice: async (id: string) => ({ success: true, data: mockStorage.sales.find(item => item.id === id) || null }),
    listDraftSalesInvoices: async (shopId: string) => ({ success: true, data: mockStorage.sales.filter(s => s.shopId === shopId) }),
    saveDraftSalesInvoice: async (id: string, input: any) => {
      const s = mockStorage.sales.find(item => item.id === id);
      if (s) Object.assign(s, input);
      return { success: true, data: s };
    },
    holdSalesInvoice: async (id: string) => {
      const s = mockStorage.sales.find(item => item.id === id);
      if (s) s.status = 'HELD';
      return { success: true };
    },
    resumeSalesInvoice: async (id: string) => {
      const s = mockStorage.sales.find(item => item.id === id);
      if (s) s.status = 'DRAFT';
      return { success: true };
    },
    deleteDraftSalesInvoice: async (id: string) => {
      mockStorage.sales = mockStorage.sales.filter(s => s.id !== id);
      return { success: true };
    },
    postPOSSale: async (id: string, _payments: any[], _version: number, _paymentContext?: any) => {
      const s = mockStorage.sales.find(item => item.id === id);
      if (s) {
        s.status = 'POSTED';
        s.invoiceNumber = 'INV-2026-' + String(Math.floor(Math.random() * 900000) + 100000);
        return { success: true, data: { invoice: s, lines: [] } };
      }
      return { success: false, error: 'Draft not found.' };
    },
    getSalesHistory: async (filter: any) => {
      let items = mockStorage.sales.filter(item => item.shopId === filter.shopId);
      if (filter.status) items = items.filter(item => item.status === filter.status);
      if (filter.paymentStatus) items = items.filter(item => item.paymentStatus === filter.paymentStatus);
      if (filter.customerId) items = items.filter(item => item.customerId === filter.customerId);
      if (filter.dateFrom) items = items.filter(item => item.invoiceDate >= filter.dateFrom);
      if (filter.dateTo) items = items.filter(item => item.invoiceDate <= filter.dateTo);
      if (filter.invoiceNumber) items = items.filter(item => `${item.invoiceNumber || ''} ${item.draftReference}`.toLowerCase().includes(filter.invoiceNumber.toLowerCase()));
      const mapped = items.map(item => {
        const customer = mockStorage.customers.find(c => c.id === item.customerId);
        return { ...item, customerName: customer?.name || 'Unknown', customerCode: customer?.customerCode || '', isWalkIn: Boolean(customer?.isWalkIn), paidAmount: item.paidAmount || 0, outstandingAmount: item.outstandingAmount || item.grandTotal || 0, version: item.version || 1 };
      });
      return { success: true, data: { items: mapped, totalItems: mapped.length, page: 1, pageSize: 25, totalPages: mapped.length ? 1 : 0 } };
    },
  } as any;
}
type StartupState =
  | 'APP_STARTING'
  | 'DATABASE_INITIALIZING'
  | 'SHOP_LOADING'
  | 'SETUP_REQUIRED'
  | 'READY'
  | 'RECOVERY_REQUIRED'
  | 'FATAL_ERROR';

type Tab =
  | 'dashboard'
  | 'billing'
  | 'sales'
  | 'products'
  | 'inventory'
  | 'purchases'
  | 'customers'
  | 'suppliers'
  | 'payments'
  | 'expenses'
  | 'reports'
  | 'import'
  | 'settings';

export default function App() {
  const [startupState, setStartupState] = useState<StartupState>('APP_STARTING');
  const [dbStatus, setDbStatus] = useState<{ state: string; encrypted: boolean; offline: boolean } | null>(null);
  const [shop, setShop] = useState<ShopData | null>(null);
  const [inventoryDashboard, setInventoryDashboard] = useState<InventoryDashboardSummary | null>(null);
  const [purchaseDashboard, setPurchaseDashboard] = useState<PurchaseDashboardSummary | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [resumeSalesInvoiceId, setResumeSalesInvoiceId] = useState<string | null>(null);
  const [preselectedImportType, setPreselectedImportType] = useState<ImportType | null>(null);
  
  // Form Fields (Setup & Settings)
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [merchantUpiId, setMerchantUpiId] = useState('');
  const [allowNegativeStockGlobally, setAllowNegativeStockGlobally] = useState(false);
  
  // UI States
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Escape to close toast
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setToast(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (startupState !== 'READY' || activeTab !== 'dashboard') return;
    window.smartVyapar.getInventoryDashboardSummary()
      .then((res) => {
        if (res.success && res.data) setInventoryDashboard(res.data);
      })
      .catch(() => setInventoryDashboard(null));
    window.smartVyapar.getPurchaseDashboardSummary()
      .then((res) => {
        if (res.success && res.data) setPurchaseDashboard(res.data);
      })
      .catch(() => setPurchaseDashboard(null));
  }, [startupState, activeTab]);

  const runStartupSequence = async () => {
    try {
      setStartupState('APP_STARTING');
      setErrorMessage(null);

      // 1. Check secure database status
      const dbStatusRes = await window.smartVyapar.getDatabaseStatus();
      if (!dbStatusRes.success || !dbStatusRes.data) {
        setErrorMessage(dbStatusRes.error || 'Failed to initialize security key layers.');
        setStartupState('FATAL_ERROR');
        return;
      }

      setDbStatus(dbStatusRes.data);

      if (dbStatusRes.data.state === 'MIGRATING') {
        setStartupState('DATABASE_INITIALIZING');
        // Poll for completion
        let retries = 10;
        while (retries > 0) {
          await new Promise((r) => setTimeout(r, 1000));
          const pollRes = await window.smartVyapar.getDatabaseStatus();
          if (pollRes.success && pollRes.data && pollRes.data.state === 'CONNECTED') {
            setDbStatus(pollRes.data);
            break;
          }
          retries--;
        }
      }

      // If database status check indicates error or wrong keys
      const appInfoRes = await window.smartVyapar.getAppInfo();
      if (appInfoRes.success && appInfoRes.data) {

        const status = appInfoRes.data.dbStatus;
        if (status === 'WRONG_KEY') {
          setStartupState('RECOVERY_REQUIRED');
          return;
        } else if (status === 'CORRUPTED' || status === 'CONNECTION_FAILED' || status === 'MIGRATION_FAILED') {
          setErrorMessage(`Database Initialization Failure: State is ${status}`);
          setStartupState('FATAL_ERROR');
          return;
        }
      } else {
        setErrorMessage(appInfoRes.error || 'Diagnostic interface call failed.');
        setStartupState('FATAL_ERROR');
        return;
      }

      // 2. Fetch Shop Profile
      setStartupState('SHOP_LOADING');
      const shopRes = await window.smartVyapar.getShop();
      if (shopRes.success) {
        if (shopRes.data) {
          setShop(shopRes.data);
          setName(shopRes.data.name);
          setPhone(shopRes.data.phone || '');
          setAddress(shopRes.data.address || '');
          setGstNumber(shopRes.data.gstNumber || '');
          setMerchantUpiId(shopRes.data.merchantUpiId || '');
          setAllowNegativeStockGlobally(shopRes.data.allowNegativeStockGlobally || false);
          setStartupState('READY');
        } else {
          setStartupState('SETUP_REQUIRED');
        }
      } else {
        setErrorMessage(shopRes.error || 'Could not fetch shop profile from connection handle.');
        setStartupState('FATAL_ERROR');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unknown communication error.');
      setStartupState('FATAL_ERROR');
    }
  };

  useEffect(() => {
    runStartupSequence();
  }, []);

  const validateForm = (): boolean => {
    const errors: { [key: string]: string } = {};

    if (!name.trim()) {
      errors.name = 'Shop name is required.';
    }

    if (phone.trim()) {
      const phoneRegex = /^[6-9]\d{9}$/;
      if (!phoneRegex.test(phone.trim())) {
        errors.phone = 'Enter a valid 10-digit contact number.';
      }
    }

    if (gstNumber.trim()) {
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstRegex.test(gstNumber.trim().toUpperCase())) {
        errors.gstNumber = 'Enter a valid 15-character GSTIN format (e.g. 07AAAAA1111A1Z1).';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveShopProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || submitting) return;

    try {
      setSubmitting(true);
        const res = await window.smartVyapar.createShop({
        name: name.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        gstNumber: gstNumber.trim().toUpperCase() || undefined,
        merchantUpiId: merchantUpiId.trim() || undefined,
        allowNegativeStockGlobally,
      });

      if (res.success && res.data) {
        setShop(res.data);
        setName(res.data.name);
        setPhone(res.data.phone || '');
        setAddress(res.data.address || '');
        setGstNumber(res.data.gstNumber || '');
        setMerchantUpiId(res.data.merchantUpiId || '');
        setAllowNegativeStockGlobally(res.data.allowNegativeStockGlobally || false);
        setToast({ type: 'success', message: 'Shop profile saved securely.' });
        
        if (startupState === 'SETUP_REQUIRED') {
          setStartupState('READY');
        }
      } else {
        setToast({ type: 'error', message: res.error || 'Failed to save shop profile.' });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Unexpected communication boundary crash.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Render Loader screen for startup
  if (startupState === 'APP_STARTING' || startupState === 'DATABASE_INITIALIZING' || startupState === 'SHOP_LOADING') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '1.5rem', background: 'var(--bg-app)' }}>
        <div style={{ width: '45px', height: '45px', border: '3px solid var(--border-color)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '1.1rem' }}>
          {startupState === 'APP_STARTING' && 'Starting application...'}
          {startupState === 'DATABASE_INITIALIZING' && 'Checking secure database...'}
          {startupState === 'SHOP_LOADING' && 'Loading shop profile...'}
        </span>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}} />
      </div>
    );
  }

  // Render Disaster Recovery screen
  if (startupState === 'RECOVERY_REQUIRED') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', padding: '2rem', background: 'var(--bg-app)' }}>
        <div className="card-surface" style={{ maxWidth: '480px', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ fontSize: '2.5rem', color: '#f59e0b' }}>⚠️ Security Alert</div>
          <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Recovery Package Required</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            The Windows Data Protection API (DPAPI) local storage keys were cleared or modified. Access to your encrypted database is blocked.
          </p>
          <div style={{ padding: '1rem', background: 'var(--color-warning-bg)', borderRadius: '6px', borderLeft: '3px solid #f59e0b', color: '#f59e0b', fontSize: '0.9rem' }}>
            Please import your disaster recovery backup key package to restore local access.
          </div>
          <button type="button" className="app-btn btn-primary" disabled style={{ opacity: 0.6 }}>
            Import Key Package (Coming in next phase)
          </button>
        </div>
      </div>
    );
  }

  // Render Fatal Error Screen
  if (startupState === 'FATAL_ERROR') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', padding: '2rem', background: 'var(--bg-app)' }}>
        <div className="card-surface" style={{ maxWidth: '480px', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem', borderLeft: '4px solid var(--color-error)' }}>
          <div style={{ fontSize: '2.5rem', color: 'var(--color-error)' }}>❌ System Crash</div>
          <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Application Load Failure</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Smart Vyapar failed to connect to the database engine runtime.
          </p>
          <pre style={{ background: 'var(--color-error-bg)', padding: '1rem', borderRadius: '6px', overflowX: 'auto', fontSize: '0.85rem', color: 'var(--color-error)', margin: 0 }}>
            {errorMessage}
          </pre>
          <button type="button" onClick={() => window.location.reload()} className="app-btn btn-primary">
            Retry Launch
          </button>
        </div>
      </div>
    );
  }

  // Render Setup Required Screen (First-Run)
  if (startupState === 'SETUP_REQUIRED') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '2rem', background: 'var(--bg-app)' }}>
        <div className="card-surface" style={{ maxWidth: '460px', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <div className="logo-box">V</div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Smart Vyapar Setup</h2>
              <span className="pill-badge badge-connected">🔒 Offline & Secure</span>
            </div>
          </div>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Create your local shop profile to configure the SQLCipher database connection.
          </p>

          <form onSubmit={handleSaveShopProfile} className="form-layout">
            <div className="form-group">
              <label htmlFor="setup-name">Shop Name *</label>
              <input
                id="setup-name"
                type="text"
                className={`form-input ${validationErrors.name ? 'form-input-error' : ''}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Abhijeet Store"
                disabled={submitting}
              />
              {validationErrors.name && <span className="form-error-msg" role="alert">{validationErrors.name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="setup-phone">Contact Phone</label>
              <input
                id="setup-phone"
                type="text"
                className={`form-input ${validationErrors.phone ? 'form-input-error' : ''}`}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                disabled={submitting}
              />
              {validationErrors.phone && <span className="form-error-msg" role="alert">{validationErrors.phone}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="setup-address">Shop Address</label>
              <textarea
                id="setup-address"
                className="form-input"
                style={{ resize: 'vertical', minHeight: '60px', fontFamily: 'inherit' }}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Market Complex Road, Sector 3"
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="setup-gst">GST Number (Optional)</label>
              <input
                id="setup-gst"
                type="text"
                className={`form-input ${validationErrors.gstNumber ? 'form-input-error' : ''}`}
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                placeholder="e.g. 07AAAAA1111A1Z1"
                disabled={submitting}
              />
              {validationErrors.gstNumber && <span className="form-error-msg" role="alert">{validationErrors.gstNumber}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="setup-upi">Merchant UPI ID (Optional)</label>
              <input
                id="setup-upi"
                type="text"
                className="form-input"
                value={merchantUpiId}
                onChange={(e) => setMerchantUpiId(e.target.value)}
                placeholder="e.g. merchant@upi"
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={allowNegativeStockGlobally}
                  onChange={(e) => setAllowNegativeStockGlobally(e.target.checked)}
                  disabled={submitting}
                />
                <span>Allow Negative Stock Globally (ON/OFF)</span>
              </label>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                Products using Inherit Shop Setting can be sold below available stock when this is enabled.
              </span>
            </div>

            <button type="submit" className="app-btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={submitting}>
              {submitting ? 'Persisting Profile...' : 'Initialize Local Database'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Helper for status classes
  const getDbStatusClass = () => {
    return dbStatus?.state === 'CONNECTED' ? 'pill-badge badge-connected' : 'pill-badge badge-offline';
  };

  // Render Main Layout Shell
  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <aside className="app-sidebar">
        <div className="sidebar-logo">
          <div className="logo-box">V</div>
          <span className="app-title-text">Smart Vyapar</span>
        </div>
        <nav className="sidebar-menu">
          <button
            type="button"
            className={`menu-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Dashboard
          </button>
          <button
            type="button"
            className={`menu-item ${activeTab === 'billing' ? 'active' : ''}`}
            onClick={() => setActiveTab('billing')}
          >
            🛒 Billing / POS
          </button>
          <button
            type="button"
            className={`menu-item ${activeTab === 'sales' ? 'active' : ''}`}
            onClick={() => setActiveTab('sales')}
          >
            🧾 Sales History
          </button>
          <button
            type="button"
            className={`menu-item ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            📦 Products
          </button>
          <button
            type="button"
            className={`menu-item ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            📉 Inventory
          </button>
          <button
            type="button"
            className={`menu-item ${activeTab === 'purchases' ? 'active' : ''}`}
            onClick={() => setActiveTab('purchases')}
          >
            💸 Purchases
          </button>
          <button
            type="button"
            className={`menu-item ${activeTab === 'customers' ? 'active' : ''}`}
            onClick={() => setActiveTab('customers')}
          >
            👥 Customers
          </button>
          <button
            type="button"
            className={`menu-item ${activeTab === 'suppliers' ? 'active' : ''}`}
            onClick={() => setActiveTab('suppliers')}
          >
            🏢 Suppliers
          </button>
          <button
            type="button"
            className={`menu-item ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            📥 Data Import
          </button>
          <button
            type="button"
            className={`menu-item coming-soon ${activeTab === 'payments' ? 'active' : ''}`}
            onClick={() => setActiveTab('payments')}
          >
            💳 Payments <span className="menu-item-badge">Soon</span>
          </button>
          <button
            type="button"
            className={`menu-item coming-soon ${activeTab === 'expenses' ? 'active' : ''}`}
            onClick={() => setActiveTab('expenses')}
          >
            💰 Expenses <span className="menu-item-badge">Soon</span>
          </button>
          <button
            type="button"
            className={`menu-item coming-soon ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            📈 Reports <span className="menu-item-badge">Soon</span>
          </button>
          <button
            type="button"
            className={`menu-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ Shop Settings
          </button>
        </nav>
      </aside>

      {/* Main Panel Content */}
      <div className="main-content">
        <header className="app-header">
          <div className="header-left">
            <h2 className="header-title">
              {activeTab === 'dashboard' && 'Dashboard'}
              {activeTab === 'billing' && 'Billing / POS'}
              {activeTab === 'products' && 'Product Master'}
              {activeTab === 'sales' && 'Sales History'}
              {activeTab === 'inventory' && 'Inventory'}
              {activeTab === 'purchases' && 'Purchases'}
              {activeTab === 'suppliers' && 'Suppliers'}
              {activeTab === 'customers' && 'Customer Master'}
              {activeTab === 'settings' && 'Shop Profile Settings'}
              {activeTab === 'import' && 'Bulk Data Import'}
              {activeTab !== 'dashboard' && activeTab !== 'billing' && activeTab !== 'sales' && activeTab !== 'products' && activeTab !== 'inventory' && activeTab !== 'purchases' && activeTab !== 'suppliers' && activeTab !== 'customers' && activeTab !== 'settings' && activeTab !== 'import' && 'Coming Soon'}
            </h2>
            <span className="header-subtitle">{shop?.name}</span>
          </div>
          <div className="header-right">
            <span className="pill-badge badge-offline">🟢 Offline Mode</span>
            <span className={getDbStatusClass()}>
              {dbStatus?.state === 'CONNECTED' ? '🔒 SQLCipher Connected' : '⚠️ Offline'}
            </span>
          </div>
        </header>

        {/* Tab Route Containers */}
        <main className="page-container">
          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* Analytics Section */}
              <div className="dashboard-grid">
                <div className="card-surface">
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Today's Sales</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0.5rem 0' }}>₹0</div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Coming in next phase</span>
                </div>
                <div className="card-surface">
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Today's Bills</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0.5rem 0' }}>0</div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Coming in next phase</span>
                </div>
                <div className="card-surface">
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Low Stock Items</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0.5rem 0' }}>{inventoryDashboard?.lowStockProducts ?? 0}</div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Inventory ledger</span>
                </div>
                <div className="card-surface">
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Customer Outstanding</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0.5rem 0' }}>₹0</div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Coming in next phase</span>
                </div>
                <div className="card-surface">
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Purchase Due</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0.5rem 0' }}>₹0</div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Coming in next phase</span>
                </div>
                <div className="card-surface">
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Expenses Today</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0.5rem 0' }}>₹0</div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Coming in next phase</span>
                </div>
              </div>

              <div className="card-surface">
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>Purchase Snapshot</h3>
                <div className="dashboard-grid">
                  <div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Purchases Today</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>{purchaseDashboard?.purchasesToday ?? 0}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Amount Today</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>Rs {(purchaseDashboard?.purchaseAmountToday ?? 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Drafts</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>{purchaseDashboard?.draftPurchases ?? 0}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Supplier Outstanding</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>Rs {(purchaseDashboard?.supplierOutstanding ?? 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Purchases Due</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>{purchaseDashboard?.purchasesDue ?? 0}</div>
                  </div>
                </div>
              </div>

              {/* Actions Section */}
              <div className="card-surface">
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>Quick Retail Actions</h3>
                <div className="action-grid">
                  <div className="action-btn-placeholder disabled">➕ New POS Bill (Upcoming)</div>
                  <div className="action-btn-placeholder disabled">📦 Add Product (Upcoming)</div>
                  <div className="action-btn-placeholder disabled">🏢 Add Purchase (Upcoming)</div>
                  <div className="action-btn-placeholder disabled">👥 Add Customer (Upcoming)</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="dashboard-grid">
              {/* Form Input Card */}
              <div className="card-surface">
                <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.15rem' }}>Update Profile Details</h3>
                <form onSubmit={handleSaveShopProfile} className="form-layout">
                  <div className="form-group">
                    <label htmlFor="settings-name">Shop Name *</label>
                    <input
                      id="settings-name"
                      type="text"
                      className={`form-input ${validationErrors.name ? 'form-input-error' : ''}`}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={submitting}
                    />
                    {validationErrors.name && <span className="form-error-msg" role="alert">{validationErrors.name}</span>}
                  </div>

                  <div className="form-group">
                    <label htmlFor="settings-phone">Contact Phone</label>
                    <input
                      id="settings-phone"
                      type="text"
                      className={`form-input ${validationErrors.phone ? 'form-input-error' : ''}`}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={submitting}
                    />
                    {validationErrors.phone && <span className="form-error-msg" role="alert">{validationErrors.phone}</span>}
                  </div>

                  <div className="form-group">
                    <label htmlFor="settings-address">Shop Address</label>
                    <textarea
                      id="settings-address"
                      className="form-input"
                      style={{ resize: 'vertical', minHeight: '60px', fontFamily: 'inherit' }}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      disabled={submitting}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="settings-gst">GST Number (Optional)</label>
                    <input
                      id="settings-gst"
                      type="text"
                      className={`form-input ${validationErrors.gstNumber ? 'form-input-error' : ''}`}
                      value={gstNumber}
                      onChange={(e) => setGstNumber(e.target.value)}
                      disabled={submitting}
                    />
                    {validationErrors.gstNumber && <span className="form-error-msg" role="alert">{validationErrors.gstNumber}</span>}
                  </div>

                  <div className="form-group">
                    <label htmlFor="settings-upi">Merchant UPI ID (Optional)</label>
                    <input
                      id="settings-upi"
                      type="text"
                      className="form-input"
                      value={merchantUpiId}
                      onChange={(e) => setMerchantUpiId(e.target.value)}
                      disabled={submitting}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={allowNegativeStockGlobally}
                        onChange={(e) => setAllowNegativeStockGlobally(e.target.checked)}
                        disabled={submitting}
                      />
                      <span>Allow Negative Stock Globally (ON/OFF)</span>
                    </label>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                      Products using Inherit Shop Setting can be sold below available stock when this is enabled.
                    </span>
                  </div>

                  <button type="submit" className="app-btn btn-primary" disabled={submitting}>
                    {submitting ? 'Saving Changes...' : 'Save Profile Changes'}
                  </button>
                </form>
              </div>

              {/* Informational Details Card */}
              <div className="card-surface" style={{ display: 'flex', flexDirection: 'column', justifySelf: 'stretch' }}>
                <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.15rem' }}>Active Database Record</h3>
                {shop && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', flex: 1 }}>
                    <div className="info-row">
                      <span className="info-key">Shop ID</span>
                      <span className="info-val" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{shop.id}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-key">Registered Name</span>
                      <span className="info-val">{shop.name}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-key">Phone</span>
                      <span className="info-val">{shop.phone || 'Not Set'}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-key">Address</span>
                      <span className="info-val">{shop.address || 'Not Set'}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-key">GSTIN</span>
                      <span className="info-val">{shop.gstNumber || 'Not Set'}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-key">Merchant UPI ID</span>
                      <span className="info-val">{shop.merchantUpiId || 'Not Set'}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-key">Created At</span>
                      <span className="info-val">{new Date(shop.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-key">Last Connection Sync</span>
                      <span className="info-val" style={{ color: 'var(--color-success)' }}>{new Date(shop.updatedAt).toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <ProductModule onNavigateToImport={() => {
              setPreselectedImportType('PRODUCT');
              setActiveTab('import');
            }} />
          )}

          {activeTab === 'inventory' && (
            <InventoryModule onNavigateToImport={() => {
              setPreselectedImportType('OPENING_STOCK');
              setActiveTab('import');
            }} />
          )}

          {activeTab === 'purchases' && (
            <PurchaseModule />
          )}

          {activeTab === 'suppliers' && (
            <SupplierModule onNavigateToImport={() => {
              setPreselectedImportType('SUPPLIER');
              setActiveTab('import');
            }} />
          )}

          {activeTab === 'customers' && (
            <CustomerModule />
          )}

          {activeTab === 'billing' && shop && (
            <BillingModule shopId={shop.id} initialInvoiceId={resumeSalesInvoiceId} onInitialInvoiceLoaded={() => setResumeSalesInvoiceId(null)} />
          )}

          {activeTab === 'sales' && shop && (
            <SalesHistoryModule shopId={shop.id} onResume={(invoiceId) => { setResumeSalesInvoiceId(invoiceId); setActiveTab('billing'); }} />
          )}

          {activeTab === 'import' && (
            <BulkImportModule preselectedType={preselectedImportType} onClearPreselect={() => setPreselectedImportType(null)} />
          )}

          {activeTab !== 'dashboard' && activeTab !== 'products' && activeTab !== 'inventory' && activeTab !== 'purchases' && activeTab !== 'suppliers' && activeTab !== 'customers' && activeTab !== 'import' && activeTab !== 'settings' && activeTab !== 'billing' && activeTab !== 'sales' && (
            <div className="coming-soon-container">
              <div className="coming-soon-logo">📦</div>
              <h3 style={{ fontSize: '1.4rem', color: 'white', margin: 0 }}>
                {activeTab.toUpperCase()} Module
              </h3>
              <p style={{ margin: 0, maxWidth: '380px' }}>
                Business parameters and workflows for this module are coming in the next phase of development.
              </p>
              <button type="button" className="app-btn btn-primary" disabled style={{ opacity: 0.6, marginTop: '0.5rem' }}>
                Action Disabled (Upcoming)
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Toast Alert Portal */}
      {toast && (
        <div className={`toast-msg ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`} role="alert">
          <span>{toast.type === 'success' ? '✅' : '❌'}</span>
          <span style={{ fontWeight: 600 }}>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
