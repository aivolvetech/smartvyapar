import InventoryAdjustmentForm from './InventoryAdjustmentForm';

export default function LostStockForm({ onPosted }: { onPosted: () => void }) {
  return <InventoryAdjustmentForm mode="LOSS_OUT" onPosted={onPosted} />;
}

