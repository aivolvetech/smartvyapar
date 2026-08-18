import { useState, useEffect } from 'react';
import { TaxRateData } from '../../../../shared/types/ipc';

export default function TaxRateManager() {
  const [rates, setRates] = useState<TaxRateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRates = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await (window as any).smartVyapar.listTaxRates(false);
      if (res.success) {
        setRates(res.data || []);
      } else {
        setError(res.error || 'Failed to load tax rates.');
      }
    } catch {
      setError('Communication failure.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRates();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      {/* Informational Box */}
      <div className="card-surface" style={{ background: 'rgba(99, 102, 241, 0.04)', border: '1px solid rgba(99, 102, 241, 0.12)' }}>
        <h4 style={{ margin: '0 0 var(--space-xs) 0', color: 'white', fontSize: '1.1rem' }}>GST Tax Slabs</h4>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>
          Tax rates are seeded by the system in accordance with official GST guidelines (CGST + SGST = total rate). Seeded rates are read-only.
        </p>
      </div>

      {/* List Card */}
      <div className="card-surface" style={{ display: 'flex', flexDirection: 'column' }}>
        <h4 style={{ margin: '0 0 var(--space-md) 0', color: 'white', fontSize: '1.1rem' }}>
          Available Tax Rates
        </h4>
        {error && <div className="inline-error" style={{ marginBottom: 'var(--space-md)' }}>{error}</div>}

        <div className="data-table-wrapper" style={{ flex: 1 }}>
          {loading ? (
            <div className="empty-state">
              <div className="spinner-sm" />
              <span>Loading...</span>
            </div>
          ) : rates.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">💰</span>
              <p className="empty-state-title">No tax rates registered</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Total Rate</th>
                  <th>Type</th>
                  <th>CGST</th>
                  <th>SGST</th>
                  <th>IGST</th>
                  <th>Effective From</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rates.map(r => (
                  <tr key={r.id}>
                    <td><strong style={{ color: 'white' }}>{r.name}</strong></td>
                    <td className="price-cell">{r.rate}%</td>
                    <td>
                      <span className={`status-badge ${r.taxType === 'GST' ? 'status-goods' : 'status-service'}`}>
                        {r.taxType}
                      </span>
                    </td>
                    <td>{r.cgstRate}%</td>
                    <td>{r.sgstRate}%</td>
                    <td>{r.igstRate}%</td>
                    <td className="text-mono">{r.effectiveFrom}</td>
                    <td>
                      <span className={`status-badge ${r.isActive ? 'status-active' : 'status-inactive'}`}>
                        {r.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
