import { InventoryDashboardSummary, InventorySummaryFilter, InventorySummaryResult } from '../../../shared/models/inventory';
import { InventoryTransactionRepository } from './inventory-transaction.repository';

export class InventoryReportRepository {
  private transactions = new InventoryTransactionRepository();

  public listStock(shopId: string, filter: InventorySummaryFilter): InventorySummaryResult {
    return this.transactions.listStock(shopId, filter);
  }

  public dashboardSummary(shopId: string): InventoryDashboardSummary {
    return this.transactions.dashboardSummary(shopId);
  }
}

