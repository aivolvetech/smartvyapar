import React, { useState, useEffect, useRef } from 'react';
import {
  UnitOfMeasureData, ProductCategoryData, BrandData, TaxRateData,
  CreateProductRequest, UpdateProductRequest, ProductData, CreateBarcodeInput,
} from '../../../shared/types/ipc';

interface Props {
  productId?: string; // undefined = create mode
  onSuccess: (product: ProductData) => void;
  onCancel: () => void;
}

interface FormErrors { [key: string]: string; }

interface BarcodeEntry { barcode: string; barcodeType: string; isPrimary: boolean; }

const BARCODE_TYPES = ['EAN13', 'EAN8', 'CODE128', 'QR', 'UPC-A', 'OTHER'];

export default function ProductForm({ productId, onSuccess, onCancel }: Props) {
  const isEdit = Boolean(productId);

  // Master data
  const [units, setUnits]       = useState<UnitOfMeasureData[]>([]);
  const [categories, setCats]   = useState<ProductCategoryData[]>([]);
  const [brands, setBrands]     = useState<BrandData[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateData[]>([]);

  // Form fields — Section 1: Basic
  const [productCode, setProductCode] = useState('');
  const [name, setName]               = useState('');
  const [printName, setPrintName]     = useState('');
  const [description, setDescription] = useState('');
  const [sku, setSku]                 = useState('');

  // Section 2: Classification
  const [categoryId, setCategoryId]   = useState('');
  const [brandId, setBrandId]         = useState('');
  const [primaryUnitId, setUnitId]    = useState('');

  // Section 3: Tax
  const [hsnSacCode, setHsnSac]       = useState('');
  const [taxRateId, setTaxRateId]     = useState('');

  // Section 4: Pricing
  const [purchasePrice, setPurchase]  = useState('');
  const [sellingPrice, setSelling]    = useState('');
  const [mrp, setMrp]                 = useState('');
  const [wholesalePrice, setWholesale]= useState('');

  // Section 5: Barcodes
  const [barcodes, setBarcodes]       = useState<BarcodeEntry[]>([]);
  const [newBarcode, setNewBarcode]   = useState('');
  const [newBarcodeType, setNewBarcodeType] = useState('EAN13');
  const [newIsPrimary, setNewIsPrimary]     = useState(false);

  // Section 6: Stock
  const [productType, setProductType]     = useState<'GOODS' | 'SERVICE'>('GOODS');
  const [trackInventory, setTrackInv]     = useState(true);
  const [negativeStockPolicy, setNegativeStockPolicy] = useState<'INHERIT' | 'ALLOW' | 'BLOCK'>('INHERIT');
  const [minStock, setMinStock]           = useState('');
  const [reorderLevel, setReorder]        = useState('');
  const [maxStock, setMaxStock]           = useState('');
  const [openingQty, setOpeningQty]       = useState('');
  const [openingCost, setOpeningCost]     = useState('');

  // Section 7: Status
  const [isActive, setIsActive]           = useState(true);

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const firstInput = useRef<HTMLInputElement>(null);

  // Load master data + existing product if editing
  useEffect(() => {
    const sv = (window as any).smartVyapar;
    Promise.all([
      sv.listUnits(true),
      sv.listCategories(true),
      sv.listBrands(true),
      sv.listTaxRates(true),
      productId ? sv.getProductById(productId) : Promise.resolve({ success: true, data: null }),
    ]).then(([uRes, cRes, bRes, tRes, pRes]) => {
      if (uRes.success) setUnits(uRes.data || []);
      if (cRes.success) setCats(cRes.data || []);
      if (bRes.success) setBrands(bRes.data || []);
      if (tRes.success) setTaxRates(tRes.data || []);

      if (productId && pRes.success && pRes.data) {
        const p: ProductData = pRes.data;
        setProductCode(p.productCode);
        setName(p.name);
        setPrintName(p.printName || '');
        setDescription(p.description || '');
        setSku(p.sku || '');
        setCategoryId(p.categoryId || '');
        setBrandId(p.brandId || '');
        setUnitId(p.primaryUnitId);
        setHsnSac(p.hsnSacCode || '');
        setTaxRateId(p.taxRateId || '');
        setPurchase(p.purchasePrice !== null ? String(p.purchasePrice) : '');
        setSelling(p.sellingPrice !== null ? String(p.sellingPrice) : '');
        setMrp(p.mrp !== null ? String(p.mrp) : '');
        setWholesale(p.wholesalePrice !== null ? String(p.wholesalePrice) : '');
        setBarcodes(p.barcodes.map(b => ({ barcode: b.barcode, barcodeType: b.barcodeType, isPrimary: b.isPrimary })));
        setProductType(p.productType);
        setTrackInv(p.trackInventory);
        setNegativeStockPolicy(p.negativeStockPolicy || (p.allowNegativeStock ? 'ALLOW' : 'INHERIT'));
        setMinStock(p.minimumStockLevel !== null ? String(p.minimumStockLevel) : '');
        setReorder(p.reorderLevel !== null ? String(p.reorderLevel) : '');
        setMaxStock(p.maximumStockLevel !== null ? String(p.maximumStockLevel) : '');
        setIsActive(p.isActive);
      }
      setLoadingData(false);
      setTimeout(() => firstInput.current?.focus(), 100);
    }).catch(() => {
      setLoadError('Failed to load form data.');
      setLoadingData(false);
    });
  }, [productId]);

  const validate = (): boolean => {
    const errs: FormErrors = {};
    if (!productCode.trim()) errs.productCode = 'Product code is required.';
    if (!name.trim()) errs.name = 'Product name is required.';
    if (!primaryUnitId) errs.primaryUnitId = 'Unit of measure is required.';
    if (!sellingPrice || isNaN(Number(sellingPrice)) || Number(sellingPrice) < 0) errs.sellingPrice = 'Valid selling price is required.';
    if (!mrp || isNaN(Number(mrp)) || Number(mrp) < 0) errs.mrp = 'Valid MRP is required.';
    if (purchasePrice && (isNaN(Number(purchasePrice)) || Number(purchasePrice) < 0)) errs.purchasePrice = 'Purchase price must be a non-negative number.';
    if (wholesalePrice && (isNaN(Number(wholesalePrice)) || Number(wholesalePrice) < 0)) errs.wholesalePrice = 'Wholesale price must be a non-negative number.';
    if (hsnSacCode.trim() && !/^\d{4,8}$/.test(hsnSacCode.trim())) errs.hsnSacCode = 'HSN/SAC code must be 4–8 digits.';
    if (productType === 'GOODS' && trackInventory && openingQty && (isNaN(Number(openingQty)) || Number(openingQty) < 0)) {
      errs.openingQty = 'Opening quantity must be a non-negative number.';
    }
    if (barcodes.length > 0) {
      const codes = barcodes.map(b => b.barcode);
      if (new Set(codes).size !== codes.length) errs.barcodes = 'Duplicate barcodes in the list.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const addBarcode = () => {
    if (!newBarcode.trim()) return;
    if (barcodes.some(b => b.barcode === newBarcode.trim())) {
      setErrors(prev => ({ ...prev, barcodeInput: 'Barcode already in list.' }));
      return;
    }
    const entry: BarcodeEntry = { barcode: newBarcode.trim(), barcodeType: newBarcodeType, isPrimary: newIsPrimary };
    // If setting primary, unset others
    const updated = newIsPrimary
      ? [...barcodes.map(b => ({ ...b, isPrimary: false })), entry]
      : [...barcodes, entry];
    setBarcodes(updated);
    setNewBarcode('');
    setNewIsPrimary(false);
    setErrors(prev => { const e = { ...prev }; delete e.barcodeInput; return e; });
    setIsDirty(true);
  };

  const removeBarcode = (i: number) => {
    setBarcodes(prev => prev.filter((_, idx) => idx !== i));
    setIsDirty(true);
  };

  const setPrimaryBarcode = (i: number) => {
    setBarcodes(prev => prev.map((b, idx) => ({ ...b, isPrimary: idx === i })));
    setIsDirty(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || submitting) return;

    setSubmitting(true);
    try {
      const sv = (window as any).smartVyapar;
      const priceInput = {
        purchasePrice: Number(purchasePrice) || 0,
        sellingPrice: Number(sellingPrice),
        mrp: Number(mrp),
        wholesalePrice: wholesalePrice ? Number(wholesalePrice) : undefined,
      };

      const productInput = {
        productCode: productCode.trim(),
        name: name.trim(),
        printName: printName.trim() || undefined,
        description: description.trim() || undefined,
        categoryId: categoryId || undefined,
        brandId: brandId || undefined,
        primaryUnitId,
        hsnSacCode: hsnSacCode.trim() || undefined,
        taxRateId: taxRateId || undefined,
        productType,
        trackInventory: productType === 'SERVICE' ? false : trackInventory,
        allowNegativeStock: productType === 'SERVICE' ? false : (negativeStockPolicy === 'ALLOW'),
        negativeStockPolicy: productType === 'SERVICE' ? 'BLOCK' : negativeStockPolicy,
        minimumStockLevel: minStock ? Number(minStock) : undefined,
        reorderLevel: reorderLevel ? Number(reorderLevel) : undefined,
        maximumStockLevel: maxStock ? Number(maxStock) : undefined,
        sku: sku.trim() || undefined,
      };

      const barcodesInput: CreateBarcodeInput[] = barcodes.map(b => ({
        barcode: b.barcode, barcodeType: b.barcodeType, isPrimary: b.isPrimary,
      }));

      let res;
      if (!isEdit) {
        const request: CreateProductRequest = {
          product: productInput,
          barcodes: barcodesInput,
          defaultPrice: priceInput,
          openingBalance: (productType === 'GOODS' && trackInventory && openingQty && Number(openingQty) > 0)
            ? { quantity: Number(openingQty), unitCost: openingCost ? Number(openingCost) : undefined }
            : undefined,
        };
        res = await sv.createProduct(request);
      } else {
        const request: UpdateProductRequest = {
          product: { ...productInput, isActive },
          barcodes: barcodesInput,
          defaultPrice: priceInput,
        };
        res = await sv.updateProduct(productId, request);
      }

      if (res.success && res.data) {
        onSuccess(res.data);
      } else {
        setErrors({ _form: res.error || 'Save failed.' });
      }
    } catch (err: any) {
      setErrors({ _form: err.message || 'Unexpected error.' });
    } finally {
      setSubmitting(false);
    }
  };

  const confirmCancel = () => {
    if (isDirty && !confirm('You have unsaved changes. Discard them?')) return;
    onCancel();
  };

  if (loadingData) {
    return (
      <div className="empty-state"><div className="spinner-sm" style={{ width: 28, height: 28 }} /><span>Loading form...</span></div>
    );
  }
  if (loadError) {
    return <div className="inline-error">⚠️ {loadError}</div>;
  }

  return (
    <form onSubmit={handleSubmit} onChange={() => setIsDirty(true)} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }} noValidate>
      {errors._form && <div className="inline-error">❌ {errors._form}</div>}

      {/* 1. Basic Information */}
      <div className="form-section">
        <p className="form-section-title">1. Basic Information</p>
        <div className="form-row-2">
          <div className="form-group">
            <label htmlFor="pf-code">Product Code *</label>
            <input ref={firstInput} id="pf-code" type="text" className={`form-input ${errors.productCode ? 'form-input-error' : ''}`}
              value={productCode} onChange={e => setProductCode(e.target.value)}
              placeholder="e.g. PROD-001" disabled={submitting} />
            {errors.productCode && <span className="form-error-msg" role="alert">{errors.productCode}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="pf-sku">SKU (Optional)</label>
            <input id="pf-sku" type="text" className="form-input"
              value={sku} onChange={e => setSku(e.target.value)}
              placeholder="e.g. SKU-XYZ-001" disabled={submitting} />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="pf-name">Product Name *</label>
          <input id="pf-name" type="text" className={`form-input ${errors.name ? 'form-input-error' : ''}`}
            value={name} onChange={e => setName(e.target.value)}
            placeholder="Full product name" disabled={submitting} />
          {errors.name && <span className="form-error-msg" role="alert">{errors.name}</span>}
        </div>
        <div className="form-group">
          <label htmlFor="pf-print">Print Name (on invoice/receipt)</label>
          <input id="pf-print" type="text" className="form-input"
            value={printName} onChange={e => setPrintName(e.target.value)}
            placeholder="Short name for printing (optional)" disabled={submitting} />
        </div>
        <div className="form-group">
          <label htmlFor="pf-desc">Description</label>
          <textarea id="pf-desc" className="form-input"
            style={{ resize: 'vertical', minHeight: '60px', fontFamily: 'inherit' }}
            value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Optional product description" disabled={submitting} />
        </div>
      </div>

      {/* 2. Classification */}
      <div className="form-section">
        <p className="form-section-title">2. Classification</p>
        <div className="form-row-3">
          <div className="form-group">
            <label htmlFor="pf-unit">Unit of Measure *</label>
            <select id="pf-unit" className={`form-select ${errors.primaryUnitId ? 'form-input-error' : ''}`}
              value={primaryUnitId} onChange={e => setUnitId(e.target.value)} disabled={submitting}>
              <option value="">— Select Unit —</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.shortName})</option>)}
            </select>
            {errors.primaryUnitId && <span className="form-error-msg" role="alert">{errors.primaryUnitId}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="pf-cat">Category</label>
            <select id="pf-cat" className="form-select"
              value={categoryId} onChange={e => setCategoryId(e.target.value)} disabled={submitting}>
              <option value="">— No Category —</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.parentCategoryId ? '↳ ' : ''}{c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="pf-brand">Brand</label>
            <select id="pf-brand" className="form-select"
              value={brandId} onChange={e => setBrandId(e.target.value)} disabled={submitting}>
              <option value="">— No Brand —</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* 3. Tax & HSN/SAC */}
      <div className="form-section">
        <p className="form-section-title">3. Tax & HSN/SAC Code</p>
        <div className="form-row-2">
          <div className="form-group">
            <label htmlFor="pf-hsn">HSN / SAC Code</label>
            <input id="pf-hsn" type="text" className={`form-input ${errors.hsnSacCode ? 'form-input-error' : ''}`}
              value={hsnSacCode} onChange={e => setHsnSac(e.target.value)}
              placeholder="4–8 digit code (optional)" disabled={submitting} />
            {errors.hsnSacCode && <span className="form-error-msg" role="alert">{errors.hsnSacCode}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="pf-tax">GST Tax Rate</label>
            <select id="pf-tax" className="form-select"
              value={taxRateId} onChange={e => setTaxRateId(e.target.value)} disabled={submitting}>
              <option value="">— No Tax —</option>
              {taxRates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.taxType})</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* 4. Pricing */}
      <div className="form-section">
        <p className="form-section-title">4. Pricing (Default Price List)</p>
        <div className="form-row-2">
          <div className="form-group">
            <label htmlFor="pf-sell">Selling Price (₹) *</label>
            <input id="pf-sell" type="number" min="0" step="0.01"
              className={`form-input ${errors.sellingPrice ? 'form-input-error' : ''}`}
              value={sellingPrice} onChange={e => setSelling(e.target.value)}
              placeholder="0.00" disabled={submitting} />
            {errors.sellingPrice && <span className="form-error-msg" role="alert">{errors.sellingPrice}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="pf-mrp">MRP (₹) *</label>
            <input id="pf-mrp" type="number" min="0" step="0.01"
              className={`form-input ${errors.mrp ? 'form-input-error' : ''}`}
              value={mrp} onChange={e => setMrp(e.target.value)}
              placeholder="0.00" disabled={submitting} />
            {errors.mrp && <span className="form-error-msg" role="alert">{errors.mrp}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="pf-purchase">Purchase Price (₹)</label>
            <input id="pf-purchase" type="number" min="0" step="0.01"
              className={`form-input ${errors.purchasePrice ? 'form-input-error' : ''}`}
              value={purchasePrice} onChange={e => setPurchase(e.target.value)}
              placeholder="0.00" disabled={submitting} />
            {errors.purchasePrice && <span className="form-error-msg" role="alert">{errors.purchasePrice}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="pf-wholesale">Wholesale Price (₹)</label>
            <input id="pf-wholesale" type="number" min="0" step="0.01"
              className={`form-input ${errors.wholesalePrice ? 'form-input-error' : ''}`}
              value={wholesalePrice} onChange={e => setWholesale(e.target.value)}
              placeholder="0.00 (optional)" disabled={submitting} />
            {errors.wholesalePrice && <span className="form-error-msg" role="alert">{errors.wholesalePrice}</span>}
          </div>
        </div>
      </div>

      {/* 5. Barcodes */}
      <div className="form-section">
        <p className="form-section-title">5. Barcodes</p>
        {barcodes.length > 0 && (
          <div className="barcode-list">
            {barcodes.map((b, i) => (
              <div key={i} className={`barcode-tag ${b.isPrimary ? 'primary' : ''}`}>
                <span>{b.isPrimary ? '★ ' : ''}{b.barcode}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{b.barcodeType}</span>
                {!b.isPrimary && (
                  <button type="button" onClick={() => setPrimaryBarcode(i)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', color: 'var(--color-primary)' }}
                    title="Set as primary">★</button>
                )}
                <button type="button" onClick={() => removeBarcode(i)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', color: 'var(--color-error)' }}
                  title="Remove">✕</button>
              </div>
            ))}
          </div>
        )}
        {errors.barcodes && <span className="form-error-msg">{errors.barcodes}</span>}
        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 2, minWidth: 160 }}>
            <label htmlFor="pf-barcode">Add Barcode</label>
            <input id="pf-barcode" type="text" className="form-input"
              value={newBarcode} onChange={e => setNewBarcode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addBarcode())}
              placeholder="e.g. 8901234567890" disabled={submitting} />
            {errors.barcodeInput && <span className="form-error-msg">{errors.barcodeInput}</span>}
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 120 }}>
            <label htmlFor="pf-btype">Type</label>
            <select id="pf-btype" className="form-select" value={newBarcodeType} onChange={e => setNewBarcodeType(e.target.value)}>
              {BARCODE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <label className="form-checkbox-row" style={{ marginBottom: '0.7rem', fontSize: '0.85rem' }}>
            <input type="checkbox" checked={newIsPrimary} onChange={e => setNewIsPrimary(e.target.checked)} />
            Primary
          </label>
          <button type="button" className="app-btn btn-secondary" onClick={addBarcode}
            style={{ padding: '0.65rem 1rem', marginBottom: '0.05rem', fontSize: '0.88rem' }}>
            + Add
          </button>
        </div>
      </div>

      {/* 6. Stock Configuration */}
      <div className="form-section">
        <p className="form-section-title">6. Stock Configuration</p>
        <div className="form-row-2">
          <div className="form-group">
            <label htmlFor="pf-type">Product Type</label>
            <select id="pf-type" className="form-select" value={productType}
              onChange={e => {
                const t = e.target.value as 'GOODS' | 'SERVICE';
                setProductType(t);
                 if (t === 'SERVICE') { setTrackInv(false); setNegativeStockPolicy('BLOCK'); }
              }} disabled={submitting}>
              <option value="GOODS">Goods (Physical Product)</option>
              <option value="SERVICE">Service (Non-Physical)</option>
            </select>
          </div>
        </div>

        {productType === 'GOODS' && (
          <>
            <div style={{ display: 'flex', gap: 'var(--space-lg)', flexWrap: 'wrap' }}>
              <label className="form-checkbox-row">
                 <input type="checkbox" checked={trackInventory} onChange={e => { setTrackInv(e.target.checked); if (!e.target.checked) setNegativeStockPolicy('BLOCK'); }} />
                Track Inventory
              </label>
              {trackInventory && (
                <div className="form-group" style={{ minWidth: '220px' }}>
                  <label htmlFor="pf-neg-policy">Negative Stock Policy</label>
                  <select
                    id="pf-neg-policy"
                    className="form-input"
                    value={negativeStockPolicy}
                    onChange={e => {
                      const val = e.target.value as any;
                      setNegativeStockPolicy(val);
                    }}
                    disabled={submitting}
                  >
                    <option value="INHERIT">Inherit Shop Setting</option>
                    <option value="ALLOW">Allow</option>
                    <option value="BLOCK">Block</option>
                  </select>
                </div>
              )}
            </div>

            {trackInventory && (
              <>
                <div className="form-row-3">
                  <div className="form-group">
                    <label htmlFor="pf-min">Minimum Stock Level</label>
                    <input id="pf-min" type="number" min="0" step="0.001" className="form-input"
                      value={minStock} onChange={e => setMinStock(e.target.value)} placeholder="e.g. 5" disabled={submitting} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="pf-reorder">Reorder Level</label>
                    <input id="pf-reorder" type="number" min="0" step="0.001" className="form-input"
                      value={reorderLevel} onChange={e => setReorder(e.target.value)} placeholder="e.g. 10" disabled={submitting} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="pf-max">Maximum Stock Level</label>
                    <input id="pf-max" type="number" min="0" step="0.001" className="form-input"
                      value={maxStock} onChange={e => setMaxStock(e.target.value)} placeholder="e.g. 100" disabled={submitting} />
                  </div>
                </div>

                {!isEdit && (
                  <div className="form-row-2" style={{ background: 'rgba(99,102,241,0.04)', padding: 'var(--space-md)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(99,102,241,0.12)' }}>
                    <div className="form-group">
                      <label htmlFor="pf-oqty">Opening Quantity</label>
                      <input id="pf-oqty" type="number" min="0" step="0.001"
                        className={`form-input ${errors.openingQty ? 'form-input-error' : ''}`}
                        value={openingQty} onChange={e => setOpeningQty(e.target.value)} placeholder="0" disabled={submitting} />
                      {errors.openingQty && <span className="form-error-msg">{errors.openingQty}</span>}
                    </div>
                    <div className="form-group">
                      <label htmlFor="pf-ocost">Opening Unit Cost (₹)</label>
                      <input id="pf-ocost" type="number" min="0" step="0.01" className="form-input"
                        value={openingCost} onChange={e => setOpeningCost(e.target.value)} placeholder="0.00" disabled={submitting} />
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {productType === 'SERVICE' && (
          <div style={{ padding: 'var(--space-sm) var(--space-md)', background: 'rgba(168,85,247,0.06)', borderRadius: 'var(--radius-sm)', color: '#a855f7', fontSize: '0.88rem' }}>
            ℹ️ Service products do not track inventory or allow opening balances.
          </div>
        )}
      </div>

      {/* 7. Status (Edit only) */}
      {isEdit && (
        <div className="form-section">
          <p className="form-section-title">7. Status</p>
          <label className="form-checkbox-row">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} disabled={submitting} />
            Product is Active (visible in lookup and billing)
          </label>
        </div>
      )}

      {/* Form actions */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'flex-end', paddingBottom: 'var(--space-lg)' }}>
        <button type="button" className="app-btn btn-secondary" onClick={confirmCancel} disabled={submitting}>
          Cancel
        </button>
        <button id="product-form-submit" type="submit" className="app-btn btn-primary" disabled={submitting}>
          {submitting
            ? <><span className="spinner-sm" style={{ width: 16, height: 16, marginRight: 8 }} />Saving...</>
            : isEdit ? 'Save Changes' : 'Create Product'}
        </button>
      </div>
    </form>
  );
}
