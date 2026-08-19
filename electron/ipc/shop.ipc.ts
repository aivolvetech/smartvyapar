import { ipcMain } from 'electron';
import { ShopService } from '../services/shop.service';
import { isTrustedSender } from './security';
import { IPC_CHANNELS, IPCResponse, ShopData, ShopCreateInput } from '../../shared/types/ipc';
import { logError, logInfo } from '../utils/logger';

const shopService = new ShopService();

export function registerShopIpc() {
  ipcMain.handle(IPC_CHANNELS.SHOP_GET, async (event): Promise<IPCResponse<ShopData | null>> => {
    if (!isTrustedSender(event)) {
      return { success: false, error: 'Access denied: Untrusted application frame.' };
    }
    
    try {
      logInfo('IPC Invoked: shop:get');
      const shop = await shopService.getShop();
      return { success: true, data: shop };
    } catch (err) {
      logError('IPC shop:get failed', err);
      return { success: false, error: 'The local database could not be read.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SHOP_CREATE, async (event, payload: any): Promise<IPCResponse<ShopData>> => {
    if (!isTrustedSender(event)) {
      return { success: false, error: 'Access denied: Untrusted application frame.' };
    }
    
    try {
      // Don't log full sensitive payloads (even if it's just shop name, it's good practice)
      logInfo('IPC Invoked: shop:create');
      
      // Runtime validation
      if (!payload || typeof payload !== 'object') {
        return { success: false, error: 'Invalid data format submitted.' };
      }
      
      const { name, phone, address, gstNumber } = payload;
      
      if (typeof name !== 'string' || name.trim() === '') {
        return { success: false, error: 'Shop name is required and must be non-empty.' };
      }

      if (phone !== undefined && phone !== null && typeof phone !== 'string') {
        return { success: false, error: 'Shop phone must be a text value.' };
      }

      if (address !== undefined && address !== null && typeof address !== 'string') {
        return { success: false, error: 'Shop address must be a text value.' };
      }

      if (gstNumber !== undefined && gstNumber !== null && typeof gstNumber !== 'string') {
        return { success: false, error: 'Shop GST number must be a text value.' };
      }

      const merchantUpiId = payload.merchantUpiId;
      if (merchantUpiId !== undefined && merchantUpiId !== null && typeof merchantUpiId !== 'string') {
        return { success: false, error: 'Merchant UPI ID must be a text value.' };
      }

      const allowNegativeStockGlobally = payload.allowNegativeStockGlobally !== undefined ? Boolean(payload.allowNegativeStockGlobally) : undefined;

      const input: ShopCreateInput = {
        name: name.trim(),
        phone: phone ? phone.trim() : undefined,
        address: address ? address.trim() : undefined,
        gstNumber: gstNumber ? gstNumber.trim() : undefined,
        merchantUpiId: merchantUpiId ? merchantUpiId.trim() : undefined,
        allowNegativeStockGlobally,
      };

      const result = await shopService.createOrUpdateShop(input);
      return { success: true, data: result };
    } catch (err) {
      logError('IPC shop:create failed', err);
      return { success: false, error: 'The shop details could not be saved to the database.' };
    }
  });
}
