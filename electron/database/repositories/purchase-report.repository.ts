import { getDatabaseConnection } from '../database-connection';
import { PurchaseDashboardSummary } from '../../../shared/models/supplier-purchase';

export class PurchaseReportRepository {
  public dashboardSummary(shopId: string): PurchaseDashboardSummary {
    const db = getDatabaseConnection();
    const today = new Date().toISOString().slice(0, 10);
    const row = db.prepare(`
      SELECT
        SUM(CASE WHEN status='POSTED' AND substr(postedAt, 1, 10)=? THEN 1 ELSE 0 END) AS purchasesToday,
        COALESCE(SUM(CASE WHEN status='POSTED' AND substr(postedAt, 1, 10)=? THEN grandTotal ELSE 0 END), 0) AS purchaseAmountToday,
        SUM(CASE WHEN status='DRAFT' THEN 1 ELSE 0 END) AS draftPurchases,
        SUM(CASE WHEN status='POSTED' AND dueDate IS NOT NULL AND dueDate <= ? AND outstandingAmount > 0 THEN 1 ELSE 0 END) AS purchasesDue
      FROM PurchaseInvoice
      WHERE shopId=?
    `).get(today, today, today, shopId) as any;
    const supplier = db.prepare(`
      SELECT COALESCE(SUM(creditAmount - debitAmount), 0) AS supplierOutstanding
      FROM SupplierLedgerEntry
      WHERE shopId=?
    `).get(shopId) as any;
    return {
      purchasesToday: row.purchasesToday ?? 0,
      purchaseAmountToday: row.purchaseAmountToday ?? 0,
      draftPurchases: row.draftPurchases ?? 0,
      supplierOutstanding: supplier.supplierOutstanding ?? 0,
      purchasesDue: row.purchasesDue ?? 0,
    };
  }
}
