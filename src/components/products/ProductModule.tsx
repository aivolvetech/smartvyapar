import { useState } from 'react';
import ProductList from './ProductList';
import ProductForm from './ProductForm';
import ProductView from './ProductView';
import MastersHome from './masters/MastersHome';

type ProductRoute =
  | { page: 'LIST' }
  | { page: 'CREATE' }
  | { page: 'EDIT'; productId: string }
  | { page: 'VIEW'; productId: string }
  | { page: 'MASTERS' };

export default function ProductModule({ onNavigateToImport }: { onNavigateToImport?: () => void }) {
  const [route, setRoute] = useState<ProductRoute>({ page: 'LIST' });

  return (
    <div className="product-module">
      {/* Sub-navigation tabs for the Product Module */}
      <div className="sub-nav" style={{ padding: '0 var(--space-lg)', borderBottom: '1px solid var(--border-color)' }}>
        <button
          className={`sub-nav-btn ${route.page === 'LIST' || route.page === 'VIEW' ? 'active' : ''}`}
          onClick={() => setRoute({ page: 'LIST' })}
        >
          📦 Product List
        </button>
        <button
          className={`sub-nav-btn ${route.page === 'CREATE' || route.page === 'EDIT' ? 'active' : ''}`}
          onClick={() => setRoute({ page: 'CREATE' })}
        >
          ＋ Add Product
        </button>
        <button
          className={`sub-nav-btn ${route.page === 'MASTERS' ? 'active' : ''}`}
          onClick={() => setRoute({ page: 'MASTERS' })}
        >
          ⚙️ Product Masters
        </button>
      </div>

      <div className="module-body">
        {route.page === 'LIST' && (
          <ProductList
            onView={(id) => setRoute({ page: 'VIEW', productId: id })}
            onEdit={(id) => setRoute({ page: 'EDIT', productId: id })}
            onCreate={() => setRoute({ page: 'CREATE' })}
            onImport={onNavigateToImport}
          />
        )}

        {route.page === 'CREATE' && (
          <ProductForm
            onSuccess={() => setRoute({ page: 'LIST' })}
            onCancel={() => setRoute({ page: 'LIST' })}
          />
        )}

        {route.page === 'EDIT' && (
          <ProductForm
            productId={route.productId}
            onSuccess={() => setRoute({ page: 'LIST' })}
            onCancel={() => setRoute({ page: 'LIST' })}
          />
        )}

        {route.page === 'VIEW' && (
          <ProductView
            productId={route.productId}
            onEdit={(id) => setRoute({ page: 'EDIT', productId: id })}
            onBack={() => setRoute({ page: 'LIST' })}
          />
        )}

        {route.page === 'MASTERS' && <MastersHome />}
      </div>
    </div>
  );
}
