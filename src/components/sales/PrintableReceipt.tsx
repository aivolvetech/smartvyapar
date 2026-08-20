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

  // Format invoiceDate from yyyy-mm-dd to dd/mm/yyyy safely without timezone shifting
  const formattedInvoiceDate = invoice.invoiceDate 
    ? invoice.invoiceDate.split('-').reverse().join('/') 
    : '';

  return (
    <div className="printable-receipt-wrapper" style={{ 
      padding: '15px', 
      maxWidth: '380px', 
      margin: '0 auto', 
      background: 'white', 
      color: '#000',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      lineHeight: '1.4'
    }}>
      {/* Shop Header */}
      <div style={{ textAlign: 'center', marginBottom: '15px' }}>
        <h2 style={{ margin: '0 0 5px 0', fontSize: '18px', fontWeight: 'bold', color: '#000' }}>{shop?.name || 'Smart Vyapar Shop'}</h2>
        {shop?.address && <div style={{ fontSize: '12px', color: '#000' }}>{shop.address}</div>}
        {shop?.phone && <div style={{ fontSize: '12px', color: '#000' }}>Contact: {shop.phone}</div>}
        {shop?.gstNumber && <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#000' }}>GSTIN: {shop.gstNumber}</div>}
      </div>

      <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '12px 0' }} />

      {/* Invoice Meta */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', marginBottom: '12px', color: '#000' }}>
        <div>
          <div><strong>INVOICE NO:</strong> {invoice.invoiceNumber || invoice.draftReference}</div>
          <div><strong>DATE:</strong> {formattedInvoiceDate}</div>
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
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', margin: '12px 0', color: '#000' }}>
        <thead>
          <tr style={{ borderBottom: '1.5px solid #000' }}>
            <th style={{ padding: '4px 0', textAlign: 'left', fontWeight: 'bold', color: '#000' }}>Item Description</th>
            <th style={{ padding: '4px 0', textAlign: 'right', fontWeight: 'bold', color: '#000' }}>Qty</th>
            <th style={{ padding: '4px 0', textAlign: 'right', fontWeight: 'bold', color: '#000' }}>Rate</th>
            <th style={{ padding: '4px 0', textAlign: 'right', fontWeight: 'bold', color: '#000' }}>Disc</th>
            <th style={{ padding: '4px 0', textAlign: 'right', fontWeight: 'bold', color: '#000' }}>GST%</th>
            <th style={{ padding: '4px 0', textAlign: 'right', fontWeight: 'bold', color: '#000' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const taxPct = line.taxRateSnapshot || 0;
            return (
              <tr key={line.id} style={{ borderBottom: '1px dashed #000' }}>
                <td style={{ padding: '6px 0', textAlign: 'left', color: '#000' }}>
                  <div style={{ fontWeight: 'bold' }}>{line.productNameSnapshot}</div>
                  <div style={{ fontSize: '10px', color: '#000' }}>Code: {line.productCodeSnapshot}</div>
                </td>
                <td style={{ padding: '6px 0', textAlign: 'right', color: '#000' }}>{line.quantity}</td>
                <td style={{ padding: '6px 0', textAlign: 'right', color: '#000' }}>Rs {line.unitPrice.toFixed(2)}</td>
                <td style={{ padding: '6px 0', textAlign: 'right', color: '#000' }}>Rs {((line.discountAmount || 0) + (line.invoiceDiscountAllocation || 0)).toFixed(2)}</td>
                <td style={{ padding: '6px 0', textAlign: 'right', color: '#000' }}>{taxPct}%</td>
                <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 'bold', color: '#000' }}>Rs {line.lineTotal.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Summary Section */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '12px', marginTop: '12px', color: '#000' }}>
        <div style={{ width: '280px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#000' }}>
            <span>Subtotal:</span>
            <span>Rs {subtotal.toFixed(2)}</span>
          </div>
          {discountTotal > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#000', fontWeight: 'bold' }}>
              <span>Total Discount:</span>
              <span>- Rs {discountTotal.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#000' }}>
            <span>CGST total:</span>
            <span>Rs {(invoice.cgstTotal || 0).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#000' }}>
            <span>SGST total:</span>
            <span>Rs {(invoice.sgstTotal || 0).toFixed(2)}</span>
          </div>
          {invoice.roundOff !== 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#000' }}>
              <span>Round Off:</span>
              <span>Rs {invoice.roundOff.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: '1.5px solid #000', borderBottom: '1.5px solid #000', fontWeight: 'bold', fontSize: '14px', margin: '4px 0', color: '#000' }}>
            <span>Grand Total:</span>
            <span>Rs {invoice.grandTotal.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#000' }}>
            <span>Amount Paid:</span>
            <span>Rs {invoice.paidAmount.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontWeight: 'bold', color: '#000' }}>
            <span>Outstanding Due:</span>
            <span>Rs {invoice.outstandingAmount.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {payments.length > 0 && (
        <div style={{ marginTop: '15px', fontSize: '10px', color: '#000' }}>
          <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '5px', borderBottom: '1px solid #000', paddingBottom: '2px', color: '#000' }}>Payment History Summary:</div>
          {payments.map((p, idx) => (
            <div key={p.id || idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: '1px dashed #000', color: '#000' }}>
              <span>{new Date(p.createdAt || p.paymentDate).toLocaleDateString()} - {p.paymentMode} ({p.paymentSource})</span>
              <span style={{ fontWeight: 'bold' }}>Rs {p.amount.toFixed(2)} - [{p.status}]</span>
            </div>
          ))}
        </div>
      )}

      <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '15px 0' }} />

      <div style={{ textAlign: 'center', fontSize: '12px', fontWeight: 'bold', color: '#000' }}>
        Thank You for Shopping with Us!
      </div>
    </div>
  );
}
