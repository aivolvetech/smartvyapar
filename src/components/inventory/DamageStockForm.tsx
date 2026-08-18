import InventoryAdjustmentForm from './InventoryAdjustmentForm';

export default function DamageStockForm({ onPosted }: { onPosted: () => void }) {
  return <InventoryAdjustmentForm mode="DAMAGE_OUT" onPosted={onPosted} />;
}

