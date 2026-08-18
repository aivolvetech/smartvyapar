import { ipcMain } from 'electron';
import { isTrustedSender } from './security';
import { IPC_CHANNELS, IPCResponse, ProductListFilter } from '../../shared/types/ipc';
import { logError, logInfo } from '../utils/logger';

import { UnitOfMeasureService }    from '../services/unit-of-measure.service';
import { ProductCategoryService }  from '../services/product-category.service';
import { BrandService }            from '../services/brand.service';
import { TaxRateService }          from '../services/tax-rate.service';
import { ProductService }          from '../services/product.service';

const unitService     = new UnitOfMeasureService();
const categoryService = new ProductCategoryService();
const brandService    = new BrandService();
const taxRateService  = new TaxRateService();
const productService  = new ProductService();

export function registerProductIpc() {

  // ---- Unit of Measure ----
  ipcMain.handle(IPC_CHANNELS.UNIT_LIST, async (event, payload?: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      const units = await unitService.listUnits(payload?.activeOnly ?? false);
      return { success: true, data: units };
    } catch (err) {
      logError('IPC unit:list failed', err);
      return { success: false, error: 'Failed to load units of measure.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.UNIT_CREATE, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      if (!payload || typeof payload !== 'object') return { success: false, error: 'Invalid payload.' };
      logInfo('IPC Invoked: unit:create');
      const result = await unitService.createUnit(payload);
      return { success: true, data: result };
    } catch (err: any) {
      logError('IPC unit:create failed', err);
      return { success: false, error: err.message || 'Failed to create unit.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.UNIT_UPDATE, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      if (!payload?.id || typeof payload !== 'object') return { success: false, error: 'Invalid payload.' };
      const { id, ...input } = payload;
      logInfo(`IPC Invoked: unit:update ${id}`);
      const result = await unitService.updateUnit(id, input);
      return { success: true, data: result };
    } catch (err: any) {
      logError('IPC unit:update failed', err);
      return { success: false, error: err.message || 'Failed to update unit.' };
    }
  });

  // ---- Category ----
  ipcMain.handle(IPC_CHANNELS.CATEGORY_LIST, async (event, payload?: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      const cats = await categoryService.listCategories(payload?.activeOnly ?? false);
      return { success: true, data: cats };
    } catch (err) {
      logError('IPC category:list failed', err);
      return { success: false, error: 'Failed to load categories.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.CATEGORY_CREATE, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      if (!payload || typeof payload !== 'object') return { success: false, error: 'Invalid payload.' };
      logInfo('IPC Invoked: category:create');
      const result = await categoryService.createCategory(payload);
      return { success: true, data: result };
    } catch (err: any) {
      logError('IPC category:create failed', err);
      return { success: false, error: err.message || 'Failed to create category.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.CATEGORY_UPDATE, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      if (!payload?.id) return { success: false, error: 'Invalid payload.' };
      const { id, ...input } = payload;
      logInfo(`IPC Invoked: category:update ${id}`);
      const result = await categoryService.updateCategory(id, input);
      return { success: true, data: result };
    } catch (err: any) {
      logError('IPC category:update failed', err);
      return { success: false, error: err.message || 'Failed to update category.' };
    }
  });

  // ---- Brand ----
  ipcMain.handle(IPC_CHANNELS.BRAND_LIST, async (event, payload?: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      const brands = await brandService.listBrands(payload?.activeOnly ?? false);
      return { success: true, data: brands };
    } catch (err) {
      logError('IPC brand:list failed', err);
      return { success: false, error: 'Failed to load brands.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.BRAND_CREATE, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      if (!payload || typeof payload !== 'object') return { success: false, error: 'Invalid payload.' };
      logInfo('IPC Invoked: brand:create');
      const result = await brandService.createBrand(payload);
      return { success: true, data: result };
    } catch (err: any) {
      logError('IPC brand:create failed', err);
      return { success: false, error: err.message || 'Failed to create brand.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.BRAND_UPDATE, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      if (!payload?.id) return { success: false, error: 'Invalid payload.' };
      const { id, ...input } = payload;
      logInfo(`IPC Invoked: brand:update ${id}`);
      const result = await brandService.updateBrand(id, input);
      return { success: true, data: result };
    } catch (err: any) {
      logError('IPC brand:update failed', err);
      return { success: false, error: err.message || 'Failed to update brand.' };
    }
  });

  // ---- Tax Rate ----
  ipcMain.handle(IPC_CHANNELS.TAX_RATE_LIST, async (event, payload?: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      const rates = await taxRateService.listTaxRates(payload?.activeOnly ?? false);
      return { success: true, data: rates };
    } catch (err) {
      logError('IPC taxRate:list failed', err);
      return { success: false, error: 'Failed to load tax rates.' };
    }
  });

  // ---- Product ----
  ipcMain.handle(IPC_CHANNELS.PRODUCT_LIST, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      if (!payload || typeof payload !== 'object') return { success: false, error: 'Invalid filter payload.' };
      const filter: ProductListFilter = {
        search:      typeof payload.search === 'string' ? payload.search : undefined,
        barcode:     typeof payload.barcode === 'string' ? payload.barcode : undefined,
        categoryId:  typeof payload.categoryId === 'string' ? payload.categoryId : undefined,
        brandId:     typeof payload.brandId === 'string' ? payload.brandId : undefined,
        isActive:    typeof payload.isActive === 'boolean' ? payload.isActive : undefined,
        productType: payload.productType === 'GOODS' || payload.productType === 'SERVICE' ? payload.productType : undefined,
        page:        typeof payload.page === 'number' && payload.page > 0 ? payload.page : 1,
        pageSize:    typeof payload.pageSize === 'number' && payload.pageSize > 0 && payload.pageSize <= 200 ? payload.pageSize : 50,
        sortBy:      ['name','productCode','sellingPrice','mrp','createdAt','updatedAt'].includes(payload.sortBy) ? payload.sortBy : 'name',
        sortDirection: payload.sortDirection === 'DESC' ? 'DESC' : 'ASC',
      };
      const result = await productService.listProducts(filter);
      return { success: true, data: result };
    } catch (err: any) {
      logError('IPC product:list failed', err);
      return { success: false, error: err.message || 'Failed to list products.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.PRODUCT_GET_BY_ID, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      if (typeof payload !== 'string' || !payload) return { success: false, error: 'Product ID required.' };
      logInfo(`IPC Invoked: product:getById ${payload}`);
      const product = await productService.getProductById(payload);
      return { success: true, data: product };
    } catch (err: any) {
      logError('IPC product:getById failed', err);
      return { success: false, error: err.message || 'Failed to get product.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.PRODUCT_GET_BY_BARCODE, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      if (typeof payload !== 'string' || !payload) return { success: false, error: 'Barcode required.' };
      const product = await productService.getProductByBarcode(payload);
      return { success: true, data: product };
    } catch (err: any) {
      logError('IPC product:getByBarcode failed', err);
      return { success: false, error: err.message || 'Failed to find product by barcode.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.PRODUCT_CREATE, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      if (!payload || typeof payload !== 'object') return { success: false, error: 'Invalid creation payload.' };
      if (!payload.product || !payload.defaultPrice) return { success: false, error: 'product and defaultPrice are required.' };
      logInfo('IPC Invoked: product:create');
      const result = await productService.createProduct(payload);
      return { success: true, data: result };
    } catch (err: any) {
      logError('IPC product:create failed', err);
      return { success: false, error: err.message || 'Failed to create product.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.PRODUCT_UPDATE, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      if (!payload?.id || !payload?.product) return { success: false, error: 'Invalid update payload.' };
      logInfo(`IPC Invoked: product:update ${payload.id}`);
      const { id, ...request } = payload;
      const result = await productService.updateProduct(id, request);
      return { success: true, data: result };
    } catch (err: any) {
      logError('IPC product:update failed', err);
      return { success: false, error: err.message || 'Failed to update product.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.PRODUCT_SET_ACTIVE, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      if (!payload?.id || typeof payload.isActive !== 'boolean') return { success: false, error: 'Invalid payload.' };
      logInfo(`IPC Invoked: product:setActive ${payload.id} → ${payload.isActive}`);
      const result = await productService.setProductActive(payload.id, payload.isActive);
      return { success: true, data: result };
    } catch (err: any) {
      logError('IPC product:setActive failed', err);
      return { success: false, error: err.message || 'Failed to update product status.' };
    }
  });

  logInfo('Product IPC handlers registered.');
}
