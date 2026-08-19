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
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

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

  const handleViewInvoice = async (invoiceId: string) => {
    setLoadingInvoice(true);
    try {
      const response = await (window as any).smartVyapar.getPOSDraft(invoiceId, shopId);
      if (response.success && response.data) {
        setSelectedInvoice(response.data);
      } else {
        throw new Error(response.error || 'Failed to fetch invoice details.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to fetch invoice details.');
    } finally {
      setLoadingInvoice(false);
    }
  };

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
                <td>
                  {(item.status === 'DRAFT' || item.status === 'HELD') ? (
                    <button type="button" className="app-btn" onClick={() => onResume(item.id)}>Resume</button>
                  ) : (
                    <button type="button" className="app-btn" onClick={() => handleViewInvoice(item.id)} disabled={loadingInvoice}>View</button>
                  )}
                </td>
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

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0, 0, 0, 0.6)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="card-surface" style={{ width: '850px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.5rem' }}>Invoice Details</h3>
              <button type="button" className="app-btn" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', padding: '0.5rem 1rem' }} onClick={() => setSelectedInvoice(null)}>Close</button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', background: 'var(--bg-app)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div><strong style={{ color: 'var(--text-secondary)' }}>Invoice No:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{selectedInvoice.invoiceNumber || selectedInvoice.draftReference}</span></div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>Status:</strong> <span style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: selectedInvoice.status === 'POSTED' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', color: selectedInvoice.status === 'POSTED' ? 'var(--color-success)' : 'var(--color-warning)', marginLeft: '6px' }}>{selectedInvoice.status}</span></div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>Date:</strong> <span style={{ color: 'var(--text-primary)' }}>{selectedInvoice.invoiceDate}</span></div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div><strong style={{ color: 'var(--text-secondary)' }}>Customer:</strong> <span style={{ color: 'var(--text-primary)' }}>{customers.find(c => c.id === selectedInvoice.customerId)?.name || 'Walk-In Customer'}</span></div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>Payment Status:</strong> <span style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: selectedInvoice.paymentStatus === 'PAID' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', color: selectedInvoice.paymentStatus === 'PAID' ? 'var(--color-success)' : 'var(--color-warning)', marginLeft: '6px' }}>{selectedInvoice.paymentStatus || 'UNPAID'}</span></div>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Qty</th>
                    <th>Rate</th>
                    <th>Discount</th>
                    <th>Taxable</th>
                    <th>CGST</th>
                    <th>SGST</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.cart?.lines?.map((line: any, idx: number) => (
                    <tr key={line.id || idx}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{line.productNameSnapshot || line.productName || 'Unknown Product'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Code: {line.productCodeSnapshot || 'N/A'}</div>
                      </td>
                      <td>{line.quantity}</td>
                      <td>Rs {line.unitPrice?.toFixed(2)}</td>
                      <td>
                        {line.discountAmount > 0 ? (
                          <>
                            <div>Rs {((line.discountAmount || 0) * line.quantity).toFixed(2)}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({line.discountType === 'PERCENT' ? `${line.discountValue}%` : 'Amt'})</div>
                          </>
                        ) : '—'}
                      </td>
                      <td>Rs {line.taxableAmount?.toFixed(2)}</td>
                      <td>Rs {line.cgstAmount?.toFixed(2)} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({line.cgstRate || 0}%)</span></td>
                      <td>Rs {line.sgstAmount?.toFixed(2)} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({line.sgstRate || 0}%)</span></td>
                      <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Rs {line.lineTotal?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', alignSelf: 'flex-end', width: '320px', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', fontSize: '0.95rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Subtotal:</span>
                <span style={{ color: 'var(--text-primary)' }}>Rs {selectedInvoice.cart?.subtotal?.toFixed(2) || '0.00'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>GST Total:</span>
                <span style={{ color: 'var(--text-primary)' }}>Rs {((selectedInvoice.cart?.cgstTotal || 0) + (selectedInvoice.cart?.sgstTotal || 0))?.toFixed(2) || '0.00'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Discount Total:</span>
                <span style={{ color: 'var(--text-primary)' }}>Rs {selectedInvoice.cart?.lineDiscountTotal?.toFixed(2) || '0.00'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Round Off:</span>
                <span style={{ color: 'var(--text-primary)' }}>Rs {selectedInvoice.cart?.roundOff?.toFixed(2) || '0.00'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 700, borderTop: '2px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                <span style={{ color: 'var(--text-primary)' }}>Grand Total:</span>
                <span style={{ color: 'var(--text-primary)' }}>Rs {selectedInvoice.cart?.grandTotal?.toFixed(2) || '0.00'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--color-success)' }}>
                <span>Paid Amount:</span>
                <span>Rs {selectedInvoice.paidAmount?.toFixed(2) || '0.00'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: selectedInvoice.outstandingAmount > 0 ? 'var(--color-danger)' : 'var(--text-secondary)' }}>
                <span>Outstanding:</span>
                <span>Rs {selectedInvoice.outstandingAmount?.toFixed(2) || '0.00'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
