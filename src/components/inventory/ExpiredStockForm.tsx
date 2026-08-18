import InventoryAdjustmentForm from './InventoryAdjustmentForm';

export default function ExpiredStockForm({ onPosted }: { onPosted: () => void }) {
  return <InventoryAdjustmentForm mode="EXPIRY_OUT" onPosted={onPosted} />;
}

