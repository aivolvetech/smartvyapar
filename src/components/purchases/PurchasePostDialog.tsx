export default function PurchasePostDialog({ open, onConfirm, onCancel }: { open: boolean; onConfirm: () => void; onCancel: () => void }) {
  if (!open) return null;
  return (
    <div className="card-surface" style={{ border: '1px solid var(--color-warning)', marginTop: 12 }}>
      <strong>Post this purchase?</strong>
      <p style={{ color: 'var(--text-secondary)' }}>Stock-tracked goods will create PURCHASE_IN ledger entries and supplier payable will increase.</p>
      <button className="app-btn btn-primary" onClick={onConfirm}>Confirm Post</button> <button className="app-btn" onClick={onCancel}>Cancel</button>
    </div>
  );
}
