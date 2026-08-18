import { useEffect, useState } from 'react';
import { CustomerLedgerEntry } from '../../../shared/models/customer';

interface LedgerRow extends CustomerLedgerEntry {
  runningBalance: number;
}

export default function CustomerLedgerList({ customerId }: { customerId: string }) {
  const [entries, setEntries] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadLedger = async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch all entries for this customer to calculate accurate running balances
      // Since it's a single customer statement, fetching up to 200 items is safe and correct.
      const res = await (window as any).smartVyapar.getCustomerLedger(customerId, { page: 1, pageSize: 200 });
      if (res.success) {
        const rawEntries: CustomerLedgerEntry[] = res.data.items || [];
        
        // Sort chronologically (oldest first) to compute running balance
        const chronological = [...rawEntries].sort((a, b) => {
          const timeA = new Date(a.occurredAt).getTime();
          const timeB = new Date(b.occurredAt).getTime();
          if (timeA !== timeB) return timeA - timeB;
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });

        let running = 0;
        const mappedRows: LedgerRow[] = chronological.map(entry => {
          running += (entry.debitAmount - entry.creditAmount);
          return {
            ...entry,
            runningBalance: running
          };
        });

        // Reverse to display newest first
        mappedRows.reverse();
        setEntries(mappedRows);
      } else {
        setError(res.error || 'Failed to load ledger.');
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with main process.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLedger();
  }, [customerId]);

  if (loading) return <div style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Loading ledger statement...</div>;
  if (error) return <div className="inline-error">{error}</div>;

  return (
    <div className="card-surface" style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h4 style={{ margin: 0 }}>Receivable / Activity Statement</h4>
        <button className="app-btn" onClick={loadLedger} disabled={loading}>Refresh</button>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Reference</th>
              <th>Ref No.</th>
              <th style={{ textAlign: 'right' }}>Debit (Rs)</th>
              <th style={{ textAlign: 'right' }}>Credit (Rs)</th>
              <th style={{ textAlign: 'right' }}>Running Balance (Rs)</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(row => {
              const balVal = row.runningBalance;
              const isAdvance = balVal < -0.001;
              const formattedBal = isAdvance
                ? `Rs ${Math.abs(balVal).toFixed(2)} (Advance)`
                : `Rs ${balVal.toFixed(2)}`;

              return (
                <tr key={row.id}>
                  <td>{row.occurredAt}</td>
                  <td>
                    <span className="pill-badge" style={{ textTransform: 'capitalize', background: 'var(--bg-card)' }}>
                      {row.entryType.replace(/_/g, ' ').toLowerCase()}
                    </span>
                  </td>
                  <td>{row.referenceType}</td>
                  <td>{row.referenceNumber || '-'}</td>
                  <td style={{ textAlign: 'right', color: row.debitAmount > 0 ? '#f87171' : 'inherit' }}>
                    {row.debitAmount > 0 ? row.debitAmount.toFixed(2) : '-'}
                  </td>
                  <td style={{ textAlign: 'right', color: row.creditAmount > 0 ? '#34d399' : 'inherit' }}>
                    {row.creditAmount > 0 ? row.creditAmount.toFixed(2) : '-'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: isAdvance ? '#60a5fa' : 'inherit' }}>
                    {formattedBal}
                  </td>
                  <td>{row.notes || '-'}</td>
                </tr>
              );
            })}
            {entries.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem var(--space-md)', color: 'var(--text-muted)' }}>
                  No ledger activity logged for this customer.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
