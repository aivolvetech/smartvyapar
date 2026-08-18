import { useState } from 'react';
import PurchaseForm from './PurchaseForm';
import PurchaseList from './PurchaseList';
import PurchaseView from './PurchaseView';

type Route = { page: 'LIST' } | { page: 'CREATE' } | { page: 'EDIT'; id: string } | { page: 'VIEW'; id: string };

export default function PurchaseModule() {
  const [route, setRoute] = useState<Route>({ page: 'LIST' });
  return (
    <div className="product-module">
      <div className="sub-nav" style={{ padding: '0 var(--space-lg)', borderBottom: '1px solid var(--border-color)' }}>
        <button className={`sub-nav-btn ${route.page === 'LIST' ? 'active' : ''}`} onClick={() => setRoute({ page: 'LIST' })}>Purchase List</button>
        <button className={`sub-nav-btn ${route.page === 'CREATE' ? 'active' : ''}`} onClick={() => setRoute({ page: 'CREATE' })}>Create Purchase</button>
      </div>
      <div className="module-body">
        {route.page === 'LIST' && <PurchaseList onCreate={() => setRoute({ page: 'CREATE' })} onView={id => setRoute({ page: 'VIEW', id })} onEdit={id => setRoute({ page: 'EDIT', id })} />}
        {route.page === 'CREATE' && <PurchaseForm onSaved={id => setRoute({ page: 'VIEW', id })} onCancel={() => setRoute({ page: 'LIST' })} />}
        {route.page === 'EDIT' && <PurchaseForm purchaseId={route.id} onSaved={id => setRoute({ page: 'VIEW', id })} onCancel={() => setRoute({ page: 'LIST' })} />}
        {route.page === 'VIEW' && <PurchaseView purchaseId={route.id} onBack={() => setRoute({ page: 'LIST' })} onEdit={() => setRoute({ page: 'EDIT', id: route.id })} />}
      </div>
    </div>
  );
}
