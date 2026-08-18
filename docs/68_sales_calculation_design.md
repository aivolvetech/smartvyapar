# Phase 6: Sales Calculation Design

This document specifies the authoritative mathematical calculation engine for sales invoices in Smart Vyapar.

---

## 1. Precision and Arithmetic Strategy

To maintain maximum safety and consistency with existing modules:
- Money values are stored as `REAL` (floats) in SQLite database tables.
- All calculations are done using double-precision float math in JavaScript.
- Calculations must be explicitly rounded to exactly 2 decimal places (paise precision) at each step to prevent floating-point cumulative drift errors.

### The Rounding Utility
```typescript
function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
```

### Deterministic Test Verification
To eliminate decimal representation inaccuracies during automated testing, assertion assertions must convert decimals into integer paise:
```typescript
const actualOutstandingPaise = Math.round(actualOutstanding * 100);
const expectedOutstandingPaise = 10050; // equivalent to Rs 100.50
assert.strictEqual(actualOutstandingPaise, expectedOutstandingPaise);
```

---

## 2. Line-Level Formulas

For each line, let $Q$ be the quantity, $UP$ be the unit price, $D_{val}$ be the discount value, and $D_{type}$ be the discount type.

### A. Base Line Amount
$$\text{Line Base} = money(Q \times UP)$$

### B. Line Discount Amount ($D_{amt}$)
- If $D_{type}$ is `PERCENT`:
  $$D_{amt} = money(\text{Line Base} \times \frac{D_{val}}{100})$$
  *(Validation: $D_{val} \le 100$. Throw error if discount exceeds 100%.)*
- If $D_{type}$ is `AMOUNT`:
  $$D_{amt} = money(D_{val})$$
  *(Validation: $D_{amt} \le \text{Line Base}$.)*
- If $D_{type}$ is `NONE`:
  $$D_{amt} = 0$$

### C. Line Taxable Amount (Pre-Invoice Discount)
$$\text{Taxable}_{pre} = money(\text{Line Base} - D_{amt})$$

---

## 3. Invoice-Level Discount Allocation

Let $ID_{val}$ and $ID_{type}$ be the invoice-level discount parameters.

### A. Invoice Discount Total ($ID_{total}$)
$$\text{Invoice Taxable}_{pre} = \sum(\text{Line Taxable}_{pre})$$
- If $ID_{type}$ is `PERCENT`:
  $$ID_{total} = money(\text{Invoice Taxable}_{pre} \times \frac{ID_{val}}{100})$$
- If $ID_{type}$ is `AMOUNT`:
  $$ID_{total} = money(ID_{val})$$

### B. Proportional Distribution
The total invoice discount is distributed across lines proportionally based on their pre-discount taxable values. This is required for correct line-level GST reporting.

For line $i$:
$$\text{Share}_i = money(ID_{total} \times \frac{\text{Taxable}_{pre, i}}{\text{Invoice Taxable}_{pre}})$$

### C. Last-Line Rounding Adjustment
To ensure the sum of line shares exactly matches $ID_{total}$:
$$\text{Share}_{last} = money(ID_{total} - \sum_{i=1}^{n-1} \text{Share}_i)$$

### D. Final Line Taxable Amount
$$\text{Taxable}_{final, i} = money(\text{Line Taxable}_{pre, i} - \text{Share}_i)$$

---

## 4. Tax (GST & Cess) Calculations

Tax rates are loaded from `TaxRate`. Let $R$ be the tax rate snapshot (%), $CGST_{rate}$ and $SGST_{rate}$ be $R/2$ (for intra-state), $IGST_{rate}$ be $R$ (for inter-state), and $Cess_{rate}$ be the cess percentage.

For each line $i$:

### CGST Amount (Intra-State)
$$CGST_{amt, i} = money(\text{Taxable}_{final, i} \times \frac{CGST_{rate}}{100})$$

### SGST Amount (Intra-State)
$$SGST_{amt, i} = money(\text{Taxable}_{final, i} \times \frac{SGST_{rate}}{100})$$

### IGST Amount (Inter-State)
$$IGST_{amt, i} = money(\text{Taxable}_{final, i} \times \frac{IGST_{rate}}{100})$$

### Cess Amount
$$Cess_{amt, i} = money(\text{Taxable}_{final, i} \times \frac{Cess_{rate}}{100})$$

### Line Total
$$\text{Line Total}_i = money(\text{Taxable}_{final, i} + CGST_{amt, i} + SGST_{amt, i} + IGST_{amt, i} + Cess_{amt, i})$$

---

## 5. Invoice Totals and Round-Off

Sum up all lines:
- $\text{Subtotal} = money(\sum(Q_i \times UP_i))$
- $\text{Line Discount Total} = money(\sum(D_{amt, i}))$
- $\text{Taxable Amount} = money(\sum(\text{Taxable}_{final, i}))$
- $CGST_{total} = money(\sum(CGST_{amt, i}))$
- $SGST_{total} = money(\sum(SGST_{amt, i}))$
- $IGST_{total} = money(\sum(IGST_{amt, i}))$
- $Cess_{total} = money(\sum(Cess_{amt, i}))$

### Grand Total and Round-Off
Let $beforeRound = \text{Taxable Amount} + CGST_{total} + SGST_{total} + IGST_{total} + Cess_{total}$.
$$\text{Grand Total} = \text{Math.round}(beforeRound)$$
$$\text{Round Off} = money(\text{Grand Total} - beforeRound)$$

---

## 6. Calculation Validations
- Check for `NaN` or `Infinity` at any step and reject transaction.
- Line selling price must be validated: $UP \ge \text{minimumSellingPrice}$.
- Line price cannot exceed MRP: $UP \le MRP$.
- Negative value rejection: quantities, unit prices, MRPs, and discount values must be strictly greater than or equal to zero.
- Quantities can contain decimals ONLY if the associated `UnitOfMeasure.decimalAllowed` is 1, up to `UnitOfMeasure.decimalPlaces` fractional digits.
- Inactive product lines must be blocked from posting.
- Active TaxRates must be snapshotted at time of calculation.
- Fallback TaxRate: if taxRateId is missing, default to `NON_GST` with 0%.
- Exempt taxes (EXEMPT, ZERO_RATED, NON_GST) must override GST slab rates to 0% explicitly.
