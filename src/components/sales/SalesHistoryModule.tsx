import { useCallback, useEffect, useState } from 'react';
import { SalesHistoryItem, SalesHistoryResult, SalesInvoiceStatus } from '../../../shared/models/sales';
import ReceivePaymentModal from './ReceivePaymentModal';
import PrintableReceipt from './PrintableReceipt';

interface Props {
  shopId: string;
  onResume: (invoiceId: string) => void;
}

const emptyResult: SalesHistoryResult = { items: [], totalItems: 0, page: 1, pageSize: 25, totalPages: 0 };

export default function SalesHistoryModule({ shopId, onResume }: Props) {
  const [result, setResult] = useState<SalesHistoryResult>(emptyResult);
  const [customers, setCustomers] = useState<any[]>([]);
  const [shop, setShop] = useState<any>(null);

  // Filter states
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [status, setStatus] = useState('');

  // UI state managers
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Outstanding recovery and cancellation state triggers
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [receivePaymentInvoiceId, setReceivePaymentInvoiceId] = useState<string | null>(null);
  const [cancelInvoiceId, setCancelInvoiceId] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Printing state trigger
  const [printData, setPrintData] = useState<any>(null);

  // Load sales list
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

  // Load detailed invoice for modal or print
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

  const handlePrint = (invoiceData: any) => {
    const customerObj = customers.find(c => c.id === invoiceData.customerId);
    setPrintData({
      detail: invoiceData,
      shop,
      customer: customerObj
    });
  };

  // Run window print trigger
  useEffect(() => {
    if (printData) {
      const timer = setTimeout(() => {
        window.print();
        setPrintData(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [printData]);

  // Load initial static datasets
  useEffect(() => {
    (window as any).smartVyapar.getCustomers({ page: 1, pageSize: 200, isActive: true })
      .then((response: any) => response.success && setCustomers(response.data.items || []));
    (window as any).smartVyapar.getShop()
      .then((response: any) => response.success && setShop(response.data));
    void load(1);
  }, [shopId]);

  const setQuickStatus = (value: '' | SalesInvoiceStatus) => setStatus(value);

  useEffect(() => { void load(1); }, [status]);

  // Handle Cancellation Execution
  const handleCancelInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellationReason.trim()) {
      alert('Cancellation reason is required.');
      return;
    }
    if (!cancelInvoiceId) return;

    // Find the invoice version
    const targetItem = result.items.find(item => item.id === cancelInvoiceId);
    const version = targetItem ? targetItem.version : 1;

    setCancelling(true);
    try {
      const res = await (window as any).smartVyapar.cancelSale({
        invoiceId: cancelInvoiceId,
        reason: cancellationReason.trim(),
        version
      });
      if (res.success) {
        setCancelInvoiceId(null);
        setCancellationReason('');
        setSelectedInvoice(null); // Close detail modal if open
        load(result.page);
      } else {
        alert(res.error || 'Failed to cancel sale.');
      }
    } catch (err: any) {
      alert(err.message || 'Error executing cancellation.');
    } finally {
      setCancelling(false);
    }
  };

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
          <thead>
            <tr>
              <th>Invoice No</th>
              <th>Date / Time</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Outstanding</th>
              <th>Payment</th>
              <th>Sale Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((item: SalesHistoryItem) => (
              <tr key={item.id}>
                <td style={{ fontWeight: 600 }}>{item.invoiceNumber || item.draftReference}</td>
                <td>{new Date(item.postedAt || item.heldAt || `${item.invoiceDate}T00:00:00`).toLocaleString()}</td>
                <td>{item.customerName}{item.isWalkIn ? ' / Walk-In' : ''}</td>
                <td>Rs {item.grandTotal.toFixed(2)}</td>
                <td>Rs {item.paidAmount.toFixed(2)}</td>
                <td style={{ color: item.outstandingAmount > 0.001 ? '#f87171' : 'inherit', fontWeight: item.outstandingAmount > 0.001 ? 600 : 'normal' }}>
                  Rs {item.outstandingAmount.toFixed(2)}
                </td>
                <td>
                  <span className={`pill-badge ${item.paymentStatus === 'PAID' ? 'badge-connected' : item.paymentStatus === 'PARTIALLY_PAID' ? 'badge-offline' : 'pill-badge'}`}>
                    {item.paymentStatus}
                  </span>
                </td>
                <td>
                  <span className={`pill-badge ${item.status === 'POSTED' ? 'badge-connected' : item.status === 'CANCELLED' ? 'badge-offline' : 'pill-badge'}`}>
                    {item.status}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {(item.status === 'DRAFT' || item.status === 'HELD') ? (
                      <button type="button" className="app-btn" onClick={() => onResume(item.id)}>Resume</button>
                    ) : (
                      <>
                        <button type="button" className="app-btn" onClick={() => handleViewInvoice(item.id)} disabled={loadingInvoice}>View</button>
                        {item.status === 'POSTED' && item.outstandingAmount > 0.001 && !item.isWalkIn && (
                          <button
                            type="button"
                            className="app-btn btn-primary"
                            onClick={() => setReceivePaymentInvoiceId(item.id)}
                          >
                            Pay
                          </button>
                        )}
                        {item.status === 'POSTED' && (
                          <button
                            type="button"
                            className="app-btn btn-danger"
                            onClick={() => setCancelInvoiceId(item.id)}
                          >
                            Cancel
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && result.items.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>No sales found.</td></tr>}
          </tbody>
        </table>
      </div>
      {result.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Page {result.page} of {result.totalPages} ({result.totalItems} records)</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="app-btn" disabled={result.page <= 1} onClick={() => void load(result.page - 1)}>Previous</button>
            <button className="app-btn" disabled={result.page >= result.totalPages} onClick={() => void load(result.page + 1)}>Next</button>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ width: '850px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Invoice Details</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="app-btn btn-primary" onClick={() => handlePrint(selectedInvoice)}>Print / Reprint</button>
                <button type="button" className="app-btn" onClick={() => setSelectedInvoice(null)}>Close</button>
              </div>
            </div>

            {selectedInvoice.status === 'CANCELLED' && (
              <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', color: '#f87171', marginBottom: '1rem' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>⚠️ Invoice Cancelled</div>
                <div style={{ fontSize: '0.85rem' }}>
                  <strong>Cancelled At:</strong> {new Date(selectedInvoice.cancelledAt).toLocaleString()}<br />
                  <strong>Reason:</strong> {selectedInvoice.cancellationReason || 'No reason provided'}
                </div>
              </div>
            )}
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', background: 'var(--bg-app)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div><strong style={{ color: 'var(--text-secondary)' }}>Invoice No:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{selectedInvoice.invoiceNumber || selectedInvoice.draftReference}</span></div>
                <div>
                  <strong style={{ color: 'var(--text-secondary)' }}>Status:</strong> 
                  <span className={`pill-badge ${selectedInvoice.status === 'POSTED' ? 'badge-connected' : selectedInvoice.status === 'CANCELLED' ? 'badge-offline' : 'pill-badge'}`} style={{ marginLeft: '6px' }}>
                    {selectedInvoice.status}
                  </span>
                </div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>Date:</strong> <span style={{ color: 'var(--text-primary)' }}>{selectedInvoice.invoiceDate}</span></div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div><strong style={{ color: 'var(--text-secondary)' }}>Customer:</strong> <span style={{ color: 'var(--text-primary)' }}>{customers.find(c => c.id === selectedInvoice.customerId)?.name || 'Walk-In Customer'}</span></div>
                <div>
                  <strong style={{ color: 'var(--text-secondary)' }}>Payment Status:</strong> 
                  <span className={`pill-badge ${selectedInvoice.paymentStatus === 'PAID' ? 'badge-connected' : selectedInvoice.paymentStatus === 'PARTIALLY_PAID' ? 'badge-offline' : 'pill-badge'}`} style={{ marginLeft: '6px' }}>
                    {selectedInvoice.paymentStatus || 'UNPAID'}
                  </span>
                </div>
              </div>
            </div>

            <div className="table-responsive" style={{ marginBottom: '1rem' }}>
              <table className="app-table" style={{ width: '100%' }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem', alignItems: 'start' }}>
              {/* Payment History inside detail modal */}
              <div>
                {selectedInvoice.payments && selectedInvoice.payments.length > 0 ? (
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0' }}>Payment History</h4>
                    <div className="table-responsive">
                      <table className="app-table" style={{ fontSize: '0.85rem' }}>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Amt</th>
                            <th>Mode</th>
                            <th>Source</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedInvoice.payments.map((p: any) => (
                            <tr key={p.id}>
                              <td>{new Date(p.createdAt || p.paymentDate).toLocaleDateString()}</td>
                              <td style={{ fontWeight: 600 }}>Rs {p.amount.toFixed(2)}</td>
                              <td>{p.paymentMode}</td>
                              <td style={{ fontSize: '0.75rem' }}>{p.paymentSource || 'SALE_CHECKOUT'}</td>
                              <td>
                                <span className={`pill-badge ${p.status === 'REVERSED' ? 'badge-offline' : 'badge-connected'}`}>
                                  {p.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>No payments registered.</div>
                )}
              </div>

              {/* Financial Totals */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.95rem', borderLeft: '1px solid var(--border-color)', paddingLeft: '1rem' }}>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 700, borderTop: '2px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                  <span style={{ color: 'var(--text-primary)' }}>Grand Total:</span>
                  <span style={{ color: 'var(--text-primary)' }}>Rs {selectedInvoice.cart?.grandTotal?.toFixed(2) || '0.00'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#4ade80' }}>
                  <span>Paid Amount:</span>
                  <span>Rs {selectedInvoice.paidAmount?.toFixed(2) || '0.00'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: selectedInvoice.outstandingAmount > 0.001 ? '#f87171' : 'var(--text-secondary)' }}>
                  <span>Outstanding:</span>
                  <span>Rs {selectedInvoice.outstandingAmount?.toFixed(2) || '0.00'}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions inside detail modal */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              {selectedInvoice.status === 'POSTED' && selectedInvoice.outstandingAmount > 0.001 && !selectedInvoice.isWalkIn && (
                <button
                  type="button"
                  className="app-btn btn-primary"
                  onClick={() => setReceivePaymentInvoiceId(selectedInvoice.id)}
                >
                  Receive Payment
                </button>
              )}
              {selectedInvoice.status === 'POSTED' && (
                <button
                  type="button"
                  className="app-btn btn-danger"
                  onClick={() => setCancelInvoiceId(selectedInvoice.id)}
                >
                  Cancel Sale
                </button>
              )}
              <button type="button" className="app-btn" onClick={() => setSelectedInvoice(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Outstanding Payment Modal */}
      {receivePaymentInvoiceId && (
        <ReceivePaymentModal
          invoiceId={receivePaymentInvoiceId}
          onClose={() => setReceivePaymentInvoiceId(null)}
          onSaved={() => {
            setReceivePaymentInvoiceId(null);
            if (selectedInvoice && selectedInvoice.id === receivePaymentInvoiceId) {
              handleViewInvoice(receivePaymentInvoiceId); // Reload detail modal
            }
            load(result.page);
          }}
        />
      )}

      {/* Cancellation Reason Modal */}
      {cancelInvoiceId && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Cancel Sales Invoice</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              ⚠️ <strong>Warning:</strong> Cancellation will reverse stock and financial effects. The original invoice will remain in history as CANCELLED.
            </p>

            <form onSubmit={handleCancelInvoice} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
              <div className="form-group">
                <label htmlFor="cancel-reason">Cancellation Reason <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                <input
                  id="cancel-reason"
                  type="text"
                  className="form-input"
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="e.g. Returned Goods / Typo / Customer backed out"
                  required
                  disabled={cancelling}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="app-btn" onClick={() => { setCancelInvoiceId(null); setCancellationReason(''); }} disabled={cancelling}>Dismiss</button>
                <button type="submit" className="app-btn btn-danger" disabled={cancelling || !cancellationReason.trim()}>
                  {cancelling ? 'Cancelling...' : 'Cancel Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hidden Print Container */}
      {printData && (
        <div className="printable-receipt-wrapper">
          <PrintableReceipt detail={printData.detail} shop={printData.shop} customer={printData.customer} />
        </div>
      )}
    </div>
  );
}
