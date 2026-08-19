import { SalesInvoiceDetail } from '../../../shared/models/sales';

interface Props {
  detail: SalesInvoiceDetail;
  shop: any;
  customer?: any;
}

export default function PrintableReceipt({ detail, shop, customer }: Props) {
  const { invoice, lines, payments = [] } = detail;

  const subtotal = invoice.subtotal || 0;
  const discountTotal = (invoice.lineDiscountTotal || 0) + (invoice.invoiceDiscountTotal || 0);

  return (
    <div className="printable-receipt-wrapper" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', background: 'white', color: 'black' }}>
      {/* Shop Header */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 5px 0', fontSize: '18px', fontWeight: 'bold' }}>{shop?.name || 'Smart Vyapar Shop'}</h2>
        {shop?.address && <div style={{ fontSize: '12px' }}>{shop.address}</div>}
        {shop?.phone && <div style={{ fontSize: '12px' }}>Contact: {shop.phone}</div>}
        {shop?.gstNumber && <div style={{ fontSize: '12px', fontWeight: 'bold' }}>GSTIN: {shop.gstNumber}</div>}
      </div>

      <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '15px 0' }} />

      {/* Invoice Meta */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px', marginBottom: '15px' }}>
        <div>
          <div><strong>INVOICE NO:</strong> {invoice.invoiceNumber || invoice.draftReference}</div>
          <div><strong>DATE:</strong> {new Date(invoice.invoiceDate).toLocaleDateString()}</div>
          <div><strong>STATUS:</strong> {invoice.status}</div>
        </div>
        <div>
          {customer ? (
            <>
              <div><strong>CUSTOMER:</strong> {customer.name}</div>
              {customer.customerCode && <div><strong>CODE:</strong> {customer.customerCode}</div>}
              {customer.phone && <div><strong>PHONE:</strong> {customer.phone}</div>}
              {customer.gstNumber && <div><strong>GSTIN:</strong> {customer.gstNumber}</div>}
            </>
          ) : (
            <div><strong>CUSTOMER:</strong> Walk-In Customer</div>
          )}
        </div>
      </div>

      {/* Line Items Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', margin: '15px 0' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #000' }}>
            <th style={{ padding: '4px 0', textAlign: 'left' }}>Item Description</th>
            <th style={{ padding: '4px 0', textAlign: 'right' }}>Qty</th>
            <th style={{ padding: '4px 0', textAlign: 'right' }}>Rate</th>
            <th style={{ padding: '4px 0', textAlign: 'right' }}>Disc</th>
            <th style={{ padding: '4px 0', textAlign: 'right' }}>GST%</th>
            <th style={{ padding: '4px 0', textAlign: 'right' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const taxPct = line.taxRateSnapshot || 0;
            return (
              <tr key={line.id} style={{ borderBottom: '1px dashed #ccc' }}>
                <td style={{ padding: '6px 0', textAlign: 'left' }}>
                  <div style={{ fontWeight: 'bold' }}>{line.productNameSnapshot}</div>
                  <div style={{ fontSize: '9px', color: '#555' }}>Code: {line.productCodeSnapshot}</div>
                </td>
                <td style={{ padding: '6px 0', textAlign: 'right' }}>{line.quantity}</td>
                <td style={{ padding: '6px 0', textAlign: 'right' }}>Rs {line.unitPrice.toFixed(2)}</td>
                <td style={{ padding: '6px 0', textAlign: 'right' }}>Rs {((line.discountAmount || 0) + (line.invoiceDiscountAllocation || 0)).toFixed(2)}</td>
                <td style={{ padding: '6px 0', textAlign: 'right' }}>{taxPct}%</td>
                <td style={{ padding: '6px 0', textAlign: 'right' }}>Rs {line.lineTotal.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Summary Section */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '12px', marginTop: '15px' }}>
        <div style={{ width: '280px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
            <span>Subtotal:</span>
            <span>Rs {subtotal.toFixed(2)}</span>
          </div>
          {discountTotal > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#16a34a' }}>
              <span>Total Discount:</span>
              <span>- Rs {discountTotal.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
            <span>CGST total:</span>
            <span>Rs {(invoice.cgstTotal || 0).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
            <span>SGST total:</span>
            <span>Rs {(invoice.sgstTotal || 0).toFixed(2)}</span>
          </div>
          {invoice.roundOff !== 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span>Round Off:</span>
              <span>Rs {invoice.roundOff.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: '1px solid #000', borderBottom: '1px solid #000', fontWeight: 'bold', fontSize: '13px', margin: '4px 0' }}>
            <span>Grand Total:</span>
            <span>Rs {invoice.grandTotal.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#2563eb' }}>
            <span>Amount Paid:</span>
            <span>Rs {invoice.paidAmount.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontWeight: 'bold', color: invoice.outstandingAmount > 0.001 ? '#dc2626' : 'inherit' }}>
            <span>Outstanding Due:</span>
            <span>Rs {invoice.outstandingAmount.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {payments.length > 0 && (
        <div style={{ marginTop: '20px', fontSize: '10px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '5px', borderBottom: '1px solid #000', paddingBottom: '2px' }}>Payment History Summary:</div>
          {payments.map((p, idx) => (
            <div key={p.id || idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: '1px dashed #eee' }}>
              <span>{new Date(p.createdAt || p.paymentDate).toLocaleString()} - {p.paymentMode} ({p.paymentSource})</span>
              <span style={{ fontWeight: 600 }}>Rs {p.amount.toFixed(2)} - [{p.status}]</span>
            </div>
          ))}
        </div>
      )}

      <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '20px 0' }} />

      <div style={{ textAlign: 'center', fontSize: '12px', fontWeight: '500', color: '#333' }}>
        Thank You for Shopping with Us!
      </div>
    </div>
  );
}
