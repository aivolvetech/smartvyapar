import { useEffect, useState } from 'react';
import {
  InventoryMovementListItem,
  InventoryMovementResult,
  InventoryTransactionType,
  IPCResponse,
} from '../../../shared/types/ipc';

export default function InventoryMovementHistory({ productId }: { productId?: string }) {
  const [items, setItems] = useState<InventoryMovementListItem[]>([]);
  const [type, setType] = useState<InventoryTransactionType | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    (window as any).smartVyapar.getInventoryMovements({
      productId,
      search,
      transactionType: type || undefined,
      page,
      pageSize: 25,
      sortBy: 'occurredAt',
      sortDirection: 'DESC',
    })
      .then((res: IPCResponse<InventoryMovementResult>) => {
        if (res.success && res.data) {
          setItems(res.data.items);
          setTotalPages(res.data.pagination.totalPages);
        } else {
          setError(res.error || 'Failed to load movements.');
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, type, productId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <input className="form-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product code or name..." />
        <select className="form-input" style={{ maxWidth: 210 }} value={type} onChange={e => { setType(e.target.value as any); setPage(1); }}>
          <option value="">All movements</option>
          <option value="OPENING">Opening</option>
          <option value="ADJUSTMENT_IN">Adjustment In</option>
          <option value="ADJUSTMENT_OUT">Adjustment Out</option>
          <option value="DAMAGE_OUT">Damage</option>
          <option value="EXPIRY_OUT">Expiry</option>
          <option value="LOSS_OUT">Loss</option>
          <option value="REVERSAL">Reversal</option>
        </select>
        <button className="app-btn btn-primary" onClick={() => { setPage(1); load(); }}>Search</button>
      </div>
      {error && <div className="form-error-msg" role="alert">{error}</div>}
      <div className="card-surface" style={{ overflowX: 'auto' }}>
        {loading ? (
          <div>Loading movements...</div>
        ) : items.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)' }}>No inventory movements found.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>Type</th>
                <th>In</th>
                <th>Out</th>
                <th>Unit Cost</th>
                <th>Total Cost</th>
                <th>Reference</th>
                <th>Notes</th>
                <th>Reversal</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>{new Date(item.occurredAt).toLocaleString()}</td>
                  <td>{item.productCode} - {item.productName}</td>
                  <td>{item.transactionType}</td>
                  <td>{item.quantityIn ?? '-'}</td>
                  <td>{item.quantityOut ?? '-'}</td>
                  <td>{item.unitCost}</td>
                  <td>{item.totalCost ?? '-'}</td>
                  <td>{item.referenceNumber || item.referenceType || '-'}</td>
                  <td>{item.notes || item.reasonCode || '-'}</td>
                  <td>{item.isReversal ? 'Reversal' : item.isReversed ? 'Reversed' : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
        <button className="app-btn btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
        <span style={{ alignSelf: 'center' }}>Page {page} / {totalPages}</span>
        <button className="app-btn btn-secondary" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
      </div>
    </div>
  );
}

