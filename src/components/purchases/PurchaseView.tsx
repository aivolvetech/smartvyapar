import { useEffect, useState } from 'react';
import PurchaseCancelDialog from './PurchaseCancelDialog';
import PurchaseStatusBadge from './PurchaseStatusBadge';
import PurchaseSummary from './PurchaseSummary';

export default function PurchaseView({ purchaseId, onBack, onEdit }: { purchaseId: string; onBack: () => void; onEdit: () => void }) {
  const [detail, setDetail] = useState<any>(null);
  const [error, setError] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const load = async () => {
    const res = await (window as any).smartVyapar.getPurchaseById(purchaseId);
    if (res.success) setDetail(res.data);
    else setError(res.error || 'Purchase not found.');
  };
  useEffect(() => { load(); }, [purchaseId]);
  const post = async () => {
    const res = await (window as any).smartVyapar.postPurchase(purchaseId);
    if (!res.success) setError(res.error || 'Post failed.'); else setDetail(res.data);
  };
  const cancel = async (reason: string) => {
    const res = await (window as any).smartVyapar.cancelPurchase(purchaseId, reason);
    if (!res.success) setError(res.error || 'Cancel failed.'); else { setCancelOpen(false); setDetail(res.data); }
  };
  if (error) return <div className="inline-error">{error}</div>;
  if (!detail) return <div className="card-surface">Loading purchase...</div>;
  const p = detail.invoice;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1rem' }}>
      <div className="card-surface">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><h3 style={{ marginTop: 0 }}>{p.purchaseNumber}</h3><PurchaseStatusBadge status={p.status} /></div>
        <div className="info-row"><span className="info-key">Supplier</span><span className="info-val">{detail.supplier.name}</span></div>
        <div className="info-row"><span className="info-key">Supplier Invoice</span><span className="info-val">{p.supplierInvoiceNumber || '-'}</span></div>
        <div className="info-row"><span className="info-key">Dates</span><span className="info-val">{p.invoiceDate} / {p.dueDate || '-'}</span></div>
        <div className="table-scroll"><table className="data-table"><thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Discount</th><th>Taxable</th><th>Tax</th><th>Total</th><th>Inventory Tx</th></tr></thead><tbody>{detail.lines.map((l: any) => <tr key={l.id}><td>{l.productCodeSnapshot} - {l.productNameSnapshot}</td><td>{l.quantity}</td><td>Rs {l.unitPrice.toFixed(2)}</td><td>Rs {l.discountAmount.toFixed(2)}</td><td>Rs {l.taxableAmount.toFixed(2)}</td><td>Rs {(l.cgstAmount + l.sgstAmount + l.igstAmount + l.cessAmount).toFixed(2)}</td><td>Rs {l.lineTotal.toFixed(2)}</td><td>{l.inventoryTransactionId || '-'}</td></tr>)}</tbody></table></div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}><button className="app-btn" onClick={onBack}>Back</button>{p.status === 'DRAFT' && <button className="app-btn" onClick={onEdit}>Edit Draft</button>}{p.status === 'DRAFT' && <button className="app-btn btn-primary" onClick={post}>Post</button>}{p.status === 'POSTED' && <button className="app-btn btn-primary" onClick={() => setCancelOpen(true)}>Cancel Purchase</button>}</div>
        <PurchaseCancelDialog open={cancelOpen} onConfirm={cancel} onCancel={() => setCancelOpen(false)} />
      </div>
      <PurchaseSummary totals={p} />
    </div>
  );
}
