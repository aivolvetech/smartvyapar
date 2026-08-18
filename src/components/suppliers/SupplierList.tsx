import { useEffect, useState } from 'react';
import { SupplierListResult } from '../../../shared/models/supplier-purchase';
import SupplierStatusBadge from './SupplierStatusBadge';

interface Props {
  onCreate: () => void;
  onEdit: (id: string) => void;
  onView: (id: string) => void;
  onImport?: () => void;
}

export default function SupplierList({ onCreate, onEdit, onView, onImport }: Props) {
  const [result, setResult] = useState<SupplierListResult | null>(null);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const res = await (window as any).smartVyapar.getSuppliers({
      search: search.trim() || undefined,
      isActive: showAll ? undefined : true,
      page: 1,
      pageSize: 50,
      sortBy: 'name',
      sortDirection: 'ASC',
    });
    if (res.success) setResult(res.data);
    else setError(res.error || 'Failed to load suppliers.');
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (id: string, active: boolean) => {
    await (window as any).smartVyapar.setSupplierActive(id, !active);
    load();
  };

  return (
    <div className="card-surface">
      <div className="module-toolbar">
        <input className="form-input" placeholder="Search code, name, phone, GST" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} />
        <button className="app-btn" onClick={load}>Search</button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} /> Show inactive</label>
        <button className="app-btn" onClick={onImport}>Import Suppliers</button>
        <button className="app-btn btn-primary" onClick={onCreate}>Add Supplier</button>
      </div>
      {error && <div className="inline-error">{error}</div>}
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Code</th><th>Name</th><th>Contact</th><th>Phone</th><th>GST</th><th>City</th><th>Terms</th><th>Outstanding</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {result?.items.map(s => (
              <tr key={s.id}>
                <td>{s.supplierCode}</td><td>{s.name}</td><td>{s.contactPerson || '-'}</td><td>{s.phone || '-'}</td><td>{s.gstNumber || '-'}</td><td>{s.city || '-'}</td><td>{s.paymentTermsDays}d</td><td>Rs {s.outstanding.toFixed(2)}</td><td><SupplierStatusBadge active={s.isActive} /></td>
                <td><button className="app-btn" onClick={() => onView(s.id)}>View</button> <button className="app-btn" onClick={() => onEdit(s.id)}>Edit</button> <button className="app-btn" onClick={() => toggleActive(s.id, s.isActive)}>{s.isActive ? 'Deactivate' : 'Activate'}</button></td>
              </tr>
            ))}
            {result?.items.length === 0 && <tr><td colSpan={10}>No suppliers found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
