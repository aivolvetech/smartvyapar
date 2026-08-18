import { useEffect, useState } from 'react';
import { SupplierListItem } from '../../../shared/models/supplier-purchase';
import PurchaseLineEditor from './PurchaseLineEditor';
import PurchasePostDialog from './PurchasePostDialog';
import PurchaseSummary from './PurchaseSummary';

export default function PurchaseForm({ purchaseId, onSaved, onCancel }: { purchaseId?: string; onSaved: (id: string) => void; onCancel: () => void }) {
  const [suppliers, setSuppliers] = useState<SupplierListItem[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [invoiceDiscountType, setInvoiceDiscountType] = useState('NONE');
  const [invoiceDiscountValue, setInvoiceDiscountValue] = useState(0);
  const [lines, setLines] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [error, setError] = useState('');
  const [postOpen, setPostOpen] = useState(false);

  const input = () => ({ supplierId, supplierInvoiceNumber, invoiceDate, dueDate, notes, invoiceDiscountType, invoiceDiscountValue, lines });

  useEffect(() => {
    (async () => {
      const sup = await (window as any).smartVyapar.getSuppliers({ page: 1, pageSize: 200, sortBy: 'name', sortDirection: 'ASC', isActive: true });
      if (sup.success) setSuppliers(sup.data.items);
      if (purchaseId) {
        const res = await (window as any).smartVyapar.getPurchaseById(purchaseId);
        if (res.success && res.data) {
          const p = res.data.invoice;
          setSupplierId(p.supplierId);
          setSupplierInvoiceNumber(p.supplierInvoiceNumber || '');
          setInvoiceDate(p.invoiceDate);
          setDueDate(p.dueDate || '');
          setNotes(p.notes || '');
          setInvoiceDiscountType(p.invoiceDiscountType);
          setInvoiceDiscountValue(p.invoiceDiscountValue);
          setLines(res.data.lines.map((l: any) => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice, mrp: l.mrp, discountType: l.discountType, discountValue: l.discountValue, taxRateId: l.taxRateId })));
          setTotals(p);
        }
      }
    })();
  }, [purchaseId]);

  useEffect(() => {
    if (!supplierId || lines.length === 0) return;
    const t = setTimeout(async () => {
      const res = await (window as any).smartVyapar.calculatePurchase(input());
      if (res.success) setTotals(res.data);
    }, 250);
    return () => clearTimeout(t);
  }, [supplierId, supplierInvoiceNumber, invoiceDate, dueDate, notes, invoiceDiscountType, invoiceDiscountValue, JSON.stringify(lines)]);

  const save = async () => {
    setError('');
    const res = purchaseId
      ? await (window as any).smartVyapar.updatePurchaseDraft(purchaseId, input())
      : await (window as any).smartVyapar.createPurchaseDraft(input());
    if (!res.success) { setError(res.error || 'Purchase save failed.'); return; }
    onSaved(res.data.invoice.id);
  };

  const post = async () => {
    setPostOpen(false);
    const id = purchaseId;
    if (!id) {
      const res = await (window as any).smartVyapar.createPurchaseDraft(input());
      if (!res.success) { setError(res.error || 'Purchase save failed.'); return; }
      const posted = await (window as any).smartVyapar.postPurchase(res.data.invoice.id);
      if (!posted.success) { setError(posted.error || 'Post failed.'); return; }
      onSaved(posted.data.invoice.id);
      return;
    }
    const saveRes = await (window as any).smartVyapar.updatePurchaseDraft(id, input());
    if (!saveRes.success) { setError(saveRes.error || 'Purchase save failed.'); return; }
    const posted = await (window as any).smartVyapar.postPurchase(id);
    if (!posted.success) { setError(posted.error || 'Post failed.'); return; }
    onSaved(posted.data.invoice.id);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: '1rem' }}>
      <div className="form-layout">
        <div className="card-surface">
          <h3 style={{ marginTop: 0 }}>{purchaseId ? 'Edit Purchase Draft' : 'Create Purchase'}</h3>
          {error && <div className="inline-error">{error}</div>}
          <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <label className="form-group">Supplier<select className="form-input" value={supplierId} onChange={e => setSupplierId(e.target.value)}><option value="">Select supplier</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.supplierCode} - {s.name}</option>)}</select></label>
            <label className="form-group">Supplier Invoice<input className="form-input" value={supplierInvoiceNumber} onChange={e => setSupplierInvoiceNumber(e.target.value)} /></label>
            <label className="form-group">Invoice Date<input className="form-input" type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} /></label>
            <label className="form-group">Due Date<input className="form-input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></label>
            <label className="form-group">Invoice Discount<select className="form-input" value={invoiceDiscountType} onChange={e => setInvoiceDiscountType(e.target.value)}><option>NONE</option><option>PERCENT</option><option>AMOUNT</option></select></label>
            <label className="form-group">Discount Value<input className="form-input" type="number" min="0" step="0.01" value={invoiceDiscountValue} onChange={e => setInvoiceDiscountValue(Number(e.target.value))} /></label>
          </div>
          <label className="form-group">Notes<textarea className="form-input" value={notes} onChange={e => setNotes(e.target.value)} /></label>
        </div>
        <PurchaseLineEditor lines={lines} setLines={setLines} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="app-btn btn-primary" onClick={save}>Save Draft</button>
          <button className="app-btn btn-primary" onClick={() => setPostOpen(true)}>Post Purchase</button>
          <button className="app-btn" onClick={onCancel}>Cancel</button>
        </div>
        <PurchasePostDialog open={postOpen} onConfirm={post} onCancel={() => setPostOpen(false)} />
      </div>
      <PurchaseSummary totals={totals} />
    </div>
  );
}
