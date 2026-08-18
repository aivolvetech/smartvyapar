import { useEffect, useState } from 'react';
import { PurchaseListResult } from '../../../shared/models/supplier-purchase';
import PurchaseStatusBadge from './PurchaseStatusBadge';

export default function PurchaseList({ onCreate, onView, onEdit }: { onCreate: () => void; onView: (id: string) => void; onEdit: (id: string) => void }) {
  const [result, setResult] = useState<PurchaseListResult | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const load = async () => {
    const res = await (window as any).smartVyapar.getPurchases({ search: search || undefined, status: status || undefined, page: 1, pageSize: 50, sortBy: 'invoiceDate', sortDirection: 'DESC' });
    if (res.success) setResult(res.data); else setError(res.error || 'Failed to load purchases.');
  };
  useEffect(() => { load(); }, []);
  return (
    <div className="card-surface">
      <div className="module-toolbar"><input className="form-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search purchase, supplier, invoice" /><select className="form-input" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option><option>DRAFT</option><option>POSTED</option><option>CANCELLED</option></select><button className="app-btn" onClick={load}>Search</button><button className="app-btn btn-primary" onClick={onCreate}>Create Purchase</button></div>
      {error && <div className="inline-error">{error}</div>}
      <div className="table-scroll"><table className="data-table"><thead><tr><th>No.</th><th>Supplier</th><th>Supplier Inv.</th><th>Date</th><th>Due</th><th>Status</th><th>Taxable</th><th>Tax</th><th>Total</th><th>Outstanding</th><th>Actions</th></tr></thead><tbody>
        {result?.items.map(p => <tr key={p.id}><td>{p.purchaseNumber}</td><td>{p.supplierName}</td><td>{p.supplierInvoiceNumber || '-'}</td><td>{p.invoiceDate}</td><td>{p.dueDate || '-'}</td><td><PurchaseStatusBadge status={p.status} /></td><td>Rs {p.taxableAmount.toFixed(2)}</td><td>Rs {p.taxTotal.toFixed(2)}</td><td>Rs {p.grandTotal.toFixed(2)}</td><td>Rs {p.outstandingAmount.toFixed(2)}</td><td><button className="app-btn" onClick={() => onView(p.id)}>View</button> {p.status === 'DRAFT' && <button className="app-btn" onClick={() => onEdit(p.id)}>Edit</button>}</td></tr>)}
        {result?.items.length === 0 && <tr><td colSpan={11}>No purchases found.</td></tr>}
      </tbody></table></div>
    </div>
  );
}
