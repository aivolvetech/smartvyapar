import { useState, useEffect } from 'react';
import { CustomerListItem, CustomerFilter, CustomerType } from '../../../shared/models/customer';
import CustomerStatusBadge from './CustomerStatusBadge';

interface ListProps {
  onView: (id: string) => void;
  onEdit: (item: any) => void;
  onCreate: () => void;
  refreshTrigger: number;
}

export default function CustomerList({ onView, onEdit, onCreate, refreshTrigger }: ListProps) {
  const [items, setItems] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filter parameters
  const [search, setSearch] = useState('');
  const [customerType, setCustomerType] = useState<CustomerType | 'ALL'>('ALL');
  const [isActive, setIsActive] = useState<boolean | 'ALL'>('ALL');
  const [outstandingState, setOutstandingState] = useState<'ALL' | 'DUE' | 'ADVANCE' | 'ZERO'>('ALL');

  // Paging & Sorting
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [sortBy, setSortBy] = useState<'customerCode' | 'name' | 'customerType' | 'outstanding' | 'updatedAt'>('name');
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('ASC');

  const loadCustomers = async () => {
    setLoading(true);
    setError('');
    try {
      const filter: CustomerFilter = {
        search: search.trim() || undefined,
        customerType: customerType !== 'ALL' ? customerType : undefined,
        isActive: isActive !== 'ALL' ? isActive : undefined,
        outstandingState: outstandingState,
        page,
        pageSize,
        sortBy,
        sortDirection,
      };

      const res = await (window as any).smartVyapar.getCustomers(filter);
      if (res.success) {
        setItems(res.data.items || []);
        setTotalPages(res.data.pagination.totalPages || 1);
        setTotalItems(res.data.pagination.totalItems || 0);
      } else {
        setError(res.error || 'Failed to query customer list.');
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with main process.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [search, customerType, isActive, outstandingState, page, sortBy, sortDirection, refreshTrigger]);

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const res = await (window as any).smartVyapar.setCustomerActive(id, !currentActive);
      if (res.success) {
        loadCustomers();
      } else {
        alert(res.error || 'Failed to update active state.');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred.');
    }
  };

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortDirection(prev => (prev === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortBy(column);
      setSortDirection('ASC');
    }
    setPage(1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Filters card */}
      <div className="card-surface" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Search Filters</h3>
          <button type="button" className="app-btn btn-primary" onClick={onCreate}>
            + Add Customer
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '1rem' }}>
          <div>
            <label className="form-label" htmlFor="filter-search">Search</label>
            <input
              id="filter-search"
              type="text"
              className="form-input"
              placeholder="Search by code, name, phone, GST..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div>
            <label className="form-label" htmlFor="filter-type">Customer Type</label>
            <select
              id="filter-type"
              className="form-input"
              value={customerType}
              onChange={e => {
                setCustomerType(e.target.value as any);
                setPage(1);
              }}
            >
              <option value="ALL">All Types</option>
              <option value="RETAIL">Retail</option>
              <option value="WHOLESALE">Wholesale</option>
              <option value="DISTRIBUTOR">Distributor</option>
              <option value="CORPORATE">Corporate</option>
              <option value="WALK_IN">Walk-In</option>
            </select>
          </div>

          <div>
            <label className="form-label" htmlFor="filter-status">Status</label>
            <select
              id="filter-status"
              className="form-input"
              value={isActive === 'ALL' ? 'ALL' : isActive ? 'true' : 'false'}
              onChange={e => {
                const val = e.target.value;
                setIsActive(val === 'ALL' ? 'ALL' : val === 'true');
                setPage(1);
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="true">Active Only</option>
              <option value="false">Inactive Only</option>
            </select>
          </div>

          <div>
            <label className="form-label" htmlFor="filter-outstanding">Outstanding</label>
            <select
              id="filter-outstanding"
              className="form-input"
              value={outstandingState}
              onChange={e => {
                setOutstandingState(e.target.value as any);
                setPage(1);
              }}
            >
              <option value="ALL">All Balances</option>
              <option value="DUE">Receivables (DUE)</option>
              <option value="ADVANCE">Advances (ADV)</option>
              <option value="ZERO">Zero Balances (ZERO)</option>
            </select>
          </div>
        </div>
      </div>

      {error && <div className="inline-error">{error}</div>}

      {/* Results grid */}
      <div className="card-surface" style={{ padding: '0 0 1rem 0' }}>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('customerCode')} style={{ cursor: 'pointer' }}>
                  Code {sortBy === 'customerCode' && (sortDirection === 'ASC' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
                  Name {sortBy === 'name' && (sortDirection === 'ASC' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('customerType')} style={{ cursor: 'pointer' }}>
                  Type {sortBy === 'customerType' && (sortDirection === 'ASC' ? '▲' : '▼')}
                </th>
                <th>Phone</th>
                <th>GSTIN</th>
                <th>City / State</th>
                <th onClick={() => handleSort('outstanding')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                  Outstanding (Rs) {sortBy === 'outstanding' && (sortDirection === 'ASC' ? '▲' : '▼')}
                </th>
                <th>Status</th>
                <th style={{ textAlign: 'right', paddingRight: '1rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const isDue = item.outstanding > 0.001;
                const isAdvance = item.outstanding < -0.001;
                const formattedOut = isAdvance
                  ? `Rs ${Math.abs(item.outstanding).toFixed(2)} (Adv)`
                  : `Rs ${item.outstanding.toFixed(2)}`;

                return (
                  <tr key={item.id}>
                    <td>
                      <span className="info-key" style={{ fontSize: '0.8rem' }}>{item.customerCode}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => onView(item.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          color: 'var(--accent-color)',
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          fontWeight: 600,
                          textAlign: 'left',
                        }}
                      >
                        {item.name}
                      </button>
                    </td>
                    <td>
                      <span className="pill-badge" style={{ background: 'var(--bg-app)', fontSize: '0.85rem' }}>
                        {item.customerType}
                      </span>
                    </td>
                    <td>{item.phone || '-'}</td>
                    <td>{item.gstNumber || '-'}</td>
                    <td>{item.city ? `${item.city}, ${item.state || ''}` : '-'}</td>
                    <td style={{
                      textAlign: 'right',
                      fontWeight: 600,
                      color: isDue ? '#f87171' : isAdvance ? '#60a5fa' : 'var(--text-secondary)'
                    }}>
                      {formattedOut}
                    </td>
                    <td>
                      <CustomerStatusBadge active={item.isActive} />
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: '1rem' }}>
                      <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
                        <button type="button" className="app-btn btn-sm" onClick={() => onView(item.id)}>
                          View
                        </button>
                        <button type="button" className="app-btn btn-sm" onClick={() => onEdit(item)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="app-btn btn-sm"
                          disabled={item.isWalkIn}
                          onClick={() => handleToggleActive(item.id, item.isActive)}
                          style={{
                            background: item.isActive ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                            color: item.isActive ? 'var(--text-error)' : 'var(--text-success)',
                            border: 'none'
                          }}
                        >
                          {item.isActive ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem var(--space-md)', color: 'var(--text-muted)' }}>
                    No customer accounts found matching current query parameters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paging controls */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1rem 0 1rem', borderTop: '1px solid var(--border-color)', marginTop: '1rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Showing {items.length} of {totalItems} customers
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="app-btn"
                disabled={page <= 1}
                onClick={() => setPage(prev => Math.max(prev - 1, 1))}
              >
                Previous
              </button>
              <span style={{ alignSelf: 'center', fontSize: '0.9rem' }}>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="app-btn"
                disabled={page >= totalPages}
                onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
