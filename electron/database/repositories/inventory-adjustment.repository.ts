import crypto from 'crypto';
import { getDatabaseConnection } from '../database-connection';
import { RepositoryError } from './repository-errors';
import { InventoryAdjustment } from '../../../shared/models/inventory';

export interface CreateAdjustmentRow {
  adjustmentType: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'DAMAGE_OUT' | 'EXPIRY_OUT' | 'LOSS_OUT';
  reasonCode: string;
  notes?: string | null;
  occurredAt: string;
}

export interface CreateAdjustmentLineRow {
  adjustmentId: string;
  productId: string;
  systemQuantity: number;
  countedQuantity?: number | null;
  differenceQuantity: number;
  unitCost: number;
  notes?: string | null;
}

function mapAdjustment(row: any): InventoryAdjustment {
  return {
    id: row.id,
    adjustmentNumber: row.adjustmentNumber,
    adjustmentType: row.adjustmentType,
    reasonCode: row.reasonCode,
    notes: row.notes || null,
    occurredAt: new Date(row.occurredAt).toISOString(),
    status: row.status,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export class InventoryAdjustmentRepository {
  public createPosted(input: CreateAdjustmentRow): InventoryAdjustment {
    try {
      const db = getDatabaseConnection();
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      const number = `ADJ-${Date.now()}`;
      db.prepare(`
        INSERT INTO InventoryAdjustment (
          id, adjustmentNumber, adjustmentType, reasonCode, notes, occurredAt, status, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, 'POSTED', ?, ?)
      `).run(id, number, input.adjustmentType, input.reasonCode, input.notes ?? null, input.occurredAt, now, now);
      return mapAdjustment(db.prepare('SELECT * FROM InventoryAdjustment WHERE id = ?').get(id));
    } catch (err: any) {
      throw new RepositoryError(`Failed to create inventory adjustment: ${err.message}`);
    }
  }

  public createLine(input: CreateAdjustmentLineRow): void {
    try {
      const db = getDatabaseConnection();
      db.prepare(`
        INSERT INTO InventoryAdjustmentLine (
          id, adjustmentId, productId, systemQuantity, countedQuantity,
          differenceQuantity, unitCost, notes, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        input.adjustmentId,
        input.productId,
        input.systemQuantity,
        input.countedQuantity ?? null,
        input.differenceQuantity,
        input.unitCost,
        input.notes ?? null,
        new Date().toISOString()
      );
    } catch (err: any) {
      throw new RepositoryError(`Failed to create inventory adjustment line: ${err.message}`);
    }
  }

  public markReversed(id: string): void {
    try {
      const db = getDatabaseConnection();
      db.prepare("UPDATE InventoryAdjustment SET status = 'REVERSED', updatedAt = ? WHERE id = ?")
        .run(new Date().toISOString(), id);
    } catch (err: any) {
      throw new RepositoryError(`Failed to mark inventory adjustment reversed: ${err.message}`);
    }
  }
}

