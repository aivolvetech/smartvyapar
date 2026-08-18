import { useEffect, useState } from 'react';
import { InventoryStockSummary, IPCResponse } from '../../../shared/types/ipc';
import InventoryMovementHistory from './InventoryMovementHistory';
import InventoryStatusBadge from './InventoryStatusBadge';

interface Props {
  productId: string;
  onBack: () => void;
}

export default function ProductStockView({ productId, onBack }: Props) {
  const [stock, setStock] = useState<InventoryStockSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (window as any).smartVyapar.getProductStock(productId)
      .then((res: IPCResponse<InventoryStockSummary>) => {
        if (res.success && res.data) setStock(res.data);
        else setError(res.error || 'Failed to load product stock.');
      })
      .catch((err: Error) => setError(err.message));
  }, [productId]);

  if (error) return <div className="form-error-msg" role="alert">{error}</div>;
  if (!stock) return <div>Loading stock...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <button className="app-btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={onBack}>Back to Stock List</button>
      <div className="card-surface">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start' }}>
          <div>
            <h3 style={{ margin: 0 }}>{stock.productName}</h3>
            <div style={{ color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
              Code: {stock.productCode} | Barcode: {stock.primaryBarcode || '-'} | Type: {stock.productType}
            </div>
          </div>
          <InventoryStatusBadge status={stock.stockStatus} />
        </div>
        <div className="dashboard-grid" style={{ marginTop: '1.25rem' }}>
          <div>
            <div className="info-key">Quantity On Hand</div>
            <div className="info-val">{stock.quantityOnHand} {stock.primaryUnit}</div>
          </div>
          <div>
            <div className="info-key">Minimum / Reorder / Maximum</div>
            <div className="info-val">{stock.minimumStockLevel ?? '-'} / {stock.reorderLevel ?? '-'} / {stock.maximumStockLevel ?? '-'}</div>
          </div>
          <div>
            <div className="info-key">Negative Stock</div>
            <div className="info-val">{stock.allowNegativeStock ? 'Allowed' : 'Blocked'}</div>
          </div>
          <div>
            <div className="info-key">Average Cost</div>
            <div className="info-val">{stock.averageCost === null ? '-' : stock.averageCost.toFixed(2)}</div>
          </div>
        </div>
      </div>
      <InventoryMovementHistory productId={productId} />
    </div>
  );
}

