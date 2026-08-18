# Phase 6: Sales Payment Design

This document details the sales payment mechanics, validation policies, and credit controls in Smart Vyapar.

---

## 1. SalesPayment Table Schema

```sql
CREATE TABLE "SalesPayment" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "salesInvoiceId" TEXT NOT NULL,
    "paymentMode"    TEXT NOT NULL,
    "amount"         REAL NOT NULL DEFAULT 0,
    "referenceNumber" TEXT,
    "paymentDate"    TEXT NOT NULL,
    "status"         TEXT NOT NULL DEFAULT 'CAPTURED',
    "notes"          TEXT,
    "idempotencyKey" TEXT UNIQUE,
    "createdAt"      TEXT NOT NULL,
    
    CHECK ("paymentMode" IN ('CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CREDIT')),
    CHECK ("status" IN ('CAPTURED', 'REVERSED')),
    CHECK ("amount" >= 0),
    FOREIGN KEY ("salesInvoiceId") REFERENCES "SalesInvoice"("id") ON DELETE CASCADE
);

CREATE INDEX "SalesPayment_salesInvoiceId_idx" ON "SalesPayment"("salesInvoiceId");
CREATE INDEX "SalesPayment_paymentMode_idx" ON "SalesPayment"("paymentMode");
CREATE INDEX "SalesPayment_status_idx" ON "SalesPayment"("status");
```

---

## 2. Payment Rules and Validations

### A. Mixed Payments
- An invoice can be paid using multiple payment methods (e.g., Rs 500 Cash + Rs 1000 UPI).
- Each mode creates a separate row in the `SalesPayment` table linked to the same `salesInvoiceId`.
- Immediate payment modes: `CASH`, `UPI`, `CARD`, `BANK_TRANSFER`.
- Credit payment mode: `CREDIT`.

### B. Cash Overpayment and Change Amount
- If the customer pays in Cash, they can hand over an amount exceeding the billing total.
- The POS system calculates change:
  $$\text{Change Amount} = \text{Cash Paid} - \text{Remaining Invoice Balance}$$
- The `SalesInvoice.changeAmount` is updated with this difference.
- The `SalesPayment` row for `CASH` must store only the *net* cash retained:
  $$\text{Net Cash Amount} = \text{Cash Paid} - \text{Change Amount}$$
- The sum of all `SalesPayment.amount` records (including Net Cash) must exactly equal `SalesInvoice.paidAmount`.
- `SalesInvoice.paidAmount` + `SalesInvoice.outstandingAmount` must equal `SalesInvoice.grandTotal`.

### C. Credit Restrictions and Limits
- **Walk-In Customers**:
  - The credit payment mode (`CREDIT`) is strictly BLOCKED for Walk-In Customers.
  - A Walk-In invoice must have `outstandingAmount = 0` and `paymentStatus = 'PAID'`.
  - Walk-In payments create **no** entries in the `CustomerLedgerEntry` table.
- **Registered Customers**:
  - Credit payments are allowed up to the customer's defined `creditLimit`.
  - Let $CO$ be the customer's current outstanding balance from `CustomerLedgerEntry`.
  - If $CO + \text{Requested Credit Amount} > \text{Customer.creditLimit}$:
    - The posting service must reject the invoice posting and raise a "Credit Limit Exceeded" error.
    - Exception: If `creditLimit = 0`, this check is skipped (unlimited credit allowed).

### D. Reference Requirements
- A `referenceNumber` (e.g. transaction ID, card swipe auth number) is mandatory for payment modes `UPI`, `CARD`, and `BANK_TRANSFER`.

### E. Payment Reversal Policy
- Hard deletion of payment records is forbidden once posted.
- When an invoice is cancelled:
  - Loop through existing `SalesPayment` records.
  - Update status of each record to `REVERSED`.
  - Create a reversing entry in the Customer activity ledger if a `CREDIT` payment was reversed.
  - Cash/Card/UPI immediate payments are marked `REVERSED` to show that the physical/digital payment must be refunded.
