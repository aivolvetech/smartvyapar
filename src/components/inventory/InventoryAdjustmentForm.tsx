import { useEffect, useMemo, useState } from 'react';
import { InventoryStockSummary, InventorySummaryResult, IPCResponse } from '../../../shared/types/ipc';

type Mode = 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'DAMAGE_OUT' | 'EXPIRY_OUT' | 'LOSS_OUT';

interface Props {
  mode: Mode;
  onPosted: () => void;
}

const labels: Record<Mode, string> = {
  ADJUSTMENT_IN: 'Adjustment In',
  ADJUSTMENT_OUT: 'Adjustment Out',
  DAMAGE_OUT: 'Record Damage',
  EXPIRY_OUT: 'Record Expiry',
  LOSS_OUT: 'Record Loss',
};

export default function InventoryAdjustmentForm({ mode, onPosted }: Props) {
  const [products, setProducts] = useState<InventoryStockSummary[]>([]);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    (window as any).smartVyapar.getInventorySummary({
      isActive: true,
      page: 1,
      pageSize: 200,
      sortBy: 'productCode',
      sortDirection: 'ASC',
    }).then((res: IPCResponse<InventorySummaryResult>) => {
      if (res.success && res.data) setProducts(res.data.items);
    });
  }, []);

  const selected = useMemo(() => products.find(p => p.productId === productId), [products, productId]);
  const qty = Number(quantity || 0);
  const signed = mode === 'ADJUSTMENT_IN' ? qty : -qty;
  const resultingStock = selected ? selected.quantityOnHand + signed : 0;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!productId) return setError('Product is required.');
    if (!qty || qty <= 0) return setError('Quantity must be greater than zero.');
    if (!reason.trim()) return setError('Reason is required.');
    if (mode === 'ADJUSTMENT_IN' && (!unitCost || Number(unitCost) < 0)) return setError('Unit cost is required for adjustment-in.');
    if (mode !== 'ADJUSTMENT_IN' && selected && resultingStock < 0 && !selected.allowNegativeStock) {
      return setError(`Insufficient stock. Available: ${selected.quantityOnHand}, requested: ${qty}.`);
    }

    const ok = window.confirm(`Post ${labels[mode]} for ${qty} units?`);
    if (!ok) return;

    setSubmitting(true);
    try {
      let res: IPCResponse<any>;
      if (mode === 'ADJUSTMENT_IN' || mode === 'ADJUSTMENT_OUT') {
        res = await (window as any).smartVyapar.postStockAdjustment({
          productId,
          adjustmentType: mode,
          quantity: qty,
          unitCost: unitCost ? Number(unitCost) : undefined,
          reason,
          notes,
          occurredAt: new Date(date).toISOString(),
        });
      } else if (mode === 'DAMAGE_OUT') {
        res = await (window as any).smartVyapar.postDamageStock({ productId, quantity: qty, reason, notes, occurredAt: new Date(date).toISOString() });
      } else if (mode === 'EXPIRY_OUT') {
        res = await (window as any).smartVyapar.postExpiredStock({ productId, quantity: qty, expiryDate: date, reason, notes });
      } else {
        res = await (window as any).smartVyapar.postLostStock({ productId, quantity: qty, reason, notes, occurredAt: new Date(date).toISOString() });
      }
      if (!res.success) {
        setError(res.error || 'Inventory posting failed.');
        return;
      }
      setSuccess('Inventory transaction posted.');
      setQuantity('');
      setUnitCost('');
      setReason('');
      setNotes('');
      onPosted();
    } catch (err: any) {
      setError(err.message || 'Inventory posting failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="card-surface form-layout" onSubmit={submit}>
      <h3 style={{ margin: 0 }}>{labels[mode]}</h3>
      {error && <div className="form-error-msg" role="alert">{error}</div>}
      {success && <div style={{ color: 'var(--color-success)' }}>{success}</div>}

      <div className="form-group">
        <label>Product</label>
        <select id="inventory-product-select" className="form-input" value={productId} onChange={e => setProductId(e.target.value)} disabled={submitting}>
          <option value="">Select inventory-tracked product</option>
          {products.map(p => <option key={p.productId} value={p.productId}>{p.productCode} - {p.productName}</option>)}
        </select>
      </div>

      {selected && (
        <div style={{ color: 'var(--text-secondary)' }}>
          Current stock: <strong style={{ color: 'white' }}>{selected.quantityOnHand}</strong> {selected.primaryUnit}
          {' '}| Result after posting: <strong style={{ color: resultingStock < 0 ? 'var(--color-error)' : 'white' }}>{resultingStock}</strong>
        </div>
      )}

      <div className="form-grid">
        <div className="form-group">
          <label>Quantity</label>
          <input id="inventory-quantity" className="form-input" type="number" min="0.001" step="0.001" value={quantity} onChange={e => setQuantity(e.target.value)} disabled={submitting} />
        </div>
        <div className="form-group">
          <label>{mode === 'ADJUSTMENT_IN' ? 'Unit Cost' : 'Unit Cost from average cost'}</label>
          <input id="inventory-unit-cost" className="form-input" type="number" min="0" step="0.01" value={unitCost} onChange={e => setUnitCost(e.target.value)} disabled={submitting || mode !== 'ADJUSTMENT_IN'} />
        </div>
        <div className="form-group">
          <label>{mode === 'EXPIRY_OUT' ? 'Expiry Date' : 'Effective Date'}</label>
          <input id="inventory-date" className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} disabled={submitting} />
        </div>
      </div>

      <div className="form-group">
        <label>Reason</label>
        <input id="inventory-reason" className="form-input" value={reason} onChange={e => setReason(e.target.value)} disabled={submitting} />
      </div>
      <div className="form-group">
        <label>Notes</label>
        <textarea id="inventory-notes" className="form-input" value={notes} onChange={e => setNotes(e.target.value)} disabled={submitting} />
      </div>
      <button className="app-btn btn-primary" type="submit" disabled={submitting}>{submitting ? 'Posting...' : `Post ${labels[mode]}`}</button>
    </form>
  );
}

