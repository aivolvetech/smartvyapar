import { useEffect, useState } from 'react';
import { CustomerDetail } from '../../../shared/models/customer';
import CustomerOutstandingCard from './CustomerOutstandingCard';
import CustomerStatusBadge from './CustomerStatusBadge';
import CustomerLedgerList from './CustomerLedgerList';
import CustomerOpeningBalanceDialog from './CustomerOpeningBalanceDialog';

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

        <CustomerOutstandingCard outstanding={outstandingSummary.outstanding} />
      </div>

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
    </div>
  );
}
