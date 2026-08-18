import { ipcMain } from 'electron';
import { isTrustedSender } from './security';
import {
  IPC_CHANNELS,
  IPCResponse,
  PurchaseFilter,
  SupplierFilter,
} from '../../shared/types/ipc';
import { logError, logInfo } from '../utils/logger';
import { SupplierService } from '../services/supplier.service';
import { PurchaseService } from '../services/purchase.service';
import { SupplierLedgerService } from '../services/supplier-ledger.service';

const supplierService = new SupplierService();
const purchaseService = new PurchaseService();
const supplierLedgerService = new SupplierLedgerService();

function supplierFilter(payload: any): SupplierFilter {
  return {
    search: typeof payload?.search === 'string' ? payload.search : undefined,
    isActive: typeof payload?.isActive === 'boolean' ? payload.isActive : undefined,
    page: typeof payload?.page === 'number' && payload.page > 0 ? payload.page : 1,
    pageSize: typeof payload?.pageSize === 'number' && payload.pageSize > 0 && payload.pageSize <= 200 ? payload.pageSize : 25,
    sortBy: ['supplierCode', 'name', 'city', 'outstanding', 'updatedAt'].includes(payload?.sortBy) ? payload.sortBy : 'name',
    sortDirection: payload?.sortDirection === 'DESC' ? 'DESC' : 'ASC',
  };
}

function purchaseFilter(payload: any): PurchaseFilter {
  return {
    search: typeof payload?.search === 'string' ? payload.search : undefined,
    supplierId: typeof payload?.supplierId === 'string' ? payload.supplierId : undefined,
    status: ['DRAFT', 'POSTED', 'CANCELLED'].includes(payload?.status) ? payload.status : undefined,
    dateFrom: typeof payload?.dateFrom === 'string' ? payload.dateFrom : undefined,
    dateTo: typeof payload?.dateTo === 'string' ? payload.dateTo : undefined,
    page: typeof payload?.page === 'number' && payload.page > 0 ? payload.page : 1,
    pageSize: typeof payload?.pageSize === 'number' && payload.pageSize > 0 && payload.pageSize <= 200 ? payload.pageSize : 25,
    sortBy: ['invoiceDate', 'purchaseNumber', 'supplierName', 'grandTotal', 'updatedAt'].includes(payload?.sortBy) ? payload.sortBy : 'invoiceDate',
    sortDirection: payload?.sortDirection === 'ASC' ? 'ASC' : 'DESC',
  };
}

export function registerSupplierPurchaseIpc() {
  ipcMain.handle(IPC_CHANNELS.SUPPLIER_LIST, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      return { success: true, data: supplierService.listSuppliers(supplierFilter(payload)) };
    } catch (err: any) {
      logError('IPC supplier:list failed', err);
      return { success: false, error: err.message || 'Failed to list suppliers.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SUPPLIER_GET_BY_ID, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      return { success: true, data: supplierService.getSupplierById(String(payload || '')) };
    } catch (err: any) {
      logError('IPC supplier:getById failed', err);
      return { success: false, error: err.message || 'Failed to get supplier.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SUPPLIER_CREATE, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      if (!payload || typeof payload !== 'object') return { success: false, error: 'Invalid supplier payload.' };
      logInfo('IPC Invoked: supplier:create');
      return { success: true, data: supplierService.createSupplier(payload) };
    } catch (err: any) {
      logError('IPC supplier:create failed', err);
      return { success: false, error: err.message || 'Failed to create supplier.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SUPPLIER_UPDATE, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      if (!payload?.id) return { success: false, error: 'Supplier ID is required.' };
      const { id, ...input } = payload;
      return { success: true, data: supplierService.updateSupplier(id, input) };
    } catch (err: any) {
      logError('IPC supplier:update failed', err);
      return { success: false, error: err.message || 'Failed to update supplier.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SUPPLIER_SET_ACTIVE, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      if (!payload?.id || typeof payload.isActive !== 'boolean') return { success: false, error: 'Invalid supplier status payload.' };
      return { success: true, data: supplierService.setSupplierActive(payload.id, payload.isActive) };
    } catch (err: any) {
      logError('IPC supplier:setActive failed', err);
      return { success: false, error: err.message || 'Failed to update supplier status.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SUPPLIER_OUTSTANDING, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      return { success: true, data: supplierLedgerService.outstanding(String(payload || '')) };
    } catch (err: any) {
      logError('IPC supplier:outstanding failed', err);
      return { success: false, error: err.message || 'Failed to load supplier outstanding.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.PURCHASE_LIST, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      return { success: true, data: purchaseService.listPurchases(purchaseFilter(payload)) };
    } catch (err: any) {
      logError('IPC purchase:list failed', err);
      return { success: false, error: err.message || 'Failed to list purchases.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.PURCHASE_GET_BY_ID, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      return { success: true, data: purchaseService.getPurchaseById(String(payload || '')) };
    } catch (err: any) {
      logError('IPC purchase:getById failed', err);
      return { success: false, error: err.message || 'Failed to get purchase.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.PURCHASE_CREATE_DRAFT, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      return { success: true, data: purchaseService.createPurchaseDraft(payload) };
    } catch (err: any) {
      logError('IPC purchase:createDraft failed', err);
      return { success: false, error: err.message || 'Failed to create purchase draft.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.PURCHASE_UPDATE_DRAFT, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      if (!payload?.id) return { success: false, error: 'Purchase ID is required.' };
      const { id, ...input } = payload;
      return { success: true, data: purchaseService.updatePurchaseDraft(id, input) };
    } catch (err: any) {
      logError('IPC purchase:updateDraft failed', err);
      return { success: false, error: err.message || 'Failed to update purchase draft.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.PURCHASE_DELETE_DRAFT, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      purchaseService.deletePurchaseDraft(String(payload || ''));
      return { success: true, data: true };
    } catch (err: any) {
      logError('IPC purchase:deleteDraft failed', err);
      return { success: false, error: err.message || 'Failed to delete purchase draft.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.PURCHASE_CALCULATE, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      return { success: true, data: purchaseService.calculatePurchase(payload) };
    } catch (err: any) {
      logError('IPC purchase:calculate failed', err);
      return { success: false, error: err.message || 'Failed to calculate purchase.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.PURCHASE_POST, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      return { success: true, data: purchaseService.postPurchase(String(payload || '')) };
    } catch (err: any) {
      logError('IPC purchase:post failed', err);
      return { success: false, error: err.message || 'Failed to post purchase.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.PURCHASE_CANCEL, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      if (!payload?.id) return { success: false, error: 'Purchase ID is required.' };
      return { success: true, data: purchaseService.cancelPurchase(payload.id, { reason: String(payload.reason || '') }) };
    } catch (err: any) {
      logError('IPC purchase:cancel failed', err);
      return { success: false, error: err.message || 'Failed to cancel purchase.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.PURCHASE_DASHBOARD, async (event): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      return { success: true, data: purchaseService.getPurchaseDashboardSummary() };
    } catch (err: any) {
      logError('IPC purchase:dashboard failed', err);
      return { success: false, error: err.message || 'Failed to load purchase dashboard.' };
    }
  });

  logInfo('Supplier and Purchase IPC handlers registered.');
}
