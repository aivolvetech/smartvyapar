import { useState } from 'react';
import SupplierForm from './SupplierForm';
import SupplierList from './SupplierList';
import SupplierView from './SupplierView';

type Route = { page: 'LIST' } | { page: 'CREATE' } | { page: 'EDIT'; id: string } | { page: 'VIEW'; id: string };

export default function SupplierModule({ onNavigateToImport }: { onNavigateToImport?: () => void }) {
  const [route, setRoute] = useState<Route>({ page: 'LIST' });
  return (
    <div className="product-module">
      <div className="sub-nav" style={{ padding: '0 var(--space-lg)', borderBottom: '1px solid var(--border-color)' }}>
        <button className={`sub-nav-btn ${route.page === 'LIST' ? 'active' : ''}`} onClick={() => setRoute({ page: 'LIST' })}>Supplier List</button>
        <button className={`sub-nav-btn ${route.page === 'CREATE' ? 'active' : ''}`} onClick={() => setRoute({ page: 'CREATE' })}>Add Supplier</button>
      </div>
      <div className="module-body">
        {route.page === 'LIST' && <SupplierList onCreate={() => setRoute({ page: 'CREATE' })} onEdit={id => setRoute({ page: 'EDIT', id })} onView={id => setRoute({ page: 'VIEW', id })} onImport={onNavigateToImport} />}
        {route.page === 'CREATE' && <SupplierForm onSaved={s => setRoute({ page: 'VIEW', id: s.id })} onCancel={() => setRoute({ page: 'LIST' })} />}
        {route.page === 'EDIT' && <SupplierForm supplierId={route.id} onSaved={s => setRoute({ page: 'VIEW', id: s.id })} onCancel={() => setRoute({ page: 'LIST' })} />}
        {route.page === 'VIEW' && <SupplierView supplierId={route.id} onBack={() => setRoute({ page: 'LIST' })} onEdit={() => setRoute({ page: 'EDIT', id: route.id })} />}
      </div>
    </div>
  );
}
