import { useEffect, useState } from 'react';
import { Supplier } from '../../../shared/models/supplier-purchase';
import SupplierOutstandingCard from './SupplierOutstandingCard';
import SupplierStatusBadge from './SupplierStatusBadge';

export default function SupplierView({ supplierId, onBack, onEdit }: { supplierId: string; onBack: () => void; onEdit: () => void }) {
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const res = await (window as any).smartVyapar.getSupplierById(supplierId);
      if (res.success) setSupplier(res.data);
      else setError(res.error || 'Supplier not found.');
    })();
  }, [supplierId]);

  if (error) return <div className="inline-error">{error}</div>;
  if (!supplier) return <div className="card-surface">Loading supplier...</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1rem' }}>
      <div className="card-surface">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>{supplier.name}</h3>
          <SupplierStatusBadge active={supplier.isActive} />
        </div>
        <div className="info-row"><span className="info-key">Code</span><span className="info-val">{supplier.supplierCode}</span></div>
        <div className="info-row"><span className="info-key">Contact</span><span className="info-val">{supplier.contactPerson || '-'}</span></div>
        <div className="info-row"><span className="info-key">Phone</span><span className="info-val">{supplier.phone || '-'}</span></div>
        <div className="info-row"><span className="info-key">GST / PAN</span><span className="info-val">{supplier.gstNumber || '-'} / {supplier.panNumber || '-'}</span></div>
        <div className="info-row"><span className="info-key">Address</span><span className="info-val">{[supplier.addressLine1, supplier.city, supplier.state, supplier.postalCode].filter(Boolean).join(', ') || '-'}</span></div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}><button className="app-btn" onClick={onBack}>Back</button><button className="app-btn btn-primary" onClick={onEdit}>Edit</button></div>
      </div>
      <SupplierOutstandingCard outstanding={supplier.outstanding} />
    </div>
  );
}
