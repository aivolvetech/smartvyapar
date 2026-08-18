import { useState } from 'react';
import DamageStockForm from './DamageStockForm';
import ExpiredStockForm from './ExpiredStockForm';
import InventoryAdjustmentForm from './InventoryAdjustmentForm';
import InventoryMovementHistory from './InventoryMovementHistory';
import InventoryOverview from './InventoryOverview';
import InventoryStockList from './InventoryStockList';
import LostStockForm from './LostStockForm';
import ProductStockView from './ProductStockView';

type InventoryRoute =
  | { page: 'OVERVIEW' }
  | { page: 'STOCK_LIST' }
  | { page: 'MOVEMENTS' }
  | { page: 'ADJUSTMENT' }
  | { page: 'ADJUSTMENT_OUT' }
  | { page: 'DAMAGE' }
  | { page: 'EXPIRY' }
  | { page: 'LOSS' }
  | { page: 'PRODUCT_STOCK'; productId: string };

export default function InventoryModule({ onNavigateToImport }: { onNavigateToImport?: () => void }) {
  const [route, setRoute] = useState<InventoryRoute>({ page: 'OVERVIEW' });

  return (
    <div className="product-module">
      <div className="sub-nav" style={{ padding: '0 var(--space-lg)', borderBottom: '1px solid var(--border-color)' }}>
        <button className={`sub-nav-btn ${route.page === 'OVERVIEW' ? 'active' : ''}`} onClick={() => setRoute({ page: 'OVERVIEW' })}>Overview</button>
        <button className={`sub-nav-btn ${route.page === 'STOCK_LIST' || route.page === 'PRODUCT_STOCK' ? 'active' : ''}`} onClick={() => setRoute({ page: 'STOCK_LIST' })}>Stock List</button>
        <button className={`sub-nav-btn ${route.page === 'MOVEMENTS' ? 'active' : ''}`} onClick={() => setRoute({ page: 'MOVEMENTS' })}>Movements</button>
        <button className={`sub-nav-btn ${route.page === 'ADJUSTMENT' ? 'active' : ''}`} onClick={() => setRoute({ page: 'ADJUSTMENT' })}>Adjust In</button>
        <button className={`sub-nav-btn ${route.page === 'ADJUSTMENT_OUT' ? 'active' : ''}`} onClick={() => setRoute({ page: 'ADJUSTMENT_OUT' })}>Adjust Out</button>
        <button className={`sub-nav-btn ${route.page === 'DAMAGE' ? 'active' : ''}`} onClick={() => setRoute({ page: 'DAMAGE' })}>Damage</button>
        <button className={`sub-nav-btn ${route.page === 'EXPIRY' ? 'active' : ''}`} onClick={() => setRoute({ page: 'EXPIRY' })}>Expiry</button>
        <button className={`sub-nav-btn ${route.page === 'LOSS' ? 'active' : ''}`} onClick={() => setRoute({ page: 'LOSS' })}>Loss</button>
      </div>

      <div className="module-body">
        {route.page === 'OVERVIEW' && <InventoryOverview onAction={(page) => setRoute({ page })} />}
        {route.page === 'STOCK_LIST' && <InventoryStockList onViewProduct={(productId) => setRoute({ page: 'PRODUCT_STOCK', productId })} onImportOpening={onNavigateToImport} />}
        {route.page === 'MOVEMENTS' && <InventoryMovementHistory />}
        {route.page === 'ADJUSTMENT' && <InventoryAdjustmentForm mode="ADJUSTMENT_IN" onPosted={() => setRoute({ page: 'STOCK_LIST' })} />}
        {route.page === 'ADJUSTMENT_OUT' && <InventoryAdjustmentForm mode="ADJUSTMENT_OUT" onPosted={() => setRoute({ page: 'STOCK_LIST' })} />}
        {route.page === 'DAMAGE' && <DamageStockForm onPosted={() => setRoute({ page: 'STOCK_LIST' })} />}
        {route.page === 'EXPIRY' && <ExpiredStockForm onPosted={() => setRoute({ page: 'STOCK_LIST' })} />}
        {route.page === 'LOSS' && <LostStockForm onPosted={() => setRoute({ page: 'STOCK_LIST' })} />}
        {route.page === 'PRODUCT_STOCK' && <ProductStockView productId={route.productId} onBack={() => setRoute({ page: 'STOCK_LIST' })} />}
      </div>
    </div>
  );
}
