import { useEffect, useState } from 'react';
import { ProductListItem, TaxRateData } from '../../../shared/types/ipc';

export default function PurchaseLineEditor({ lines, setLines }: { lines: any[]; setLines: (lines: any[]) => void }) {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateData[]>([]);

  useEffect(() => {
    (async () => {
      const prod = await (window as any).smartVyapar.listProducts({ page: 1, pageSize: 100, sortBy: 'name', sortDirection: 'ASC', isActive: true });
      if (prod.success) setProducts(prod.data.items);
      const tax = await (window as any).smartVyapar.listTaxRates(true);
      if (tax.success) setTaxRates(tax.data);
    })();
  }, []);

  const update = (idx: number, key: string, value: any) => {
    const next = [...lines];
    next[idx] = { ...next[idx], [key]: value };
    setLines(next);
  };

  const handleProductSelect = (idx: number, prodId: string) => {
    const selected = products.find(p => p.id === prodId);
    const next = [...lines];
    next[idx] = {
      ...next[idx],
      productId: prodId,
      unitPrice: selected ? (selected.purchasePrice ?? 0) : 0,
      mrp: selected ? (selected.mrp ?? 0) : 0
    };
    setLines(next);
  };

  const add = () => setLines([...lines, { productId: '', quantity: 1, unitPrice: 0, mrp: 0, discountType: 'NONE', discountValue: 0 }]);
  const remove = (idx: number) => setLines(lines.filter((_, i) => i !== idx));

  return (
    <div className="card-surface">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Purchase Lines</h3>
        <button className="app-btn" onClick={add}>Add Line</button>
      </div>
      <div className="table-scroll" style={{ maxHeight: 300 }}>
        <table className="data-table">
          <thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>MRP</th><th>Discount</th><th>Tax</th><th></th></tr></thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx}>
                <td>
                  <select 
                    className="form-input" 
                    style={{ width: '220px', padding: '0.4rem 0.6rem' }} 
                    value={line.productId} 
                    onChange={e => handleProductSelect(idx, e.target.value)}
                  >
                    <option value="">Select product</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.productCode} - {p.name}</option>)}
                  </select>
                </td>
                <td>
                  <input 
                    className="form-input" 
                    style={{ width: '75px', padding: '0.4rem 0.6rem' }} 
                    type="number" 
                    min="0.001" 
                    step="0.001" 
                    value={line.quantity} 
                    onChange={e => update(idx, 'quantity', Number(e.target.value))} 
                  />
                </td>
                <td>
                  <input 
                    className="form-input" 
                    style={{ width: '95px', padding: '0.4rem 0.6rem' }} 
                    type="number" 
                    min="0" 
                    step="0.01" 
                    value={line.unitPrice} 
                    onChange={e => update(idx, 'unitPrice', Number(e.target.value))} 
                  />
                </td>
                <td>
                  <input 
                    className="form-input" 
                    style={{ width: '95px', padding: '0.4rem 0.6rem' }} 
                    type="number" 
                    min="0" 
                    step="0.01" 
                    value={line.mrp || 0} 
                    onChange={e => update(idx, 'mrp', Number(e.target.value))} 
                  />
                </td>
                <td style={{ minWidth: 175 }}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <select 
                      className="form-input" 
                      style={{ width: '85px', padding: '0.4rem 0.3rem', fontSize: '0.85rem' }} 
                      value={line.discountType || 'NONE'} 
                      onChange={e => update(idx, 'discountType', e.target.value)}
                    >
                      <option>NONE</option>
                      <option>PERCENT</option>
                      <option>AMOUNT</option>
                    </select>
                    <input 
                      className="form-input" 
                      style={{ width: '70px', padding: '0.4rem 0.5rem' }} 
                      type="number" 
                      min="0" 
                      step="0.01" 
                      value={line.discountValue || 0} 
                      onChange={e => update(idx, 'discountValue', Number(e.target.value))} 
                    />
                  </div>
                </td>
                <td>
                  <select 
                    className="form-input" 
                    style={{ width: '130px', padding: '0.4rem 0.6rem' }} 
                    value={line.taxRateId || ''} 
                    onChange={e => update(idx, 'taxRateId', e.target.value || undefined)}
                  >
                    <option value="">Product default</option>
                    {taxRates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </td>
                <td>
                  <button 
                    className="app-btn" 
                    style={{ padding: '0.4rem 0.8rem', backgroundColor: 'var(--color-error)', color: 'white', border: 'none' }} 
                    onClick={() => remove(idx)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {lines.length === 0 && <tr><td colSpan={7}>No lines added.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
