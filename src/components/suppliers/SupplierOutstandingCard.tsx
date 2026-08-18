export default function SupplierOutstandingCard({ outstanding }: { outstanding: number }) {
  return (
    <div className="card-surface">
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Supplier Outstanding</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '0.25rem' }}>Rs {outstanding.toFixed(2)}</div>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Credits minus debits</span>
    </div>
  );
}
