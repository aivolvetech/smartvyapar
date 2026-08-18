import { ShopRepository } from '../database/repositories/shop.repository';
import { ShopData, ShopCreateInput } from '../../shared/types/ipc';

export class ShopService {
  private repository = new ShopRepository();

  public async getShop(): Promise<ShopData | null> {
    const shop = this.repository.getShop();
    if (!shop) return null;

    return {
      id: shop.id,
      name: shop.name,
      phone: shop.phone || null,
      address: shop.address || null,
      gstNumber: shop.gstNumber || null,
      merchantUpiId: shop.merchantUpiId || null,
      createdAt: shop.createdAt,
      updatedAt: shop.updatedAt,
    };
  }

  public async createOrUpdateShop(input: ShopCreateInput): Promise<ShopData> {
    if (!input.name || input.name.trim() === '') {
      throw new Error('Shop name is required.');
    }

    const existing = this.repository.getShop();
    let shop;
    if (existing) {
      shop = this.repository.updateShop({
        name: input.name,
        phone: input.phone || null,
        address: input.address || null,
        gstNumber: input.gstNumber || null,
        merchantUpiId: input.merchantUpiId || null,
      });
    } else {
      shop = this.repository.createShop({
        name: input.name,
        phone: input.phone,
        address: input.address,
        gstNumber: input.gstNumber,
        merchantUpiId: input.merchantUpiId,
      });
    }

    // Programmatically ensure the system Walk-In Customer exists for this shop
    const { CustomerService } = require('./customer.service');
    const customerService = new CustomerService();
    customerService.ensureWalkInCustomer(shop.id);

    return {
      id: shop.id,
      name: shop.name,
      phone: shop.phone || null,
      address: shop.address || null,
      gstNumber: shop.gstNumber || null,
      merchantUpiId: shop.merchantUpiId || null,
      createdAt: shop.createdAt,
      updatedAt: shop.updatedAt,
    };
  }
}
