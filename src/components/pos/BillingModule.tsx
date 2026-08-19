import React, { useEffect, useState, useRef } from 'react';
import UPIQRCode from './UPIQRCode';

interface Props {
  shopId: string;
  initialInvoiceId?: string | null;
  onInitialInvoiceLoaded?: () => void;
}

export default function BillingModule({ shopId, initialInvoiceId, onInitialInvoiceLoaded }: Props) {
  const [draft, setDraft] = useState<any>(null);
  const [shop, setShop] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  
  // Input references for focus targeting
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const customerSelectRef = useRef<HTMLSelectElement>(null);

  // Search & Barcode
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');

  // Checkout Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'CARD' | 'CREDIT' | 'MIXED'>('CASH');
  
  // Payment allocations
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [cardAmount, setCardAmount] = useState<number>(0);
  const [upiAmount, setUpiAmount] = useState<number>(0);
  const [creditAmount, setCreditAmount] = useState<number>(0);

  // Cash Tender Helper
  const [cashTendered, setCashTendered] = useState<number>(0);
  
  // UPI QR states
  const [upiConfirmed, setUpiConfirmed] = useState(false);
  const [checkoutToken, setCheckoutToken] = useState('');

  // Quick Customer Modal State
  const [quickCustModalOpen, setQuickCustModalOpen] = useState(false);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custGst, setCustGst] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custError, setCustError] = useState('');
  const [custSaving, setCustSaving] = useState(false);

  // Pending Bills Modal State
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const [pendingTab, setPendingTab] = useState<'DRAFT' | 'HELD'>('DRAFT');
  const [pendingBills, setPendingBills] = useState<any[]>([]);

  // General States
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [successInvoice, setSuccessInvoice] = useState<any>(null);

  // Friendly error mapper
  const getFriendlyError = (errStr: string): string => {
    if (!errStr) return '';
    if (errStr.includes('INSUFFICIENT_STOCK')) {
      return 'Insufficient stock for one or more goods in the cart. Please adjust quantity or stock.';
    }
    if (errStr.includes('PRODUCT_NOT_FOUND')) {
      return 'Product not found for scanned barcode.';
    }
    if (errStr.includes('UPI_NOT_CONFIGURED')) {
      return 'UPI is not configured. Add Merchant UPI ID in Shop Settings.';
    }
    if (errStr.includes('INVALID_PAYMENT_ALLOCATION')) {
      return 'Invalid payment allocation. Total payments must match Grand Total.';
    }
    if (errStr.includes('CREDIT_CUSTOMER_REQUIRED')) {
      return 'Walk-In Customer is blocked from using credit terms.';
    }
    if (errStr.includes('STALE_INVOICE_VERSION')) {
      return 'Stale bill version. The cart has been modified elsewhere. Please reload.';
    }
    if (errStr.includes('SALE_ALREADY_POSTED')) {
      return 'This sale has already been posted successfully.';
    }
    return errStr;
  };

  // Initialize draft and settings
  const initializePOS = async () => {
    setLoading(true);
    setError('');
    setSuccessInvoice(null);
    setPaymentModalOpen(false);
    setPendingModalOpen(false);
    resetPayments();
    
    try {
      // 1. Get Shop details
      const shopRes = await (window as any).smartVyapar.getShop();
      if (shopRes.success) {
        setShop(shopRes.data);
      }

      // 2. Load Customers
      await loadCustomers();
    } catch (err: any) {
      setError(getFriendlyError(err.message) || 'Error initializing POS.');
    } finally {
      setLoading(false);
      // Auto focus barcode input
      setTimeout(() => barcodeInputRef.current?.focus(), 150);
    }
  };

  const loadCustomers = async (autoSelectId?: string) => {
    const custRes = await (window as any).smartVyapar.getCustomers({ page: 1, pageSize: 200, isActive: true });
    if (custRes.success) {
      const items = custRes.data.items || [];
      setCustomers(items);
      
      const walkin = items.find((c: any) =>
        c.isWalkIn || c.customerType === 'WALK_IN' || c.customerCode === 'WALK-IN' || c.customerCode === 'WALKIN'
      );
      
      // Determine selected customer id
      let targetCustId = autoSelectId;
      if (!targetCustId) {
        if (draft) {
          targetCustId = draft.customerId;
        } else {
          targetCustId = walkin ? walkin.id : (items[0]?.id || '');
        }
      }

      setSelectedCustomerId(targetCustId || '');

      // 3. Resume/Create draft
      let draftRes;
      if (initialInvoiceId) {
        const current = await (window as any).smartVyapar.getPOSDraft(initialInvoiceId, shopId);
        draftRes = current.success && current.data?.status === 'HELD'
          ? await (window as any).smartVyapar.resumePOSDraft(initialInvoiceId, shopId)
          : current;
      } else {
        draftRes = await (window as any).smartVyapar.createPOSDraft(shopId, targetCustId);
      }
      
      if (draftRes.success) {
        setDraft(draftRes.data);
        setSelectedCustomerId(draftRes.data.customerId || targetCustId || '');
        setCheckoutToken(Date.now().toString());
        if (initialInvoiceId) onInitialInvoiceLoaded?.();
      } else {
        setError(getFriendlyError(draftRes.error) || 'Failed to initialize POS draft.');
      }
    }
  };

  const resetPayments = () => {
    setCashAmount(0);
    setCardAmount(0);
    setUpiAmount(0);
    setCreditAmount(0);
    setCashTendered(0);
    setUpiConfirmed(false);
  };

  useEffect(() => {
    initializePOS();
  }, [shopId, initialInvoiceId]);

  // Handle single payment mode allocations automatically
  const grandTotal = draft?.cart?.grandTotal || 0;

  useEffect(() => {
    if (paymentModalOpen) {
      resetPayments();
      setUpiConfirmed(false);
      if (paymentMode === 'CASH') {
        setCashAmount(grandTotal);
        setCashTendered(grandTotal);
      } else if (paymentMode === 'UPI') {
        setUpiAmount(grandTotal);
      } else if (paymentMode === 'CARD') {
        setCardAmount(grandTotal);
      } else if (paymentMode === 'CREDIT') {
        setCreditAmount(grandTotal);
      }
    }
  }, [paymentModalOpen, paymentMode, grandTotal]);

  // Keyboard Shortcuts handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC closes any active modal
      if (e.key === 'Escape') {
        if (paymentModalOpen) {
          setPaymentModalOpen(false);
          e.preventDefault();
        } else if (quickCustModalOpen) {
          setQuickCustModalOpen(false);
          e.preventDefault();
        } else if (pendingModalOpen) {
          setPendingModalOpen(false);
          e.preventDefault();
        }
        return;
      }

      // F2 -> Focus barcode scanner/product lookup
      if (e.key === 'F2') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
        return;
      }

      // F4 -> Focus customer selection dropdown
      if (e.key === 'F4') {
        e.preventDefault();
        customerSelectRef.current?.focus();
        return;
      }

      // F6 -> Hold Bill
      if (e.key === 'F6') {
        e.preventDefault();
        if (draft?.cart?.lines?.length > 0) {
          handleHoldBill();
        }
        return;
      }

      // F8 -> Proceed to Checkout
      if (e.key === 'F8') {
        e.preventDefault();
        if (draft?.cart?.lines?.length > 0 && !hasStockValidationError && !isCheckoutDisabled) {
          setPaymentModalOpen(true);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [draft, paymentModalOpen, quickCustModalOpen, pendingModalOpen, grandTotal]);

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
        setError(getFriendlyError(res.error) || 'Failed to reprice cart for customer.');
      }
    } catch (err: any) {
      setError(getFriendlyError(err.message) || 'Error updating customer.');
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
    const val = barcodeInput.trim();
    if (!val || !draft) return;
    setError('');
    try {
      const res = await (window as any).smartVyapar.resolvePOSProductByBarcode({
        shopId,
        barcode: val,
        customerId: selectedCustomerId,
        draftDate: draft.invoiceDate
      });
      if (res.success && res.data) {
        // Add product to draft. The backend automatically increments quantity if already exists.
        const addRes = await (window as any).smartVyapar.addPOSDraftLine(draft.id, {
          productId: res.data.productId,
          quantity: 1,
          provisionalUnitPrice: res.data.sellingPrice,
          provisionalDiscountType: 'NONE',
          provisionalDiscountValue: 0
        });
        if (addRes.success) {
          setDraft(addRes.data);
          setCheckoutToken(Date.now().toString());
          setBarcodeInput('');
          // Maintain focus
          barcodeInputRef.current?.focus();
        } else {
          setError(getFriendlyError(addRes.error) || 'Failed to add product.');
        }
      } else {
        const friendly = res.error === 'PRODUCT_NOT_FOUND' 
          ? 'Product not found for scanned barcode.' 
          : (getFriendlyError(res.error) || 'Barcode could not be resolved.');
        setError(friendly);
      }
    } catch (err: any) {
      setError(getFriendlyError(err.message) || 'Barcode resolution failed.');
    }
  };

  // Add Product to Cart from Search Results
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
        barcodeInputRef.current?.focus();
      } else {
        setError(getFriendlyError(res.error) || 'Failed to add product.');
      }
    } catch (err: any) {
      setError(getFriendlyError(err.message) || 'Error adding product.');
    }
  };

  // Update line quantity or discount
  const handleLineChange = async (lineId: string, qty: number, price: number, discType: string, discVal: number) => {
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
        setError(getFriendlyError(res.error) || 'Failed to update item details.');
      }
    } catch (err: any) {
      setError(getFriendlyError(err.message) || 'Error updating line.');
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
        setError(getFriendlyError(res.error) || 'Failed to remove product.');
      }
    } catch (err: any) {
      setError(getFriendlyError(err.message) || 'Error removing line.');
    }
  };

  // Quick Customer Submit
  const handleCreateQuickCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustError('');
    if (!custName.trim()) {
      setCustError('CUSTOMER_NAME_REQUIRED');
      return;
    }
    if (!custPhone.trim()) {
      setCustError('INVALID_MOBILE');
      return;
    }
    setCustSaving(true);
    try {
      const res = await (window as any).smartVyapar.createCustomer({
        name: custName.trim(),
        phone: custPhone.trim(),
        email: custEmail.trim() || undefined,
        gstNumber: custGst.trim() || undefined,
        billingAddressLine1: custAddress.trim() || undefined,
        customerType: 'RETAIL',
        requireUniquePhone: true,
        isQuick: true
      });
      if (res.success && res.data) {
        const newCust = res.data;
        // Close modal and refresh customer select list with newly selected id
        setQuickCustModalOpen(false);
        setCustName('');
        setCustPhone('');
        setCustEmail('');
        setCustGst('');
        setCustAddress('');
        await loadCustomers(newCust.id);
      } else {
        setCustError(getFriendlyError(res.error) || 'Failed to create customer.');
      }
    } catch (err: any) {
      setCustError(getFriendlyError(err.message) || 'Error creating customer.');
    } finally {
      setCustSaving(false);
    }
  };

  // Save draft cart state
  const handleSaveDraft = async () => {
    if (!draft) return;
    setError('');
    try {
      const saveRes = await (window as any).smartVyapar.savePOSDraft(draft.id, {
        customerId: selectedCustomerId,
        invoiceDate: draft.invoiceDate,
        dueDate: draft.dueDate,
        invoiceDiscountType: draft.cart.invoiceDiscountType,
        invoiceDiscountValue: draft.cart.invoiceDiscountValue,
        notes: draft.notes,
        lines: draft.cart.lines.map((l: any) => ({
          productId: l.productId,
          quantity: l.quantity,
          provisionalUnitPrice: l.unitPrice,
          provisionalDiscountType: l.discountType,
          provisionalDiscountValue: l.discountValue
        }))
      });
      if (saveRes.success) {
        const savedRef = draft.draftReference;
        await initializePOS();
        alert(`Draft saved successfully! Reference: ${savedRef}`);
      } else {
        setError(getFriendlyError(saveRes.error) || 'Failed to save draft.');
      }
    } catch (err: any) {
      setError(getFriendlyError(err.message) || 'Error saving draft.');
    }
  };

  // Hold current bill
  const handleHoldBill = async () => {
    if (!draft) return;
    if (draft.cart.lines.length === 0) {
      setError('Cannot hold an empty cart.');
      return;
    }
    setError('');
    try {
      // 1. Save draft payload first
      const saveRes = await (window as any).smartVyapar.savePOSDraft(draft.id, {
        customerId: selectedCustomerId,
        invoiceDate: draft.invoiceDate,
        dueDate: draft.dueDate,
        invoiceDiscountType: draft.cart.invoiceDiscountType,
        invoiceDiscountValue: draft.cart.invoiceDiscountValue,
        notes: draft.notes,
        lines: draft.cart.lines.map((l: any) => ({
          productId: l.productId,
          quantity: l.quantity,
          provisionalUnitPrice: l.unitPrice,
          provisionalDiscountType: l.discountType,
          provisionalDiscountValue: l.discountValue
        }))
      });
      if (saveRes.success) {
        // 2. Mark draft as HELD
        const holdRes = await (window as any).smartVyapar.holdPOSDraft(draft.id, shopId);
        if (holdRes.success) {
          const heldRef = draft.draftReference;
          await initializePOS();
          alert(`Bill held successfully! Reference: ${heldRef}`);
        } else {
          setError(getFriendlyError(holdRes.error) || 'Failed to hold bill.');
        }
      } else {
        setError(getFriendlyError(saveRes.error) || 'Failed to save draft before holding.');
      }
    } catch (err: any) {
      setError(getFriendlyError(err.message) || 'Error holding bill.');
    }
  };

  // Clear cart items safely
  const handleClearCart = async () => {
    if (!draft) return;
    if (draft.cart.lines.length === 0) return;
    if (window.confirm('Are you sure you want to clear all items in the current cart?')) {
      setError('');
      try {
        const saveRes = await (window as any).smartVyapar.savePOSDraft(draft.id, {
          customerId: selectedCustomerId,
          invoiceDate: draft.invoiceDate,
          dueDate: draft.dueDate,
          invoiceDiscountType: 'NONE',
          invoiceDiscountValue: 0,
          notes: draft.notes,
          lines: []
        });
        if (saveRes.success) {
          setDraft(saveRes.data);
          setCheckoutToken(Date.now().toString());
        } else {
          setError(getFriendlyError(saveRes.error) || 'Failed to clear cart items.');
        }
      } catch (err: any) {
        setError(getFriendlyError(err.message) || 'Error clearing cart.');
      }
    }
  };

  // Delete draft safely
  const handleDeleteDraft = async (id: string, refName: string) => {
    if (window.confirm(`Are you sure you want to permanently delete this draft (${refName})? This action cannot be undone.`)) {
      setError('');
      try {
        const res = await (window as any).smartVyapar.deletePOSDraft(id, shopId);
        if (res.success) {
          if (draft && draft.id === id) {
            await initializePOS();
          } else if (pendingModalOpen) {
            await loadPendingBills();
          }
          alert(`Draft ${refName} deleted.`);
        } else {
          setError(getFriendlyError(res.error) || 'Failed to delete draft.');
        }
      } catch (err: any) {
        setError(getFriendlyError(err.message) || 'Error deleting draft.');
      }
    }
  };

  // Open Pending Bills Panel
  const handleOpenPendingBills = async () => {
    setError('');
    await loadPendingBills();
    setPendingModalOpen(true);
  };

  const loadPendingBills = async () => {
    const res = await (window as any).smartVyapar.listHeldPOSBills(shopId);
    if (res.success) {
      setPendingBills(res.data || []);
    }
  };

  // Resume Pending Bill
  const handleResumeBill = async (billId: string, status: string) => {
    setError('');
    try {
      let res;
      if (status === 'HELD') {
        res = await (window as any).smartVyapar.resumePOSDraft(billId, shopId);
      } else {
        res = await (window as any).smartVyapar.getPOSDraft(billId, shopId);
      }

      if (res.success && res.data) {
        setDraft(res.data);
        setSelectedCustomerId(res.data.customerId);
        setCheckoutToken(Date.now().toString());
        setPendingModalOpen(false);
        resetPayments();
        // Focus scanner
        setTimeout(() => barcodeInputRef.current?.focus(), 100);
      } else {
        setError(getFriendlyError(res.error) || 'Failed to resume bill.');
      }
    } catch (err: any) {
      setError(getFriendlyError(err.message) || 'Error resuming bill.');
    }
  };

  // Selector for Payment Mode
  const handlePaymentModeSelect = (mode: 'CASH' | 'UPI' | 'CARD' | 'CREDIT' | 'MIXED') => {
    setPaymentMode(mode);
  };

  // Total Summary Stats
  const totalItemsCount = draft?.cart?.lines?.length || 0;
  const totalQuantitySum = draft?.cart?.lines?.reduce((sum: number, line: any) => sum + line.quantity, 0) || 0;
  
  // Stock Insufficient validations
  const hasStockValidationError = draft?.cart?.lines?.some(
    (line: any) => line.productTypeSnapshot === 'GOODS' && line.quantity > line.advisoryStock
  );

  // Calculate live balances
  const totalAllocated = cashAmount + cardAmount + upiAmount + creditAmount;
  const remaining = grandTotal - totalAllocated;

  const currentCustomer = customers.find(c => c.id === selectedCustomerId);
  const isWalkIn = Boolean(
    currentCustomer?.isWalkIn ||
    currentCustomer?.customerType === 'WALK_IN' ||
    currentCustomer?.customerCode === 'WALK-IN' ||
    currentCustomer?.customerCode === 'WALKIN'
  );

  // Validation Checks for Proceed to Checkout
  const isCartEmpty = totalItemsCount === 0;
  const hasInvalidQuantity = draft?.cart?.lines?.some((line: any) => line.quantity <= 0 || !Number.isFinite(line.quantity));
  const hasInvalidDiscount = draft?.cart?.lines?.some((line: any) => {
    if (line.discountType === 'PERCENT') {
      return line.discountValue < 0 || line.discountValue > 100;
    }
    if (line.discountType === 'AMOUNT') {
      return line.discountValue < 0 || line.discountValue > (line.unitPrice * line.quantity);
    }
    return false;
  });

  const isCheckoutDisabled = isCartEmpty || hasStockValidationError || hasInvalidQuantity || hasInvalidDiscount;

  // Resolve human-readable checkout disabled reason
  const getCheckoutBlockReason = (): string => {
    if (isCartEmpty) return 'Cart is empty.';
    if (hasStockValidationError) {
      const blockedItem = draft?.cart?.lines?.find((line: any) => line.productTypeSnapshot === 'GOODS' && line.quantity > line.advisoryStock);
      return `Insufficient stock for ${blockedItem?.productNameSnapshot}. Requested: ${blockedItem?.quantity} | Available: ${blockedItem?.advisoryStock}`;
    }
    if (hasInvalidQuantity) return 'Enter a valid quantity.';
    if (hasInvalidDiscount) return 'Fix invalid discount before checkout.';
    return '';
  };

  // Generate UPI URI using dynamic upiAmount
  const generateUpiUri = () => {
    if (!shop?.merchantUpiId) return '';
    const pa = encodeURIComponent(shop.merchantUpiId);
    const pn = encodeURIComponent(shop.name || 'Smart Vyapar Shop');
    const am = upiAmount.toFixed(2);
    const tr = draft?.draftReference || 'checkout-ref';
    const tn = encodeURIComponent(`POS Bill ${draft?.draftReference || ''}`);
    return `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=INR&tr=${tr}&tn=${tn}`;
  };

  // Persist post sale transaction
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
        setError(getFriendlyError(res.error) || 'Transaction failed.');
      }
    } catch (err: any) {
      setError(getFriendlyError(err.message) || 'Error posting sale.');
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return (
      <div className="card-surface" style={{ padding: '3rem', textAlign: 'center', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)' }}>
        <div className="logo-box" style={{ margin: '0 auto 1rem auto' }}>🔄</div>
        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Initializing POS Checkout...</span>
      </div>
    );
  }

  if (successInvoice) {
    return (
      <div className="card-surface" style={{ maxWidth: '600px', margin: '2rem auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '2.5rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: '3rem' }}>🎉</div>
        <h2 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700 }}>Sale Posted Successfully!</h2>
        <div style={{ background: 'var(--bg-app)', padding: '1.5rem', borderRadius: 'var(--radius-md)', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid var(--border-color)' }}>
          <div><strong style={{ color: 'var(--text-secondary)' }}>Invoice Number:</strong> <span style={{ color: 'var(--color-success)', fontFamily: 'monospace', fontSize: '1.25rem', fontWeight: 700 }}>{successInvoice.invoiceNumber}</span></div>
          <div><strong style={{ color: 'var(--text-secondary)' }}>Draft Reference:</strong> <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{successInvoice.draftReference}</span></div>
          <div><strong style={{ color: 'var(--text-secondary)' }}>Date:</strong> <span style={{ color: 'var(--text-primary)' }}>{successInvoice.postedAt?.slice(0, 10) || successInvoice.invoiceDate}</span></div>
          <div><strong style={{ color: 'var(--text-secondary)' }}>Grand Total:</strong> <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Rs {successInvoice.grandTotal.toFixed(2)}</span></div>
          <div><strong style={{ color: 'var(--text-secondary)' }}>Paid Amount:</strong> <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Rs {successInvoice.paidAmount.toFixed(2)}</span></div>
          <div><strong style={{ color: 'var(--text-secondary)' }}>Outstanding Amount:</strong> <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Rs {successInvoice.outstandingAmount.toFixed(2)}</span></div>
          <div><strong style={{ color: 'var(--text-secondary)' }}>Payment Status:</strong> <span style={{ textTransform: 'uppercase', fontSize: '0.8rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: successInvoice.paymentStatus === 'PAID' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', color: successInvoice.paymentStatus === 'PAID' ? 'var(--color-success)' : 'var(--color-warning)' }}>{successInvoice.paymentStatus}</span></div>
        </div>
        <button type="button" className="app-btn btn-primary" style={{ padding: '0.75rem 1.5rem', fontWeight: 600 }} onClick={initializePOS}>New Transaction</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: '1rem', height: 'calc(100vh - 120px)' }}>
      {/* Catalog & Cart Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', paddingRight: '0.25rem' }}>
        
        {/* Customer Select, Compact Creation, Barcode scan, and Pending action */}
        <div className="card-surface" style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Customer:</span>
            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
              <select
                ref={customerSelectRef}
                id="customer-select"
                className="form-input"
                style={{ width: '180px', height: '36px', padding: '0 0.5rem', borderRadius: 'var(--radius-sm)' }}
                value={selectedCustomerId}
                onChange={e => handleCustomerChange(e.target.value)}
              >
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.isWalkIn || c.customerCode === 'WALKIN' || c.customerCode === 'WALK-IN' ? '(Walk-In)' : `(${c.customerCode})`}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="app-btn"
                title="Create Quick Customer"
                style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', border: '1px solid var(--color-primary)', height: '36px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, padding: '0 0.5rem', borderRadius: 'var(--radius-sm)' }}
                onClick={() => {
                  setCustError('');
                  setQuickCustModalOpen(true);
                }}
              >
                ➕ Quick Customer
              </button>
            </div>
          </div>

          <form onSubmit={handleBarcodeSubmit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Barcode Scan:</span>
            <input
              ref={barcodeInputRef}
              id="barcode-input"
              type="text"
              className="form-input"
              placeholder="Scan barcode/SKU (F2)"
              style={{ width: '180px', height: '36px', borderRadius: 'var(--radius-sm)' }}
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
            />
          </form>

          <button
            type="button"
            className="app-btn"
            style={{ background: 'var(--color-info-light)', color: 'var(--color-info)', border: '1px solid var(--color-info)', height: '36px', fontWeight: 600, padding: '0 0.75rem', borderRadius: 'var(--radius-sm)' }}
            onClick={handleOpenPendingBills}
          >
            📋 Pending Bills
          </button>
        </div>

        {/* Product Catalog Lookup */}
        <div className="card-surface" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search product code, SKU, name, or barcode..."
            style={{ height: '38px', borderRadius: 'var(--radius-sm)' }}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />

          {searchResults.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem', maxHeight: '180px', overflowY: 'auto', padding: '0.5rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              {searchResults.map(p => (
                <div
                  key={p.productId}
                  className="catalog-item"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'all 0.15s ease' }}
                  onClick={() => handleAddProduct(p.productId, p.sellingPrice)}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{p.productName}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Stock: {p.currentStock} {p.unitName}</span>
                  </div>
                  <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>Rs {p.sellingPrice.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart items list */}
        <div className="card-surface" style={{ flexGrow: 1, padding: '1rem', display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: 700 }}>
              Cart Items ({totalItemsCount} items, {totalQuantitySum} qty)
            </h3>
            {draft?.draftReference && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', background: 'var(--bg-app)', padding: '3px 8px', borderRadius: '4px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Ref: {draft.draftReference} ({draft.status})
                </span>
                <button
                  type="button"
                  className="app-btn"
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', background: 'var(--color-error-bg)', color: 'var(--color-error)', border: '1px solid var(--color-error)', borderRadius: '4px' }}
                  onClick={() => handleDeleteDraft(draft.id, draft.draftReference)}
                >
                  Delete Draft
                </button>
              </div>
            )}
          </div>
          {error && <div className="inline-error" style={{ marginBottom: '1rem', background: 'var(--color-error-bg)', color: 'var(--color-error)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>{error}</div>}
          
          <div className="table-scroll" style={{ flexGrow: 1, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Rate</th>
                  <th style={{ width: '80px' }}>Qty</th>
                  <th>Available</th>
                  <th>GST %</th>
                  <th style={{ width: '130px' }}>Discount</th>
                  <th>Taxable Amt</th>
                  <th>CGST</th>
                  <th>SGST</th>
                  <th style={{ textAlign: 'right' }}>Line Total</th>
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {draft?.cart?.lines.map((line: any) => {
                  const isGoods = line.productTypeSnapshot === 'GOODS';
                  const isStockInsufficient = isGoods && line.quantity > line.advisoryStock;

                  return (
                    <tr key={line.id} style={{ background: isStockInsufficient ? 'var(--color-error-bg)' : 'transparent' }}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{line.productNameSnapshot}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Code: {line.productCodeSnapshot}</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-primary)' }}>Rs {line.unitPrice.toFixed(2)}</td>
                      <td>
                        <input
                          type="number"
                          className="form-input"
                          style={{ width: '70px', padding: '0.25rem', border: isStockInsufficient ? '1px solid var(--color-error)' : '1px solid var(--border-color)' }}
                          value={line.quantity}
                          onChange={e => handleLineChange(line.id, Number(e.target.value), line.unitPrice, line.discountType, line.discountValue)}
                          min={line.allowsDecimalQuantity ? "0.001" : "1"}
                          step={line.allowsDecimalQuantity ? "0.001" : "1"}
                        />
                      </td>
                      <td style={{ color: isStockInsufficient ? 'var(--color-error)' : 'var(--text-primary)', fontWeight: isStockInsufficient ? 700 : 500 }}>
                        {isGoods ? (
                          isStockInsufficient ? (
                            <div style={{ fontSize: '0.8rem' }}>
                              Available: {line.advisoryStock}<br/>
                              Requested: {line.quantity}
                            </div>
                          ) : (
                            line.advisoryStock
                          )
                        ) : (
                          'N/A (Svc)'
                        )}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{line.taxRateSnapshot}%</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                          <select
                            className="form-input"
                            style={{ width: '55px', padding: '0.25rem', height: '28px', fontSize: '0.75rem' }}
                            value={line.discountType}
                            onChange={e => {
                              const newType = e.target.value;
                              let newVal = 0;
                              if (newType === 'PERCENT') {
                                newVal = Math.min(100, Math.max(0, line.discountValue));
                              } else if (newType === 'AMOUNT') {
                                newVal = Math.min(line.unitPrice * line.quantity, Math.max(0, line.discountValue));
                              }
                              handleLineChange(line.id, line.quantity, line.unitPrice, newType, newVal);
                            }}
                          >
                            <option value="NONE">None</option>
                            <option value="PERCENT">%</option>
                            <option value="AMOUNT">₹</option>
                          </select>
                          
                          {line.discountType !== 'NONE' && (
                            <input
                              type="number"
                              className="form-input"
                              style={{ width: '50px', padding: '0.25rem', height: '28px', fontSize: '0.75rem' }}
                              value={line.discountType === 'AMOUNT' ? (line.discountValue * line.quantity) : line.discountValue}
                              onChange={e => {
                                let val = Number(e.target.value);
                                let newVal = val;
                                if (line.discountType === 'PERCENT') {
                                  newVal = Math.min(100, Math.max(0, val));
                                } else if (line.discountType === 'AMOUNT') {
                                  // Validate flat amount against allowable line discount total (quantity * unitPrice)
                                  const maxDiscount = line.unitPrice * line.quantity;
                                  val = Math.min(maxDiscount, Math.max(0, val));
                                  // Save in database as per-unit discount
                                  newVal = val / line.quantity;
                                }
                                handleLineChange(line.id, line.quantity, line.unitPrice, line.discountType, newVal);
                              }}
                              min="0"
                              max={line.discountType === 'PERCENT' ? "100" : (line.unitPrice * line.quantity)}
                              step="0.01"
                            />
                          )}
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-primary)' }}>Rs {line.taxableAmount.toFixed(2)}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>Rs {line.cgstAmount.toFixed(2)}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>Rs {line.sgstAmount.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>Rs {line.lineTotal.toFixed(2)}</td>
                      <td>
                        <button
                          type="button"
                          className="app-btn"
                          style={{ padding: '0.25rem 0.5rem', background: 'var(--color-error-bg)', color: 'var(--color-error)', border: 'none', borderRadius: 'var(--radius-xs)' }}
                          onClick={() => handleRemoveLine(line.id)}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {(!draft?.cart?.lines || draft.cart.lines.length === 0) && (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                      Cart is empty. Add products or scan barcode (F2) to start.
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
        
        {/* Customer outstanding card */}
        {!isWalkIn && currentCustomer && (
          <div className="card-surface" style={{ padding: '0.75rem 1rem', background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#92400E' }}>CUSTOMER LEDGER SUMMARY</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#78350F' }}>
              <span>Code: <strong>{currentCustomer.customerCode}</strong></span>
              <span>Outstanding: <strong>Rs {currentCustomer.outstanding?.toFixed(2) || '0.00'}</strong></span>
            </div>
          </div>
        )}

        <div className="card-surface" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', color: 'var(--text-primary)', fontWeight: 700 }}>Order Summary</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Items Count:</span><span style={{ fontWeight: 600 }}>{totalItemsCount}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Total Qty:</span><span style={{ fontWeight: 600 }}>{totalQuantitySum}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color)', paddingTop: '0.5rem' }}><span>Subtotal:</span><span>Rs {draft?.cart?.subtotal?.toFixed(2) || '0.00'}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-warning)' }}><span>Discount:</span><span>-Rs {draft?.cart?.lineDiscountTotal?.toFixed(2) || '0.00'}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>CGST Total:</span><span>Rs {draft?.cart?.cgstTotal?.toFixed(2) || '0.00'}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>SGST Total:</span><span>Rs {draft?.cart?.sgstTotal?.toFixed(2) || '0.00'}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Round Off:</span><span>Rs {draft?.cart?.roundOff?.toFixed(2) || '0.00'}</span></div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 800, borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.25rem', color: 'var(--color-primary)' }}>
              <span>GRAND TOTAL:</span>
              <span>Rs {draft?.cart?.grandTotal?.toFixed(2) || '0.00'}</span>
            </div>
          </div>

          {isCheckoutDisabled && (
            <div style={{ color: 'var(--color-error)', background: 'var(--color-error-bg)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: 600, border: '1px solid var(--color-error)' }}>
              ⚠️ {getCheckoutBlockReason()}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="app-btn btn-primary"
              style={{ width: '100%', padding: '0.85rem', fontWeight: 700, fontSize: '1.05rem', borderRadius: 'var(--radius-sm)' }}
              disabled={isCheckoutDisabled}
              onClick={() => setPaymentModalOpen(true)}
            >
              💳 Proceed to Checkout (F8)
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button
                type="button"
                className="app-btn"
                style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', padding: '0.5rem', fontSize: '0.8rem', fontWeight: 600 }}
                onClick={handleSaveDraft}
              >
                💾 Save Draft
              </button>
              <button
                type="button"
                className="app-btn"
                style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', padding: '0.5rem', fontSize: '0.8rem', fontWeight: 600 }}
                disabled={draft?.cart?.lines?.length === 0}
                onClick={handleHoldBill}
              >
                ⏳ Hold Bill (F6)
              </button>
            </div>
            
            <button
              type="button"
              className="app-btn"
              style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)', border: '1px solid var(--color-error)', padding: '0.5rem', fontSize: '0.8rem', fontWeight: 600 }}
              disabled={draft?.cart?.lines?.length === 0}
              onClick={handleClearCart}
            >
              🗑️ Clear Cart
            </button>
          </div>
        </div>
      </div>

      {/* Payment Allocation Modal */}
      {paymentModalOpen && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card-surface" style={{ width: '680px', display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.75rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-color)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>POS Checkout Payment Allocations</h3>
              <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-primary)' }}>Rs {grandTotal.toFixed(2)}</span>
            </div>

            {/* Selector tabs for payment mode */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.25rem', background: 'var(--bg-app)', padding: '0.25rem', borderRadius: 'var(--radius-sm)' }}>
              {(['CASH', 'UPI', 'CARD', 'CREDIT', 'MIXED'] as const).map(mode => {
                const isActive = paymentMode === mode;
                const isCreditBlocked = mode === 'CREDIT' && isWalkIn;

                return (
                  <button
                    key={mode}
                    type="button"
                    className="app-btn"
                    style={{
                      background: isActive ? 'var(--bg-surface)' : 'transparent',
                      color: isCreditBlocked ? 'var(--text-muted)' : isActive ? 'var(--color-primary)' : 'var(--text-secondary)',
                      boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                      fontWeight: 700,
                      padding: '0.5rem 0',
                      border: 'none',
                      opacity: isCreditBlocked ? 0.4 : 1,
                      cursor: isCreditBlocked ? 'not-allowed' : 'pointer',
                      borderRadius: 'var(--radius-xs)',
                      fontSize: '0.8rem'
                    }}
                    disabled={isCreditBlocked}
                    title={isCreditBlocked ? 'Walk-In Customer is blocked from using credit' : ''}
                    onClick={() => handlePaymentModeSelect(mode)}
                  >
                    {mode === 'MIXED' ? 'MIXED PAY' : mode}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              {/* Payment entries */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label className="form-group">
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>CASH Allocation</span>
                  <input
                    type="number"
                    className="form-input"
                    value={cashAmount === 0 ? '' : cashAmount}
                    onChange={e => {
                      const val = Math.max(0, Number(e.target.value));
                      setCashAmount(val);
                      if (paymentMode === 'CASH') setCashTendered(val);
                    }}
                    disabled={paymentMode !== 'MIXED'}
                    placeholder="0.00"
                    style={{ height: '36px' }}
                    min="0"
                  />
                </label>
                <label className="form-group">
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>CARD Allocation</span>
                  <input
                    type="number"
                    className="form-input"
                    value={cardAmount === 0 ? '' : cardAmount}
                    onChange={e => {
                      const val = Math.max(0, Number(e.target.value));
                      setCardAmount(val);
                    }}
                    disabled={paymentMode !== 'MIXED'}
                    placeholder="0.00"
                    style={{ height: '36px' }}
                    min="0"
                  />
                </label>
                <label className="form-group">
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>UPI Allocation</span>
                  <input
                    type="number"
                    className="form-input"
                    value={upiAmount === 0 ? '' : upiAmount}
                    onChange={e => {
                      const val = Math.max(0, Number(e.target.value));
                      setUpiAmount(val);
                      setUpiConfirmed(false);
                    }}
                    disabled={paymentMode !== 'MIXED'}
                    placeholder="0.00"
                    style={{ height: '36px' }}
                    min="0"
                  />
                </label>
                <label className="form-group" style={{ opacity: isWalkIn ? 0.4 : 1 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    CREDIT Allocation {isWalkIn && <span style={{ color: 'var(--color-error)', fontSize: '0.7rem' }}>(Walk-In Blocked)</span>}
                  </span>
                  <input
                    type="number"
                    className="form-input"
                    value={creditAmount === 0 ? '' : creditAmount}
                    onChange={e => {
                      const val = Math.max(0, Number(e.target.value));
                      setCreditAmount(val);
                    }}
                    disabled={paymentMode !== 'MIXED' || isWalkIn}
                    placeholder="0.00"
                    style={{ height: '36px' }}
                    min="0"
                  />
                </label>
              </div>

              {/* UPI QR / Confirmed Area or Cash Tender Helper */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', padding: '1rem', border: '1px solid var(--border-color)' }}>
                {paymentMode === 'CASH' ? (
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>💵 Cash Change Calculator</h4>
                    <label className="form-group">
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Received Amount / Tendered</span>
                      <input
                        type="number"
                        className="form-input"
                        value={cashTendered === 0 ? '' : cashTendered}
                        onChange={e => setCashTendered(Math.max(0, Number(e.target.value)))}
                        style={{ height: '36px' }}
                        min="0"
                      />
                    </label>
                    <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <span>Bill Payable:</span>
                        <span>Rs {grandTotal.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', borderTop: '1px dashed var(--border-color)', paddingTop: '4px' }}>
                        <span>Change to Return:</span>
                        <span style={{ color: (cashTendered - grandTotal) >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                          Rs {Math.max(0, cashTendered - grandTotal).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : upiAmount > 0 ? (
                  !shop?.merchantUpiId ? (
                    <div style={{ color: 'var(--color-error)', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, padding: '1rem' }}>
                      ⚠️ merchantUpiId is not configured in Shop Settings. UPI QR cannot be loaded.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
                      <UPIQRCode value={generateUpiUri()} size={150} />
                      <div style={{ textAlign: 'center', fontSize: '0.8rem' }}>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>UPI Amount: Rs {upiAmount.toFixed(2)}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>UPI ID: {shop.merchantUpiId}</div>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-sm)' }}>
                        <input
                          type="checkbox"
                          checked={upiConfirmed}
                          onChange={e => setUpiConfirmed(e.target.checked)}
                        />
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>Confirm Payment Received</span>
                      </label>
                    </div>
                  )
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
                    Enter an allocation in UPI mode to display the QR Code.
                  </div>
                )}
              </div>
            </div>

            {/* Live Allocations Display */}
            <div style={{ background: 'var(--bg-app)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center', fontSize: '0.85rem' }}>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>GRAND TOTAL</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>Rs {grandTotal.toFixed(2)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>TOTAL ALLOCATED</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>Rs {totalAllocated.toFixed(2)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>REMAINING BALANCE</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: remaining === 0 ? 'var(--color-success)' : remaining > 0 ? 'var(--color-warning)' : 'var(--color-error)' }}>
                  Rs {remaining.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Error notifications */}
            {upiAmount > 0 && !upiConfirmed && (
              <div style={{ color: 'var(--color-warning)', fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-warning-bg)', padding: '0.5rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--color-warning)', textAlign: 'center' }}>
                ⚠️ Please manually confirm the UPI payment to enable checkout.
              </div>
            )}

            {paymentMode === 'CASH' && cashTendered < grandTotal && (
              <div style={{ color: 'var(--color-error)', fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-error-bg)', padding: '0.5rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--color-error)', textAlign: 'center' }}>
                ❌ Tendered cash amount must be greater than or equal to the grand total.
              </div>
            )}

            {/* Verification Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.25rem' }}>
              <div style={{ fontSize: '0.85rem' }}>
                {remaining === 0 ? (
                  <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>✅ Exact payment allocated</span>
                ) : remaining > 0 ? (
                  <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>⚠️ Under-allocated (Needs Rs {remaining.toFixed(2)} more)</span>
                ) : (
                  <span style={{ color: 'var(--color-error)', fontWeight: 600 }}>❌ Over-allocated (Exceeds by Rs {Math.abs(remaining).toFixed(2)})</span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="app-btn"
                  style={{ padding: '0.5rem 1.25rem', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', fontWeight: 600 }}
                  onClick={() => setPaymentModalOpen(false)}
                >
                  Cancel (ESC)
                </button>
                <button
                  type="button"
                  className="app-btn btn-primary"
                  style={{ padding: '0.5rem 1.5rem', fontWeight: 700 }}
                  disabled={remaining !== 0 || posting || (upiAmount > 0 && !upiConfirmed) || (upiAmount > 0 && !shop?.merchantUpiId) || (paymentMode === 'CASH' && cashTendered < grandTotal)}
                  onClick={handlePostSale}
                >
                  {posting ? 'Posting...' : 'Post Sale'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compact Quick Customer Creation Modal */}
      {quickCustModalOpen && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div className="card-surface" style={{ width: '480px', display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.75rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-color)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>⚡ Create Quick Customer</h3>
              <button
                type="button"
                className="app-btn"
                style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', padding: '0.25rem', color: 'var(--text-secondary)', cursor: 'pointer' }}
                onClick={() => setQuickCustModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {custError && (
              <div style={{ color: 'var(--color-error)', background: 'var(--color-error-bg)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', fontWeight: 600, border: '1px solid var(--color-error)' }}>
                {custError === 'CUSTOMER_MOBILE_EXISTS' && '❌ CUSTOMER_MOBILE_EXISTS: Phone number is already assigned to another active customer.'}
                {custError === 'INVALID_MOBILE' && '❌ INVALID_MOBILE: Please enter a valid mobile number (6 to 20 digits).'}
                {custError === 'CUSTOMER_NAME_REQUIRED' && '❌ CUSTOMER_NAME_REQUIRED: Customer name is required.'}
                {custError !== 'CUSTOMER_MOBILE_EXISTS' && custError !== 'INVALID_MOBILE' && custError !== 'CUSTOMER_NAME_REQUIRED' && `❌ Error: ${custError}`}
              </div>
            )}

            <form onSubmit={handleCreateQuickCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label className="form-group">
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Customer Name *</span>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter customer name"
                  value={custName}
                  onChange={e => setCustName(e.target.value)}
                  style={{ height: '36px' }}
                  required
                />
              </label>

              <label className="form-group">
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Mobile Number *</span>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter phone number"
                  value={custPhone}
                  onChange={e => setCustPhone(e.target.value)}
                  style={{ height: '36px' }}
                  required
                />
              </label>

              <label className="form-group">
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Email</span>
                <input
                  type="email"
                  className="form-input"
                  placeholder="name@example.com"
                  value={custEmail}
                  onChange={e => setCustEmail(e.target.value)}
                  style={{ height: '36px' }}
                />
              </label>

              <label className="form-group">
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>GSTIN</span>
                <input
                  type="text"
                  className="form-input"
                  placeholder="15-character GSTIN"
                  value={custGst}
                  onChange={e => setCustGst(e.target.value)}
                  style={{ height: '36px' }}
                />
              </label>

              <label className="form-group">
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Billing Address</span>
                <textarea
                  className="form-input"
                  placeholder="Enter street, city, state address"
                  value={custAddress}
                  onChange={e => setCustAddress(e.target.value)}
                  style={{ height: '60px', padding: '0.5rem', resize: 'none' }}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="app-btn"
                  style={{ padding: '0.5rem 1.25rem', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', fontWeight: 600 }}
                  onClick={() => setQuickCustModalOpen(false)}
                  disabled={custSaving}
                >
                  Cancel (ESC)
                </button>
                <button
                  type="submit"
                  className="app-btn btn-primary"
                  style={{ padding: '0.5rem 1.5rem', fontWeight: 700 }}
                  disabled={custSaving}
                >
                  {custSaving ? 'Saving...' : 'Create & Select'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pending Bills Modal Panel */}
      {pendingModalOpen && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div className="card-surface" style={{ width: '780px', display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.75rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-color)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>📋 Pending Invoices & Held Bills</h3>
              <button
                type="button"
                className="app-btn"
                style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', padding: '0.25rem', color: 'var(--text-secondary)', cursor: 'pointer' }}
                onClick={() => setPendingModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* Tabs selection */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <button
                type="button"
                className="app-btn"
                style={{
                  background: pendingTab === 'DRAFT' ? 'var(--color-primary-light)' : 'transparent',
                  color: pendingTab === 'DRAFT' ? 'var(--color-primary)' : 'var(--text-secondary)',
                  borderBottom: pendingTab === 'DRAFT' ? '2px solid var(--color-primary)' : 'none',
                  padding: '0.5rem 1rem',
                  fontWeight: 700,
                  borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0'
                }}
                onClick={() => setPendingTab('DRAFT')}
              >
                Drafts ({pendingBills.filter(b => b.status === 'DRAFT').length})
              </button>
              <button
                type="button"
                className="app-btn"
                style={{
                  background: pendingTab === 'HELD' ? 'var(--color-primary-light)' : 'transparent',
                  color: pendingTab === 'HELD' ? 'var(--color-primary)' : 'var(--text-secondary)',
                  borderBottom: pendingTab === 'HELD' ? '2px solid var(--color-primary)' : 'none',
                  padding: '0.5rem 1rem',
                  fontWeight: 700,
                  borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0'
                }}
                onClick={() => setPendingTab('HELD')}
              >
                Held Bills ({pendingBills.filter(b => b.status === 'HELD').length})
              </button>
            </div>

            {/* List Table */}
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Date / Time</th>
                    <th>Customer</th>
                    <th>Lines</th>
                    <th>Total Qty</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ width: '130px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingBills.filter(b => b.status === pendingTab).map(b => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{b.draftReference}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {b.heldAt ? b.heldAt.slice(0, 16).replace('T', ' ') : b.createdAt?.slice(0, 16).replace('T', ' ')}
                      </td>
                      <td style={{ color: 'var(--text-primary)' }}>{b.customerName}</td>
                      <td>{b.lineCount}</td>
                      <td>{b.totalQty}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>Rs {b.provisionalTotal.toFixed(2)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="app-btn btn-primary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => handleResumeBill(b.id, b.status)}
                          >
                            Resume
                          </button>
                          <button
                            type="button"
                            className="app-btn"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: 'var(--color-error-bg)', color: 'var(--color-error)', border: '1px solid var(--color-error)' }}
                            onClick={() => handleDeleteDraft(b.id, b.draftReference)}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {pendingBills.filter(b => b.status === pendingTab).length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                        No pending {pendingTab.toLowerCase()} bills.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <button
                type="button"
                className="app-btn"
                style={{ padding: '0.5rem 1.5rem', fontWeight: 600 }}
                onClick={() => setPendingModalOpen(false)}
              >
                Close (ESC)
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
