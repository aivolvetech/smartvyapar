import { PaginationMeta } from '../types/ipc';

export type InventoryTransactionType =
  | 'OPENING'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'DAMAGE_OUT'
  | 'EXPIRY_OUT'
  | 'LOSS_OUT'
  | 'PURCHASE_IN'
  | 'SALE_OUT'
  | 'SALE_RETURN_IN'
  | 'PURCHASE_RETURN_OUT'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'REVERSAL';

export type InventoryStockStatus =
  | 'IN_STOCK'
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK'
  | 'NEGATIVE_STOCK'
  | 'OVER_STOCK';

export interface InventoryTransaction {
  id: string;
  shopId: string;
  productId: string;
  transactionType: InventoryTransactionType;
  quantity: number;
  unitCost: number;
  totalCost: number | null;
  referenceType: string | null;
  referenceId: string | null;
  referenceNumber: string | null;
  sourceTransactionId: string | null;
  reversalOfTransactionId: string | null;
  reasonCode: string | null;
  notes: string | null;
  occurredAt: string;
  postedAt: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface InventoryStockSummary {
  productId: string;
  productCode: string;
  productName: string;
  categoryName: string | null;
  primaryBarcode: string | null;
  primaryUnit: string;
  quantityOnHand: number;
  averageCost: number | null;
  minimumStockLevel: number | null;
  reorderLevel: number | null;
  maximumStockLevel: number | null;
  stockStatus: InventoryStockStatus;
  lastMovementAt: string | null;
  productType: 'GOODS' | 'SERVICE';
  trackInventory: boolean;
  allowNegativeStock: boolean;
  isActive: boolean;
}

export interface InventoryMovementListItem {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  transactionType: InventoryTransactionType;
  quantity: number;
  quantityIn: number | null;
  quantityOut: number | null;
  unitCost: number;
  totalCost: number | null;
  referenceType: string | null;
  referenceId: string | null;
  referenceNumber: string | null;
  reasonCode: string | null;
  notes: string | null;
  occurredAt: string;
  postedAt: string;
  isReversal: boolean;
  isReversed: boolean;
}

export interface InventoryMovementFilter {
  productId?: string;
  search?: string;
  transactionType?: InventoryTransactionType;
  referenceNumber?: string;
  dateFrom?: string;
  dateTo?: string;
  reversed?: boolean;
  page: number;
  pageSize: number;
  sortBy: 'occurredAt' | 'postedAt' | 'productCode' | 'transactionType' | 'quantity';
  sortDirection: 'ASC' | 'DESC';
}

export interface InventoryMovementResult {
  items: InventoryMovementListItem[];
  pagination: PaginationMeta;
}

export interface InventorySummaryFilter {
  search?: string;
  categoryId?: string;
  stockStatus?: InventoryStockStatus;
  isActive?: boolean;
  page: number;
  pageSize: number;
  sortBy: 'productCode' | 'productName' | 'quantityOnHand' | 'lastMovementAt';
  sortDirection: 'ASC' | 'DESC';
}

export interface InventorySummaryResult {
  items: InventoryStockSummary[];
  pagination: PaginationMeta;
}

export interface InventoryDashboardSummary {
  totalTrackedProducts: number;
  totalStockQuantity: number;
  inStockProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  reorderRequiredProducts: number;
  negativeStockProducts: number;
  overStockProducts: number;
  damagePostedToday: number;
  expiryPostedToday: number;
}

export interface InventoryAdjustment {
  id: string;
  adjustmentNumber: string;
  adjustmentType: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'DAMAGE_OUT' | 'EXPIRY_OUT' | 'LOSS_OUT';
  reasonCode: string;
  notes: string | null;
  occurredAt: string;
  status: 'DRAFT' | 'POSTED' | 'REVERSED';
  createdAt: string;
  updatedAt: string;
}

export interface PostOpeningStockInput {
  productId: string;
  quantity: number;
  unitCost?: number;
  reason?: string;
  notes?: string;
  occurredAt?: string;
}

export interface CreateInventoryAdjustmentInput {
  productId: string;
  adjustmentType: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
  quantity: number;
  unitCost?: number;
  reason: string;
  notes?: string;
  occurredAt?: string;
}

export interface PostDamageInput {
  productId: string;
  quantity: number;
  reason: string;
  notes?: string;
  occurredAt?: string;
}

export interface PostExpiryInput {
  productId: string;
  quantity: number;
  expiryDate: string;
  reason: string;
  notes?: string;
}

export interface PostLossInput {
  productId: string;
  quantity: number;
  reason: string;
  notes?: string;
  occurredAt?: string;
}

export interface ReverseInventoryTransactionInput {
  transactionId: string;
  reason: string;
  notes?: string;
}

