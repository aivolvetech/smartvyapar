/**
 * OpeningBalanceService — explicit ownership of opening stock persistence.
 * Opening balance is NOT a Product attribute; it is an accounting record
 * created once at product setup time and managed separately from transaction stock.
 */
import { InventoryOpeningBalanceRepository } from '../database/repositories/inventory-opening-balance.repository';
import { CreateInventoryOpeningBalanceInput } from '../../shared/models/inventory-opening-balance';

export class OpeningBalanceService {
  private repo = new InventoryOpeningBalanceRepository();

  public create(input: CreateInventoryOpeningBalanceInput) {
    return this.repo.create(input);
  }

  public findByProductAndShop(productId: string, shopId: string) {
    return this.repo.findByProductAndShop(productId, shopId);
  }
}
