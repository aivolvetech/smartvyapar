import { FormEvent, useEffect, useState } from 'react';
import { Supplier } from '../../../shared/models/supplier-purchase';

interface Props {
  supplierId?: string;
  onSaved: (supplier: Supplier) => void;
  onCancel: () => void;
}

export default function SupplierForm({ supplierId, onSaved, onCancel }: Props) {
  const [form, setForm] = useState<any>({
    supplierCode: '',
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    gstNumber: '',
    panNumber: '',
    city: '',
    state: '',
    paymentTermsDays: 0,
    creditLimit: 0,
    openingBalance: 0,
    openingBalanceType: 'NONE',
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supplierId) return;
    (async () => {
      const res = await (window as any).smartVyapar.getSupplierById(supplierId);
      if (res.success && res.data) setForm(res.data);
      else setError(res.error || 'Supplier not found.');
    })();
  }, [supplierId]);

  const set = (key: string, value: any) => setForm((prev: any) => ({ ...prev, [key]: value }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      ...form,
      paymentTermsDays: Number(form.paymentTermsDays || 0),
      creditLimit: Number(form.creditLimit || 0),
      openingBalance: Number(form.openingBalance || 0),
    };
    const res = supplierId
      ? await (window as any).smartVyapar.updateSupplier(supplierId, payload)
      : await (window as any).smartVyapar.createSupplier(payload);
    setSaving(false);
    if (!res.success) {
      setError(res.error || 'Supplier save failed.');
      return;
    }
    onSaved(res.data);
  };

  return (
    <form onSubmit={save} className="card-surface form-layout" style={{ maxWidth: 980 }}>
      <h3 style={{ margin: 0 }}>{supplierId ? 'Edit Supplier' : 'Create Supplier'}</h3>
      {error && <div className="inline-error">{error}</div>}
      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <label className="form-group">Supplier Code *<input className="form-input" value={form.supplierCode} onChange={e => set('supplierCode', e.target.value)} /></label>
        <label className="form-group">Supplier Name *<input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} /></label>
        <label className="form-group">Contact Person<input className="form-input" value={form.contactPerson || ''} onChange={e => set('contactPerson', e.target.value)} /></label>
        <label className="form-group">Phone<input className="form-input" value={form.phone || ''} onChange={e => set('phone', e.target.value)} /></label>
        <label className="form-group">Email<input className="form-input" value={form.email || ''} onChange={e => set('email', e.target.value)} /></label>
        <label className="form-group">GST Number<input className="form-input" value={form.gstNumber || ''} onChange={e => set('gstNumber', e.target.value)} /></label>
        <label className="form-group">PAN<input className="form-input" value={form.panNumber || ''} onChange={e => set('panNumber', e.target.value)} /></label>
        <label className="form-group">City<input className="form-input" value={form.city || ''} onChange={e => set('city', e.target.value)} /></label>
        <label className="form-group">State<input className="form-input" value={form.state || ''} onChange={e => set('state', e.target.value)} /></label>
        <label className="form-group">Payment Terms<input className="form-input" type="number" min="0" value={form.paymentTermsDays || 0} onChange={e => set('paymentTermsDays', e.target.value)} /></label>
        <label className="form-group">Credit Limit<input className="form-input" type="number" min="0" step="0.01" value={form.creditLimit || 0} onChange={e => set('creditLimit', e.target.value)} /></label>
        <label className="form-group">Opening Balance<input className="form-input" type="number" min="0" step="0.01" value={form.openingBalance || 0} onChange={e => set('openingBalance', e.target.value)} disabled={!!supplierId} /></label>
        <label className="form-group">Opening Type<select className="form-input" value={form.openingBalanceType || 'NONE'} onChange={e => set('openingBalanceType', e.target.value)} disabled={!!supplierId}><option>NONE</option><option>PAYABLE</option><option>RECEIVABLE</option></select></label>
        <label className="form-group">Status<select className="form-input" value={form.isActive ? 'true' : 'false'} onChange={e => set('isActive', e.target.value === 'true')}><option value="true">Active</option><option value="false">Inactive</option></select></label>
      </div>
      <label className="form-group">Notes<textarea className="form-input" value={form.notes || ''} onChange={e => set('notes', e.target.value)} /></label>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button className="app-btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Supplier'}</button>
        <button type="button" className="app-btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
