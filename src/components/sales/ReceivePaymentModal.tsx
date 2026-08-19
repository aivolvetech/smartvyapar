import { useEffect, useState } from 'react';
import UPIQRCode from '../pos/UPIQRCode';

interface Props {
  invoiceId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function ReceivePaymentModal({ invoiceId, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [invoice, setInvoice] = useState<any>(null);
  const [shop, setShop] = useState<any>(null);

  // Form states
  const [amount, setAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER'>('CASH');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [upiConfirmed, setUpiConfirmed] = useState(false);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      try {
        const invRes = await (window as any).smartVyapar.getPOSDraft(invoiceId);
        if (!invRes.success) {
          if (active) setError(invRes.error || 'Failed to load invoice.');
          return;
        }

        const shopRes = await (window as any).smartVyapar.getShop();
        if (!shopRes.success) {
          if (active) setError(shopRes.error || 'Failed to load shop settings.');
          return;
        }

        if (active) {
          setInvoice(invRes.data);
          setShop(shopRes.data);
          setAmount(invRes.data.outstandingAmount || 0);
          setLoading(false);
        }
      } catch (err: any) {
        if (active) setError(err.message || 'Error loading outstanding details.');
      }
    };
    loadData();
    return () => {
      active = false;
    };
  }, [invoiceId]);

  if (loading) {
    return (
      <div className="modal-backdrop">
        <div className="modal-content" style={{ maxWidth: '400px' }}>
          <h4>Loading Outstanding Details...</h4>
          {error && <div className="inline-error">{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button className="app-btn" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  const outstanding = invoice.outstandingAmount || 0;
  const isUpi = paymentMode === 'UPI';
  const hasMerchantUpi = !!shop?.merchantUpiId;

  // Generate UPI payment URL
  const generateUpiUri = () => {
    if (!shop?.merchantUpiId) return '';
    const pa = encodeURIComponent(shop.merchantUpiId);
    const pn = encodeURIComponent(shop.name || 'Smart Vyapar Shop');
    const am = amount.toFixed(2);
    const tr = invoice.id;
    const tn = encodeURIComponent(`Bill Rec ${invoice.invoiceNumber || invoice.draftReference}`);
    return `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=INR&tr=${tr}&tn=${tn}`;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (amount <= 0 || isNaN(amount)) {
      setError('Amount must be greater than zero.');
      return;
    }

    if (amount > outstanding + 0.001) {
      setError(`Amount cannot exceed the remaining outstanding balance of Rs ${outstanding.toFixed(2)}.`);
      return;
    }

    if (isUpi && !hasMerchantUpi) {
      setError('Merchant UPI ID is not configured in shop settings. Cannot collect via UPI.');
      return;
    }

    if (isUpi && !upiConfirmed) {
      setError('Please check and confirm that UPI payment has been received.');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        invoiceId,
        paymentMode,
        amount,
        referenceNumber: referenceNumber.trim() || null
      };

      if (isUpi) {
        payload.paymentContext = {
          upiConfirmed: true,
          confirmedUpiAmount: amount
        };
      }

      const res = await (window as any).smartVyapar.receiveCustomerPayment(payload);
      if (res.success) {
        onSaved();
      } else {
        setError(res.error || 'Failed to record outstanding payment.');
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with background service.');
    } finally {
      setSaving(false);
    }
  };

  const isInvalid = amount <= 0 || amount > outstanding + 0.001 || (isUpi && (!hasMerchantUpi || !upiConfirmed));

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '450px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Receive Outstanding Payment</h3>
          <button className="app-btn-icon" onClick={onClose} disabled={saving}>✕</button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {error && <div className="inline-error">{error}</div>}

          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <div className="info-row"><span className="info-key">Invoice / Ref</span><span className="info-val" style={{ fontWeight: 600 }}>{invoice.invoiceNumber || invoice.draftReference}</span></div>
            <div className="info-row"><span className="info-key">Customer</span><span className="info-val">{invoice.cart?.customerName || 'Registered Customer'}</span></div>
            <div className="info-row"><span className="info-key">Total Bill</span><span className="info-val">Rs {(invoice.cart?.grandTotal || invoice.grandTotal || 0).toFixed(2)}</span></div>
            <div className="info-row"><span className="info-key">Outstanding Balance</span><span className="info-val" style={{ color: '#f87171', fontWeight: 600 }}>Rs {outstanding.toFixed(2)}</span></div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.25rem 0' }} />

          <div className="form-group">
            <label htmlFor="rpm-amount">Payment Amount (Rs) <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <input
              id="rpm-amount"
              type="number"
              step="0.01"
              className="form-input"
              value={amount === 0 ? '' : amount}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setAmount(isNaN(val) ? 0 : val);
                setUpiConfirmed(false); // Invalidate confirmation if amount changes
              }}
              required
              disabled={saving}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="rpm-mode">Payment Mode <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <select
              id="rpm-mode"
              className="form-input"
              value={paymentMode}
              onChange={(e) => {
                setPaymentMode(e.target.value as any);
                setUpiConfirmed(false);
              }}
              disabled={saving}
            >
              <option value="CASH">CASH</option>
              <option value="UPI">UPI (Offline QR)</option>
              <option value="CARD">CARD (POS Device)</option>
              <option value="BANK_TRANSFER">BANK TRANSFER</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="rpm-ref">Reference / Transaction Number {paymentMode !== 'CASH' && <span style={{ color: 'var(--danger-color)' }}>*</span>}</label>
            <input
              id="rpm-ref"
              type="text"
              className="form-input"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder={isUpi ? 'Enter UTR number' : paymentMode === 'CARD' ? 'Card Transaction ID' : paymentMode === 'BANK_TRANSFER' ? 'IMPS/NEFT Ref Number' : 'Optional receipt memo'}
              required={paymentMode !== 'CASH'}
              disabled={saving}
            />
          </div>

          {isUpi && (
            <div className="card-surface" style={{ background: 'var(--bg-app)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '0.75rem' }}>
              {!hasMerchantUpi ? (
                <div className="inline-error" style={{ fontSize: '0.8rem', margin: 0 }}>
                  ⚠️ merchantUpiId is not configured in Shop Settings. UPI QR cannot be loaded.
                </div>
              ) : (
                <>
                  <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>Scan QR to Pay: Rs {amount.toFixed(2)}</div>
                  <UPIQRCode value={generateUpiUri()} size={140} />
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>UPI ID: {shop.merchantUpiId}</div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', width: '100%', justifyContent: 'center' }}>
                    <input
                      id="rpm-confirm-checkbox"
                      type="checkbox"
                      checked={upiConfirmed}
                      onChange={(e) => setUpiConfirmed(e.target.checked)}
                      disabled={saving}
                      style={{ transform: 'scale(1.15)', cursor: 'pointer' }}
                    />
                    <label htmlFor="rpm-confirm-checkbox" style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', color: upiConfirmed ? '#4ade80' : 'var(--text-primary)' }}>
                      Payment Confirmed (Manual Verification)
                    </label>
                  </div>
                </>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" className="app-btn" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="app-btn btn-primary" disabled={saving || isInvalid}>
              {saving ? 'Processing...' : 'Record Receipt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
