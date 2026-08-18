export default function PurchaseSummary({ totals }: { totals: any }) {
  return (
    <div className="card-surface">
      <h3 style={{ marginTop: 0 }}>Purchase Summary</h3>
      {[
        ['Subtotal', totals?.subtotal || 0],
        ['Line Discount', totals?.lineDiscountTotal || 0],
        ['Invoice Discount', totals?.invoiceDiscountTotal || 0],
        ['Taxable', totals?.taxableAmount || 0],
        ['CGST', totals?.cgstTotal || 0],
        ['SGST', totals?.sgstTotal || 0],
        ['IGST', totals?.igstTotal || 0],
        ['Cess', totals?.cessTotal || 0],
        ['Round Off', totals?.roundOff || 0],
        ['Grand Total', totals?.grandTotal || 0],
      ].map(([k, v]) => <div className="info-row" key={k as string}><span className="info-key">{k}</span><span className="info-val">Rs {Number(v).toFixed(2)}</span></div>)}
    </div>
  );
}
