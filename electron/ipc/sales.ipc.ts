import { ipcMain } from 'electron';
import { isTrustedSender } from './security';
import { IPC_CHANNELS, IPCResponse } from '../../shared/types/ipc';
import { logError, logInfo } from '../utils/logger';
import { SalesService } from '../services/sales.service';
import { SalesBarcodeResolutionService } from '../services/sales-barcode-resolution.service';
import { POSProductSearchService } from '../services/pos-product-search.service';

const salesService = new SalesService();
const barcodeResolutionService = new SalesBarcodeResolutionService();
const productSearchService = new POSProductSearchService();

export function registerSalesIpc() {
  ipcMain.handle(IPC_CHANNELS.SALES_HISTORY, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      const shopId = typeof payload?.shopId === 'string' ? payload.shopId.trim() : '';
      if (!shopId) return { success: false, error: 'Shop ID is required.' };
      const statuses = ['DRAFT', 'HELD', 'POSTED', 'CANCELLED'];
      const paymentStatuses = ['UNPAID', 'PARTIALLY_PAID', 'PAID'];
      if (payload.status && !statuses.includes(payload.status)) return { success: false, error: 'Invalid sale status.' };
      if (payload.paymentStatus && !paymentStatuses.includes(payload.paymentStatus)) return { success: false, error: 'Invalid payment status.' };
      const page = payload.page === undefined ? 1 : Number(payload.page);
      const pageSize = payload.pageSize === undefined ? 25 : Number(payload.pageSize);
      if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 200) {
        return { success: false, error: 'Invalid pagination.' };
      }
      const result = salesService.listSalesHistory({
        shopId,
        dateFrom: typeof payload.dateFrom === 'string' && payload.dateFrom ? payload.dateFrom : undefined,
        dateTo: typeof payload.dateTo === 'string' && payload.dateTo ? payload.dateTo : undefined,
        invoiceNumber: typeof payload.invoiceNumber === 'string' && payload.invoiceNumber.trim() ? payload.invoiceNumber.trim() : undefined,
        customerId: typeof payload.customerId === 'string' && payload.customerId ? payload.customerId : undefined,
        paymentStatus: payload.paymentStatus || undefined,
        status: payload.status || undefined,
        page,
        pageSize,
      });
      return { success: true, data: result };
    } catch (err: any) {
      logError('IPC sales:history failed', err);
      return { success: false, error: err.message === 'SALE_NOT_FOUND' ? 'SALE_NOT_FOUND' : 'Failed to load sales history.' };
    }
  });

  // Existing Sales Draft (Phase 6.3)
  ipcMain.handle(IPC_CHANNELS.SALES_CREATE_DRAFT, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      if (!payload?.shopId || !payload?.customerId) {
        return { success: false, error: 'Shop ID and Customer ID are required to create a draft.' };
      }
      logInfo('IPC Invoked: sales:createDraft');
      const draft = salesService.createDraft(String(payload.shopId), String(payload.customerId));
      return { success: true, data: draft };
    } catch (err: any) {
      logError('IPC sales:createDraft failed', err);
      return { success: false, error: err.message || 'Failed to create draft sales invoice.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SALES_GET_DRAFT, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      let id = '';
      let shopId: string | undefined;
      if (payload && typeof payload === 'object') {
        id = String(payload.id || '');
        shopId = payload.shopId ? String(payload.shopId) : undefined;
      } else {
        id = String(payload || '');
      }
      if (!id) return { success: false, error: 'Sales invoice ID is required.' };
      logInfo(`IPC Invoked: sales:getDraft for ID: ${id}`);
      const detail = salesService.getDraft(id, shopId);
      return { success: true, data: detail };
    } catch (err: any) {
      logError('IPC sales:getDraft failed', err);
      return { success: false, error: err.message || 'Failed to retrieve sales invoice draft.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SALES_LIST_DRAFTS, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      const shopId = String(payload || '');
      if (!shopId) return { success: false, error: 'Shop ID is required to list drafts.' };
      logInfo(`IPC Invoked: sales:listDrafts for shop: ${shopId}`);
      const list = salesService.listDrafts(shopId);
      return { success: true, data: list };
    } catch (err: any) {
      logError('IPC sales:listDrafts failed', err);
      return { success: false, error: err.message || 'Failed to list sales drafts.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SALES_SAVE_DRAFT, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      const id = String(payload?.id || '');
      const input = payload?.input;
      if (!id) return { success: false, error: 'Sales invoice ID is required.' };
      if (!input || typeof input !== 'object') {
        return { success: false, error: 'Invalid draft payload.' };
      }
      logInfo(`IPC Invoked: sales:saveDraft for ID: ${id}`);
      const updated = salesService.saveDraft(id, input);
      return { success: true, data: updated };
    } catch (err: any) {
      logError('IPC sales:saveDraft failed', err);
      return { success: false, error: err.message || 'Failed to save sales draft.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SALES_HOLD_BILL, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      let id = '';
      let shopId: string | undefined;
      if (payload && typeof payload === 'object') {
        id = String(payload.id || '');
        shopId = payload.shopId ? String(payload.shopId) : undefined;
      } else {
        id = String(payload || '');
      }
      if (!id) return { success: false, error: 'Sales invoice ID is required.' };
      logInfo(`IPC Invoked: sales:holdBill for ID: ${id}`);
      salesService.holdBill(id, shopId);
      return { success: true, data: null };
    } catch (err: any) {
      logError('IPC sales:holdBill failed', err);
      return { success: false, error: err.message || 'Failed to hold sales invoice.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SALES_RESUME_BILL, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      let id = '';
      let shopId: string | undefined;
      if (payload && typeof payload === 'object') {
        id = String(payload.id || '');
        shopId = payload.shopId ? String(payload.shopId) : undefined;
      } else {
        id = String(payload || '');
      }
      if (!id) return { success: false, error: 'Sales invoice ID is required.' };
      logInfo(`IPC Invoked: sales:resumeBill for ID: ${id}`);
      salesService.resumeBill(id, shopId);
      return { success: true, data: null };
    } catch (err: any) {
      logError('IPC sales:resumeBill failed', err);
      return { success: false, error: err.message || 'Failed to resume sales invoice.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SALES_DELETE_DRAFT, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      let id = '';
      let shopId: string | undefined;
      if (payload && typeof payload === 'object') {
        id = String(payload.id || '');
        shopId = payload.shopId ? String(payload.shopId) : undefined;
      } else {
        id = String(payload || '');
      }
      if (!id) return { success: false, error: 'Sales invoice ID is required.' };
      logInfo(`IPC Invoked: sales:deleteDraft for ID: ${id}`);
      salesService.deleteDraft(id, shopId);
      return { success: true, data: null };
    } catch (err: any) {
      logError('IPC sales:deleteDraft failed', err);
      return { success: false, error: err.message || 'Failed to delete sales draft.' };
    }
  });

  // POS / Billing (Phase 6.4) IPC Handlers
  ipcMain.handle(IPC_CHANNELS.POS_SEARCH_PRODUCTS, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      if (!payload?.shopId) return { success: false, error: 'Shop ID is required.' };
      const result = productSearchService.searchPOSProducts({
        shopId: String(payload.shopId),
        query: String(payload.query || ''),
        customerId: payload.customerId ? String(payload.customerId) : undefined,
        draftDate: payload.draftDate ? String(payload.draftDate) : undefined,
        page: payload.page ? Number(payload.page) : undefined,
        pageSize: payload.pageSize ? Number(payload.pageSize) : undefined,
      });
      return { success: true, data: result };
    } catch (err: any) {
      logError('IPC pos:searchProducts failed', err);
      return { success: false, error: err.message || 'Failed to search POS products.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.POS_RESOLVE_BARCODE, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      if (!payload?.shopId || !payload?.barcode) {
        return { success: false, error: 'Shop ID and Barcode are required.' };
      }
      const result = barcodeResolutionService.resolveProductByBarcode({
        shopId: String(payload.shopId),
        barcode: String(payload.barcode),
        customerId: payload.customerId ? String(payload.customerId) : undefined,
        draftDate: payload.draftDate ? String(payload.draftDate) : undefined,
      });
      return { success: true, data: result };
    } catch (err: any) {
      logError('IPC pos:resolveBarcode failed', err);
      return { success: false, error: err.message || 'Failed to resolve barcode.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.POS_LIST_HELD, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      if (!payload?.shopId) return { success: false, error: 'Shop ID is required.' };
      const list = salesService.listHeldBillsForPOS(String(payload.shopId));
      return { success: true, data: list };
    } catch (err: any) {
      logError('IPC pos:listHeld failed', err);
      return { success: false, error: err.message || 'Failed to list held bills.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.POS_REPRICE_CART, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      if (!payload?.invoiceId || !payload?.customerId) {
        return { success: false, error: 'Invoice ID and Customer ID are required.' };
      }
      const result = salesService.repriceCartForCustomer(String(payload.invoiceId), String(payload.customerId));
      return { success: true, data: result };
    } catch (err: any) {
      logError('IPC pos:repriceCart failed', err);
      return { success: false, error: err.message || 'Failed to reprice cart.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.POS_CREATE_DRAFT, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      if (!payload?.shopId || !payload?.customerId) {
        return { success: false, error: 'Shop ID and Customer ID are required.' };
      }
      const draft = salesService.createDraftForPOS(String(payload.shopId), String(payload.customerId));
      return { success: true, data: draft };
    } catch (err: any) {
      logError('IPC pos:createDraft failed', err);
      return { success: false, error: err.message || 'Failed to create POS draft.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.POS_GET_DRAFT, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      const id = String(payload?.id || '');
      const shopId = payload?.shopId ? String(payload.shopId) : undefined;
      if (!id) return { success: false, error: 'Invoice ID is required.' };
      const draft = salesService.getDraftForPOS(id, shopId);
      return { success: true, data: draft };
    } catch (err: any) {
      logError('IPC pos:getDraft failed', err);
      return { success: false, error: err.message || 'Failed to retrieve POS draft.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.POS_SAVE_DRAFT, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      const id = String(payload?.id || '');
      const input = payload?.input;
      if (!id || !input) return { success: false, error: 'Invoice ID and input payload are required.' };
      const updated = salesService.saveDraftFromPOS(id, input);
      return { success: true, data: updated };
    } catch (err: any) {
      logError('IPC pos:saveDraft failed', err);
      return { success: false, error: err.message || 'Failed to save POS draft.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.POS_ADD_LINE, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      const id = String(payload?.id || '');
      const input = payload?.input;
      if (!id || !input) return { success: false, error: 'Invoice ID and input line details are required.' };
      const updated = salesService.addDraftLine(id, input);
      return { success: true, data: updated };
    } catch (err: any) {
      logError('IPC pos:addLine failed', err);
      return { success: false, error: err.message || 'Failed to add line item.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.POS_UPDATE_LINE, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      const id = String(payload?.id || '');
      const lineId = String(payload?.lineId || '');
      const input = payload?.input;
      if (!id || !lineId || !input) return { success: false, error: 'Invoice ID, Line ID and input line details are required.' };
      const updated = salesService.updateDraftLine(id, lineId, input);
      return { success: true, data: updated };
    } catch (err: any) {
      logError('IPC pos:updateLine failed', err);
      return { success: false, error: err.message || 'Failed to update line item.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.POS_REMOVE_LINE, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      const id = String(payload?.id || '');
      const lineId = String(payload?.lineId || '');
      if (!id || !lineId) return { success: false, error: 'Invoice ID and Line ID are required.' };
      const updated = salesService.removeDraftLine(id, lineId);
      return { success: true, data: updated };
    } catch (err: any) {
      logError('IPC pos:removeLine failed', err);
      return { success: false, error: err.message || 'Failed to remove line item.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.POS_HOLD_BILL, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      const id = String(payload?.id || '');
      const shopId = payload?.shopId ? String(payload.shopId) : undefined;
      if (!id) return { success: false, error: 'Invoice ID is required.' };
      salesService.holdBill(id, shopId);
      return { success: true, data: null };
    } catch (err: any) {
      logError('IPC pos:holdBill failed', err);
      return { success: false, error: err.message || 'Failed to hold POS draft.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.POS_RESUME_BILL, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      const id = String(payload?.id || '');
      const shopId = payload?.shopId ? String(payload.shopId) : undefined;
      if (!id) return { success: false, error: 'Invoice ID is required.' };
      const draft = salesService.resumeBillForPOS(id, shopId);
      return { success: true, data: draft };
    } catch (err: any) {
      logError('IPC pos:resumeBill failed', err);
      return { success: false, error: err.message || 'Failed to resume POS draft.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.POS_DELETE_DRAFT, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      const id = String(payload?.id || '');
      const shopId = payload?.shopId ? String(payload.shopId) : undefined;
      if (!id) return { success: false, error: 'Invoice ID is required.' };
      salesService.deleteDraft(id, shopId);
      return { success: true, data: null };
    } catch (err: any) {
      logError('IPC pos:deleteDraft failed', err);
      return { success: false, error: err.message || 'Failed to delete POS draft.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.POS_POST_SALE, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      const id = String(payload?.id || '');
      const payments = payload?.payments;
      const version = Number(payload?.version);
      const paymentContext = payload?.paymentContext;

      if (!id) return { success: false, error: 'Invoice ID is required.' };
      if (!Array.isArray(payments)) return { success: false, error: 'Payments array is required.' };
      if (isNaN(version)) return { success: false, error: 'Version is required.' };

      logInfo(`IPC Invoked: pos:postSale for ID: ${id}`);
      const posted = salesService.postSale(id, payments, version, paymentContext);
      return { success: true, data: posted };
    } catch (err: any) {
      logError('IPC pos:postSale failed', err);
      return { success: false, error: err.message || 'Failed to post POS sale.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.POS_CALCULATE_CART, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      const { shopId, customerId, lines, invoiceDiscountType, invoiceDiscountValue } = payload || {};
      if (!shopId) return { success: false, error: 'Shop ID is required.' };
      if (!customerId) return { success: false, error: 'Customer ID is required.' };
      if (!Array.isArray(lines)) return { success: false, error: 'Lines must be an array.' };

      const cart = salesService.calculatePOSCartInMem(shopId, customerId, lines, invoiceDiscountType || 'NONE', invoiceDiscountValue || 0);
      return { success: true, data: cart };
    } catch (err: any) {
      logError('IPC pos:calculateCart failed', err);
      return { success: false, error: err.message || 'Failed to calculate POS cart.' };
    }
  });
}
