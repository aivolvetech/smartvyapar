import { useEffect, useState } from 'react';
import { CustomerDetail } from '../../../shared/models/customer';
import CustomerOutstandingCard from './CustomerOutstandingCard';
import CustomerStatusBadge from './CustomerStatusBadge';
import CustomerLedgerList from './CustomerLedgerList';
import CustomerOpeningBalanceDialog from './CustomerOpeningBalanceDialog';
import ReceivePaymentModal from '../sales/ReceivePaymentModal';

interface ViewProps {
  customerId: string;
  onBack: () => void;
  onEdit: () => void;
}

export default function CustomerView({ customerId, onBack, onEdit }: ViewProps) {
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState('');
  const [showObDialog, setShowObDialog] = useState(false);
  const [hasOpeningBalance, setHasOpeningBalance] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Outstanding recovery states
  const [showPendingList, setShowPendingList] = useState(false);
  const [pendingInvoices, setPendingInvoices] = useState<any[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  const handleOpenPendingList = async () => {
    if (!detail) return;
    setLoadingPending(true);
    setError('');
    try {
      const res = await (window as any).smartVyapar.getSalesHistory({
        shopId: detail.customer.shopId,
        customerId,
        status: 'POSTED',
        pageSize: 100
      });
      if (res.success) {
        const filtered = (res.data.items || []).filter((item: any) => item.outstandingAmount > 0.001);
        setPendingInvoices(filtered);
        setShowPendingList(true);
      } else {
        setError(res.error || 'Failed to retrieve pending invoices.');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching pending invoices.');
    } finally {
      setLoadingPending(false);
    }
  };

  const loadCustomer = async () => {
    setError('');
    try {
      const res = await (window as any).smartVyapar.getCustomerById(customerId);
      if (res.success) {
        setDetail(res.data);
        
        // Check if opening balance already exists in the ledger
        const ledgerRes = await (window as any).smartVyapar.getCustomerLedger(customerId, { page: 1, pageSize: 50 });
        if (ledgerRes.success) {
          const hasOb = (ledgerRes.data.items || []).some(
            (e: any) => e.entryType === 'OPENING_BALANCE'
          );
          setHasOpeningBalance(hasOb);
        }
      } else {
        setError(res.error || 'Customer not found.');
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with main process.');
    }
  };

  useEffect(() => {
    loadCustomer();
  }, [customerId, refreshKey]);

  if (error) return <div className="inline-error">{error}</div>;
  if (!detail) return <div className="card-surface">Loading customer details...</div>;

  const { customer, priceBookName, outstandingSummary } = detail;

  const showPostObButton = !customer.isWalkIn && !hasOpeningBalance;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1rem', alignItems: 'start' }}>
        <div className="card-surface" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.4rem' }}>{customer.name}</h3>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {customer.isWalkIn && <span className="pill-badge" style={{ background: '#7c3aed', color: 'white' }}>Walk-In</span>}
              <CustomerStatusBadge active={customer.isActive} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
            <div>
              <div className="info-row"><span className="info-key">Customer Code</span><span className="info-val">{customer.customerCode}</span></div>
              <div className="info-row"><span className="info-key">Type</span><span className="info-val">{customer.customerType}</span></div>
              <div className="info-row"><span className="info-key">Contact Person</span><span className="info-val">{customer.contactPerson || '-'}</span></div>
              <div className="info-row"><span className="info-key">Phone</span><span className="info-val">{customer.phone || '-'}</span></div>
              <div className="info-row"><span className="info-key">Alternate Phone</span><span className="info-val">{customer.alternatePhone || '-'}</span></div>
              <div className="info-row"><span className="info-key">Email</span><span className="info-val">{customer.email || '-'}</span></div>
            </div>
            <div>
              <div className="info-row"><span className="info-key">GSTIN</span><span className="info-val">{customer.gstNumber || '-'}</span></div>
              <div className="info-row"><span className="info-key">PAN</span><span className="info-val">{customer.panNumber || '-'}</span></div>
              <div className="info-row"><span className="info-key">Price Book</span><span className="info-val">{priceBookName || 'Default Price List'}</span></div>
              <div className="info-row"><span className="info-key">Credit Terms (Days)</span><span className="info-val">{customer.paymentTermsDays || 'Immediate (0)'}</span></div>
              <div className="info-row"><span className="info-key">Credit Limit (Rs)</span><span className="info-val">{customer.creditLimit ? customer.creditLimit.toFixed(2) : 'No Limit'}</span></div>
              <div className="info-row"><span className="info-key">Country</span><span className="info-val">{customer.country}</span></div>
            </div>
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <span className="info-key" style={{ display: 'block', marginBottom: '0.25rem' }}>Address</span>
            <div className="card-surface" style={{ background: 'var(--bg-app)', padding: '0.5rem', fontSize: '0.85rem' }}>
              <strong>Billing:</strong> {[customer.billingAddressLine1, customer.billingAddressLine2, customer.city, customer.state, customer.postalCode].filter(Boolean).join(', ') || '-'}<br />
              <strong>Shipping:</strong> {[customer.shippingAddressLine1, customer.shippingAddressLine2, customer.city, customer.state, customer.postalCode].filter(Boolean).join(', ') || '-'}
            </div>
          </div>

          {customer.notes && (
            <div style={{ marginTop: '0.25rem' }}>
              <span className="info-key" style={{ display: 'block', marginBottom: '0.25rem' }}>Notes</span>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{customer.notes}</p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="button" className="app-btn" onClick={onBack}>
              Back to List
            </button>
            <button type="button" className="app-btn btn-primary" onClick={onEdit}>
              Edit Profile
            </button>
            {showPostObButton && (
              <button
                type="button"
                className="app-btn"
                style={{ background: 'var(--border-color)', color: 'white' }}
                onClick={() => setShowObDialog(true)}
              >
                Post Opening Balance
              </button>
            )}
          </div>
        </div>

        <CustomerOutstandingCard
          outstanding={outstandingSummary.outstanding}
          onReceivePayment={!customer.isWalkIn && outstandingSummary.outstanding > 0.001 ? handleOpenPendingList : undefined}
        />
      </div>

      {loadingPending && <div style={{ color: 'var(--text-secondary)' }}>Loading pending invoices...</div>}

      <CustomerLedgerList customerId={customer.id} />

      {showObDialog && (
        <CustomerOpeningBalanceDialog
          customerId={customer.id}
          customerName={customer.name}
          onClose={() => setShowObDialog(false)}
          onPosted={() => {
            setShowObDialog(false);
            setRefreshKey(prev => prev + 1);
          }}
        />
      )}

      {showPendingList && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Select Pending Invoice</h3>
              <button className="app-btn-icon" onClick={() => setShowPendingList(false)}>✕</button>
            </div>
            
            {pendingInvoices.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No active outstanding invoices found for this customer.
              </div>
            ) : (
              <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <table className="app-table">
                  <thead>
                    <tr>
                      <th>Invoice No</th>
                      <th>Date</th>
                      <th>Grand Total</th>
                      <th>Paid</th>
                      <th>Outstanding</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingInvoices.map((inv) => (
                      <tr key={inv.id}>
                        <td style={{ fontWeight: 600 }}>{inv.invoiceNumber || inv.draftReference}</td>
                        <td>{inv.invoiceDate}</td>
                        <td>Rs {inv.grandTotal.toFixed(2)}</td>
                        <td>Rs {inv.paidAmount.toFixed(2)}</td>
                        <td style={{ color: '#f87171', fontWeight: 600 }}>Rs {inv.outstandingAmount.toFixed(2)}</td>
                        <td>
                          <span className={`pill-badge ${inv.paymentStatus === 'PARTIALLY_PAID' ? 'badge-offline' : 'pill-badge'}`}>
                            {inv.paymentStatus}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="app-btn btn-primary"
                            style={{ padding: '0.2rem 0.5rem', minHeight: 'auto', fontSize: '0.8rem' }}
                            onClick={() => {
                              setSelectedInvoiceId(inv.id);
                              setShowPendingList(false);
                            }}
                          >
                            Select
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="button" className="app-btn" onClick={() => setShowPendingList(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {selectedInvoiceId && (
        <ReceivePaymentModal
          invoiceId={selectedInvoiceId}
          onClose={() => setSelectedInvoiceId(null)}
          onSaved={() => {
            setSelectedInvoiceId(null);
            setRefreshKey(prev => prev + 1);
          }}
        />
      )}
    </div>
  );
}
