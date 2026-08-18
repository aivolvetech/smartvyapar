import { InventoryStockStatus } from '../../../shared/types/ipc';

const labels: Record<InventoryStockStatus, string> = {
  IN_STOCK: 'In Stock',
  LOW_STOCK: 'Low Stock',
  OUT_OF_STOCK: 'Out of Stock',
  NEGATIVE_STOCK: 'Negative',
  OVER_STOCK: 'Over Stock',
};

const colors: Record<InventoryStockStatus, string> = {
  IN_STOCK: 'badge-connected',
  LOW_STOCK: 'badge-offline',
  OUT_OF_STOCK: 'badge-error',
  NEGATIVE_STOCK: 'badge-error',
  OVER_STOCK: 'badge-offline',
};

export default function InventoryStatusBadge({ status }: { status: InventoryStockStatus }) {
  return <span className={`pill-badge ${colors[status] || 'badge-offline'}`}>{labels[status] || status}</span>;
}

