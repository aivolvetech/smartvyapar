import { useState } from 'react';

export default function PurchaseCancelDialog({ open, onConfirm, onCancel }: { open: boolean; onConfirm: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  if (!open) return null;
  return (
    <div className="card-surface" style={{ border: '1px solid var(--color-error)', marginTop: 12 }}>
      <strong>Cancel posted purchase</strong>
      <p style={{ color: 'var(--text-secondary)' }}>Inventory reversal and payable reversal will be created. Original purchase remains auditable.</p>
      <textarea className="form-input" placeholder="Cancellation reason" value={reason} onChange={e => setReason(e.target.value)} />
      <button className="app-btn btn-primary" disabled={!reason.trim()} onClick={() => onConfirm(reason)}>Confirm Cancel</button> <button className="app-btn" onClick={onCancel}>Back</button>
    </div>
  );
}
