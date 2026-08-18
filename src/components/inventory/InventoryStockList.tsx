import { useEffect, useState } from 'react';
import {
  InventoryStockStatus,
  InventoryStockSummary,
  InventorySummaryResult,
  IPCResponse,
} from '../../../shared/types/ipc';
import InventoryStatusBadge from './InventoryStatusBadge';

interface Props {
  onViewProduct: (productId: string) => void;
  onImportOpening?: () => void;
}

export default function InventoryStockList({ onViewProduct, onImportOpening }: Props) {
  const [items, setItems] = useState<InventoryStockSummary[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<InventoryStockStatus | ''>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    (window as any).smartVyapar.getInventorySummary({
      search,
      stockStatus: status || undefined,
      isActive: true,
      page,
      pageSize: 25,
      sortBy: 'productCode',
      sortDirection: 'ASC',
    })
      .then((res: IPCResponse<InventorySummaryResult>) => {
        if (res.success && res.data) {
          setItems(res.data.items);
          setTotalPages(res.data.pagination.totalPages);
        } else {
          setError(res.error || 'Failed to load stock list.');
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, status]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <input
          id="inventory-stock-search"
          className="form-input"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by code, name, or barcode..."
        />
        <select className="form-input" style={{ maxWidth: 190 }} value={status} onChange={e => { setStatus(e.target.value as any); setPage(1); }}>
          <option value="">All status</option>
          <option value="IN_STOCK">In stock</option>
          <option value="LOW_STOCK">Low stock</option>
          <option value="OUT_OF_STOCK">Out of stock</option>
          <option value="NEGATIVE_STOCK">Negative stock</option>
          <option value="OVER_STOCK">Over stock</option>
        </select>
        <button className="app-btn btn-primary" onClick={() => { setPage(1); load(); }}>Search</button>
        <button className="app-btn" onClick={onImportOpening} style={{ marginLeft: 'auto' }}>📥 Import Opening Stock</button>
      </div>

      {error && <div className="form-error-msg" role="alert">{error}</div>}

      <div className="card-surface" style={{ overflowX: 'auto' }}>
        {loading ? (
          <div>Loading stock...</div>
        ) : items.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)' }}>No tracked inventory products found.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Product</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Qty</th>
                <th>Min</th>
                <th>Reorder</th>
                <th>Max</th>
                <th>Status</th>
                <th>Last Movement</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.productId}>
                  <td>{item.productCode}</td>
                  <td>{item.productName}</td>
                  <td>{item.categoryName || '-'}</td>
                  <td>{item.primaryUnit}</td>
                  <td>{item.quantityOnHand}</td>
                  <td>{item.minimumStockLevel ?? '-'}</td>
                  <td>{item.reorderLevel ?? '-'}</td>
                  <td>{item.maximumStockLevel ?? '-'}</td>
                  <td><InventoryStatusBadge status={item.stockStatus} /></td>
                  <td>{item.lastMovementAt ? new Date(item.lastMovementAt).toLocaleString() : '-'}</td>
                  <td><button className="app-btn btn-secondary" onClick={() => onViewProduct(item.productId)}>View</button></td>
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

