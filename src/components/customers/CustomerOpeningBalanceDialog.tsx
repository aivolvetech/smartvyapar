import { useState } from 'react';
import { CustomerOpeningBalanceType } from '../../../shared/models/customer';

interface DialogProps {
  customerId: string;
  customerName: string;
  onClose: () => void;
  onPosted: () => void;
}

export default function CustomerOpeningBalanceDialog({ customerId, customerName, onClose, onPosted }: DialogProps) {
  const [openingDate, setOpeningDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [balanceType, setBalanceType] = useState<CustomerOpeningBalanceType>('RECEIVABLE');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) {
      setError('Amount must be a positive number greater than zero.');
      return;
    }

    if (!referenceNumber.trim()) {
      setError('Reference number is required.');
      return;
    }

    const confirmPost = window.confirm(
      'Are you sure you want to post this opening balance?\nThis will create an immutable ledger entry that cannot be edited or deleted.'
    );
    if (!confirmPost) return;

    setSubmitting(true);
    try {
      const res = await (window as any).smartVyapar.postCustomerOpeningBalance({
        customerId,
        openingDate,
        amount: amt,
        balanceType,
        referenceNumber: referenceNumber.trim(),
        notes: notes.trim() || undefined,
      });

      if (res.success) {
        onPosted();
      } else {
        setError(res.error || 'Failed to post opening balance.');
      }
    } catch (err: any) {
      setError(err.message || 'Communication error with main process.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-dialog card-surface" style={{ maxWidth: '480px', width: '100%' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Post Opening Balance</h3>
          <button type="button" className="close-btn" onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer' }}>&times;</button>
        </div>

        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Customer: <strong>{customerName}</strong>
        </p>

        {error && <div className="inline-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="form-label" htmlFor="ob-date">Opening Date</label>
            <input
              id="ob-date"
              type="date"
              className="form-input"
              value={openingDate}
              onChange={e => setOpeningDate(e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label" htmlFor="ob-amount">Amount (Rs)</label>
              <input
                id="ob-amount"
                type="number"
                step="0.01"
                min="0.01"
                className="form-input"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                disabled={submitting}
                required
              />
            </div>

            <div>
              <label className="form-label" htmlFor="ob-type">Balance Type</label>
              <select
                id="ob-type"
                className="form-input"
                value={balanceType}
                onChange={e => setBalanceType(e.target.value as CustomerOpeningBalanceType)}
                disabled={submitting}
                required
              >
                <option value="RECEIVABLE">Receivable (Debit)</option>
                <option value="ADVANCE">Advance (Credit)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="form-label" htmlFor="ob-ref">Reference Number</label>
            <input
              id="ob-ref"
              type="text"
              className="form-input"
              placeholder="e.g. OB-2026-01"
              value={referenceNumber}
              onChange={e => setReferenceNumber(e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          <div>
            <label className="form-label" htmlFor="ob-notes">Notes</label>
            <textarea
              id="ob-notes"
              className="form-input"
              rows={2}
              placeholder="Optional notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="button" className="app-btn" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="app-btn btn-primary" disabled={submitting}>
              {submitting ? 'Posting...' : 'Post Balance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
