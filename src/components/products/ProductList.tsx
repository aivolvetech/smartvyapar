import { useState, useEffect } from 'react';
import { ProductListItem, ProductListFilter, ProductListResult, ProductSortField } from '../../../shared/types/ipc';

interface Props {
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onCreate: () => void;
  onImport?: () => void;
}

const DEFAULT_FILTER: ProductListFilter = {
  page: 1, pageSize: 50,
  sortBy: 'name', sortDirection: 'ASC',
  isActive: true,
};

export default function ProductList({ onView, onEdit, onCreate, onImport }: Props) {
  const [result, setResult] = useState<ProductListResult | null>(null);
  const [filter, setFilter] = useState<ProductListFilter>(DEFAULT_FILTER);
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = async (f: ProductListFilter) => {
    setLoading(true);
    setError(null);
    try {
      const res = await (window as any).smartVyapar.listProducts(f);
      if (res.success) setResult(res.data);
      else setError(res.error || 'Failed to load products.');
    } catch { setError('IPC communication error.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(filter); }, []);

  const applySearch = () => {
    const f: ProductListFilter = { ...filter, search: searchInput.trim() || undefined, page: 1 };
    setFilter(f);
    load(f);
  };

  const handleSort = (col: ProductSortField) => {
    const dir = filter.sortBy === col && filter.sortDirection === 'ASC' ? 'DESC' : 'ASC';
    const f: ProductListFilter = { ...filter, sortBy: col, sortDirection: dir, page: 1 };
    setFilter(f);
    load(f);
  };

  const handlePage = (page: number) => {
    const f: ProductListFilter = { ...filter, page };
    setFilter(f);
    load(f);
  };

  const toggleShowAll = () => {
    const newShowAll = !showAll;
    setShowAll(newShowAll);
    const f: ProductListFilter = { ...filter, isActive: newShowAll ? undefined : true, page: 1 };
    setFilter(f);
    load(f);
  };

  const toggleActive = async (item: ProductListItem) => {
    try {
      await (window as any).smartVyapar.setProductActive(item.id, !item.isActive);
      load(filter);
    } catch { setError('Failed to update product status.'); }
  };

  const sortIcon = (col: ProductSortField) => {
    if (filter.sortBy !== col) return <span style={{ opacity: 0.3 }}>↕</span>;
    return filter.sortDirection === 'ASC' ? '↑' : '↓';
  };

  const fmt = (v: number | null) => v !== null && v !== undefined ? `₹${v.toFixed(2)}` : null;

  const pagination = result?.pagination;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-search">
          <input
            id="product-search"
            type="text"
            className="form-input"
            placeholder="Search by name, code, SKU, or barcode..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applySearch()}
            style={{ width: '100%' }}
          />
        </div>
        <div className="toolbar-actions">
          <button className="app-btn btn-secondary" onClick={applySearch} style={{ padding: '0.65rem 1rem', fontSize: '0.88rem' }}>
            🔍 Search
          </button>
          <label className="form-checkbox-row" style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={showAll} onChange={toggleShowAll} />
            Show inactive
          </label>
          <button className="app-btn btn-secondary" onClick={onImport} style={{ padding: '0.65rem 1.1rem', fontSize: '0.88rem' }}>
            📥 Import Products
          </button>
          <button id="product-create-btn" className="app-btn btn-primary" onClick={onCreate} style={{ padding: '0.65rem 1.1rem', fontSize: '0.88rem' }}>
            ＋ Add Product
          </button>
        </div>
      </div>

      {error && <div className="inline-error">⚠️ {error}</div>}

      {/* Table */}
      <div className="data-table-wrapper">
        {loading ? (
          <div className="empty-state">
            <div className="spinner-sm" style={{ width: 28, height: 28 }} />
            <span style={{ color: 'var(--text-secondary)' }}>Loading products...</span>
          </div>
        ) : result && result.items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <p className="empty-state-title">No products found</p>
            <p className="empty-state-msg">
              {filter.search ? `No results for "${filter.search}". Try a different search term.` : 'Add your first product to get started.'}
            </p>
            {!filter.search && (
              <button className="app-btn btn-primary" onClick={onCreate} style={{ marginTop: 'var(--space-sm)' }}>
                ＋ Add First Product
              </button>
            )}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className={filter.sortBy === 'productCode' ? 'sorted' : ''} onClick={() => handleSort('productCode')}>
                  Code {sortIcon('productCode')}
                </th>
                <th className={filter.sortBy === 'name' ? 'sorted' : ''} onClick={() => handleSort('name')}>
                  Name {sortIcon('name')}
                </th>
                <th>Category</th>
                <th>Brand</th>
                <th>Unit</th>
                <th>HSN/SAC</th>
                <th className={filter.sortBy === 'sellingPrice' ? 'sorted' : ''} onClick={() => handleSort('sellingPrice')}>
                  Sale Price {sortIcon('sellingPrice')}
                </th>
                <th className={filter.sortBy === 'mrp' ? 'sorted' : ''} onClick={() => handleSort('mrp')}>
                  MRP {sortIcon('mrp')}
                </th>
                <th>Type</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {result?.items.map(item => (
                <tr key={item.id}>
                  <td className="text-mono">{item.productCode}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    {item.primaryBarcode && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        🔢 {item.primaryBarcode}
                      </div>
                    )}
                  </td>
                  <td className="text-muted">{item.categoryName || '—'}</td>
                  <td className="text-muted">{item.brandName || '—'}</td>
                  <td className="text-muted">{item.unitShortName || '—'}</td>
                  <td className="text-muted">{item.hsnSacCode || '—'}</td>
                  <td>
                    {fmt(item.sellingPrice)
                      ? <span className="price-cell">{fmt(item.sellingPrice)}</span>
                      : <span className="price-na">—</span>}
                  </td>
                  <td>
                    {fmt(item.mrp)
                      ? <span className="price-cell">{fmt(item.mrp)}</span>
                      : <span className="price-na">—</span>}
                  </td>
                  <td>
                    <span className={`status-badge ${item.productType === 'SERVICE' ? 'status-service' : 'status-goods'}`}>
                      {item.productType}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${item.isActive ? 'status-active' : 'status-inactive'}`}>
                      {item.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="btn-icon" title="View" onClick={() => onView(item.id)}>👁</button>
                      <button className="btn-icon" title="Edit" onClick={() => onEdit(item.id)}>✏️</button>
                      <button
                        className={`btn-icon ${item.isActive ? 'btn-danger' : ''}`}
                        title={item.isActive ? 'Deactivate' : 'Activate'}
                        onClick={() => toggleActive(item)}
                      >
                        {item.isActive ? '⏸' : '▶'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalItems > 0 && (
        <div className="pagination">
          <span>
            Showing {((pagination.page - 1) * pagination.pageSize) + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.totalItems)} of {pagination.totalItems} products
          </span>
          <div className="pagination-controls">
            <button className="page-btn" disabled={pagination.page <= 1} onClick={() => handlePage(1)} title="First">«</button>
            <button className="page-btn" disabled={pagination.page <= 1} onClick={() => handlePage(pagination.page - 1)} title="Prev">‹</button>
            <span style={{ padding: '0 var(--space-sm)', fontSize: '0.85rem' }}>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button className="page-btn" disabled={pagination.page >= pagination.totalPages} onClick={() => handlePage(pagination.page + 1)} title="Next">›</button>
            <button className="page-btn" disabled={pagination.page >= pagination.totalPages} onClick={() => handlePage(pagination.totalPages)} title="Last">»</button>
          </div>
        </div>
      )}
    </div>
  );
}
