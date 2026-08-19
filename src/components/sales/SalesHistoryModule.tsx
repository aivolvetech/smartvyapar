import { useCallback, useEffect, useState } from 'react';
import { SalesHistoryItem, SalesHistoryResult, SalesInvoiceStatus } from '../../../shared/models/sales';

interface Props {
  shopId: string;
  onResume: (invoiceId: string) => void;
}

const emptyResult: SalesHistoryResult = { items: [], totalItems: 0, page: 1, pageSize: 25, totalPages: 0 };

export default function SalesHistoryModule({ shopId, onResume }: Props) {
  const [result, setResult] = useState<SalesHistoryResult>(emptyResult);
  const [customers, setCustomers] = useState<any[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const response = await (window as any).smartVyapar.getSalesHistory({
        shopId, dateFrom, dateTo, invoiceNumber, customerId, paymentStatus, status, page, pageSize: 25,
      });
      if (!response.success) throw new Error(response.error || 'Failed to load sales history.');
      setResult(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load sales history.');
    } finally {
      setLoading(false);
    }
  }, [shopId, dateFrom, dateTo, invoiceNumber, customerId, paymentStatus, status]);

  useEffect(() => {
    (window as any).smartVyapar.getCustomers({ page: 1, pageSize: 200, isActive: true })
      .then((response: any) => response.success && setCustomers(response.data.items || []));
    void load(1);
  }, [shopId]);

  const setQuickStatus = (value: '' | SalesInvoiceStatus) => setStatus(value);

  useEffect(() => { void load(1); }, [status]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card-surface" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {(['', 'POSTED', 'DRAFT', 'HELD', 'CANCELLED'] as const).map(value => (
            <button key={value || 'ALL'} type="button" className={`app-btn ${status === value ? 'btn-primary' : ''}`} onClick={() => setQuickStatus(value)}>
              {value || 'ALL'}
            </button>
          ))}
        </div>
        <div className="module-toolbar" style={{ flexWrap: 'wrap' }}>
          <input className="form-input" type="date" aria-label="Sales from date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} />
          <input className="form-input" type="date" aria-label="Sales to date" value={dateTo} onChange={event => setDateTo(event.target.value)} />
          <input className="form-input" placeholder="Invoice or draft number" value={invoiceNumber} onChange={event => setInvoiceNumber(event.target.value)} />
          <select className="form-input" aria-label="Sales customer" value={customerId} onChange={event => setCustomerId(event.target.value)}>
            <option value="">All customers</option>
            {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}{customer.isWalkIn ? ' (Walk-In)' : ''}</option>)}
          </select>
          <select className="form-input" aria-label="Payment status" value={paymentStatus} onChange={event => setPaymentStatus(event.target.value)}>
            <option value="">All payment statuses</option><option>UNPAID</option><option>PARTIALLY_PAID</option><option>PAID</option>
          </select>
          <select className="form-input" aria-label="Sale status" value={status} onChange={event => setStatus(event.target.value)}>
            <option value="">All sale statuses</option><option>DRAFT</option><option>HELD</option><option>POSTED</option><option>CANCELLED</option>
          </select>
          <button type="button" className="app-btn btn-primary" onClick={() => void load(1)} disabled={loading}>{loading ? 'Loading…' : 'Search'}</button>
        </div>
      </div>

      {error && <div className="inline-error">{error}</div>}
      <div className="card-surface table-scroll" style={{ padding: '1rem' }}>
        <table className="data-table">
          <thead><tr><th>Invoice No</th><th>Date / Time</th><th>Customer</th><th>Total</th><th>Paid</th><th>Outstanding</th><th>Payment</th><th>Sale Status</th><th>Actions</th></tr></thead>
          <tbody>
            {result.items.map((item: SalesHistoryItem) => (
              <tr key={item.id}>
                <td>{item.invoiceNumber || item.draftReference}</td>
                <td>{new Date(item.postedAt || item.heldAt || `${item.invoiceDate}T00:00:00`).toLocaleString()}</td>
                <td>{item.customerName}{item.isWalkIn ? ' / Walk-In' : ''}</td>
                <td>Rs {item.grandTotal.toFixed(2)}</td><td>Rs {item.paidAmount.toFixed(2)}</td><td>Rs {item.outstandingAmount.toFixed(2)}</td>
                <td>{item.paymentStatus}</td><td><span className="pill-badge">{item.status}</span></td>
                <td>{(item.status === 'DRAFT' || item.status === 'HELD') ? <button type="button" className="app-btn" onClick={() => onResume(item.id)}>Resume</button> : <span style={{ color: '#9CA3AF' }}>View</span>}</td>
              </tr>
            ))}
            {!loading && result.items.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>No sales found.</td></tr>}
          </tbody>
        </table>
      </div>
      {result.totalPages > 1 && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Page {result.page} of {result.totalPages} ({result.totalItems} records)</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}><button className="app-btn" disabled={result.page <= 1} onClick={() => void load(result.page - 1)}>Previous</button><button className="app-btn" disabled={result.page >= result.totalPages} onClick={() => void load(result.page + 1)}>Next</button></div>
      </div>}
    </div>
  );
}
