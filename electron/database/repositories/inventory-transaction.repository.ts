import crypto from 'crypto';
import { getDatabaseConnection } from '../database-connection';
import { RepositoryError } from './repository-errors';
import {
  InventoryDashboardSummary,
  InventoryMovementFilter,
  InventoryMovementListItem,
  InventoryMovementResult,
  InventoryStockSummary,
  InventorySummaryFilter,
  InventorySummaryResult,
  InventoryTransaction,
  InventoryTransactionType,
} from '../../../shared/models/inventory';

const SUMMARY_SORT: Record<InventorySummaryFilter['sortBy'], string> = {
  productCode: 'productCode',
  productName: 'productName',
  quantityOnHand: 'quantityOnHand',
  lastMovementAt: 'lastMovementAt',
};

const MOVEMENT_SORT: Record<InventoryMovementFilter['sortBy'], string> = {
  occurredAt: 'it.occurredAt',
  postedAt: 'it.postedAt',
  productCode: 'p.productCode',
  transactionType: 'it.transactionType',
  quantity: 'it.quantity',
};

function normalizeStr(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function stockStatusSql(alias = 'quantityOnHand'): string {
  return `CASE
    WHEN ${alias} < 0 THEN 'NEGATIVE_STOCK'
    WHEN ${alias} <= 0 THEN 'OUT_OF_STOCK'
    WHEN p.maximumStockLevel IS NOT NULL AND ${alias} > p.maximumStockLevel THEN 'OVER_STOCK'
    WHEN p.minimumStockLevel IS NOT NULL AND ${alias} > 0 AND ${alias} <= p.minimumStockLevel THEN 'LOW_STOCK'
    ELSE 'IN_STOCK'
  END`;
}

function mapTransaction(row: any): InventoryTransaction {
  return {
    id: row.id,
    shopId: row.shopId,
    productId: row.productId,
    transactionType: row.transactionType,
    quantity: row.quantity ?? 0,
    unitCost: row.unitCost ?? 0,
    totalCost: row.totalCost ?? null,
    referenceType: row.referenceType || null,
    referenceId: row.referenceId || null,
    referenceNumber: row.referenceNumber || null,
    sourceTransactionId: row.sourceTransactionId || null,
    reversalOfTransactionId: row.reversalOfTransactionId || null,
    reasonCode: row.reasonCode || null,
    notes: row.notes || null,
    occurredAt: new Date(row.occurredAt).toISOString(),
    postedAt: new Date(row.postedAt).toISOString(),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
    version: row.version ?? 1,
  };
}

export interface CreateInventoryTransactionRow {
  shopId: string;
  productId: string;
  transactionType: InventoryTransactionType;
  quantity: number;
  unitCost: number;
  referenceType?: string | null;
  referenceId?: string | null;
  referenceNumber?: string | null;
  sourceTransactionId?: string | null;
  reversalOfTransactionId?: string | null;
  reasonCode?: string | null;
  notes?: string | null;
  occurredAt?: string;
}

export class InventoryTransactionRepository {
  public create(input: CreateInventoryTransactionRow): InventoryTransaction {
    try {
      const db = getDatabaseConnection();
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const occurredAt = input.occurredAt ?? now;
      const totalCost = Math.abs(input.quantity) * input.unitCost;

      db.prepare(`
        INSERT INTO InventoryTransaction (
          id, shopId, productId, transactionType, quantity, unitCost, totalCost,
          referenceType, referenceId, referenceNumber, sourceTransactionId,
          reversalOfTransactionId, reasonCode, notes, occurredAt, postedAt,
          createdAt, updatedAt, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        id,
        input.shopId,
        input.productId,
        input.transactionType,
        input.quantity,
        input.unitCost,
        totalCost,
        input.referenceType ?? null,
        input.referenceId ?? null,
        input.referenceNumber ?? null,
        input.sourceTransactionId ?? null,
        input.reversalOfTransactionId ?? null,
        input.reasonCode ?? null,
        input.notes ?? null,
        occurredAt,
        now,
        now,
        now
      );
      return this.findById(id)!;
    } catch (err: any) {
      throw new RepositoryError(`Failed to create inventory transaction: ${err.message}`);
    }
  }

  public findById(id: string): InventoryTransaction | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT * FROM InventoryTransaction WHERE id = ?').get(id);
      return row ? mapTransaction(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find inventory transaction: ${err.message}`);
    }
  }

  public hasReversal(transactionId: string): boolean {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT count(*) as count FROM InventoryTransaction WHERE reversalOfTransactionId = ?').get(transactionId) as { count: number };
      return row.count > 0;
    } catch (err: any) {
      throw new RepositoryError(`Failed to check reversal: ${err.message}`);
    }
  }

  public currentStock(shopId: string, productId: string): number {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare(`
        SELECT COALESCE(SUM(quantity), 0) as quantityOnHand
        FROM InventoryTransaction
        WHERE shopId = ? AND productId = ?
      `).get(shopId, productId) as { quantityOnHand: number };
      return row.quantityOnHand ?? 0;
    } catch (err: any) {
      throw new RepositoryError(`Failed to calculate current stock: ${err.message}`);
    }
  }

  public averageCost(shopId: string, productId: string): number | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare(`
        SELECT
          SUM(CASE WHEN quantity > 0 THEN quantity * unitCost ELSE 0 END) as totalInCost,
          SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END) as totalInQty
        FROM InventoryTransaction
        WHERE shopId = ? AND productId = ?
      `).get(shopId, productId) as { totalInCost: number | null; totalInQty: number | null };
      if (!row.totalInQty) return null;
      return row.totalInCost! / row.totalInQty;
    } catch (err: any) {
      throw new RepositoryError(`Failed to calculate average cost: ${err.message}`);
    }
  }

  public getProductStock(shopId: string, productId: string): InventoryStockSummary | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare(`
        WITH stock AS (
          SELECT
            productId,
            COALESCE(SUM(quantity), 0) AS quantityOnHand,
            MAX(occurredAt) AS lastMovementAt,
            CASE
              WHEN SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END) > 0
              THEN SUM(CASE WHEN quantity > 0 THEN quantity * unitCost ELSE 0 END) / SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END)
              ELSE NULL
            END AS averageCost
          FROM InventoryTransaction
          WHERE shopId = ? AND productId = ?
          GROUP BY productId
        )
        SELECT
          p.id AS productId,
          p.productCode,
          p.name AS productName,
          c.name AS categoryName,
          (SELECT pb.barcode FROM ProductBarcode pb WHERE pb.productId = p.id AND pb.isPrimary = 1 AND pb.isActive = 1 LIMIT 1) AS primaryBarcode,
          u.shortName AS primaryUnit,
          COALESCE(s.quantityOnHand, 0) AS quantityOnHand,
          s.averageCost,
          p.minimumStockLevel,
          p.reorderLevel,
          p.maximumStockLevel,
          ${stockStatusSql('COALESCE(s.quantityOnHand, 0)')} AS stockStatus,
          s.lastMovementAt,
          p.productType,
          p.trackInventory,
          p.allowNegativeStock,
          p.isActive
        FROM Product p
        LEFT JOIN stock s ON s.productId = p.id
        LEFT JOIN ProductCategory c ON c.id = p.categoryId
        LEFT JOIN UnitOfMeasure u ON u.id = p.primaryUnitId
        WHERE p.id = ?
      `).get(shopId, productId, productId);
      return row ? this.mapStock(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to load product stock: ${err.message}`);
    }
  }

  public listStock(shopId: string, filter: InventorySummaryFilter): InventorySummaryResult {
    try {
      const db = getDatabaseConnection();
      const conditions = ['p.productType = ?','p.trackInventory = 1'];
      const params: any[] = ['GOODS'];

      if (filter.isActive !== undefined) {
        conditions.push('p.isActive = ?');
        params.push(filter.isActive ? 1 : 0);
      }
      if (filter.categoryId) {
        conditions.push('p.categoryId = ?');
        params.push(filter.categoryId);
      }
      if (filter.search) {
        const norm = normalizeStr(filter.search);
        conditions.push(`(
          p.normalizedProductCode = ? OR p.normalizedName LIKE ? OR
          EXISTS (SELECT 1 FROM ProductBarcode pb WHERE pb.productId = p.id AND pb.barcode = ? AND pb.isActive = 1)
        )`);
        params.push(norm, `%${norm}%`, filter.search.trim());
      }

      const baseWhere = conditions.join(' AND ');
      const statusSql = stockStatusSql('COALESCE(s.quantityOnHand, 0)');
      const statusFilter = filter.stockStatus ? `WHERE stockStatus = ?` : '';
      const statusParams = filter.stockStatus ? [filter.stockStatus] : [];
      const direction = filter.sortDirection === 'DESC' ? 'DESC' : 'ASC';
      const sortColumn = SUMMARY_SORT[filter.sortBy] ?? 'p.productCode';
      const pageSize = Math.min(Math.max(filter.pageSize, 1), 200);
      const page = Math.max(filter.page, 1);
      const offset = (page - 1) * pageSize;

      const fromSql = `
        WITH stock AS (
          SELECT
            productId,
            COALESCE(SUM(quantity), 0) AS quantityOnHand,
            MAX(occurredAt) AS lastMovementAt,
            CASE
              WHEN SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END) > 0
              THEN SUM(CASE WHEN quantity > 0 THEN quantity * unitCost ELSE 0 END) / SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END)
              ELSE NULL
            END AS averageCost
          FROM InventoryTransaction
          WHERE shopId = ?
          GROUP BY productId
        ),
        stock_rows AS (
          SELECT
            p.id AS productId,
            p.productCode,
            p.name AS productName,
            c.name AS categoryName,
            (SELECT pb.barcode FROM ProductBarcode pb WHERE pb.productId = p.id AND pb.isPrimary = 1 AND pb.isActive = 1 LIMIT 1) AS primaryBarcode,
            u.shortName AS primaryUnit,
            COALESCE(s.quantityOnHand, 0) AS quantityOnHand,
            s.averageCost,
            p.minimumStockLevel,
            p.reorderLevel,
            p.maximumStockLevel,
            ${statusSql} AS stockStatus,
            s.lastMovementAt,
            p.productType,
            p.trackInventory,
            p.allowNegativeStock,
            p.isActive
          FROM Product p
          LEFT JOIN stock s ON s.productId = p.id
          LEFT JOIN ProductCategory c ON c.id = p.categoryId
          LEFT JOIN UnitOfMeasure u ON u.id = p.primaryUnitId
          WHERE ${baseWhere}
        )
      `;

      const count = db.prepare(`${fromSql} SELECT count(*) as total FROM stock_rows ${statusFilter}`)
        .get(shopId, ...params, ...statusParams) as { total: number };

      const rows = db.prepare(`
        ${fromSql}
        SELECT * FROM stock_rows
        ${statusFilter}
        ORDER BY ${sortColumn} ${direction}, productId ASC
        LIMIT ? OFFSET ?
      `).all(shopId, ...params, ...statusParams, pageSize, offset) as any[];

      return {
        items: rows.map(row => this.mapStock(row)),
        pagination: {
          page,
          pageSize,
          totalItems: count.total,
          totalPages: Math.max(1, Math.ceil(count.total / pageSize)),
        },
      };
    } catch (err: any) {
      throw new RepositoryError(`Failed to list inventory stock: ${err.message}`);
    }
  }

  public listMovements(shopId: string, filter: InventoryMovementFilter): InventoryMovementResult {
    try {
      const db = getDatabaseConnection();
      const conditions = ['it.shopId = ?'];
      const params: any[] = [shopId];
      if (filter.productId) {
        conditions.push('it.productId = ?');
        params.push(filter.productId);
      }
      if (filter.transactionType) {
        conditions.push('it.transactionType = ?');
        params.push(filter.transactionType);
      }
      if (filter.referenceNumber) {
        conditions.push('it.referenceNumber LIKE ?');
        params.push(`%${filter.referenceNumber.trim()}%`);
      }
      if (filter.dateFrom) {
        conditions.push('it.occurredAt >= ?');
        params.push(filter.dateFrom);
      }
      if (filter.dateTo) {
        conditions.push('it.occurredAt <= ?');
        params.push(filter.dateTo);
      }
      if (filter.search) {
        const norm = normalizeStr(filter.search);
        conditions.push('(p.normalizedProductCode = ? OR p.normalizedName LIKE ?)');
        params.push(norm, `%${norm}%`);
      }
      if (filter.reversed !== undefined) {
        if (filter.reversed) conditions.push('rev.id IS NOT NULL');
        else conditions.push('rev.id IS NULL');
      }

      const where = `WHERE ${conditions.join(' AND ')}`;
      const sortColumn = MOVEMENT_SORT[filter.sortBy] ?? 'it.occurredAt';
      const direction = filter.sortDirection === 'ASC' ? 'ASC' : 'DESC';
      const pageSize = Math.min(Math.max(filter.pageSize, 1), 200);
      const page = Math.max(filter.page, 1);
      const offset = (page - 1) * pageSize;

      const count = db.prepare(`
        SELECT count(*) as total
        FROM InventoryTransaction it
        INNER JOIN Product p ON p.id = it.productId
        LEFT JOIN InventoryTransaction rev ON rev.reversalOfTransactionId = it.id
        ${where}
      `).get(...params) as { total: number };

      const rows = db.prepare(`
        SELECT
          it.*,
          p.productCode,
          p.name AS productName,
          rev.id AS reversalTransactionId
        FROM InventoryTransaction it
        INNER JOIN Product p ON p.id = it.productId
        LEFT JOIN InventoryTransaction rev ON rev.reversalOfTransactionId = it.id
        ${where}
        ORDER BY ${sortColumn} ${direction}, it.id ASC
        LIMIT ? OFFSET ?
      `).all(...params, pageSize, offset) as any[];

      return {
        items: rows.map(row => ({
          id: row.id,
          productId: row.productId,
          productCode: row.productCode,
          productName: row.productName,
          transactionType: row.transactionType,
          quantity: row.quantity,
          quantityIn: row.quantity > 0 ? row.quantity : null,
          quantityOut: row.quantity < 0 ? Math.abs(row.quantity) : null,
          unitCost: row.unitCost ?? 0,
          totalCost: row.totalCost ?? null,
          referenceType: row.referenceType || null,
          referenceId: row.referenceId || null,
          referenceNumber: row.referenceNumber || null,
          reasonCode: row.reasonCode || null,
          notes: row.notes || null,
          occurredAt: new Date(row.occurredAt).toISOString(),
          postedAt: new Date(row.postedAt).toISOString(),
          isReversal: !!row.reversalOfTransactionId,
          isReversed: !!row.reversalTransactionId,
        })),
        pagination: {
          page,
          pageSize,
          totalItems: count.total,
          totalPages: Math.max(1, Math.ceil(count.total / pageSize)),
        },
      };
    } catch (err: any) {
      throw new RepositoryError(`Failed to list inventory movements: ${err.message}`);
    }
  }

  public dashboardSummary(shopId: string): InventoryDashboardSummary {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare(`
        WITH stock AS (
          SELECT productId, COALESCE(SUM(quantity), 0) AS quantityOnHand
          FROM InventoryTransaction
          WHERE shopId = ?
          GROUP BY productId
        ),
        tracked AS (
          SELECT p.*, COALESCE(s.quantityOnHand, 0) AS quantityOnHand
          FROM Product p
          LEFT JOIN stock s ON s.productId = p.id
          WHERE p.productType = 'GOODS' AND p.trackInventory = 1 AND p.isActive = 1
        )
        SELECT
          count(*) AS totalTrackedProducts,
          COALESCE(SUM(quantityOnHand), 0) AS totalStockQuantity,
          SUM(CASE WHEN quantityOnHand > 0 THEN 1 ELSE 0 END) AS inStockProducts,
          SUM(CASE WHEN quantityOnHand > 0 AND minimumStockLevel IS NOT NULL AND quantityOnHand <= minimumStockLevel THEN 1 ELSE 0 END) AS lowStockProducts,
          SUM(CASE WHEN quantityOnHand <= 0 THEN 1 ELSE 0 END) AS outOfStockProducts,
          SUM(CASE WHEN reorderLevel IS NOT NULL AND quantityOnHand <= reorderLevel THEN 1 ELSE 0 END) AS reorderRequiredProducts,
          SUM(CASE WHEN quantityOnHand < 0 THEN 1 ELSE 0 END) AS negativeStockProducts,
          SUM(CASE WHEN maximumStockLevel IS NOT NULL AND quantityOnHand > maximumStockLevel THEN 1 ELSE 0 END) AS overStockProducts
        FROM tracked
      `).get(shopId) as any;

      const today = new Date().toISOString().slice(0, 10);
      const daily = db.prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN transactionType = 'DAMAGE_OUT' THEN ABS(quantity) ELSE 0 END), 0) AS damagePostedToday,
          COALESCE(SUM(CASE WHEN transactionType = 'EXPIRY_OUT' THEN ABS(quantity) ELSE 0 END), 0) AS expiryPostedToday
        FROM InventoryTransaction
        WHERE shopId = ? AND substr(postedAt, 1, 10) = ?
      `).get(shopId, today) as any;

      return {
        totalTrackedProducts: row.totalTrackedProducts ?? 0,
        totalStockQuantity: row.totalStockQuantity ?? 0,
        inStockProducts: row.inStockProducts ?? 0,
        lowStockProducts: row.lowStockProducts ?? 0,
        outOfStockProducts: row.outOfStockProducts ?? 0,
        reorderRequiredProducts: row.reorderRequiredProducts ?? 0,
        negativeStockProducts: row.negativeStockProducts ?? 0,
        overStockProducts: row.overStockProducts ?? 0,
        damagePostedToday: daily.damagePostedToday ?? 0,
        expiryPostedToday: daily.expiryPostedToday ?? 0,
      };
    } catch (err: any) {
      throw new RepositoryError(`Failed to load inventory dashboard summary: ${err.message}`);
    }
  }

  private mapStock(row: any): InventoryStockSummary {
    return {
      productId: row.productId,
      productCode: row.productCode,
      productName: row.productName,
      categoryName: row.categoryName || null,
      primaryBarcode: row.primaryBarcode || null,
      primaryUnit: row.primaryUnit || '',
      quantityOnHand: row.quantityOnHand ?? 0,
      averageCost: row.averageCost ?? null,
      minimumStockLevel: row.minimumStockLevel ?? null,
      reorderLevel: row.reorderLevel ?? null,
      maximumStockLevel: row.maximumStockLevel ?? null,
      stockStatus: row.stockStatus,
      lastMovementAt: row.lastMovementAt ? new Date(row.lastMovementAt).toISOString() : null,
      productType: row.productType,
      trackInventory: Boolean(row.trackInventory),
      allowNegativeStock: Boolean(row.allowNegativeStock),
      isActive: Boolean(row.isActive),
    };
  }
}
