export default function CustomerOutstandingCard({ outstanding }: { outstanding: number }) {
  const isAdvance = outstanding < -0.001;
  const isDue = outstanding > 0.001;
  
  let label = 'Settled';
  let badgeClass = 'badge-connected'; // green
  if (isDue) {
    label = 'Receivable (Customer owes you)';
    badgeClass = 'badge-offline'; // orange/red in some stylesheets, or we can use custom inline
  } else if (isAdvance) {
    label = 'Advance (Shop owes customer)';
    badgeClass = 'pill-badge'; // neutral
  }

  return (
    <div className="card-surface" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>
        Customer Outstanding
      </div>
      <div style={{ fontSize: '1.8rem', fontWeight: 700, color: isDue ? '#f87171' : isAdvance ? '#60a5fa' : 'var(--text-primary)' }}>
        Rs {Math.abs(outstanding).toFixed(2)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span className={`pill-badge ${badgeClass}`} style={{ fontSize: '0.75rem' }}>{label}</span>
      </div>
    </div>
  );
}
