import { useEffect, useState } from 'react';
import UPIQRCode from './UPIQRCode';

interface Props {
  shopId: string;
}

export default function BillingModule({ shopId }: Props) {
  const [draft, setDraft] = useState<any>(null);
  const [shop, setShop] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  
  // Search & Barcode
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');

  // Mixed Payments Allocation
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [cardAmount, setCardAmount] = useState<number>(0);
  const [upiAmount, setUpiAmount] = useState<number>(0);
  const [creditAmount, setCreditAmount] = useState<number>(0);
  
  // UPI QR states
  const [upiConfirmed, setUpiConfirmed] = useState(false);
  const [checkoutToken, setCheckoutToken] = useState('');

  // States
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [successInvoice, setSuccessInvoice] = useState<any>(null);

  // Initialize draft and settings
  const initializePOS = async () => {
    setLoading(true);
    setError('');
    setSuccessInvoice(null);
    setPaymentModalOpen(false);
    resetPayments();
    
    try {
      // 1. Get Shop details
      const shopRes = await (window as any).smartVyapar.getShop();
      if (shopRes.success) {
        setShop(shopRes.data);
      }

      // 2. Load Customers
      const custRes = await (window as any).smartVyapar.getCustomers({ page: 1, pageSize: 200, isActive: true });
      if (custRes.success) {
        setCustomers(custRes.data.items || []);
        const walkin = custRes.data.items.find((c: any) =>
          c.isWalkIn || c.customerType === 'WALK_IN' || c.customerCode === 'WALK-IN' || c.customerCode === 'WALKIN'
        );
        const defaultCustId = walkin ? walkin.id : (custRes.data.items[0]?.id || '');
        setSelectedCustomerId(defaultCustId);
        
        // 3. Create Draft on backend
        const draftRes = await (window as any).smartVyapar.createPOSDraft(shopId, defaultCustId);
        if (draftRes.success) {
          setDraft(draftRes.data);
          setCheckoutToken(Date.now().toString());
        } else {
          setError(draftRes.error || 'Failed to initialize POS draft.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error initializing POS.');
    } finally {
      setLoading(false);
    }
  };

  const resetPayments = () => {
    setCashAmount(0);
    setCardAmount(0);
    setUpiAmount(0);
    setCreditAmount(0);
    setUpiConfirmed(false);
  };

  useEffect(() => {
    initializePOS();
  }, [shopId]);

  // When customer changes, reprice the draft cart
  const handleCustomerChange = async (custId: string) => {
    if (!draft) return;
    setSelectedCustomerId(custId);
    setError('');
    resetPayments();
    
    try {
      const res = await (window as any).smartVyapar.repricePOSCartForCustomer({
        invoiceId: draft.id,
        customerId: custId
      });
      if (res.success) {
        // Fetch updated draft
        const updated = await (window as any).smartVyapar.getPOSDraft(draft.id);
        if (updated.success) {
          setDraft(updated.data);
          setCheckoutToken(Date.now().toString());
        }
      } else {
        setError(res.error || 'Failed to reprice cart for customer.');
      }
    } catch (err: any) {
      setError(err.message || 'Error updating customer.');
    }
  };

  // Search products
  useEffect(() => {
    if (!draft) return;
    const t = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      const res = await (window as any).smartVyapar.searchPOSProducts({
        shopId,
        query: searchQuery.trim(),
        customerId: selectedCustomerId,
        draftDate: draft.invoiceDate
      });
      if (res.success) {
        setSearchResults(res.data.items || []);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [searchQuery, selectedCustomerId, draft?.invoiceDate]);

  // Handle barcode scanning
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim() || !draft) return;
    setError('');
    try {
      const res = await (window as any).smartVyapar.resolvePOSProductByBarcode({
        shopId,
        barcode: barcodeInput.trim(),
        customerId: selectedCustomerId,
        draftDate: draft.invoiceDate
      });
      if (res.success && res.data) {
        // Add product to draft
        await handleAddProduct(res.data.productId, res.data.sellingPrice);
        setBarcodeInput('');
      } else {
        setError(res.error || 'Barcode could not be resolved.');
      }
    } catch (err: any) {
      setError(err.message || 'Barcode resolution failed.');
    }
  };

  // Add Product to Cart
  const handleAddProduct = async (productId: string, price: number) => {
    if (!draft) return;
    setError('');
    resetPayments();
    try {
      const res = await (window as any).smartVyapar.addPOSDraftLine(draft.id, {
        productId,
        quantity: 1,
        provisionalUnitPrice: price,
        provisionalDiscountType: 'NONE',
        provisionalDiscountValue: 0
      });
      if (res.success) {
        setDraft(res.data);
        setCheckoutToken(Date.now().toString());
        setSearchQuery('');
        setSearchResults([]);
      } else {
        setError(res.error || 'Failed to add product.');
      }
    } catch (err: any) {
      setError(err.message || 'Error adding product.');
    }
  };

  // Update line quantity
  const handleQtyChange = async (lineId: string, qty: number, price: number, discType: string, discVal: number) => {
    if (!draft) return;
    setError('');
    resetPayments();
    try {
      const res = await (window as any).smartVyapar.updatePOSDraftLine(draft.id, lineId, {
        quantity: qty,
        provisionalUnitPrice: price,
        provisionalDiscountType: discType,
        provisionalDiscountValue: discVal
      });
      if (res.success) {
        setDraft(res.data);
        setCheckoutToken(Date.now().toString());
      } else {
        setError(res.error || 'Failed to update quantity.');
      }
    } catch (err: any) {
      setError(err.message || 'Error updating line.');
    }
  };

  // Remove line
  const handleRemoveLine = async (lineId: string) => {
    if (!draft) return;
    setError('');
    resetPayments();
    try {
      const res = await (window as any).smartVyapar.removePOSDraftLine(draft.id, lineId);
      if (res.success) {
        setDraft(res.data);
        setCheckoutToken(Date.now().toString());
      } else {
        setError(res.error || 'Failed to remove product.');
      }
    } catch (err: any) {
      setError(err.message || 'Error removing line.');
    }
  };

  // Calculate outstanding allocations
  const grandTotal = draft?.cart?.grandTotal || 0;
  const nonCreditPaid = cashAmount + cardAmount + upiAmount;
  const totalAllocated = nonCreditPaid + creditAmount;
  const remaining = grandTotal - totalAllocated;

  const currentCustomer = customers.find(c => c.id === selectedCustomerId);
  const isWalkIn = Boolean(
    currentCustomer?.isWalkIn ||
    currentCustomer?.customerType === 'WALK_IN' ||
    currentCustomer?.customerCode === 'WALK-IN' ||
    currentCustomer?.customerCode === 'WALKIN'
  );

  // Generate UPI URI
  const generateUpiUri = () => {
    if (!shop?.merchantUpiId) return '';
    const pa = encodeURIComponent(shop.merchantUpiId);
    const pn = encodeURIComponent(shop.name || 'Smart Vyapar Shop');
    const am = upiAmount.toFixed(2);
    const tr = draft?.draftReference || 'checkout-ref';
    const tn = encodeURIComponent(`POS Bill ${draft?.draftReference || ''}`);
    return `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=INR&tr=${tr}&tn=${tn}`;
  };

  const handlePostSale = async () => {
    if (!draft) return;
    setPosting(true);
    setError('');
    try {
      const paymentsPayload = [
        { paymentMode: 'CASH', amount: cashAmount },
        { paymentMode: 'CARD', amount: cardAmount },
        { paymentMode: 'UPI', amount: upiAmount },
        { paymentMode: 'CREDIT', amount: creditAmount }
      ].filter(p => p.amount > 0);

      const paymentContext = {
        contextToken: checkoutToken,
        upiConfirmed,
        confirmedUpiAmount: upiAmount
      };

      const res = await (window as any).smartVyapar.postPOSSale(
        draft.id,
        paymentsPayload,
        draft.version,
        paymentContext
      );

      if (res.success) {
        setSuccessInvoice(res.data.invoice);
      } else {
        setError(res.error || 'Transaction failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Error posting sale.');
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return <div className="card-surface" style={{ padding: '2rem', textAlign: 'center' }}>Loading Billing Module...</div>;
  }

  if (successInvoice) {
    return (
      <div className="card-surface" style={{ maxWidth: '600px', margin: '2rem auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '2.5rem' }}>
        <div style={{ fontSize: '3rem' }}>🎉</div>
        <h2 style={{ margin: 0, color: 'white' }}>Sale Posted Successfully!</h2>
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '8px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div><strong>Invoice Number:</strong> <span style={{ color: '#10B981', fontFamily: 'monospace', fontSize: '1.25rem', fontWeight: 600 }}>{successInvoice.invoiceNumber}</span></div>
          <div><strong>Draft Reference:</strong> {successInvoice.draftReference}</div>
          <div><strong>Date:</strong> {successInvoice.postedAt?.slice(0, 10) || successInvoice.invoiceDate}</div>
          <div><strong>Grand Total:</strong> Rs {successInvoice.grandTotal.toFixed(2)}</div>
          <div><strong>Paid Amount:</strong> Rs {successInvoice.paidAmount.toFixed(2)}</div>
          <div><strong>Outstanding Amount:</strong> Rs {successInvoice.outstandingAmount.toFixed(2)}</div>
          <div><strong>Payment Status:</strong> <span style={{ textTransform: 'uppercase', fontSize: '0.85rem', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: successInvoice.paymentStatus === 'PAID' ? '#10B981' : '#F59E0B' }}>{successInvoice.paymentStatus}</span></div>
        </div>
        <button type="button" className="app-btn btn-primary" onClick={initializePOS}>New Transaction</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '1rem', height: 'calc(100vh - 120px)' }}>
      {/* Catalog & Cart Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', paddingRight: '0.25rem' }}>
        {/* Customer Select & Barcode scan */}
        <div className="card-surface" style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', padding: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: '#9CA3AF' }}>Customer:</span>
            <select
              className="form-input"
              style={{ width: '200px' }}
              value={selectedCustomerId}
              onChange={e => handleCustomerChange(e.target.value)}
            >
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.customerCode === 'WALKIN' ? '(Walk-In)' : ''}
                </option>
              ))}
            </select>
          </div>

          <form onSubmit={handleBarcodeSubmit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: '#9CA3AF' }}>Barcode Scan:</span>
            <input
              type="text"
              className="form-input"
              placeholder="Scan barcode and press Enter"
              style={{ width: '240px' }}
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
            />
          </form>
        </div>

        {/* Product Catalog Lookup */}
        <div className="card-surface" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search product code, SKU, name, or category"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />

          {searchResults.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem', maxHeight: '180px', overflowY: 'auto', padding: '0.5rem', background: 'rgba(0,0,0,0.15)', borderRadius: '6px' }}>
              {searchResults.map(p => (
                <div
                  key={p.productId}
                  className="catalog-item"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '0.5rem 0.75rem', borderRadius: '4px', cursor: 'pointer' }}
                  onClick={() => handleAddProduct(p.productId, p.sellingPrice)}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.productName}</span>
                    <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Stock: {p.currentStock} {p.unitName}</span>
                  </div>
                  <span style={{ color: '#3B82F6', fontWeight: 600 }}>Rs {p.sellingPrice.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart items list */}
        <div className="card-surface" style={{ flexGrow: 1, padding: '1rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', color: 'white' }}>Cart Items</h3>
          {error && <div className="inline-error" style={{ marginBottom: '1rem' }}>{error}</div>}
          
          <div className="table-scroll" style={{ flexGrow: 1, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Price</th>
                  <th style={{ width: '100px' }}>Qty</th>
                  <th>Discount</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {draft?.cart?.lines.map((line: any) => (
                  <tr key={line.id}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{line.productNameSnapshot}</span>
                        <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Code: {line.productCodeSnapshot}</span>
                      </div>
                    </td>
                    <td>Rs {line.unitPrice.toFixed(2)}</td>
                    <td>
                      <input
                        type="number"
                        className="form-input"
                        style={{ width: '80px', padding: '0.25rem' }}
                        value={line.quantity}
                        onChange={e => handleQtyChange(line.id, Number(e.target.value), line.unitPrice, line.discountType, line.discountValue)}
                        min={line.allowsDecimalQuantity ? "0.001" : "1"}
                        step={line.allowsDecimalQuantity ? "0.001" : "1"}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <input
                          type="number"
                          className="form-input"
                          style={{ width: '60px', padding: '0.25rem' }}
                          value={line.discountValue}
                          onChange={e => handleQtyChange(line.id, line.quantity, line.unitPrice, line.discountType, Number(e.target.value))}
                          min="0"
                        />
                        <select
                          className="form-input"
                          style={{ width: '50px', padding: '0.25rem' }}
                          value={line.discountType}
                          onChange={e => handleQtyChange(line.id, line.quantity, line.unitPrice, e.target.value, line.discountValue)}
                        >
                          <option>NONE</option>
                          <option>PERCENT</option>
                          <option>AMOUNT</option>
                        </select>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>Rs {line.lineTotal.toFixed(2)}</td>
                    <td>
                      <button
                        type="button"
                        className="app-btn"
                        style={{ padding: '0.25rem 0.5rem', background: '#EF4444', border: 'none' }}
                        onClick={() => handleRemoveLine(line.id)}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
                {(!draft?.cart?.lines || draft.cart.lines.length === 0) && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem 0', color: '#9CA3AF' }}>
                      Cart is empty. Add products above to start.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Cart Summary & Actions Sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="card-surface" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Summary</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal:</span><span>Rs {draft?.cart?.subtotal?.toFixed(2) || '0.00'}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#F59E0B' }}><span>Discount:</span><span>-Rs {draft?.cart?.lineDiscountTotal?.toFixed(2) || '0.00'}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>CGST:</span><span>Rs {draft?.cart?.cgstTotal?.toFixed(2) || '0.00'}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>SGST:</span><span>Rs {draft?.cart?.sgstTotal?.toFixed(2) || '0.00'}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Round Off:</span><span>Rs {draft?.cart?.roundOff?.toFixed(2) || '0.00'}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 700, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem', marginTop: '0.25rem', color: 'white' }}>
              <span>Grand Total:</span>
              <span>Rs {draft?.cart?.grandTotal?.toFixed(2) || '0.00'}</span>
            </div>
          </div>

          <button
            type="button"
            className="app-btn btn-primary"
            style={{ width: '100%', padding: '0.75rem', fontWeight: 600, fontSize: '1rem', marginTop: '0.5rem' }}
            disabled={!draft?.cart?.lines || draft.cart.lines.length === 0}
            onClick={() => setPaymentModalOpen(true)}
          >
            💳 Proceed to Checkout
          </button>
        </div>
      </div>

      {/* Payment Allocation Modal */}
      {paymentModalOpen && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card-surface" style={{ width: '600px', display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.75rem', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>POS Payment allocations</h3>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#60A5FA' }}>Rs {grandTotal.toFixed(2)}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              {/* Payment entries */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label className="form-group">
                  <span>CASH Allocation</span>
                  <input
                    type="number"
                    className="form-input"
                    value={cashAmount}
                    onChange={e => setCashAmount(Math.max(0, Number(e.target.value)))}
                    min="0"
                  />
                </label>
                <label className="form-group">
                  <span>CARD Allocation</span>
                  <input
                    type="number"
                    className="form-input"
                    value={cardAmount}
                    onChange={e => setCardAmount(Math.max(0, Number(e.target.value)))}
                    min="0"
                  />
                </label>
                <label className="form-group">
                  <span>UPI Allocation</span>
                  <input
                    type="number"
                    className="form-input"
                    value={upiAmount}
                    onChange={e => { setUpiAmount(Math.max(0, Number(e.target.value))); setUpiConfirmed(false); }}
                    min="0"
                  />
                </label>
                <label className="form-group" style={{ opacity: isWalkIn ? 0.5 : 1 }}>
                  <span>CREDIT Allocation {isWalkIn && <span style={{ fontSize: '0.7rem', color: '#EF4444' }}>(Walk-in blocked)</span>}</span>
                  <input
                    type="number"
                    className="form-input"
                    value={creditAmount}
                    onChange={e => setCreditAmount(Math.max(0, Number(e.target.value)))}
                    disabled={isWalkIn}
                    min="0"
                  />
                </label>
              </div>

              {/* UPI QR / Confirmed Area */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', padding: '1rem' }}>
                {upiAmount > 0 ? (
                  !shop?.merchantUpiId ? (
                    <div style={{ color: '#EF4444', textAlign: 'center', fontSize: '0.85rem' }}>
                      ⚠️ UPI merchant UPI ID is not configured in Shop settings!
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
                      <UPIQRCode value={generateUpiUri()} size={140} />
                      <div style={{ textAlign: 'center', fontSize: '0.8rem' }}>
                        <div><strong>Amount:</strong> Rs {upiAmount.toFixed(2)}</div>
                        <div style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>UPI ID: {shop.merchantUpiId.replace(/(?<=.{3}).(?=.*@)/g, '*')}</div>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', padding: '0.4rem 0.8rem', borderRadius: '4px' }}>
                        <input
                          type="checkbox"
                          checked={upiConfirmed}
                          onChange={e => setUpiConfirmed(e.target.checked)}
                        />
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Payment Confirmed</span>
                      </label>
                    </div>
                  )
                ) : (
                  <div style={{ color: '#6B7280', fontSize: '0.9rem', textAlign: 'center' }}>
                    Enter UPI allocation to display payment QR code.
                  </div>
                )}
              </div>
            </div>

            {/* Verification Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem', marginTop: '0.5rem' }}>
              <div style={{ fontSize: '0.9rem' }}>
                {remaining === 0 ? (
                  <span style={{ color: '#10B981', fontWeight: 600 }}>✅ Allocations Match perfectly</span>
                ) : remaining > 0 ? (
                  <span style={{ color: '#F59E0B' }}>⚠️ Remaining allocation: Rs {remaining.toFixed(2)}</span>
                ) : (
                  <span style={{ color: '#EF4444' }}>❌ Over allocated by: Rs {Math.abs(remaining).toFixed(2)}</span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="app-btn"
                  onClick={() => setPaymentModalOpen(false)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="app-btn btn-primary"
                  disabled={remaining !== 0 || posting || (upiAmount > 0 && !upiConfirmed)}
                  onClick={handlePostSale}
                >
                  {posting ? 'Posting...' : 'Post Sale'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
