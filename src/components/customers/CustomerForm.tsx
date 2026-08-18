import React, { useState, useEffect } from 'react';
import { Customer, CreateCustomerInput, CustomerType } from '../../../shared/models/customer';

interface FormProps {
  customer?: Customer; // if provided, we are in edit mode
  onSave: () => void;
  onCancel: () => void;
}

export default function CustomerForm({ customer, onSave, onCancel }: FormProps) {
  const isEdit = !!customer;

  // Form Fields
  const [customerCode, setCustomerCode] = useState(customer?.customerCode || '');
  const [name, setName] = useState(customer?.name || '');
  const [customerType, setCustomerType] = useState<CustomerType>(customer?.customerType || 'RETAIL');
  const [contactPerson, setContactPerson] = useState(customer?.contactPerson || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [alternatePhone, setAlternatePhone] = useState(customer?.alternatePhone || '');
  const [email, setEmail] = useState(customer?.email || '');
  const [gstNumber, setGstNumber] = useState(customer?.gstNumber || '');
  const [panNumber, setPanNumber] = useState(customer?.panNumber || '');
  
  // Addresses
  const [billingAddressLine1, setBillingAddressLine1] = useState(customer?.billingAddressLine1 || '');
  const [billingAddressLine2, setBillingAddressLine2] = useState(customer?.billingAddressLine2 || '');
  const [shippingAddressLine1, setShippingAddressLine1] = useState(customer?.shippingAddressLine1 || '');
  const [shippingAddressLine2, setShippingAddressLine2] = useState(customer?.shippingAddressLine2 || '');
  const [city, setCity] = useState(customer?.city || '');
  const [state, setState] = useState(customer?.state || '');
  const [postalCode, setPostalCode] = useState(customer?.postalCode || '');
  const [country, setCountry] = useState(customer?.country || 'India');

  // Terms & Limits
  const [paymentTermsDays, setPaymentTermsDays] = useState(customer?.paymentTermsDays ? String(customer.paymentTermsDays) : '0');
  const [creditLimit, setCreditLimit] = useState(customer?.creditLimit ? String(customer.creditLimit) : '0');
  const [priceBookId, setPriceBookId] = useState(customer?.priceBookId || '');
  const [notes, setNotes] = useState(customer?.notes || '');

  // UI state
  const [sameAddress, setSameAddress] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [phoneWarning, setPhoneWarning] = useState('');

  // Handle same address toggle
  const handleAddressToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setSameAddress(checked);
    if (checked) {
      setShippingAddressLine1(billingAddressLine1);
      setShippingAddressLine2(billingAddressLine2);
    }
  };

  // Keep shipping in sync if checkbox is checked
  useEffect(() => {
    if (sameAddress) {
      setShippingAddressLine1(billingAddressLine1);
      setShippingAddressLine2(billingAddressLine2);
    }
  }, [billingAddressLine1, billingAddressLine2, sameAddress]);

  // On Phone Blur check for warnings
  const handlePhoneBlur = async () => {
    setPhoneWarning('');
    const val = phone.trim();
    if (!val) return;

    try {
      const res = await (window as any).smartVyapar.getCustomers({ search: val, isActive: true });
      if (res.success && res.data.items) {
        // Find if any other customer has this exact phone
        const duplicates = res.data.items.filter((item: any) => {
          if (isEdit && item.id === customer?.id) return false;
          return item.phone?.trim() === val;
        });

        if (duplicates.length > 0) {
          setPhoneWarning(`Warning: Phone number is already used by active customer "${duplicates[0].name}".`);
        }
      }
    } catch (err) {
      console.error('Failed to run duplicate phone check', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Customer name is required.');
      return;
    }

    const payload: CreateCustomerInput = {
      customerCode: customerCode.trim() || undefined,
      name: name.trim(),
      customerType,
      contactPerson: contactPerson.trim() || undefined,
      phone: phone.trim() || undefined,
      alternatePhone: alternatePhone.trim() || undefined,
      email: email.trim() || undefined,
      gstNumber: gstNumber.trim() || undefined,
      panNumber: panNumber.trim() || undefined,
      billingAddressLine1: billingAddressLine1.trim() || undefined,
      billingAddressLine2: billingAddressLine2.trim() || undefined,
      shippingAddressLine1: shippingAddressLine1.trim() || undefined,
      shippingAddressLine2: shippingAddressLine2.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      postalCode: postalCode.trim() || undefined,
      country: country.trim() || 'India',
      paymentTermsDays: Number(paymentTermsDays) || 0,
      creditLimit: Number(creditLimit) || 0,
      priceBookId: priceBookId || undefined,
      notes: notes.trim() || undefined,
    };

    setSubmitting(true);
    try {
      let res;
      if (isEdit) {
        res = await (window as any).smartVyapar.updateCustomer(customer!.id, payload);
      } else {
        res = await (window as any).smartVyapar.createCustomer(payload);
      }

      if (res.success) {
        onSave();
      } else {
        setError(res.error || 'Failed to save customer details.');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred while saving.');
    } finally {
      setSubmitting(false);
    }
  };

  const isWalkIn = customer?.isWalkIn;

  return (
    <form onSubmit={handleSubmit} className="card-surface" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h3 style={{ margin: 0, fontSize: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        {isEdit ? `Edit Customer: ${customer?.name}` : 'New Customer Profile'}
      </h3>

      {error && <div className="inline-error">{error}</div>}

      {/* Basic Info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
        <div>
          <label className="form-label" htmlFor="cust-code">Customer Code</label>
          <input
            id="cust-code"
            type="text"
            className="form-input"
            placeholder="Auto-generated if empty"
            value={customerCode}
            onChange={e => setCustomerCode(e.target.value)}
            disabled={isEdit || submitting}
          />
        </div>

        <div>
          <label className="form-label" htmlFor="cust-name">Customer Name *</label>
          <input
            id="cust-name"
            type="text"
            className="form-input"
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={isWalkIn || submitting}
            required
          />
        </div>

        <div>
          <label className="form-label" htmlFor="cust-type">Customer Type</label>
          <select
            id="cust-type"
            className="form-input"
            value={customerType}
            onChange={e => setCustomerType(e.target.value as CustomerType)}
            disabled={isWalkIn || submitting}
            required
          >
            {isWalkIn ? (
              <option value="WALK_IN">Walk-In</option>
            ) : (
              <>
                <option value="RETAIL">Retail</option>
                <option value="WHOLESALE">Wholesale</option>
                <option value="DISTRIBUTOR">Distributor</option>
                <option value="CORPORATE">Corporate</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* Contact Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
        <div>
          <label className="form-label" htmlFor="cust-contact">Contact Person</label>
          <input
            id="cust-contact"
            type="text"
            className="form-input"
            value={contactPerson}
            onChange={e => setContactPerson(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div>
          <label className="form-label" htmlFor="cust-phone">Phone</label>
          <input
            id="cust-phone"
            type="text"
            className="form-input"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            onBlur={handlePhoneBlur}
            disabled={submitting}
          />
          {phoneWarning && <div style={{ color: '#fbbf24', fontSize: '0.8rem', marginTop: '0.25rem' }}>⚠️ {phoneWarning}</div>}
        </div>

        <div>
          <label className="form-label" htmlFor="cust-altphone">Alternate Phone</label>
          <input
            id="cust-altphone"
            type="text"
            className="form-input"
            value={alternatePhone}
            onChange={e => setAlternatePhone(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div>
          <label className="form-label" htmlFor="cust-email">Email</label>
          <input
            id="cust-email"
            type="email"
            className="form-input"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={submitting}
          />
        </div>
      </div>

      {/* Tax Registration */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
        <div>
          <label className="form-label" htmlFor="cust-gst">GSTIN</label>
          <input
            id="cust-gst"
            type="text"
            className="form-input"
            placeholder="e.g. 27AAAAA0000A1Z5"
            value={gstNumber}
            onChange={e => setGstNumber(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div>
          <label className="form-label" htmlFor="cust-pan">PAN</label>
          <input
            id="cust-pan"
            type="text"
            className="form-input"
            placeholder="e.g. AAAAA0000A"
            value={panNumber}
            onChange={e => setPanNumber(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div>
          <label className="form-label" htmlFor="cust-payment-terms">Credit Terms (Days)</label>
          <input
            id="cust-payment-terms"
            type="number"
            min="0"
            className="form-input"
            value={paymentTermsDays}
            onChange={e => setPaymentTermsDays(e.target.value)}
            disabled={isWalkIn || submitting}
          />
        </div>

        <div>
          <label className="form-label" htmlFor="cust-limit">Credit Limit (Rs)</label>
          <input
            id="cust-limit"
            type="number"
            min="0"
            step="0.01"
            className="form-input"
            value={creditLimit}
            onChange={e => setCreditLimit(e.target.value)}
            disabled={isWalkIn || submitting}
          />
        </div>
      </div>

      {/* Price Book & Notes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
        <div>
          <label className="form-label" htmlFor="cust-pricebook">Pricing Book (Optional)</label>
          <select
            id="cust-pricebook"
            className="form-input"
            value={priceBookId}
            onChange={e => setPriceBookId(e.target.value)}
            disabled={submitting}
          >
            <option value="">Default Price List</option>
            <option value="pricebook-default">pricebook-default</option>
          </select>
        </div>
        <div>
          <label className="form-label" htmlFor="cust-notes">Notes</label>
          <input
            id="cust-notes"
            type="text"
            className="form-input"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            disabled={submitting}
          />
        </div>
      </div>

      {/* Addresses */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem' }}>Address details</h4>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* Billing */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Billing Address</span>
            <input
              type="text"
              className="form-input"
              placeholder="Address Line 1"
              value={billingAddressLine1}
              onChange={e => setBillingAddressLine1(e.target.value)}
              disabled={submitting}
            />
            <input
              type="text"
              className="form-input"
              placeholder="Address Line 2"
              value={billingAddressLine2}
              onChange={e => setBillingAddressLine2(e.target.value)}
              disabled={submitting}
            />
          </div>

          {/* Shipping */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Shipping Address</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={sameAddress}
                  onChange={handleAddressToggle}
                  disabled={submitting}
                />
                Same as Billing
              </label>
            </div>
            <input
              type="text"
              className="form-input"
              placeholder="Address Line 1"
              value={shippingAddressLine1}
              onChange={e => setShippingAddressLine1(e.target.value)}
              disabled={sameAddress || submitting}
            />
            <input
              type="text"
              className="form-input"
              placeholder="Address Line 2"
              value={shippingAddressLine2}
              onChange={e => setShippingAddressLine2(e.target.value)}
              disabled={sameAddress || submitting}
            />
          </div>
        </div>

        {/* City, State, Postcode, Country */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <div>
            <label className="form-label" htmlFor="cust-city">City</label>
            <input
              id="cust-city"
              type="text"
              className="form-input"
              value={city}
              onChange={e => setCity(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="cust-state">State</label>
            <input
              id="cust-state"
              type="text"
              className="form-input"
              value={state}
              onChange={e => setState(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="cust-postcode">Postal Code</label>
            <input
              id="cust-postcode"
              type="text"
              className="form-input"
              value={postalCode}
              onChange={e => setPostalCode(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="cust-country">Country</label>
            <input
              id="cust-country"
              type="text"
              className="form-input"
              value={country}
              onChange={e => setCountry(e.target.value)}
              disabled={submitting}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
        <button type="button" className="app-btn" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="app-btn btn-primary" disabled={submitting}>
          {submitting ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </form>
  );
}
