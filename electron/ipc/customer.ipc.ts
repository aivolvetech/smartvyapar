import { ipcMain } from 'electron';
import { isTrustedSender } from './security';
import { IPC_CHANNELS, IPCResponse, CustomerFilter } from '../../shared/types/ipc';
import { logError, logInfo } from '../utils/logger';
import { CustomerService } from '../services/customer.service';
import { CustomerLedgerService } from '../services/customer-ledger.service';

const customerService = new CustomerService();
const ledgerService = new CustomerLedgerService();

function customerFilter(payload: any): CustomerFilter {
  return {
    search: typeof payload?.search === 'string' ? payload.search : undefined,
    customerType: ['WALK_IN', 'RETAIL', 'WHOLESALE', 'DISTRIBUTOR', 'CORPORATE'].includes(payload?.customerType)
      ? payload.customerType
      : undefined,
    isActive: typeof payload?.isActive === 'boolean' ? payload.isActive : undefined,
    outstandingState: ['ALL', 'DUE', 'ADVANCE', 'ZERO'].includes(payload?.outstandingState)
      ? payload.outstandingState
      : 'ALL',
    page: typeof payload?.page === 'number' && payload.page > 0 ? payload.page : 1,
    pageSize: typeof payload?.pageSize === 'number' && payload.pageSize > 0 && payload.pageSize <= 200
      ? payload.pageSize
      : 25,
    sortBy: ['customerCode', 'name', 'customerType', 'outstanding', 'updatedAt'].includes(payload?.sortBy)
      ? payload.sortBy
      : 'name',
    sortDirection: payload?.sortDirection === 'DESC' ? 'DESC' : 'ASC',
  };
}

export function registerCustomerIpc() {
  ipcMain.handle(IPC_CHANNELS.CUSTOMER_LIST, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      return { success: true, data: customerService.listCustomers(customerFilter(payload)) };
    } catch (err: any) {
      logError('IPC customer:list failed', err);
      return { success: false, error: err.message || 'Failed to list customers.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.CUSTOMER_GET_BY_ID, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      return { success: true, data: customerService.getCustomerById(String(payload || '')) };
    } catch (err: any) {
      logError('IPC customer:getById failed', err);
      return { success: false, error: err.message || 'Failed to retrieve customer details.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.CUSTOMER_CREATE, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      if (!payload || typeof payload !== 'object') return { success: false, error: 'Invalid customer payload.' };
      logInfo('IPC Invoked: customer:create');
      return { success: true, data: customerService.createCustomer(payload) };
    } catch (err: any) {
      logError('IPC customer:create failed', err);
      return { success: false, error: err.message || 'Failed to create customer.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.CUSTOMER_UPDATE, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      if (!payload?.id) return { success: false, error: 'Customer ID is required.' };
      const { id, ...input } = payload;
      logInfo('IPC Invoked: customer:update');
      return { success: true, data: customerService.updateCustomer(id, input) };
    } catch (err: any) {
      logError('IPC customer:update failed', err);
      return { success: false, error: err.message || 'Failed to update customer.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.CUSTOMER_SET_ACTIVE, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      if (!payload?.id || typeof payload.isActive !== 'boolean') return { success: false, error: 'Invalid customer status payload.' };
      return { success: true, data: customerService.setCustomerActive(payload.id, payload.isActive) };
    } catch (err: any) {
      logError('IPC customer:setActive failed', err);
      return { success: false, error: err.message || 'Failed to update customer status.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.CUSTOMER_OUTSTANDING, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      return { success: true, data: ledgerService.outstanding(String(payload || '')) };
    } catch (err: any) {
      logError('IPC customer:outstanding failed', err);
      return { success: false, error: err.message || 'Failed to retrieve outstanding.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.CUSTOMER_LEDGER, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      if (!payload?.customerId) return { success: false, error: 'Customer ID is required.' };
      const page = typeof payload.page === 'number' && payload.page > 0 ? payload.page : 1;
      const pageSize = typeof payload.pageSize === 'number' && payload.pageSize > 0 ? payload.pageSize : 25;
      return { success: true, data: ledgerService.getCustomerLedger(payload.customerId, { page, pageSize }) };
    } catch (err: any) {
      logError('IPC customer:ledger failed', err);
      return { success: false, error: err.message || 'Failed to retrieve ledger.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.CUSTOMER_POST_OPENING, async (event, payload: any): Promise<IPCResponse<any>> => {
    if (!isTrustedSender(event)) return { success: false, error: 'Access denied.' };
    try {
      if (!payload || typeof payload !== 'object') return { success: false, error: 'Invalid opening balance payload.' };
      return { success: true, data: ledgerService.postOpeningBalance(payload) };
    } catch (err: any) {
      logError('IPC customer:postOpening failed', err);
      return { success: false, error: err.message || 'Failed to post opening balance.' };
    }
  });
}
