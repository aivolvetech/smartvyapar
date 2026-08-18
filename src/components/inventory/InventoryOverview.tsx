import { useEffect, useState } from 'react';
import { InventoryDashboardSummary, IPCResponse } from '../../../shared/types/ipc';

interface Props {
  onAction: (page: 'STOCK_LIST' | 'MOVEMENTS' | 'ADJUSTMENT' | 'DAMAGE' | 'EXPIRY' | 'LOSS') => void;
}

const emptySummary: InventoryDashboardSummary = {
  totalTrackedProducts: 0,
  totalStockQuantity: 0,
  inStockProducts: 0,
  lowStockProducts: 0,
  outOfStockProducts: 0,
  reorderRequiredProducts: 0,
  negativeStockProducts: 0,
  overStockProducts: 0,
  damagePostedToday: 0,
  expiryPostedToday: 0,
};

export default function InventoryOverview({ onAction }: Props) {
  const [summary, setSummary] = useState<InventoryDashboardSummary>(emptySummary);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (window as any).smartVyapar.getInventoryDashboardSummary()
      .then((res: IPCResponse<InventoryDashboardSummary>) => {
        if (cancelled) return;
        if (res.success && res.data) setSummary(res.data);
        else setError(res.error || 'Failed to load inventory overview.');
      })
      .catch((err: Error) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const cards = [
    ['Total tracked Products', summary.totalTrackedProducts],
    ['Total stock quantity', summary.totalStockQuantity],
    ['Low stock', summary.lowStockProducts],
    ['Out of stock', summary.outOfStockProducts],
    ['Reorder required', summary.reorderRequiredProducts],
    ['Negative stock', summary.negativeStockProducts],
    ['Damage posted today', summary.damagePostedToday],
    ['Expiry posted today', summary.expiryPostedToday],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {error && <div className="form-error-msg" role="alert">{error}</div>}
      <div className="dashboard-grid">
        {cards.map(([label, value]) => (
          <div className="card-surface" key={label}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{label}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0.5rem 0' }}>{loading ? '...' : value}</div>
          </div>
        ))}
      </div>
      <div className="card-surface">
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem' }}>Inventory Actions</h3>
        <div className="action-grid">
          <button className="app-btn btn-primary" onClick={() => onAction('ADJUSTMENT')}>Stock Adjustment</button>
          <button className="app-btn btn-secondary" onClick={() => onAction('DAMAGE')}>Record Damage</button>
          <button className="app-btn btn-secondary" onClick={() => onAction('EXPIRY')}>Record Expiry</button>
          <button className="app-btn btn-secondary" onClick={() => onAction('LOSS')}>Record Loss</button>
          <button className="app-btn btn-secondary" onClick={() => onAction('MOVEMENTS')}>View Movements</button>
          <button className="app-btn btn-secondary" onClick={() => onAction('STOCK_LIST')}>Stock List</button>
        </div>
      </div>
    </div>
  );
}

