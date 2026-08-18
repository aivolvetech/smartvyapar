import { ipcMain } from 'electron';
import { isTrustedSender } from './security';
import {
  CreateInventoryAdjustmentInput,
  InventoryMovementFilter,
  InventorySummaryFilter,
  IPC_CHANNELS,
  IPCResponse,
} from '../../shared/types/ipc';
import { InventoryService } from '../services/inventory.service';
import { logError, logInfo } from '../utils/logger';

const inventoryService = new InventoryService();
const summarySort = ['productCode', 'productName', 'quantityOnHand', 'lastMovementAt'];
const movementSort = ['occurredAt', 'postedAt', 'productCode', 'transactionType', 'quantity'];
const movementTypes = ['OPENING', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGE_OUT', 'EXPIRY_OUT', 'LOSS_OUT', 'PURCHASE_IN', 'SALE_OUT', 'SALE_RETURN_IN', 'PURCHASE_RETURN_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'REVERSAL'];
const stockStatuses = ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'NEGATIVE_STOCK', 'OVER_STOCK'];

function page(value: any): number {
  return typeof value === 'number' && value > 0 ? Math.floor(value) : 1;
}

function pageSize(value: any): number {
  return typeof value === 'number' && value > 0 && value <= 200 ? Math.floor(value) : 25;
}

export function registerInventoryIpc() {
  ipcMain.handle(IPC_CHANNELS.INVENTORY_SUMMARY, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      const filter: InventorySummaryFilter = {
        search: typeof payload?.search === 'string' ? payload.search : undefined,
        categoryId: typeof payload?.categoryId === 'string' ? payload.categoryId : undefined,
        stockStatus: stockStatuses.includes(payload?.stockStatus) ? payload.stockStatus : undefined,
        isActive: typeof payload?.isActive === 'boolean' ? payload.isActive : true,
        page: page(payload?.page),
        pageSize: pageSize(payload?.pageSize),
        sortBy: summarySort.includes(payload?.sortBy) ? payload.sortBy : 'productCode',
        sortDirection: payload?.sortDirection === 'DESC' ? 'DESC' : 'ASC',
      };
      return { success: true, data: inventoryService.getInventorySummary(filter) };
    } catch (err: any) {
      logError('IPC inventory:summary failed', err);
      return { success: false, error: err.message || 'Failed to load inventory summary.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.INVENTORY_PRODUCT_STOCK, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      if (typeof payload !== 'string' || !payload.trim()) return { success: false, error: 'Product ID is required.' };
      return { success: true, data: inventoryService.getProductStock(payload) };
    } catch (err: any) {
      logError('IPC inventory:productStock failed', err);
      return { success: false, error: err.message || 'Failed to load product stock.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.INVENTORY_MOVEMENTS, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      const filter: InventoryMovementFilter = {
        productId: typeof payload?.productId === 'string' ? payload.productId : undefined,
        search: typeof payload?.search === 'string' ? payload.search : undefined,
        transactionType: movementTypes.includes(payload?.transactionType) ? payload.transactionType : undefined,
        referenceNumber: typeof payload?.referenceNumber === 'string' ? payload.referenceNumber : undefined,
        dateFrom: typeof payload?.dateFrom === 'string' ? payload.dateFrom : undefined,
        dateTo: typeof payload?.dateTo === 'string' ? payload.dateTo : undefined,
        reversed: typeof payload?.reversed === 'boolean' ? payload.reversed : undefined,
        page: page(payload?.page),
        pageSize: pageSize(payload?.pageSize),
        sortBy: movementSort.includes(payload?.sortBy) ? payload.sortBy : 'occurredAt',
        sortDirection: payload?.sortDirection === 'ASC' ? 'ASC' : 'DESC',
      };
      return { success: true, data: inventoryService.getInventoryMovements(filter) };
    } catch (err: any) {
      logError('IPC inventory:movements failed', err);
      return { success: false, error: err.message || 'Failed to load inventory movements.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.INVENTORY_POST_OPENING, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      logInfo('IPC Invoked: inventory:postOpening');
      return { success: true, data: inventoryService.postOpeningStock(payload) };
    } catch (err: any) {
      logError('IPC inventory:postOpening failed', err);
      return { success: false, error: err.message || 'Failed to post opening stock.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.INVENTORY_POST_ADJUSTMENT, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      if (!['ADJUSTMENT_IN', 'ADJUSTMENT_OUT'].includes(payload?.adjustmentType)) {
        return { success: false, error: 'Invalid adjustment type.' };
      }
      const input: CreateInventoryAdjustmentInput = payload;
      logInfo(`IPC Invoked: inventory:postAdjustment ${input.adjustmentType}`);
      return { success: true, data: inventoryService.postAdjustment(input) };
    } catch (err: any) {
      logError('IPC inventory:postAdjustment failed', err);
      return { success: false, error: err.message || 'Failed to post stock adjustment.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.INVENTORY_POST_DAMAGE, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      logInfo('IPC Invoked: inventory:postDamage');
      return { success: true, data: inventoryService.postDamage(payload) };
    } catch (err: any) {
      logError('IPC inventory:postDamage failed', err);
      return { success: false, error: err.message || 'Failed to post damaged stock.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.INVENTORY_POST_EXPIRY, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      logInfo('IPC Invoked: inventory:postExpiry');
      return { success: true, data: inventoryService.postExpiry(payload) };
    } catch (err: any) {
      logError('IPC inventory:postExpiry failed', err);
      return { success: false, error: err.message || 'Failed to post expired stock.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.INVENTORY_POST_LOSS, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      logInfo('IPC Invoked: inventory:postLoss');
      return { success: true, data: inventoryService.postLoss(payload) };
    } catch (err: any) {
      logError('IPC inventory:postLoss failed', err);
      return { success: false, error: err.message || 'Failed to post lost stock.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.INVENTORY_REVERSE, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      logInfo('IPC Invoked: inventory:reverse');
      return { success: true, data: inventoryService.reverseTransaction(payload) };
    } catch (err: any) {
      logError('IPC inventory:reverse failed', err);
      return { success: false, error: err.message || 'Failed to reverse inventory transaction.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.INVENTORY_DASHBOARD, async (event): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      return { success: true, data: inventoryService.getInventoryDashboardSummary() };
    } catch (err: any) {
      logError('IPC inventory:dashboard failed', err);
      return { success: false, error: err.message || 'Failed to load inventory dashboard.' };
    }
  });

  logInfo('Inventory IPC handlers registered.');
}

