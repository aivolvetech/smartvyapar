import { useState, useEffect } from 'react';
import { InventoryStockSummary, ProductData } from '../../../shared/types/ipc';

interface Props {
  productId: string;
  onEdit: (id: string) => void;
  onBack: () => void;
}

export default function ProductView({ productId, onEdit, onBack }: Props) {
  const [product, setProduct] = useState<ProductData | null>(null);
  const [stock, setStock] = useState<InventoryStockSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProduct = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await (window as any).smartVyapar.getProductById(productId);
      if (res.success && res.data) {
        setProduct(res.data);
        if (res.data.productType === 'GOODS' && res.data.trackInventory) {
          const stockRes = await (window as any).smartVyapar.getProductStock(productId);
          if (stockRes.success && stockRes.data) setStock(stockRes.data);
        }
      } else {
        setError(res.error || 'Failed to retrieve product details.');
      }
    } catch (err: any) {
      setError('Unexpected communication error.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProduct();
  }, [productId]);

  const fmt = (v: number | null) => (v !== null && v !== undefined ? `₹${v.toFixed(2)}` : '—');

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner-sm" style={{ width: 28, height: 28 }} />
        <span>Loading product details...</span>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        <button className="app-btn btn-secondary" onClick={onBack} style={{ alignSelf: 'flex-start' }}>
          ← Back to List
        </button>
        <div className="inline-error">⚠️ {error || 'Product not found.'}</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {/* Header Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="app-btn btn-secondary" onClick={onBack}>
          ← Back to List
        </button>
        <button className="app-btn btn-primary" onClick={() => onEdit(product.id)}>
          ✏️ Edit Product
        </button>
      </div>

      <div className="card-surface" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        {/* Title Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: 'var(--space-md)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.5rem', color: 'white' }}>{product.name}</h3>
            <p style={{ margin: 'var(--space-xs) 0 0 0', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
              Code: {product.productCode} {product.sku ? `| SKU: ${product.sku}` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <span className={`status-badge ${product.productType === 'SERVICE' ? 'status-service' : 'status-goods'}`}>
              {product.productType}
            </span>
            <span className={`status-badge ${product.isActive ? 'status-active' : 'status-inactive'}`}>
              {product.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Detailed Grid */}
        <div className="detail-grid">
          {/* Column 1: Classification */}
          <div className="detail-section">
            <span className="detail-section-title">Classification</span>
            <div className="info-row">
              <span className="info-key">Category</span>
              <span className="info-val">{product.categoryName || '—'}</span>
            </div>
            <div className="info-row">
              <span className="info-key">Brand</span>
              <span className="info-val">{product.brandName || '—'}</span>
            </div>
            <div className="info-row">
              <span className="info-key">Unit of Measure</span>
              <span className="info-val">{product.unitName ? `${product.unitName} (${product.unitShortName})` : '—'}</span>
            </div>
          </div>

          {/* Column 2: Pricing */}
          <div className="detail-section">
            <span className="detail-section-title">Pricing</span>
            <div className="info-row">
              <span className="info-key">MRP</span>
              <span className="info-val price-cell" style={{ color: 'white' }}>{fmt(product.mrp)}</span>
            </div>
            <div className="info-row">
              <span className="info-key">Selling Price</span>
              <span className="info-val price-cell" style={{ color: 'var(--color-primary)' }}>{fmt(product.sellingPrice)}</span>
            </div>
            <div className="info-row">
              <span className="info-key">Purchase Price</span>
              <span className="info-val price-cell">{fmt(product.purchasePrice)}</span>
            </div>
            <div className="info-row">
              <span className="info-key">Wholesale Price</span>
              <span className="info-val price-cell">{fmt(product.wholesalePrice)}</span>
            </div>
          </div>

          {/* Column 3: Tax & HSN */}
          <div className="detail-section">
            <span className="detail-section-title">Tax & HSN/SAC</span>
            <div className="info-row">
              <span className="info-key">HSN/SAC Code</span>
              <span className="info-val">{product.hsnSacCode || '—'}</span>
            </div>
            <div className="info-row">
              <span className="info-key">GST Slab</span>
              <span className="info-val">{product.taxRateName ? `${product.taxRateName} (${product.taxRate}%)` : '—'}</span>
            </div>
          </div>
        </div>

        <div className="detail-grid" style={{ marginTop: 'var(--space-md)' }}>
          {/* Column 4: Barcodes */}
          <div className="detail-section">
            <span className="detail-section-title">Barcodes</span>
            {product.barcodes.length === 0 ? (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No barcodes configured.</span>
            ) : (
              <div className="barcode-list">
                {product.barcodes.map(b => (
                  <div key={b.id} className={`barcode-tag ${b.isPrimary ? 'primary' : ''}`}>
                    <span>{b.isPrimary ? '★ ' : ''}{b.barcode}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{b.barcodeType}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Column 5: Stock Configuration */}
          <div className="detail-section">
            <span className="detail-section-title">Stock Configuration</span>
            {product.productType === 'SERVICE' ? (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Not applicable for SERVICE.</span>
            ) : (
              <>
                <div className="info-row">
                  <span className="info-key">Track Inventory</span>
                  <span className="info-val">{product.trackInventory ? 'Yes' : 'No'}</span>
                </div>
                {product.trackInventory && (
                  <>
                    <div className="info-row">
                      <span className="info-key">Quantity On Hand</span>
                      <span className="info-val">{stock ? `${stock.quantityOnHand} ${stock.primaryUnit}` : 'Loading...'}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-key">Stock Status</span>
                      <span className="info-val">{stock ? stock.stockStatus.replace(/_/g, ' ') : 'Loading...'}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-key">Allow Negative Stock</span>
                      <span className="info-val">{product.allowNegativeStock ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-key">Min Stock Level</span>
                      <span className="info-val">{product.minimumStockLevel ?? '—'}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-key">Reorder Level</span>
                      <span className="info-val">{product.reorderLevel ?? '—'}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-key">Max Stock Level</span>
                      <span className="info-val">{product.maximumStockLevel ?? '—'}</span>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Audit timestamps */}
        <div style={{ display: 'flex', gap: 'var(--space-lg)', fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
          <span>Created: {new Date(product.createdAt).toLocaleString()}</span>
          <span>Last Updated: {new Date(product.updatedAt).toLocaleString()}</span>
          <span>Version: {product.version}</span>
        </div>
      </div>
    </div>
  );
}
